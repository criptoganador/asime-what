import { db } from './db';
import { statuses } from './db/schema';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  try {
    const allStatuses = await db.select().from(statuses);
    console.log('📊 Estados actuales en la DB:', JSON.stringify(allStatuses, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al consultar estados:', error);
    process.exit(1);
  }
}

main();
