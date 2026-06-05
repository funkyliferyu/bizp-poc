import type { DbConnection } from '../db/connection.js';
import { createRepository, type BaseEntity, type JsonValue } from './base.js';

export type AuditEvent = BaseEntity & {
  storeId: string | null;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  event: JsonValue;
};

const columns = [
  'id',
  'storeId',
  'actor',
  'action',
  'entityType',
  'entityId',
  'event',
  'createdAt',
  'updatedAt'
] as const;

export function createAuditEventsRepository(connection: DbConnection) {
  const repository = createRepository<AuditEvent>(connection, {
    tableName: 'audit_events',
    columns,
    jsonColumns: ['event']
  });
  return {
    ...repository,
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId),
    listByEntity: (entityType: string, entityId: string) =>
      repository.all().filter((event) => event.entityType === entityType && event.entityId === entityId)
  };
}
