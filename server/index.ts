import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { db } from './db';
import { users, conversations, conversationParticipants, messages, contacts, statuses } from './db/schema';
import { eq, or, and, ilike, not, inArray, sql, gt, lt } from 'drizzle-orm';
import cron from 'node-cron';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { AccessToken } from 'livekit-server-sdk';
import rateLimit from 'express-rate-limit';

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

// Anti-Spam Nivel Enterprise: Rate Limiting para APIs REST
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 150, // Limita a 150 peticiones por IP cada 5 min
  message: { error: 'Demasiadas peticiones. Por favor, intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

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

// Anti-Spam Nivel Enterprise: Token Bucket para WebSockets
const socketRateLimits = new Map<string, { count: number, resetAt: number }>();
const MAX_MESSAGES_PER_WINDOW = 10;
const SPAM_WINDOW_MS = 5000; // 5 segundos

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
    
    // Anti-Spam Check
    const now = Date.now();
    let rateData = socketRateLimits.get(senderId) || { count: 0, resetAt: now + SPAM_WINDOW_MS };
    if (now > rateData.resetAt) {
      rateData = { count: 1, resetAt: now + SPAM_WINDOW_MS };
    } else {
      rateData.count += 1;
    }
    socketRateLimits.set(senderId, rateData);

    if (rateData.count > MAX_MESSAGES_PER_WINDOW) {
      socket.emit('spam_warning', { message: 'Has enviado demasiados mensajes. Espera unos segundos.' });
      return; // Bloquear mensaje
    }

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

  // Debounce para evitar inundar Neon con peticiones de "marcar como leído"
  const pendingReads = new Map<string, NodeJS.Timeout>();
  
  socket.on('mark_messages_read', ({ chatId, userId }) => {
    const key = `${chatId}-${userId}`;
    
    // Si ya hay una petición pendiente para este chat+usuario, la cancelamos
    if (pendingReads.has(key)) {
      clearTimeout(pendingReads.get(key)!);
    }
    
    // Esperamos 500ms antes de hacer la petición real (debounce)
    pendingReads.set(key, setTimeout(async () => {
      pendingReads.delete(key);
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
        // Silenciar errores de conexión temporales para no inundar la consola
        if (String(error).includes('fetch failed')) {
          console.warn('⚠️ Neon temporalmente inaccesible (mark_read). Reintentando...');
        } else {
          console.error('Error al marcar mensajes como leídos:', error);
        }
      }
    }, 500));
  });

  socket.on('user_typing', ({ chatId, userId }) => {
    socket.to(chatId).emit('user_typing', { chatId, userId });
  });

  socket.on('user_stop_typing', ({ chatId, userId }) => {
    socket.to(chatId).emit('user_stop_typing', { chatId, userId });
  });

  socket.on('add_reaction', async ({ chatId, messageId, emoji, userId }) => {
    try {
      const msg = await db.query.messages.findFirst({ where: eq(messages.id, messageId) });
      if (msg) {
        const reactions = (msg.reactions as Record<string, string[]>) || {};
        const users = reactions[emoji] || [];
        
        if (users.includes(userId)) {
          // Remove reaction
          reactions[emoji] = users.filter(id => id !== userId);
          if (reactions[emoji].length === 0) delete reactions[emoji];
        } else {
          // Add reaction
          reactions[emoji] = [...users, userId];
        }
        
        await db.update(messages).set({ reactions }).where(eq(messages.id, messageId));
      }
      io.to(chatId).emit('message_reaction', { chatId, messageId, emoji, userId });
    } catch (error) {
      console.error('Error al guardar reacción:', error);
    }
  });

  socket.on('delete_message', async ({ chatId, messageId, forEveryone, userId }) => {
    try {
      if (forEveryone) {
        await db.update(messages)
          .set({ isDeleted: true, text: 'Este mensaje fue eliminado', imageUrl: null, fileUrl: null, fileName: null, duration: null })
          .where(eq(messages.id, messageId));
      } else {
        const msg = await db.query.messages.findFirst({ where: eq(messages.id, messageId) });
        if (msg) {
          const deletedFor = (msg.deletedFor as string[]) || [];
          if (!deletedFor.includes(userId)) {
            deletedFor.push(userId);
            await db.update(messages).set({ deletedFor }).where(eq(messages.id, messageId));
          }
        }
      }
      io.to(chatId).emit('message_deleted', { chatId, messageId, forEveryone, userId });
    } catch (error) {
      console.error('Error al borrar mensaje:', error);
    }
  });

  socket.on('disconnect', async () => {
    const userId = (socket as any).userId;
    if (userId) {
      activeUsers.delete(userId);
      const now = new Date();
      try {
        await db.update(users).set({ lastSeen: now }).where(eq(users.id, userId));
      } catch (error) {
        console.error('Error al actualizar lastSeen:', error);
      }
      io.emit('user_status_change', { userId, status: 'offline', lastSeen: now.toISOString() });
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
    console.error('❌ Error en /api/auth:', error);
    res.status(500).json({ error: 'Error en auth' });
  }
});

app.get('/api/users/check/:phone', async (req, res) => {
  const { phone } = req.params;
  try {
    const decodedPhone = decodeURIComponent(phone);
    console.log('🔍 Buscando usuario con teléfono:', decodedPhone);
    const user = await db.query.users.findFirst({ where: eq(users.phone, decodedPhone) });
    res.json(user || null);
  } catch (error) {
    console.error('❌ Error en /api/users/check:', error);
    res.status(500).json({ error: 'Error al verificar usuario' });
  }
});

app.get('/api/users/search', async (req, res) => {
  const { query, currentUserId } = req.query;
  if (!query) return res.json([]);
  try {
    const results = await db.query.users.findMany({
      where: or(
        ilike(users.phone, `%${query}%`),
        ilike(users.name, `%${query}%`)
      )
    });
    // Excluir al usuario actual de los resultados
    const filtered = results.filter(u => u.id !== currentUserId);
    res.json(filtered);
  } catch (error) {
    console.error('❌ Error en /api/users/search:', error);
    res.status(500).json({ error: 'Error al buscar usuarios' });
  }
});

// Validar si un usuario sigue existiendo en la BD (para sesiones restauradas)
app.get('/api/users/validate/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const user = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!user) return res.status(404).json({ valid: false });
    res.json({ valid: true, user });
  } catch (error) {
    res.status(500).json({ valid: false, error: 'Error al validar usuario' });
  }
});

app.get('/api/get-livekit-token', async (req, res) => {
  const { roomName, participantName } = req.query;
  if (!roomName || !participantName) {
    return res.status(400).json({ error: 'Faltan parámetros roomName o participantName' });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: 'LiveKit no está configurado en las variables de entorno' });
  }

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
    // EL "SUPER-QUERY": Una sola consulta para traer todo lo necesario
    // 1. Unimos conversaciones con participantes
    // 2. Buscamos al "otro" participante para chats privados
    // 3. Subconsultas optimizadas para el último mensaje y contador de no leídos
    const chatsData = await db.execute(sql`
      SELECT 
        c.id, 
        c.is_group as "isGroup", 
        c.name as "groupName", 
        c.avatar as "groupAvatar",
        c.description,
        u.id as "otherUserId",
        u.name as "otherUserName",
        u.avatar as "otherUserAvatar",
        u.last_seen as "lastSeen",
        (
          SELECT COUNT(*)::int 
          FROM ${messages} m 
          WHERE m.conversation_id = c.id 
          AND m.sender_id != ${userId} 
          AND m.status != 'read'
        ) as "unreadCount",
        (
          SELECT m.text 
          FROM ${messages} m 
          WHERE m.conversation_id = c.id 
          ORDER BY m.timestamp DESC 
          LIMIT 1
        ) as "lastMessage",
        (
          SELECT m.type 
          FROM ${messages} m 
          WHERE m.conversation_id = c.id 
          ORDER BY m.timestamp DESC 
          LIMIT 1
        ) as "lastMessageType",
        (
          SELECT m.timestamp 
          FROM ${messages} m 
          WHERE m.conversation_id = c.id 
          ORDER BY m.timestamp DESC 
          LIMIT 1
        ) as "timestamp"
      FROM ${conversations} c
      JOIN ${conversationParticipants} cp ON cp.conversation_id = c.id
      LEFT JOIN ${conversationParticipants} cp_other ON cp_other.conversation_id = c.id AND cp_other.user_id != ${userId}
      LEFT JOIN ${users} u ON u.id = cp_other.user_id
      WHERE cp.user_id = ${userId}
      -- Para grupos, el LEFT JOIN de cp_other traerá varias filas, colapsamos por id de chat
      GROUP BY c.id, u.id
      ORDER BY "timestamp" DESC NULLS LAST
    `);

    // Procesamos los resultados para el formato que espera el frontend
    const results = chatsData.rows.map((row: any) => {
      const isGroup = row.isGroup;
      
      // Mapeo amigable para el último mensaje
      let lastMsgText = row.lastMessage || '';
      if (row.lastMessageType === 'image') lastMsgText = '📷 Imagen';
      else if (row.lastMessageType === 'audio') lastMsgText = '🎤 Nota de voz';
      else if (row.lastMessageType === 'video') lastMsgText = '🎥 Video';
      else if (row.lastMessageType === 'file') lastMsgText = '📄 Archivo';

      return {
        id: row.id,
        name: isGroup ? row.groupName : row.otherUserName || 'Usuario desconocido',
        avatar: isGroup ? row.groupAvatar : row.otherUserAvatar,
        description: row.description,
        lastMessage: lastMsgText,
        timestamp: row.timestamp,
        unreadCount: row.unreadCount || 0,
        isOnline: !isGroup && activeUsers.has(row.otherUserId || ''),
        lastSeen: row.lastSeen,
        isGroup: isGroup,
        otherUserId: row.otherUserId
      };
    });

    // Filtramos duplicados que puedan aparecer en grupos por el JOIN
    // (Aunque el GROUP BY ayuda, en chats 1-a-1 es limpio)
    const uniqueResults = results.reduce((acc: any[], current) => {
      const x = acc.find(item => item.id === current.id);
      if (!x) return acc.concat([current]);
      return acc;
    }, []);

    res.json(uniqueResults);
  } catch (error) {
    console.error('Error en Super-Query de chats:', error);
    res.status(500).json({ error: 'Error al obtener chats' });
  }
});

app.get('/api/messages/:chatId', async (req, res) => {
  const { chatId } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const userId = req.query.userId as string;
  
  try {
    const chatMessages = await db.query.messages.findMany({
      where: eq(messages.conversationId, chatId),
      orderBy: (messages, { desc }) => [desc(messages.timestamp)],
      limit,
      offset
    });
    
    // Filtrar los que este usuario borró solo para él
    const visibleMessages = chatMessages.filter(msg => {
      const deletedFor = (msg.deletedFor as string[]) || [];
      return !deletedFor.includes(userId);
    });

    res.json(visibleMessages.reverse());
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

app.post('/api/conversations', async (req, res) => {
  const { participantIds } = req.body;
  if (!participantIds || participantIds.length !== 2) {
    return res.status(400).json({ error: 'Se requieren exactamente 2 participantes para un chat 1-a-1' });
  }

  try {
    // 1. Buscar chats del usuario 1
    const user1Convs = await db.query.conversationParticipants.findMany({
      where: eq(conversationParticipants.userId, participantIds[0])
    });
    
    // 2. Buscar chats del usuario 2
    const user2Convs = await db.query.conversationParticipants.findMany({
      where: eq(conversationParticipants.userId, participantIds[1])
    });

    // 3. Encontrar IDs de conversaciones compartidas
    const sharedConvIds = user1Convs
      .map(cp => cp.conversationId)
      .filter(id => user2Convs.some(cp2 => cp2.conversationId === id));

    // 4. Verificar si alguna de las compartidas es un chat 1-a-1 (no grupo)
    if (sharedConvIds.length > 0) {
      const existingChat = await db.query.conversations.findFirst({
        where: and(
          inArray(conversations.id, sharedConvIds),
          eq(conversations.isGroup, false)
        )
      });

      if (existingChat) {
        // Si ya existe, devolvemos el existente en vez de crear uno nuevo
        return res.json(existingChat);
      }
    }

    // 5. Si no existe, creamos el chat nuevo
    const [newConv] = await db.insert(conversations).values({ isGroup: false }).returning();
    await db.insert(conversationParticipants).values(
      participantIds.map((uid: string) => ({ conversationId: newConv.id, userId: uid }))
    );
    res.json(newConv);
  } catch (error) {
    console.error('Error al crear/verificar conversación:', error);
    res.status(500).json({ error: 'Error al procesar la conversación' });
  }
});

app.delete('/api/conversations/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Eliminar dependencias primero (ya que no hay ON DELETE CASCADE en BD)
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversationParticipants).where(eq(conversationParticipants.conversationId, id));
    
    // Eliminar la conversación
    await db.delete(conversations).where(eq(conversations.id, id));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar conversación:', error);
    res.status(500).json({ error: 'Error al eliminar conversación' });
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

app.patch('/api/groups/:id', async (req, res) => {
  const { id } = req.params;
  const { name, avatar, description } = req.body;
  try {
    const [updatedGroup] = await db.update(conversations)
      .set({ name, avatar, description })
      .where(eq(conversations.id, id))
      .returning();
    res.json(updatedGroup);
  } catch (error) {
    console.error('Error al actualizar grupo:', error);
    res.status(500).json({ error: 'Error al actualizar grupo' });
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

app.post('/api/contacts', async (req, res) => {
  const { ownerId, contactId, nickname } = req.body;
  try {
    // Check if contact already exists
    const existing = await db.query.contacts.findFirst({
      where: and(eq(contacts.ownerId, ownerId), eq(contacts.contactId, contactId))
    });
    
    if (existing) {
      return res.status(400).json({ error: 'El contacto ya existe' });
    }

    const [newContact] = await db.insert(contacts).values({
      ownerId,
      contactId,
      nickname
    }).returning();
    
    res.json(newContact);
  } catch (error) {
    console.error('Error al crear contacto:', error);
    res.status(500).json({ error: 'Error al crear contacto' });
  }
});

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ imageUrl: `http://localhost:${port}/uploads/${req.file.filename}` });
});

app.get('/api/get-livekit-token', async (req, res) => {
  const { roomName, participantName } = req.query;
  
  if (!roomName || !participantName) {
    return res.status(400).json({ error: 'Faltan parámetros roomName o participantName' });
  }

  try {
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: participantName as string,
      }
    );
    at.addGrant({ 
      roomJoin: true, 
      room: roomName as string,
      canPublish: true,
      canSubscribe: true,
    });

    res.json({ token: await at.toJwt() });
  } catch (error) {
    console.error('Error generando token LiveKit:', error);
    res.status(500).json({ error: 'Error al generar token de llamada' });
  }
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
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const results = await db.query.statuses.findMany({ 
      where: gt(statuses.createdAt, twentyFourHoursAgo),
      orderBy: (statuses, { desc }) => [desc(statuses.createdAt)] 
    });
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

app.post('/api/conversations/:id/participants', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  try {
    // Check if user is already a participant
    const existing = await db.query.conversationParticipants.findFirst({
      where: and(eq(conversationParticipants.conversationId, id), eq(conversationParticipants.userId, userId))
    });
    if (!existing) {
      await db.insert(conversationParticipants).values({ conversationId: id, userId, role: 'member' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding participant:', error);
    res.status(500).json({ error: 'Error' });
  }
});

app.delete('/api/conversations/:id/participants/:userId', async (req, res) => {
  const { id, userId } = req.params;
  try {
    await db.delete(conversationParticipants).where(
      and(eq(conversationParticipants.conversationId, id), eq(conversationParticipants.userId, userId))
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing participant:', error);
    res.status(500).json({ error: 'Error' });
  }
});

app.put('/api/conversations/:id/participants/:userId/role', async (req, res) => {
  const { id, userId } = req.params;
  const { role } = req.body;
  try {
    await db.update(conversationParticipants)
      .set({ role })
      .where(and(
        eq(conversationParticipants.conversationId, id),
        eq(conversationParticipants.userId, userId)
      ));
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating participant role:', error);
    res.status(500).json({ error: 'Error' });
  }
});

// ==========================================
// EL CONSERJE: CRON JOB DE LIMPIEZA AUTOMÁTICA
// ==========================================

// Función maestra de limpieza
const performCleanup = async () => {
  console.log('🧹 [Conserje] Iniciando limpieza diaria...');
  try {
    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // 1. Buscar estados expirados
    const expiredStatuses = await db.query.statuses.findMany({
      where: lt(statuses.createdAt, threshold)
    });

    if (expiredStatuses.length === 0) {
      console.log('🧹 [Conserje] No hay estados expirados para limpiar.');
      return { deleted: 0, files: 0 };
    }

    let filesDeleted = 0;
    
    // 2. Eliminar archivos físicos
    for (const status of expiredStatuses) {
      if (status.type === 'image' || status.type === 'video') {
        try {
          // Extraer nombre del archivo de la URL
          const fileName = status.content.split('/').pop();
          if (fileName) {
            const filePath = path.join(__dirname, 'uploads', fileName);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              filesDeleted++;
            }
          }
        } catch (fileErr) {
          console.error(`❌ Error al borrar archivo del estado ${status.id}:`, fileErr);
        }
      }
    }

    // 3. Eliminar de la base de datos
    await db.delete(statuses).where(lt(statuses.createdAt, threshold));

    console.log(`✅ [Conserje] Limpieza completada. Estados eliminados: ${expiredStatuses.length}, Archivos borrados: ${filesDeleted}`);
    return { deleted: expiredStatuses.length, files: filesDeleted };
  } catch (error) {
    console.error('❌ [Conserje] Error crítico durante la limpieza:', error);
    throw error;
  }
};

// Programar para ejecutarse cada día a las 03:00 AM
cron.schedule('0 3 * * *', () => {
  performCleanup();
});

// Endpoint manual para que el usuario pueda probarlo de inmediato
app.post('/api/admin/cleanup', async (req, res) => {
  try {
    const result = await performCleanup();
    res.json({ message: 'Limpieza ejecutada con éxito', ...result });
  } catch (error) {
    res.status(500).json({ error: 'Fallo al ejecutar la limpieza manual' });
  }
});

httpServer.listen(port, () => {
  console.log(`🚀 Servidor Asicme Real-Time corriendo en http://localhost:${port}`);
});
