import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabaseConnection, type DbConnection } from './connection.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(dirname, 'schema.sql');

export function readSchemaSql() {
  return readFileSync(schemaPath, 'utf8');
}

export function migrateDatabase(connection: DbConnection) {
  connection.exec(readSchemaSql());
  ensureColumn(connection, 'collection_items', 'status', "TEXT NOT NULL DEFAULT 'pending'");
  ensureColumn(connection, 'collection_items', 'selected_for_analysis', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(connection, 'collection_items', 'selection_reason', 'TEXT');
  ensureColumn(connection, 'collection_items', 'selected_at', 'TEXT');
}

function ensureColumn(connection: DbConnection, tableName: string, columnName: string, columnDefinition: string) {
  const columns = connection.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
  if (columns.some((column) => column.name === columnName)) return;
  connection.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition};`);
}

function isCliInvocation() {
  return process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
}

if (isCliInvocation()) {
  const connection = createDatabaseConnection();
  try {
    migrateDatabase(connection);
    console.log(`Store Learning SQLite schema migrated at ${connection.filename}`);
  } finally {
    connection.close();
  }
}
