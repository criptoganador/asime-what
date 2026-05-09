import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { db } from './db';
import { users, conversations, conversationParticipants, messages, contacts, statuses } from './db/schema';
import { eq, or, and, ilike, not, inArray, sql, gt } from 'drizzle-orm';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { AccessToken } from 'livekit-server-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const activeUsers = new Map<string, string>();

io.on('connection', (socket) => {
  socket.on('user_connected', (userId) => {
    activeUsers.set(userId, socket.id);
    (socket as any).userId = userId;
    socket.join(userId);
    io.emit('user_status_change', { userId, status: 'online' });
  });

  socket.on('join_chat', (chatId) => {
    socket.join(chatId);
  });

  socket.on('send_message', async (data) => {
    const { chatId, senderId, text, type, imageUrl, fileUrl, fileName, fileType, duration, replyToId } = data;
    try {
      const participants = await db.query.conversationParticipants.findMany({ 
        where: eq(conversationParticipants.conversationId, chatId) 
      });

      const otherParticipants = participants.filter(p => p.userId !== senderId);
      const isRecipientOnline = otherParticipants.some(p => activeUsers.has(p.userId));
      
      const [newMsg] = await db.insert(messages).values({
        conversationId: chatId,
        senderId,
        text,
        type: type || 'text',
        imageUrl,
        fileUrl,
        fileName,
        fileType,
        duration,
        replyToId,
        status: isRecipientOnline ? 'delivered' : 'sent'
      }).returning();

      participants.forEach(p => {
        io.to(p.userId).emit('receive_message', newMsg);
      });
    } catch (error) {
      console.error('Error al procesar mensaje socket:', error);
    }
  });

  socket.on('mark_messages_read', async ({ chatId, userId }) => {
    try {
      await db.update(messages)
        .set({ status: 'read' })
        .where(and(
          eq(messages.conversationId, chatId),
          not(eq(messages.senderId, userId)),
          or(eq(messages.status, 'sent'), eq(messages.status, 'delivered'))
        ));
      
      const participants = await db.query.conversationParticipants.findMany({ 
        where: eq(conversationParticipants.conversationId, chatId) 
      });
      
      participants.forEach(p => {
        io.to(p.userId).emit('messages_read', { chatId, readBy: userId });
      });
    } catch (error) {
      console.error('Error al marcar mensajes como leídos:', error);
    }
  });

  socket.on('user_typing', ({ chatId, userId }) => {
    socket.to(chatId).emit('user_typing', { chatId, userId });
  });

  socket.on('user_stop_typing', ({ chatId, userId }) => {
    socket.to(chatId).emit('user_stop_typing', { chatId, userId });
  });

  socket.on('add_reaction', async ({ chatId, messageId, emoji, userId }) => {
    io.to(chatId).emit('message_reaction', { chatId, messageId, emoji, userId });
  });

  socket.on('disconnect', () => {
    const userId = (socket as any).userId;
    if (userId) {
      activeUsers.delete(userId);
      io.emit('user_status_change', { userId, status: 'offline' });
    }
  });
});

app.post('/api/auth', async (req, res) => {
  const { phone, name, avatar, about } = req.body;
  try {
    let user = await db.query.users.findFirst({ where: eq(users.phone, phone) });
    if (!user) {
      const [newUser] = await db.insert(users).values({ phone, name, avatar, about }).returning();
      user = newUser;
    } else {
      const [updatedUser] = await db.update(users).set({ name, avatar, about }).where(eq(users.id, user.id)).returning();
      user = updatedUser;
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error en auth' });
  }
});

app.get('/api/users/check/:phone', async (req, res) => {
  const { phone } = req.params;
  try {
    const user = await db.query.users.findFirst({ where: eq(users.phone, phone) });
    res.json(user || null);
  } catch (error) {
    res.status(500).json({ error: 'Error al verificar usuario' });
  }
});

app.get('/api/get-livekit-token', async (req, res) => {
  const { roomName, participantName } = req.query;
  if (!roomName || !participantName) {
    return res.status(400).json({ error: 'Faltan parámetros roomName o participantName' });
  }

  const apiKey = 'APIkSHa5JALFdev';
  const apiSecret = 'WvyAyBfKY3EYcC9IXaiJ2oq9Z1Xkjp6f9Si1eWe0LjPA';

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName as string,
    });
    at.addGrant({ roomJoin: true, room: roomName as string, canPublish: true, canSubscribe: true });

    const token = await at.toJwt();
    res.json({ token });
  } catch (error) {
    console.error('LiveKit token error:', error);
    res.status(500).json({ error: 'Error al generar token de LiveKit' });
  }
});

app.get('/api/chats/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!userId || userId === 'undefined') return res.status(400).json({ error: 'ID de usuario no válido' });
  try {
    const userConvs = await db.query.conversationParticipants.findMany({ 
      where: eq(conversationParticipants.userId, userId) 
    });
    
    const convIds = userConvs.map(cp => cp.conversationId);
    if (convIds.length === 0) return res.json([]);

    const chatDetails = await db.query.conversations.findMany({ 
      where: inArray(conversations.id, convIds) 
    });

    const results = await Promise.all(chatDetails.map(async (conv) => {
      const lastMsg = await db.query.messages.findFirst({
        where: eq(messages.conversationId, conv.id),
        orderBy: (messages, { desc }) => [desc(messages.timestamp)]
      });
      
      const participants = await db.query.conversationParticipants.findMany({ 
        where: eq(conversationParticipants.conversationId, conv.id) 
      });
      
      const otherParticipantId = participants.find(p => p.userId !== userId)?.userId;
      const otherUser = otherParticipantId ? await db.query.users.findFirst({ where: eq(users.id, otherParticipantId) }) : null;

      const unreadCount = await db.query.messages.findMany({
        where: and(
          eq(messages.conversationId, conv.id),
          not(eq(messages.senderId, userId)),
          not(eq(messages.status, 'read'))
        )
      });

      return {
        id: conv.id,
        name: conv.isGroup ? conv.name : otherUser?.name || 'Usuario desconocido',
        avatar: conv.isGroup ? conv.avatar : otherUser?.avatar,
        lastMessage: lastMsg?.text || (lastMsg?.type === 'image' ? '📷 Imagen' : lastMsg?.type === 'audio' ? '🎤 Nota de voz' : ''),
        timestamp: lastMsg?.timestamp,
        unreadCount: unreadCount.length,
        isOnline: activeUsers.has(otherParticipantId || ''),
        isGroup: conv.isGroup,
        otherUserId: otherParticipantId
      };
    }));

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener chats' });
  }
});

app.get('/api/messages/:chatId', async (req, res) => {
  const { chatId } = req.params;
  try {
    const chatMessages = await db.query.messages.findMany({
      where: eq(messages.conversationId, chatId),
      orderBy: (messages, { asc }) => [asc(messages.timestamp)]
    });
    res.json(chatMessages);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

app.post('/api/conversations', async (req, res) => {
  const { participantIds } = req.body;
  try {
    const [newConv] = await db.insert(conversations).values({ isGroup: false }).returning();
    await db.insert(conversationParticipants).values(
      participantIds.map((uid: string) => ({ conversationId: newConv.id, userId: uid }))
    );
    res.json(newConv);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear conversación' });
  }
});

app.post('/api/groups', async (req, res) => {
  const { name, avatar, description, participantIds } = req.body;
  try {
    const [newGroup] = await db.insert(conversations).values({ name, avatar, description, isGroup: true }).returning();
    await db.insert(conversationParticipants).values(
      participantIds.map((uid: string, index: number) => ({
        conversationId: newGroup.id,
        userId: uid,
        role: index === 0 ? 'admin' : 'member'
      }))
    );
    res.json(newGroup);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear grupo' });
  }
});

app.get('/api/contacts/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!userId || userId === 'undefined') return res.status(400).json({ error: 'ID de usuario no válido' });
  try {
    const userContacts = await db.query.contacts.findMany({ where: eq(contacts.ownerId, userId) });
    const contactDetails = await Promise.all(userContacts.map(async (c) => {
      const user = await db.query.users.findFirst({ where: eq(users.id, c.contactId) });
      return { ...c, user };
    }));
    res.json(contactDetails);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener contactos' });
  }
});

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ imageUrl: `http://localhost:${port}/uploads/${req.file.filename}` });
});

app.post('/api/upload-file', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ fileUrl: `http://localhost:${port}/uploads/${req.file.filename}` });
});

app.post('/api/statuses', async (req, res) => {
  const { userId, type, content, backgroundColor } = req.body;
  try {
    const [newStatus] = await db.insert(statuses).values({ userId, type, content, backgroundColor }).returning();
    res.json(newStatus);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.get('/api/statuses/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const results = await db.query.statuses.findMany({ orderBy: (statuses, { desc }) => [desc(statuses.createdAt)] });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.get('/api/conversations/:id/participants', async (req, res) => {
  const { id } = req.params;
  try {
    const groupParticipants = await db.select({
      id: users.id, name: users.name, avatar: users.avatar, about: users.about, role: conversationParticipants.role
    }).from(conversationParticipants).innerJoin(users, eq(conversationParticipants.userId, users.id)).where(eq(conversationParticipants.conversationId, id));
    res.json(groupParticipants);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

httpServer.listen(port, () => {
  console.log(`🚀 Servidor Asicme Real-Time corriendo en http://localhost:${port}`);
});
