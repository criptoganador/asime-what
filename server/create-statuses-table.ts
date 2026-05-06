import { db } from './db';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🛠️ Creando tabla de estados...');
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS statuses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        type text DEFAULT 'text',
        content text NOT NULL,
        background_color text DEFAULT '#6b21a8',
        created_at timestamp DEFAULT now()
      );
    `);
    console.log('✅ Tabla "statuses" creada correctamente.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al crear la tabla:', error);
    process.exit(1);
  }
}

main();
