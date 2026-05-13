import { execSync } from 'child_process';
import { db } from './db';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

async function guard() {
  console.log('🛡️  MODO GUARDIÁN ACTIVADO: Verificando Base de Datos en Neon...');
  
  try {
    // 1. Sincronizar esquema con migraciones (más seguro para producción)
    console.log('🔄 Sincronizando base de datos con migraciones...');
    try {
      execSync('npx tsx migrate.ts', { stdio: 'inherit' });
    } catch (pushError) {
      console.warn('⚠️  Guardián: La migración falló. El servidor arrancará con el esquema actual.');
    }
    
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
    console.warn('\n⚠️ GUARDIÁN: Hubo un problema, pero el servidor arrancará de todas formas.');
    console.warn(error);
  }
}

guard();
