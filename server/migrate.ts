import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set');
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  console.log('🚀 Iniciando migración de base de datos con Node-Postgres...');
  try {
    await client.connect();
    const db = drizzle(client);
    await migrate(db, {
      migrationsFolder: './drizzle',
    });
    console.log('✅ Migraciones aplicadas con éxito.');
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
