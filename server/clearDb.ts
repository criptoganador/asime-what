import { db } from './db';
import { users, messages, conversationParticipants, conversations, contacts, statuses } from './db/schema';

async function main() {
  console.log('Clearing DB to allow schema update...');
  try {
    await db.delete(messages);
    await db.delete(conversationParticipants);
    await db.delete(conversations);
    await db.delete(contacts);
    await db.delete(statuses);
    await db.delete(users);
    console.log('✅ DB Cleared successfully.');
  } catch (error) {
    console.error('Error clearing DB:', error);
  }
  process.exit(0);
}

main();
