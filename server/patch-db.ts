import { db } from './db';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🛠️ Aplicando parche a la base de datos...');
  try {
    await db.execute(sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS description text;`);
    console.log('✅ Columna "description" añadida correctamente.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al aplicar el parche:', error);
    process.exit(1);
  }
}

main();
