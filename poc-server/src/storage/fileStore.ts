import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '../../data');
type Bucket = 'businesses' | 'events' | 'approvals' | 'assets';

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

export async function writeJson<T>(bucket: Bucket, id: string, data: T) {
  const dir = path.join(root, bucket);
  await ensureDir(dir);
  const file = path.join(dir, `${id}.json`);
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return file;
}

export async function readJson<T>(bucket: Bucket, id: string) {
  const file = path.join(root, bucket, `${id}.json`);
  return JSON.parse(await readFile(file, 'utf8')) as T;
}

export async function listJson<T>(bucket: Bucket) {
  const dir = path.join(root, bucket);
  try {
    const files = (await readdir(dir)).filter((file) => file.endsWith('.json')).sort();
    return Promise.all(
      files.map(async (file) => JSON.parse(await readFile(path.join(dir, file), 'utf8')) as T)
    );
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}
