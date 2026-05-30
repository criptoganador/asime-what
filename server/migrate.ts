import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log('Migrando base de datos...');
  try {
    await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hashed_recovery_phrase" text;`;
    await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "recovery_encrypted_private_key" text;`;
    console.log('✅ Migración exitosa');
  } catch (e) {
    console.error('Error:', e);
  }
}
migrate();
