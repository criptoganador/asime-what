import { db } from './db';
import { users, contacts } from './db/schema';

async function check() {
  console.log('--- USERS ---');
  const allUsers = await db.select().from(users);
  allUsers.forEach(u => console.log(`ID: ${u.id}, Name: ${u.name}, Phone: ${u.phone}`));

  console.log('\n--- CONTACTS ---');
  const allContacts = await db.select().from(contacts);
  console.table(allContacts);
  
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
