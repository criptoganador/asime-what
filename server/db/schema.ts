import { pgTable, text, timestamp, integer, boolean, uuid, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').unique(),
  phone: text('phone').unique(),
  pin: text('pin'),
  name: text('name').notNull(),
  avatar: text('avatar'),
  about: text('about').default('¡Hola! Estoy usando Asicme Chat.'),
  publicKey: text('public_key'),
  encryptedPrivateKey: text('encrypted_private_key'),
  hashedRecoveryPhrase: text('hashed_recovery_phrase'),
  recoveryEncryptedPrivateKey: text('recovery_encrypted_private_key'),
  credentialID: text('credential_id'),
  credentialPublicKey: text('credential_public_key'),
  hardwarePublicKey: text('hardware_public_key'),
  counter: integer('counter').default(0),
  transports: jsonb('transports').default([]),
  currentChallenge: text('current_challenge'),
  failedLoginAttempts: integer('failed_login_attempts').default(0),
  lockedUntil: timestamp('locked_until'),
  pushToken: text('push_token'),
  lastSeen: timestamp('last_seen'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  avatar: text('avatar'),
  description: text('description'),
  isGroup: boolean('is_group').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const conversationParticipants = pgTable('conversation_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  role: text('role').default('member'),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id).notNull(),
  senderId: uuid('sender_id').references(() => users.id).notNull(),
  text: text('text'),
  type: text('type').default('text'),
  imageUrl: text('image_url'),
  fileUrl: text('file_url'),
  fileName: text('file_name'),
  fileType: text('file_type'),
  duration: integer('duration'),
  replyToId: uuid('reply_to_id'),
  status: text('status').default('sent'),
  reactions: jsonb('reactions').default({}),
  isDeleted: boolean('is_deleted').default(false),
  deletedFor: jsonb('deleted_for').default([]),
  timestamp: timestamp('timestamp').defaultNow(),
});

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').references(() => users.id).notNull(),
  contactId: uuid('contact_id').references(() => users.id).notNull(),
  nickname: text('nickname'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const statuses = pgTable('statuses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: text('type').default('text'),
  content: text('content').notNull(),
  backgroundColor: text('background_color').default('#6b21a8'),
  createdAt: timestamp('created_at').defaultNow(),
});
