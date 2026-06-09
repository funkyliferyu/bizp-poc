import { createDatabaseConnection } from './db/connection.js';
import { migrateDatabase } from './db/migrate.js';
import { generateRagDocuments } from './storeLearning/rag/ragDocumentService.js';

function argValue(name: string) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const storeId = argValue('storeId');
  if (!storeId) {
    throw new Error('Usage: npm run rag:export -- --storeId=<storeId>');
  }

  const connection = createDatabaseConnection();
  try {
    migrateDatabase(connection);
    const manifest = await generateRagDocuments({ connection }, storeId);
    console.log(JSON.stringify(manifest, null, 2));
  } finally {
    connection.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(message);
  process.exitCode = 1;
});
