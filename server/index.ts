import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { db } from './db';
import { users, conversations, conversationParticipants, messages, contacts } from './db/schema';
import { eq, or, and, ilike, not, inArray } from 'drizzle-orm';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // URL del frontend de Vite
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Configuración de Multer para imágenes ---
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
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'));
    }
  }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Lógica de Socket.io ---
const activeUsers = new Map<string, string>(); // userId -> socketId

io.on('connection', (socket) => {
  console.log('👤 Socket conectado:', socket.id);

  socket.on('user_connected', (userId) => {
    activeUsers.set(userId, socket.id);
    (socket as any).userId = userId; // Guardar en el socket para desconexión rápida
    socket.join(userId);
    io.emit('user_status_change', { userId, status: 'online' });
    console.log(`✅ Usuario ${userId} conectado`);
  });

  socket.on('join_chat', (chatId) => {
    socket.join(chatId);
    console.log(`📂 Usuario unido al chat: ${chatId}`);
  });

    socket.on('send_message', async (data) => {
    const { chatId, senderId, text, type, imageUrl } = data;
    try {
      // Obtener participantes para determinar si el mensaje se entrega inmediatamente
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
        status: isRecipientOnline ? 'delivered' : 'sent'
      }).returning();

      // Emitir a las salas privadas de TODOS los participantes para entrega real-time
      participants.forEach(p => {
        io.to(p.userId).emit('receive_message', newMsg);
      });

      console.log(`✉️ Mensaje enviado en ${chatId} (${newMsg.status}): ${text || '[Imagen]'}`);
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
      
      // Notificar a los demás participantes que sus mensajes han sido leídos
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

  socket.on('disconnect', () => {
    const userId = (socket as any).userId;
    if (userId) {
      activeUsers.delete(userId);
      io.emit('user_status_change', { userId, status: 'offline' });
      console.log(`❌ Usuario ${userId} desconectado`);
    }
  });
});

// --- Endpoints de la API ---

app.post('/api/auth', async (req, res) => {
  const { phone, name, avatar, about } = req.body;
  try {
    let user = await db.query.users.findFirst({ where: eq(users.phone, phone) });
    if (!user) {
      const [newUser] = await db.insert(users).values({ phone, name, avatar, about }).returning();
      user = newUser;
    } else if (name || avatar || about) {
      const [updatedUser] = await db.update(users).set({ name, avatar, about }).where(eq(users.id, user.id)).returning();
      user = updatedUser;
    }
    res.json(user);
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Error en auth', details: String(error) });
  }
});

app.get('/api/chats/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    console.log(`🔍 Buscando chats para usuario: ${userId}`);
    
    // Verificar si el usuario existe
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) {
      console.log(`⚠️ El usuario ${userId} no existe en la base de datos.`);
      return res.status(401).json({ error: 'Sesión inválida o usuario eliminado' });
    }

    const userConvs = await db.query.conversationParticipants.findMany({ 
      where: eq(conversationParticipants.userId, userId) 
    });
    
    const convIds = userConvs.map(cp => cp.conversationId);
    console.log(`📂 Conversaciones encontradas (IDs):`, convIds);
    
    if (convIds.length === 0) {
      console.log('ℹ️ No se encontraron conversaciones para este usuario.');
      return res.json([]);
    }

    const chatDetails = await db.query.conversations.findMany({ 
      where: inArray(conversations.id, convIds) 
    });
    
    console.log(`📋 Detalles de ${chatDetails.length} chats obtenidos.`);

    const results = await Promise.all(chatDetails.map(async (conv) => {
      try {
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
          avatar: conv.isGroup 
            ? conv.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.name || 'G')}` 
            : otherUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser?.name || '?')}&background=random`,
          lastMessage: lastMsg?.type === 'image' ? '📷 Imagen' : (lastMsg?.text || 'Empieza a chatear'),
          timestamp: lastMsg?.timestamp ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          unreadCount: unreadCount.length,
          isOnline: activeUsers.has(otherParticipantId || ''),
          isGroup: conv.isGroup,
          description: conv.description,
          otherUserId: otherParticipantId
        };
      } catch (innerError) {
        console.error(`❌ Error procesando detalles del chat ${conv.id}:`, innerError);
        return null;
      }
    }));

    // Filtrar posibles nulos por errores internos
    const finalResults = results.filter(r => r !== null);
    res.json(finalResults);
  } catch (error) {
    console.error('💥 Error crítico en GET /api/chats/:userId:', error);
    res.status(500).json({ error: 'Error al obtener chats', details: String(error) });
  }
});

app.get('/api/messages/:chatId', async (req, res) => {
  const { chatId } = req.params;
  const { userId } = req.query;

  try {
    // Verificar si el usuario es participante de este chat
    const isParticipant = await db.query.conversationParticipants.findFirst({
      where: and(
        eq(conversationParticipants.conversationId, chatId),
        eq(conversationParticipants.userId, userId as string)
      )
    });

    if (!isParticipant) {
      return res.status(403).json({ error: 'No tienes permiso para ver este chat' });
    }

    const chatMessages = await db.query.messages.findMany({
      where: eq(messages.conversationId, chatId),
      orderBy: (messages, { asc }) => [asc(messages.timestamp)]
    });
    res.json(chatMessages);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

// --- Endpoints de Usuarios ---

// Buscar usuarios para nuevos chats
app.get('/api/users/search', async (req, res) => {
  const { query, currentUserId } = req.query;
  if (!query) return res.json([]);

  try {
    const results = await db.query.users.findMany({
      where: and(
        or(
          ilike(users.name, `%${query}%`),
          ilike(users.phone, `%${query}%`)
        ),
        not(eq(users.id, currentUserId as string)) // No buscarse a sí mismo
      ),
      limit: 10
    });
    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en la búsqueda' });
  }
});

// --- Endpoints de Conversaciones ---

// Crear o recuperar conversación 1v1
app.post('/api/conversations', async (req, res) => {
  const { participantIds } = req.body; // Array de 2 IDs

  try {
    // 1. Buscar si ya existe una conversación 1v1 entre estos participantes
    const userConvs = await db.query.conversationParticipants.findMany({
      where: inArray(conversationParticipants.userId, participantIds)
    });

    const convCounts: Record<string, number> = {};
    let existingConvId: string | null = null;

    for (const cp of userConvs) {
      convCounts[cp.conversationId] = (convCounts[cp.conversationId] || 0) + 1;
      if (convCounts[cp.conversationId] === 2) {
        // Verificar que solo tenga 2 participantes (es 1v1)
        const totalParts = await db.query.conversationParticipants.findMany({
          where: eq(conversationParticipants.conversationId, cp.conversationId)
        });
        if (totalParts.length === 2) {
          existingConvId = cp.conversationId;
          break;
        }
      }
    }

    if (existingConvId) {
      const conv = await db.query.conversations.findFirst({ where: eq(conversations.id, existingConvId) });
      return res.json(conv);
    }
    
    // Crear la conversación si no existe
    const [newConv] = await db.insert(conversations).values({
      isGroup: false
    }).returning();

    // Añadir participantes
    await db.insert(conversationParticipants).values(
      participantIds.map((uid: string) => ({
        conversationId: newConv.id,
        userId: uid
      }))
    );

    res.json(newConv);
  } catch (error) {
    console.error('Error al crear/recuperar conversación:', error);
    res.status(500).json({ error: 'Error al procesar conversación' });
  }
});

// Crear nuevo grupo
app.post('/api/groups', async (req, res) => {
  const { name, avatar, description, participantIds } = req.body; // participantIds debe incluir al creador

  try {
    // 1. Crear la conversación de tipo grupo
    const [newGroup] = await db.insert(conversations).values({
      name,
      avatar,
      description,
      isGroup: true
    }).returning();

    // 2. Añadir a todos los participantes
    if (participantIds && participantIds.length > 0) {
      await db.insert(conversationParticipants).values(
        participantIds.map((uid: string, index: number) => ({
          conversationId: newGroup.id,
          userId: uid,
          role: index === 0 ? 'admin' : 'member' // El creador es el primero
        }))
      );
    }

    res.json(newGroup);
  } catch (error) {
    console.error('Error al crear grupo:', error);
    res.status(500).json({ error: 'Error al crear grupo' });
  }
});

// Actualizar un grupo
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

// --- Endpoints de Contactos ---

// Eliminar una conversación (y sus mensajes/participantes)
app.delete('/api/conversations/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Borrar mensajes
    await db.delete(messages).where(eq(messages.conversationId, id));
    // 2. Borrar participantes
    await db.delete(conversationParticipants).where(eq(conversationParticipants.conversationId, id));
    // 3. Borrar la conversación
    await db.delete(conversations).where(eq(conversations.id, id));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar conversación:', error);
    res.status(500).json({ error: 'Error al eliminar conversación' });
  }
});

// Obtener contactos del usuario
app.get('/api/contacts/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const userContacts = await db.query.contacts.findMany({
      where: eq(contacts.ownerId, userId)
    });
    
    // Obtener datos completos de cada contacto
    const contactDetails = await Promise.all(
      userContacts.map(async (c) => {
        const user = await db.query.users.findFirst({ where: eq(users.id, c.contactId) });
        return {
          ...c,
          user: user
        };
      })
    );
    
    res.json(contactDetails);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener contactos' });
  }
});

// Agregar un contacto
// --- Endpoints de Upload ---

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo' });
  }
  
  const imageUrl = `http://localhost:${port}/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

app.post('/api/contacts', async (req, res) => {
  const { ownerId, contactId, nickname } = req.body;
  try {
    // Verificar que no exista ya
    const existing = await db.query.contacts.findFirst({
      where: and(
        eq(contacts.ownerId, ownerId),
        eq(contacts.contactId, contactId)
      )
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Este contacto ya existe' });
    }
    
    const [newContact] = await db.insert(contacts).values({
      ownerId,
      contactId,
      nickname
    }).returning();
    
    // Devolver con datos del usuario
    const user = await db.query.users.findFirst({ where: eq(users.id, contactId) });
    res.json({ ...newContact, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al agregar contacto' });
  }
});

// Obtener participantes de una conversación
app.get('/api/conversations/:id/participants', async (req, res) => {
  const { id } = req.params;
  try {
    const groupParticipants = await db.select({
      id: users.id,
      name: users.name,
      avatar: users.avatar,
      about: users.about,
      phone: users.phone,
      role: conversationParticipants.role
    })
    .from(conversationParticipants)
    .innerJoin(users, eq(conversationParticipants.userId, users.id))
    .where(eq(conversationParticipants.conversationId, id));
    
    res.json(groupParticipants);
  } catch (error) {
    console.error('Error al obtener participantes:', error);
    res.status(500).json({ error: 'Error al obtener participantes' });
  }
});

// Añadir participante a una conversación
app.post('/api/conversations/:id/participants', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    // Obtener nombre del usuario para el mensaje de sistema
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Verificar si ya es participante
    const existing = await db.select()
      .from(conversationParticipants)
      .where(and(
        eq(conversationParticipants.conversationId, id),
        eq(conversationParticipants.userId, userId)
      ));

    if (existing.length > 0) {
      return res.status(400).json({ error: 'El usuario ya es participante' });
    }

    await db.insert(conversationParticipants).values({
      conversationId: id,
      userId
    });

    // Crear mensaje de sistema
    const [systemMsg] = await db.insert(messages).values({
      conversationId: id,
      senderId: userId, // Usamos el ID del usuario afectado
      text: `${user.name} ha sido añadido al grupo`,
      type: 'system'
    }).returning();

    // Notificar vía socket
    io.to(id).emit('receive_message', systemMsg);

    res.json({ success: true });
  } catch (error) {
    console.error('Error al añadir participante:', error);
    res.status(500).json({ error: 'Error al añadir participante' });
  }
});

// Eliminar participante de una conversación
app.delete('/api/conversations/:id/participants/:userId', async (req, res) => {
  const { id, userId } = req.params;
  const { isSelf } = req.query; // Recibimos si el usuario se está yendo por su cuenta

  try {
    // Obtener nombre del usuario antes de borrarlo
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    
    await db.delete(conversationParticipants)
      .where(and(
        eq(conversationParticipants.conversationId, id),
        eq(conversationParticipants.userId, userId)
      ));

    if (user) {
      // Mensaje dinámico: "ha salido" o "ha sido eliminado"
      const actionText = isSelf === 'true' ? 'ha salido del grupo' : 'ha sido eliminado del grupo';
      
      const [systemMsg] = await db.insert(messages).values({
        conversationId: id,
        senderId: userId,
        text: `${user.name} ${actionText}`,
        type: 'system'
      }).returning();

      // Notificar vía socket
      io.to(id).emit('receive_message', systemMsg);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar participante:', error);
    res.status(500).json({ error: 'Error al eliminar participante' });
  }
});

httpServer.listen(port, () => {
  console.log(`🚀 Servidor Asicme Real-Time corriendo en http://localhost:${port}`);
});
