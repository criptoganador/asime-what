import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function dropDB() {
  console.log('🗑️ Eliminando tablas antiguas...');
  await sql`DROP TABLE IF EXISTS contacts CASCADE`;
  await sql`DROP TABLE IF EXISTS messages CASCADE`;
  await sql`DROP TABLE IF EXISTS conversation_participants CASCADE`;
  await sql`DROP TABLE IF EXISTS conversations CASCADE`;
  await sql`DROP TABLE IF EXISTS users CASCADE`;
  await sql`DROP TABLE IF EXISTS __drizzle_migrations CASCADE`;
  console.log('✅ Tablas eliminadas correctamente');
}

dropDB().catch(console.error);
