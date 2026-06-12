import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { seedDemoStore } from '../src/seedStoreLearning.js';
import { createStoreLearningReadinessRoutes } from '../src/storeLearning/routes/readiness.js';

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

describe('LLM audit log API', () => {
  let connection: DbConnection;
  let server: ReturnType<express.Express['listen']>;
  let baseUrl: string;

  beforeEach(() => {
    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    seedDemoStore(connection);

    const repos = createStoreLearningRepositories(connection);
    repos.llmAuditLogs.create({
      id: 'llm_audit_test_legacy',
      storeId: 'store_demo_cake',
      relatedEntityType: 'analysis_run',
      relatedEntityId: 'analysis_run_test',
      provider: 'openAIAnalysisProvider',
      mode: 'openai',
      model: 'test-model',
      action: 'analyze_store_learning',
      requestStartedAt: '2026-06-12T01:00:00.000Z',
      responseCompletedAt: '2026-06-12T01:00:01.000Z',
      durationMs: 1000,
      inputBudget: { promptItemCount: 1 },
      promptInputJson: { schemaVersion: 'sl_a1_blog_sop_input.v3' },
      responseFormatJson: { name: 'store_learning_analysis', strict: true },
      rawRequestedJson: null,
      rawParsedOutputJson: null,
      normalizedOutputJson: null,
      parsedOutputJson: { storePositioning: 'legacy normalized output' },
      status: 'completed',
      errorJson: null,
      providerMetadataJson: null
    });

    const app = express();
    app.use(
      '/api/store-learning',
      createStoreLearningReadinessRoutes({
        env: {},
        now: () => '2026-06-12T01:00:00.000Z',
        connection
      } as Parameters<typeof createStoreLearningReadinessRoutes>[0] & { connection: DbConnection })
    );
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    connection.close();
  });

  it('serves internal LLM audit logs with separated raw and normalized JSON fields', async () => {
    const response = await fetch(`${baseUrl}/api/store-learning/llm-audit-logs?storeId=store_demo_cake&limit=5`);

    expect(response.status).toBe(200);
    const body = await readJson(response);

    expect(body.logs).toHaveLength(1);
    expect(body.logs[0]).toMatchObject({
      id: 'llm_audit_test_legacy',
      storeId: 'store_demo_cake',
      action: 'analyze_store_learning',
      rawRequestedJson: null,
      rawParsedOutputJson: null,
      normalizedOutputJson: {
        storePositioning: 'legacy normalized output'
      },
      parsedOutputJson: {
        storePositioning: 'legacy normalized output'
      }
    });
  });
});
