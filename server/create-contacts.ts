import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  await sql`CREATE TABLE IF NOT EXISTS contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES users(id),
    contact_id uuid NOT NULL REFERENCES users(id),
    nickname text,
    created_at timestamp DEFAULT now()
  )`;
  console.log('✅ Tabla contacts creada');
}

run().catch(console.error);
