import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function resetDB() {
  console.log('🗑️ Eliminando tablas antiguas...');
  await sql`DROP TABLE IF EXISTS contacts CASCADE`;
  await sql`DROP TABLE IF EXISTS messages CASCADE`;
  await sql`DROP TABLE IF EXISTS conversation_participants CASCADE`;
  await sql`DROP TABLE IF EXISTS conversations CASCADE`;
  await sql`DROP TABLE IF EXISTS users CASCADE`;
  await sql`DROP TABLE IF EXISTS __drizzle_migrations CASCADE`;
  console.log('✅ Tablas eliminadas correctamente');

  console.log('🔨 Recreando tablas...');
  await sql`CREATE TABLE "users" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "phone" text NOT NULL,
    "name" text NOT NULL,
    "avatar" text,
    "about" text DEFAULT '¡Hola! Estoy usando Asicme Chat.',
    "created_at" timestamp DEFAULT now(),
    CONSTRAINT "users_phone_unique" UNIQUE("phone")
  )`;

  await sql`CREATE TABLE "conversations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text,
    "is_group" boolean DEFAULT false,
    "created_at" timestamp DEFAULT now()
  )`;

  await sql`CREATE TABLE "conversation_participants" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "conversation_id" uuid NOT NULL REFERENCES "conversations"("id"),
    "user_id" uuid NOT NULL REFERENCES "users"("id")
  )`;

  await sql`CREATE TABLE "messages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "conversation_id" uuid NOT NULL REFERENCES "conversations"("id"),
    "sender_id" uuid NOT NULL REFERENCES "users"("id"),
    "text" text,
    "type" text DEFAULT 'text',
    "image_url" text,
    "status" text DEFAULT 'sent',
    "timestamp" timestamp DEFAULT now()
  )`;

  await sql`CREATE TABLE "contacts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "owner_id" uuid NOT NULL REFERENCES "users"("id"),
    "contact_id" uuid NOT NULL REFERENCES "users"("id"),
    "nickname" text,
    "created_at" timestamp DEFAULT now()
  )`;

  console.log('🎉 ¡Base de datos recreada exitosamente!');
}

resetDB().catch(console.error);
