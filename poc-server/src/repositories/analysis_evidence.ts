import type { DbConnection } from '../db/connection.js';
import { createRepository, type BaseEntity, type JsonValue } from './base.js';

export type AnalysisEvidence = BaseEntity & {
  analysisRunId: string;
  collectionItemId: string | null;
  evidenceType: string;
  summary: string;
  score: number | null;
  metadata: JsonValue;
};

const columns = [
  'id',
  'analysisRunId',
  'collectionItemId',
  'evidenceType',
  'summary',
  'score',
  'metadata',
  'createdAt',
  'updatedAt'
] as const;

export function createAnalysisEvidenceRepository(connection: DbConnection) {
  const repository = createRepository<AnalysisEvidence>(connection, {
    tableName: 'analysis_evidence',
    columns,
    jsonColumns: ['metadata']
  });
  return {
    ...repository,
    listByAnalysisRunId: (analysisRunId: string) => repository.findManyBy('analysisRunId', analysisRunId)
  };
}
