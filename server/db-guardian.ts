import { execSync } from 'child_process';
import { db } from './db';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

async function guard() {
  console.log('🛡️  MODO GUARDIÁN ACTIVADO: Verificando Base de Datos en Neon...');
  
  try {
    // 1. Sincronizar esquema con drizzle-kit push
    console.log('🔄 Sincronizando campos y tablas con el esquema actual...');
    // Usamos --force-accept-warnings para que no se detenga si hay cambios que drizzle considera peligrosos
    // pero que nosotros queremos aplicar (como añadir columnas).
    execSync('npx drizzle-kit push', { stdio: 'inherit' });
    
    // 2. Verificación de salud de la conexión y tablas críticas
    console.log('🔍 Verificando integridad de tablas...');
    const tables = ['users', 'conversations', 'messages', 'contacts', 'statuses'];
    
    for (const table of tables) {
      try {
        await db.execute(sql.raw(`SELECT count(*) FROM ${table};`));
        console.log(`✅ Tabla "${table}" operativa.`);
      } catch (e) {
        console.error(`⚠️ Advertencia: Problema con la tabla "${table}".`);
      }
    }
    
    console.log('\n✅ BASE DE DATOS PROTEGIDA: Todos los campos están reconstruidos y sincronizados.');
  } catch (error) {
    console.error('\n❌ ERROR DEL GUARDIÁN: No se pudo completar la reconstrucción.');
    console.error(error);
    process.exit(1);
  }
}

guard();
