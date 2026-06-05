import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync as DatabaseSyncType, StatementSync } from 'node:sqlite';

const require = createRequire(import.meta.url);
const { DatabaseSync: DatabaseSyncCtor } = require('node:sqlite') as typeof import('node:sqlite');

export type SqliteValue = string | number | bigint | Buffer | null;

export type DbConnection = {
  filename: string;
  database: DatabaseSyncType;
  exec(sql: string): void;
  prepare(sql: string): StatementSync;
  close(): void;
};

export type DatabaseConnectionOptions = {
  filename?: string;
};

const dirname = path.dirname(fileURLToPath(import.meta.url));

export function defaultStoreLearningDatabasePath() {
  return path.resolve(dirname, '../../data/store-learning.sqlite');
}

function ensureDatabaseDirectory(filename: string) {
  if (filename === ':memory:' || filename.startsWith('file:')) return;
  mkdirSync(path.dirname(filename), { recursive: true });
}

export function createDatabaseConnection(options: DatabaseConnectionOptions = {}): DbConnection {
  const filename = options.filename ?? process.env.STORE_LEARNING_DB_PATH ?? defaultStoreLearningDatabasePath();
  ensureDatabaseDirectory(filename);

  const database = new DatabaseSyncCtor(filename);
  database.exec('PRAGMA foreign_keys = ON;');

  if (filename !== ':memory:') {
    database.exec('PRAGMA journal_mode = WAL;');
  }

  return {
    filename,
    database,
    exec: (sql: string) => database.exec(sql),
    prepare: (sql: string) => database.prepare(sql),
    close: () => database.close()
  };
}
