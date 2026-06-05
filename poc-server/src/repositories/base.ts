import type { DbConnection, SqliteValue } from '../db/connection.js';

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type BaseEntity = {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateEntity<T extends BaseEntity> = Omit<T, 'createdAt' | 'updatedAt'> &
  Partial<Pick<T, 'createdAt' | 'updatedAt'>>;

export type UpdateEntity<T extends BaseEntity> = Partial<Omit<T, 'id' | 'createdAt'>>;

export type Repository<T extends BaseEntity> = {
  create(input: CreateEntity<T>): T;
  upsert(input: CreateEntity<T>): T;
  findById(id: string): T | null;
  all(): T[];
  update(id: string, patch: UpdateEntity<T>): T;
  findManyBy<K extends keyof T & string>(field: K, value: T[K]): T[];
};

type RepositoryDefinition<T extends BaseEntity> = {
  tableName: string;
  columns: readonly (keyof T & string)[];
  jsonColumns?: readonly (keyof T & string)[];
  columnOverrides?: Partial<Record<keyof T & string, string>>;
};

function nowIso() {
  return new Date().toISOString();
}

function camelToSnake(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function columnName(property: string, columnOverrides: Record<string, string | undefined> = {}) {
  const override = columnOverrides[property];
  if (override) return override;
  if (property === 'metadata') return 'metadata_json';
  if (property === 'settings') return 'settings_json';
  if (property === 'result') return 'result_json';
  if (property === 'error') return 'error_json';
  if (property === 'snapshot') return 'snapshot_json';
  if (property === 'ruleset') return 'ruleset_json';
  if (property === 'prompt') return 'prompt_json';
  if (property === 'output') return 'output_json';
  if (property === 'article') return 'article_json';
  if (property === 'rubric') return 'rubric_json';
  if (property === 'event') return 'event_json';
  return camelToSnake(property);
}

function encodeValue<T extends BaseEntity>(
  property: keyof T & string,
  value: unknown,
  jsonColumns: Set<keyof T & string>
): SqliteValue {
  if (jsonColumns.has(property)) {
    return JSON.stringify(value ?? null);
  }
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return value;
  if (Buffer.isBuffer(value)) return value;
  throw new Error(`Unsupported SQLite value for ${property}`);
}

function decodeJson(raw: unknown) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return raw;
  return JSON.parse(raw) as JsonValue;
}

function rowToEntity<T extends BaseEntity>(
  row: Record<string, unknown>,
  columns: readonly (keyof T & string)[],
  jsonColumns: Set<keyof T & string>,
  columnOverrides: Partial<Record<keyof T & string, string>>
): T {
  const entity: Record<string, unknown> = {};
  for (const property of columns) {
    const raw = row[columnName(property, columnOverrides)];
    entity[property] = jsonColumns.has(property) ? decodeJson(raw) : raw;
  }
  return entity as T;
}

function requireEntity<T>(entity: T | null, tableName: string, id: string): T {
  if (!entity) {
    throw new Error(`${tableName} record not found: ${id}`);
  }
  return entity;
}

export function createRepository<T extends BaseEntity>(
  connection: DbConnection,
  definition: RepositoryDefinition<T>
): Repository<T> {
  const jsonColumns = new Set(definition.jsonColumns ?? []);
  const columnOverrides = definition.columnOverrides ?? {};
  const columnList = definition.columns.map((property) => columnName(property, columnOverrides));
  const selectSql = `SELECT ${columnList.join(', ')} FROM ${definition.tableName}`;

  function create(input: CreateEntity<T>): T {
    const timestamp = nowIso();
    const entity = {
      ...input,
      createdAt: input.createdAt ?? timestamp,
      updatedAt: input.updatedAt ?? timestamp
    } as T;
    const values = definition.columns.map((property) => encodeValue(property, entity[property], jsonColumns));
    const placeholders = definition.columns.map(() => '?').join(', ');
    connection
      .prepare(`INSERT INTO ${definition.tableName} (${columnList.join(', ')}) VALUES (${placeholders})`)
      .run(...values);
    return requireEntity(findById(entity.id), definition.tableName, entity.id);
  }

  function findById(id: string): T | null {
    const row = connection.prepare(`${selectSql} WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    return row ? rowToEntity<T>(row, definition.columns, jsonColumns, columnOverrides) : null;
  }

  function all(): T[] {
    const rows = connection.prepare(`${selectSql} ORDER BY created_at ASC`).all() as Record<string, unknown>[];
    return rows.map((row) => rowToEntity<T>(row, definition.columns, jsonColumns, columnOverrides));
  }

  function update(id: string, patch: UpdateEntity<T>): T {
    requireEntity(findById(id), definition.tableName, id);
    const patchRecord = {
      ...patch,
      updatedAt: patch.updatedAt ?? nowIso()
    } as Partial<T>;
    const properties = definition.columns.filter((property) => {
      return property !== 'id' && property !== 'createdAt' && patchRecord[property] !== undefined;
    });
    if (properties.length === 0) return requireEntity(findById(id), definition.tableName, id);

    const assignments = properties.map((property) => `${columnName(property, columnOverrides)} = ?`).join(', ');
    const values = properties.map((property) => encodeValue(property, patchRecord[property], jsonColumns));
    connection.prepare(`UPDATE ${definition.tableName} SET ${assignments} WHERE id = ?`).run(...values, id);
    return requireEntity(findById(id), definition.tableName, id);
  }

  function upsert(input: CreateEntity<T>): T {
    const existing = findById(input.id);
    if (!existing) return create(input);
    const { id: _id, createdAt: _createdAt, ...patch } = input as Partial<T>;
    return update(input.id, patch as UpdateEntity<T>);
  }

  function findManyBy<K extends keyof T & string>(field: K, value: T[K]): T[] {
    const rows = connection
      .prepare(`${selectSql} WHERE ${columnName(field, columnOverrides)} = ? ORDER BY created_at ASC`)
      .all(encodeValue(field, value, jsonColumns)) as Record<string, unknown>[];
    return rows.map((row) => rowToEntity<T>(row, definition.columns, jsonColumns, columnOverrides));
  }

  return {
    create,
    upsert,
    findById,
    all,
    update,
    findManyBy
  };
}
