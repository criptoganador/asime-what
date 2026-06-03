import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { db } from './db';
import { users, conversations, conversationParticipants, messages, contacts, statuses } from './db/schema';
import { eq, or, and, ilike, not, inArray, sql, gt, lt } from 'drizzle-orm';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import { AccessToken } from 'livekit-server-sdk';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import compression from 'compression';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

// Encriptación simétrica AES-256 para teléfonos (Determinista con IV estático para búsquedas exactas)
const ENCRYPTION_KEY = process.env.PHONE_ENCRYPTION_KEY || 'AsicmeSecretKeyForPhones2024!@#$'; // Exactamente 32 bytes
const STATIC_IV = Buffer.alloc(16, 0);

function encryptPhone(text: string) {
  if (!text) return text;
  try {
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), STATIC_IV);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (error) {
    console.error('Error encrypting phone:', error);
    return text;
  }
}

function decryptPhone(text: string) {
  if (!text) return text;
  try {
    if (!/^[0-9a-fA-F]+$/.test(text)) return text; // Retorna normal si no es un hex válido
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), STATIC_IV);
    let decrypted = decipher.update(text, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Error decrypting phone:', error);
    return text;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const uploadToR2 = async (base64OrString: string): Promise<string> => {
  const fileName = `${uuidv4()}.txt`;
  
  // Si recibimos E2EE, es simplemente un string.
  const buffer = Buffer.from(base64OrString, 'utf-8');

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: fileName,
    Body: buffer,
    ContentType: 'text/plain',
  });

  await s3Client.send(command);
  return `${process.env.R2_PUBLIC_DOMAIN}/${fileName}`;
};

const app = express();
app.set('trust proxy', 1); // Confiar en el proxy de Render

// Seguridad: Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Desactivar CSP si causa problemas con LiveKit/Socket.io, o configurar específicamente
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false // Permitir cargar imágenes cross-origin
}));

// Rendimiento: Gzip Compression
app.use(compression());

const httpServer = createServer(app);
const allowedOrigins = [
  "https://asime-what-frontend.onrender.com",
  "capacitor://localhost",
  "http://localhost"
];

const io = new Server(httpServer, {
  maxHttpBufferSize: 5e7, // 50 MB payload limit for E2EE Base64 Media
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? allowedOrigins
      : true, // Allow all origins in dev (e.g. 192.168.x.x)
    methods: ["GET", "POST"],
    credentials: true
  }
});

const port = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? allowedOrigins
    : true, // Allow all origins in dev
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Anti-Spam Nivel Enterprise: Rate Limiting para APIs REST
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 150, // Limita a 150 peticiones por IP cada 5 min
  message: { error: 'Demasiadas peticiones. Por favor, intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Anti-Enumeration: Rate Limiting estricto para rutas de autenticación
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5, // Limita a 5 peticiones por IP cada minuto
  message: { error: 'Demasiados intentos de verificación. Por favor, espera un minuto para tu seguridad.', rateLimited: true },
  standardHeaders: true,
  legacyHeaders: false,
});

// Endpoint de Salud para Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Multer eliminado por seguridad (Archivos se guardan en BD como Base64 E2EE)

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
    const { id, chatId, senderId, text, type, imageUrl, fileUrl, fileName, fileType, duration, replyToId } = data;
    
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
      
      let finalImageUrl = imageUrl;
      let finalFileUrl = fileUrl;

      // Upload to R2 if content is provided
      if (imageUrl && imageUrl.length > 500) {
        try {
          finalImageUrl = await uploadToR2(imageUrl);
        } catch (e) {
          console.error('Error uploading image to R2:', e);
        }
      }

      if (fileUrl && fileUrl.length > 500) {
        try {
          finalFileUrl = await uploadToR2(fileUrl);
        } catch (e) {
          console.error('Error uploading file to R2:', e);
        }
      }

      const [newMsg] = await db.insert(messages).values({
        id: id || undefined, // Uses client-provided ID if available, else DB generates
        conversationId: chatId,
        senderId,
        text,
        type: type || 'text',
        imageUrl: finalImageUrl,
        fileUrl: finalFileUrl,
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

  socket.on('clear_chat', async ({ chatId, userId }) => {
    try {
      await db.execute(sql`
        UPDATE "messages" 
        SET "deleted_for" = COALESCE("deleted_for", '[]'::jsonb) || ${JSON.stringify([userId])}::jsonb 
        WHERE "conversation_id" = ${chatId} 
        AND NOT (COALESCE("deleted_for", '[]'::jsonb) @> ${JSON.stringify(userId)}::jsonb)
      `);

      // Optimización de espacio: Borrar físicamente si TODOS los participantes ya lo borraron
      const participants = await db.query.conversationParticipants.findMany({ 
        where: eq(conversationParticipants.conversationId, chatId) 
      });
      const numParticipants = participants.length;

      if (numParticipants > 0) {
        await db.execute(sql`
          DELETE FROM "messages"
          WHERE "conversation_id" = ${chatId}
          AND jsonb_array_length(COALESCE("deleted_for", '[]'::jsonb)) >= ${numParticipants}
        `);
      }

      io.to(userId).emit('chat_cleared', { chatId });
    } catch (error) {
      console.error('Error al vaciar chat:', error);
    }
  });

  socket.on('delete_message', async ({ chatId, messageId, forEveryone, userId }) => {
    try {
      if (forEveryone) {
        await db.delete(messages).where(eq(messages.id, messageId));
      } else {
        const msg = await db.query.messages.findFirst({ where: eq(messages.id, messageId) });
        if (msg) {
          const deletedFor = (msg.deletedFor as string[]) || [];
          if (!deletedFor.includes(userId)) {
            deletedFor.push(userId);
            
            // Verificar si todos los participantes ya lo han borrado
            const participants = await db.query.conversationParticipants.findMany({ 
              where: eq(conversationParticipants.conversationId, chatId) 
            });
            
            if (deletedFor.length >= participants.length && participants.length > 0) {
              await db.delete(messages).where(eq(messages.id, messageId));
            } else {
              await db.update(messages).set({ deletedFor }).where(eq(messages.id, messageId));
            }
          }
        }
      }
      io.to(chatId).emit('message_deleted', { chatId, messageId, forEveryone, userId });
    } catch (error) {
      console.error('Error al borrar mensaje:', error);
    }
  });

  socket.on('call_user', async ({ chatId, callerId, callerName, callerAvatar, type }) => {
    try {
      const participants = await db.query.conversationParticipants.findMany({ 
        where: eq(conversationParticipants.conversationId, chatId) 
      });
      participants.forEach(p => {
        if (p.userId !== callerId) {
          io.to(p.userId).emit('incoming_call', { chatId, callerId, callerName, callerAvatar, type });
        }
      });
    } catch (error) {
      console.error('Error in call_user:', error);
    }
  });

  socket.on('invite_to_call', ({ chatId, inviterId, inviterName, inviterAvatar, receiverId, type }) => {
    try {
      io.to(receiverId).emit('incoming_call', { 
        chatId, 
        callerId: inviterId, 
        callerName: inviterName, 
        callerAvatar: inviterAvatar, 
        type 
      });
    } catch (error) {
      console.error('Error in invite_to_call:', error);
    }
  });

  socket.on('answer_call', async ({ chatId, answererId, accept, reason }) => {
    try {
      const participants = await db.query.conversationParticipants.findMany({ 
        where: eq(conversationParticipants.conversationId, chatId) 
      });
      participants.forEach(p => {
        if (p.userId !== answererId) {
          io.to(p.userId).emit('call_answered', { chatId, answererId, accept, reason });
        }
      });
    } catch (error) {
      console.error('Error in answer_call:', error);
    }
  });

  socket.on('end_call', async ({ chatId }) => {
    try {
      // 1. Broadcast global termination so ANYONE in that room (even invited 3rd parties) hangs up
      io.emit('call_ended', { chatId });

      // 2. Insert a system message into the chat
      const userId = (socket as any).userId;
      if (userId) {
        const [newMsg] = await db.insert(messages).values({
          conversationId: chatId,
          senderId: userId,
          text: '📞 Videollamada finalizada',
          type: 'system',
        }).returning();

        // 3. Notify participants of the new message
        io.to(chatId).emit('receive_message', newMsg);
      }
    } catch (error) {
      console.error('Error in end_call:', error);
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

// --- WEBAUTHN (PASSKEYS) ENDPOINTS ---
const rpName = 'Asicme Chat';

// Helper to get dynamic origins and rpID based on the request
const getWebAuthnConfig = (req: express.Request) => {
  if (process.env.NODE_ENV === 'production') {
    return {
      rpID: 'asime-what-frontend.onrender.com',
      expectedOrigin: 'https://asime-what-frontend.onrender.com'
    };
  }
  // For local development, allow the current hostname of the request (e.g., 192.168.x.x)
  const origin = req.headers.origin || 'http://localhost:5173';
  const url = new URL(origin);
  return {
    rpID: url.hostname,
    expectedOrigin: origin
  };
};

app.post('/api/auth/generate-registration-options', authLimiter, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username es requerido' });

  let user = await db.query.users.findFirst({ where: eq(users.username, username) });
  
  if (user && user.credentialID) {
    return res.status(400).json({ error: 'El usuario ya está registrado con este username.' });
  }

  if (!user) {
    // Registro inicial: creamos usuario sin llave hasta verificar
    const [newUser] = await db.insert(users).values({ 
      username, 
      name: username
    }).returning();
    user = newUser;
  }

  try {
    const { rpID } = getWebAuthnConfig(req);
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(user.id, 'utf-8'),
      userName: username,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        userVerification: 'preferred',
      },
    });

    await db.update(users).set({ currentChallenge: options.challenge }).where(eq(users.id, user.id));
    res.json(options);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/verify-registration', authLimiter, async (req, res) => {
  const { username, body, publicKey, encryptedPrivateKey, recoveryEncryptedPrivateKey, hashedRecoveryPhrase } = req.body;
  const user = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (!user || !user.currentChallenge) return res.status(400).json({ error: 'Usuario no válido' });

  try {
    const { expectedOrigin, rpID } = getWebAuthnConfig(req);
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: user.currentChallenge,
      expectedOrigin,
      expectedRPID: rpID,
    });

    const { verified, registrationInfo } = verification;
    if (verified && registrationInfo) {
      const [updatedUser] = await db.update(users).set({
        credentialID: registrationInfo.credential.id,
        credentialPublicKey: Buffer.from(registrationInfo.credential.publicKey).toString('base64url'),
        counter: registrationInfo.credential.counter,
        currentChallenge: null,
        publicKey,
        encryptedPrivateKey,
        recoveryEncryptedPrivateKey,
        hashedRecoveryPhrase
      }).where(eq(users.id, user.id)).returning();

      const { pin: _pin, hashedRecoveryPhrase: _hrp, ...safeUser } = updatedUser;
      return res.json({ verified: true, user: safeUser });
    }
  } catch (error: any) {
    console.error('Error verifyRegistrationResponse:', error);
    return res.status(400).send({ error: error.message });
  }
  return res.status(400).json({ error: 'Fallo al verificar el registro' });
});

app.post('/api/auth/generate-authentication-options', authLimiter, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username es requerido' });

  const user = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (!user || !user.credentialID) {
    return res.status(404).json({ error: 'Usuario no encontrado o sin passkey configurado' });
  }

  try {
    const { rpID } = getWebAuthnConfig(req);
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: [{
        id: user.credentialID,
      }],
      userVerification: 'preferred',
    });

    await db.update(users).set({ currentChallenge: options.challenge }).where(eq(users.id, user.id));
    res.json(options);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/verify-authentication', authLimiter, async (req, res) => {
  const { username, body } = req.body;
  const user = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (!user || !user.currentChallenge || !user.credentialPublicKey || !user.credentialID) {
    return res.status(400).json({ error: 'Usuario no válido para autenticación' });
  }

  try {
    const { expectedOrigin, rpID } = getWebAuthnConfig(req);
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: user.currentChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: user.credentialID,
        publicKey: Buffer.from(user.credentialPublicKey, 'base64url'),
        counter: user.counter || 0,
      },
    });

    const { verified, authenticationInfo } = verification;
    if (verified) {
      const [updatedUser] = await db.update(users).set({
        counter: authenticationInfo.newCounter,
        currentChallenge: null,
      }).where(eq(users.id, user.id)).returning();

      const { pin: _pin, hashedRecoveryPhrase: _hrp, ...safeUser } = updatedUser;
      return res.json({ verified: true, user: safeUser });
    }
  } catch (error: any) {
    console.error('Error verifyAuthenticationResponse:', error);
    return res.status(400).send({ error: error.message });
  }
  return res.status(400).json({ error: 'Fallo al verificar autenticación' });
});

app.post('/api/auth/recover-account', authLimiter, async (req, res) => {
  const { username, hashedRecoveryPhrase } = req.body;
  if (!username || !hashedRecoveryPhrase) return res.status(400).json({ error: 'Faltan datos' });

  const user = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (user.hashedRecoveryPhrase !== hashedRecoveryPhrase) {
    return res.status(401).json({ error: 'Frase de recuperación incorrecta' });
  }

  // Borrar credenciales de hardware anteriores porque ahora registrarán uno nuevo
  await db.update(users).set({
    credentialID: null,
    credentialPublicKey: null,
    hardwarePublicKey: null
  }).where(eq(users.id, user.id));

  res.json({
    success: true,
    user: {
      ...user,
      pin: undefined,
      hashedRecoveryPhrase: undefined
    }
  });
});

// --- NATIVE MOBILE AUTHENTICATION ---
app.post('/api/auth/mobile-register', authLimiter, async (req, res) => {
  const { username, hardwarePublicKey, publicKey, encryptedPrivateKey, recoveryEncryptedPrivateKey, hashedRecoveryPhrase } = req.body;
  if (!username || !hardwarePublicKey) return res.status(400).json({ error: 'Username y Hardware Key son requeridos' });

  let user = await db.query.users.findFirst({ where: eq(users.username, username) });
  
  if (user && user.hardwarePublicKey) {
    return res.status(400).json({ error: 'El usuario ya está registrado con este username en móvil.' });
  }

  try {
    if (!user) {
      const [newUser] = await db.insert(users).values({ 
        username, 
        name: username,
        hardwarePublicKey,
        publicKey,
        encryptedPrivateKey,
        recoveryEncryptedPrivateKey,
        hashedRecoveryPhrase
      }).returning();
      user = newUser;
    } else {
      const [updatedUser] = await db.update(users).set({
        hardwarePublicKey,
        publicKey,
        encryptedPrivateKey,
        recoveryEncryptedPrivateKey,
        hashedRecoveryPhrase
      }).where(eq(users.id, user.id)).returning();
      user = updatedUser;
    }

    const { pin: _pin, hashedRecoveryPhrase: _hrp, ...safeUser } = user;
    res.json({ verified: true, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/mobile-login-challenge', authLimiter, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username es requerido' });

  const user = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (!user || !user.hardwarePublicKey) {
    return res.status(404).json({ error: 'Usuario no encontrado o no registrado desde móvil' });
  }

  const challenge = crypto.randomBytes(32).toString('hex');
  await db.update(users).set({ currentChallenge: challenge }).where(eq(users.id, user.id));
  
  res.json({ challenge });
});

app.post('/api/auth/mobile-verify-signature', authLimiter, async (req, res) => {
  const { username, signature } = req.body;
  const user = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (!user || !user.currentChallenge || !user.hardwarePublicKey) {
    return res.status(400).json({ error: 'Usuario no válido para autenticación móvil' });
  }

  try {
    const verify = crypto.createVerify('SHA256');
    verify.update(user.currentChallenge);
    verify.end();
    
    // PEM format for public key
    const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${user.hardwarePublicKey}\n-----END PUBLIC KEY-----`;
    
    const isValid = verify.verify(publicKeyPem, signature, 'base64');

    if (isValid) {
      const [updatedUser] = await db.update(users).set({
        currentChallenge: null,
      }).where(eq(users.id, user.id)).returning();

      const { pin: _pin, hashedRecoveryPhrase: _hrp, ...safeUser } = updatedUser;
      return res.json({ verified: true, user: safeUser });
    } else {
      return res.status(401).json({ error: 'Firma digital inválida' });
    }
  } catch (error: any) {
    console.error('Error verify mobile signature:', error);
    return res.status(400).send({ error: error.message });
  }
});

app.post('/api/auth', authLimiter, async (req, res) => {
  const { phone, pin, name, avatar, about, publicKey, encryptedPrivateKey, recoveryPhrase, recoveryEncryptedPrivateKey } = req.body;
  if (!phone || !pin) return res.status(400).json({ error: 'Teléfono y PIN son obligatorios' });
  
  try {
    const encryptedPhone = encryptPhone(phone!);
    let user = await db.query.users.findFirst({ where: eq(users.phone, encryptedPhone) });
    if (!user) {
      if (!publicKey || !encryptedPrivateKey) {
        return res.status(400).json({ error: 'Faltan claves criptográficas para registro' });
      }
      // Registro de usuario nuevo
      const hashedPin = await bcrypt.hash(pin, 10);
      let hashedRecoveryPhrase = null;
      if (recoveryPhrase) {
        hashedRecoveryPhrase = await bcrypt.hash(recoveryPhrase, 10);
      }
      
      const [newUser] = await db.insert(users).values({ 
        phone: encryptedPhone, 
        pin: hashedPin, 
        name: name || 'Usuario', 
        avatar, 
        about,
        publicKey,
        encryptedPrivateKey,
        hashedRecoveryPhrase,
        recoveryEncryptedPrivateKey
      }).returning();
      user = newUser;
    } else {
      // Login o actualización de usuario existente
      
      if (user.lockedUntil && new Date() < user.lockedUntil) {
        const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
        return res.status(403).json({ error: `Cuenta bloqueada. Intente de nuevo en ${minutesLeft} minutos.` });
      }

      const isMatch = await bcrypt.compare(pin, user.pin!);
      if (!isMatch) {
        const newAttempts = (user.failedLoginAttempts || 0) + 1;
        let updateData: any = { failedLoginAttempts: newAttempts };
        
        if (newAttempts >= 5) {
          updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
          await db.update(users).set(updateData).where(eq(users.id, user.id));
          return res.status(403).json({ error: `Demasiados intentos fallidos. Cuenta bloqueada por 15 minutos.` });
        } else {
          await db.update(users).set(updateData).where(eq(users.id, user.id));
          return res.status(401).json({ error: `PIN incorrecto. Le quedan ${5 - newAttempts} intentos.` });
        }
      }
      
      // Resetear contadores si el PIN fue correcto
      if ((user.failedLoginAttempts ?? 0) > 0 || user.lockedUntil) {
        await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, user.id));
        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
      }
      
      if (name) {
        const [updatedUser] = await db.update(users).set({ name, avatar, about }).where(eq(users.id, user.id)).returning();
        user = updatedUser;
      }
    }
    
    // Remover el pin del objeto retornado por seguridad y descifrar teléfono
    const { pin: _pin, hashedRecoveryPhrase: _hrp, ...safeUser } = user;
    safeUser.phone = decryptPhone(safeUser.phone!);
    res.json(safeUser);
  } catch (error) {
    console.error('❌ Error en /api/auth:', error);
    res.status(500).json({ error: 'Error en auth' });
  }
});

// Endpoint dedicado para actualizar el perfil del usuario
app.put('/api/users/profile', authLimiter, async (req, res) => {
  const { id, name, avatar, about } = req.body;
  if (!id) return res.status(400).json({ error: 'ID del usuario es requerido' });

  try {
    const [updatedUser] = await db.update(users)
      .set({ name, avatar, about })
      .where(eq(users.id, id))
      .returning();
      
    if (!updatedUser) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { pin: _pin, hashedRecoveryPhrase: _hrp, ...safeUser } = updatedUser;
    res.json(safeUser);
  } catch (error: any) {
    console.error('❌ Error actualizando perfil:', error);
    res.status(500).json({ error: 'Error interno actualizando el perfil' });
  }
});

// Paso 1 de Recuperación: Verificar frase y obtener llave privada encriptada de respaldo
app.post('/api/auth/verify-phrase', authLimiter, async (req, res) => {
  const { phone, recoveryPhrase } = req.body;
  if (!phone || !recoveryPhrase) return res.status(400).json({ error: 'Teléfono y frase son obligatorios' });

  try {
    const encryptedPhone = encryptPhone(phone!);
    const user = await db.query.users.findFirst({ where: eq(users.phone, encryptedPhone) });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!user.hashedRecoveryPhrase) return res.status(400).json({ error: 'Este usuario no tiene frase de recuperación configurada' });

    const isMatch = await bcrypt.compare(recoveryPhrase, user.hashedRecoveryPhrase);
    if (!isMatch) return res.status(401).json({ error: 'Frase de recuperación incorrecta' });

    res.json({ recoveryEncryptedPrivateKey: user.recoveryEncryptedPrivateKey });
  } catch (error) {
    console.error('❌ Error verificando frase:', error);
    res.status(500).json({ error: 'Error al verificar frase de recuperación' });
  }
});

// Paso 2 de Recuperación: Establecer nuevo PIN
app.post('/api/auth/reset-pin', authLimiter, async (req, res) => {
  const { phone, recoveryPhrase, newPin, newEncryptedPrivateKey } = req.body;
  if (!phone || !recoveryPhrase || !newPin || !newEncryptedPrivateKey) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  try {
    const encryptedPhone = encryptPhone(phone!);
    const user = await db.query.users.findFirst({ where: eq(users.phone, encryptedPhone) });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!user.hashedRecoveryPhrase) return res.status(400).json({ error: 'Este usuario no tiene frase de recuperación configurada' });

    const isMatch = await bcrypt.compare(recoveryPhrase, user.hashedRecoveryPhrase);
    if (!isMatch) return res.status(401).json({ error: 'Frase de recuperación incorrecta' });

    const hashedPin = await bcrypt.hash(newPin, 10);
    
    const [updatedUser] = await db.update(users).set({
      pin: hashedPin,
      encryptedPrivateKey: newEncryptedPrivateKey,
      failedLoginAttempts: 0,
      lockedUntil: null
    }).where(eq(users.id, user.id)).returning();

    const { pin: _pin, hashedRecoveryPhrase: _hrp, ...safeUser } = updatedUser;
    safeUser.phone = decryptPhone(safeUser.phone!);
    res.json(safeUser);
  } catch (error) {
    console.error('❌ Error reseteando PIN:', error);
    res.status(500).json({ error: 'Error al resetear PIN' });
  }
});

app.get('/api/users/check/:phone', authLimiter, async (req, res) => {
  const phone = req.params.phone as string;
  try {
    const decodedPhone = decodeURIComponent(phone);
    const encryptedPhone = encryptPhone(decodedPhone);
    console.log('🔍 Buscando usuario con teléfono encriptado');
    const user = await db.query.users.findFirst({ where: eq(users.phone, encryptedPhone) });
    
    if (user) {
      const { pin: _pin, ...safeUser } = user;
      safeUser.phone = decryptPhone(safeUser.phone!);
      res.json(safeUser);
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('❌ Error en /api/users/check:', error);
    res.status(500).json({ error: 'Error al verificar usuario' });
  }
});

app.get('/api/users/search', async (req, res) => {
  const query = req.query.query as string;
  const currentUserId = req.query.currentUserId as string;
  if (!query) return res.json([]);
  try {
    // Buscar coincidencia exacta por @username (sin el @ si lo pusieron)
    const cleanQuery = query.replace('@', '').toLowerCase();
    // Sanitizar para ILIKE (escapar % y _)
    const safeLikeQuery = query.replace(/[%_]/g, '\\$&');

    
    const results = await db.query.users.findMany({
      where: or(
        eq(users.username, cleanQuery),
        ilike(users.name, `%${safeLikeQuery}%`)
      )
    });
    // Excluir al usuario actual de los resultados
    const filtered = results.filter(u => u.id !== currentUserId).map(u => {
      const { pin: _pin, ...safeUser } = u;
      if (safeUser.phone) safeUser.phone = decryptPhone(safeUser.phone);
      return safeUser;
    });
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
    const { pin: _pin, ...safeUser } = user;
    safeUser.phone = decryptPhone(safeUser.phone!);
    res.json({ valid: true, user: safeUser });
  } catch (error) {
    res.status(500).json({ valid: false, error: 'Error al validar usuario' });
  }
});

app.get('/api/get-livekit-token', async (req, res) => {
  const { roomName, participantName } = req.query;
  if (!roomName || !participantName) {
    return res.status(400).json({ error: 'Faltan parámetros roomName o participantName' });
  }

  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();

  if (!apiKey || !apiSecret) {
    console.error('Faltan claves de LiveKit en el .env');
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
        u.public_key as "otherUserPublicKey",
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
        otherUserId: row.otherUserId,
        otherUserPublicKey: row.otherUserPublicKey
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
  
  if (ownerId === contactId) {
    return res.status(400).json({ error: 'No puedes agregarte a ti mismo' });
  }

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

// Endpoints de upload eliminados por seguridad

// Endpoints de upload eliminados por seguridad

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

    // 2. Eliminar de la base de datos
    await db.delete(statuses).where(lt(statuses.createdAt, threshold));

    console.log(`✅ [Conserje] Limpieza completada. Estados eliminados: ${expiredStatuses.length}`);
    return { deleted: expiredStatuses.length };
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
  const url = process.env.NODE_ENV === 'production' ? 'https://asime-chat-backend-shfl.onrender.com' : `http://localhost:${port}`;
  console.log(`🚀 Servidor Asicme Chat Real-Time corriendo en ${url}`);
});

// Manejo de Cierre Gracioso (Graceful Shutdown)
const shutdown = () => {
  console.log('🛑 Cerrando servidor graciosamente...');
  httpServer.close(() => {
    console.log('✅ Servidor HTTP cerrado.');
    process.exit(0);
  });
  
  // Forzar cierre tras 10 segundos si no termina solo
  setTimeout(() => {
    console.error('⚠️ Forzando cierre tras tiempo de espera.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
