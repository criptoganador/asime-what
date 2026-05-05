import { pgTable, text, timestamp, integer, boolean, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone').notNull().unique(),
  name: text('name').notNull(),
  avatar: text('avatar'),
  about: text('about').default('¡Hola! Estoy usando Asicme Web.'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'), // Null for 1v1
  avatar: text('avatar'),
  description: text('description'),
  communityId: uuid('community_id'), // Para grupos vinculados a comunidades
  isGroup: boolean('is_group').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const conversationParticipants = pgTable('conversation_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  role: text('role').default('member'), // 'admin' o 'member'
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id).notNull(),
  senderId: uuid('sender_id').references(() => users.id).notNull(),
  text: text('text'), // Opcional si es imagen
  type: text('type').default('text'), // 'text' o 'image'
  imageUrl: text('image_url'),
  status: text('status').default('sent'), // sent, delivered, read
  timestamp: timestamp('timestamp').defaultNow(),
});

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').references(() => users.id).notNull(),
  contactId: uuid('contact_id').references(() => users.id).notNull(),
  nickname: text('nickname'),
  createdAt: timestamp('created_at').defaultNow(),
});
