import { db } from './db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Dropping all tables...');
  try {
    await db.execute(sql`DROP SCHEMA public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);
    console.log('✅ All tables dropped.');
  } catch (error) {
    console.error('Error dropping tables:', error);
  }
  process.exit(0);
}

main();
