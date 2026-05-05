import { db } from './db';
import { messages } from './db/schema';
import { sql } from 'drizzle-orm';

async function checkMessages() {
  try {
    console.log('--- Checking Messages Table ---');
    // Check if the table exists and has the timestamp column
    const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'messages'
    `);
    console.table(result.rows);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkMessages();
