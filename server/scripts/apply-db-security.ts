import { db } from '../db';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const applySecurity = async () => {
  console.log('🔒 Aplicando Seguridad a Nivel de Fila (RLS) y Triggers de Auditoría...');

  try {
    // 1. Activar RLS en tabla messages
    await db.execute(sql`ALTER TABLE messages ENABLE ROW LEVEL SECURITY;`);
    console.log('✅ RLS habilitado en messages.');

    // 2. Crear política (Ignoramos error si ya existe)
    try {
      await db.execute(sql`
        CREATE POLICY select_messages_policy ON messages
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM conversation_participants 
            WHERE conversation_id = messages.conversation_id 
            AND user_id = current_setting('app.current_user_id', true)::uuid
          )
        );
      `);
      console.log('✅ Política de SELECT creada para messages.');
    } catch (e) {
      console.log('⚠️ La política RLS ya existe o hubo un problema al crearla:', e);
    }

    // 3. Crear Función Trigger genérica para auditoría
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION log_security_audit()
      RETURNS TRIGGER AS $$
      BEGIN
        IF (TG_OP = 'UPDATE') THEN
          INSERT INTO security_audit_logs (table_name, action, record_id, old_data, new_data)
          VALUES (TG_TABLE_NAME, 'UPDATE', NEW.id::text, row_to_json(OLD), row_to_json(NEW));
          RETURN NEW;
        ELSIF (TG_OP = 'DELETE') THEN
          INSERT INTO security_audit_logs (table_name, action, record_id, old_data)
          VALUES (TG_TABLE_NAME, 'DELETE', OLD.id::text, row_to_json(OLD));
          RETURN OLD;
        ELSIF (TG_OP = 'INSERT') THEN
          INSERT INTO security_audit_logs (table_name, action, record_id, new_data)
          VALUES (TG_TABLE_NAME, 'INSERT', NEW.id::text, row_to_json(NEW));
          RETURN NEW;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Función de Auditoría creada.');

    // 4. Aplicar Triggers a las tablas sensibles
    const tablesToAudit = ['users', 'authenticators'];
    for (const table of tablesToAudit) {
      try {
        await db.execute(sql`
          DROP TRIGGER IF EXISTS audit_trigger ON ${sql.raw(table)};
          CREATE TRIGGER audit_trigger
          AFTER INSERT OR UPDATE OR DELETE ON ${sql.raw(table)}
          FOR EACH ROW EXECUTE FUNCTION log_security_audit();
        `);
        console.log(`✅ Trigger de auditoría aplicado a la tabla ${table}.`);
      } catch (e) {
        console.error(`❌ Error al aplicar trigger en ${table}:`, e);
      }
    }

    console.log('🎉 Seguridad avanzada aplicada con éxito.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error aplicando seguridad:', error);
    process.exit(1);
  }
};

applySecurity();
