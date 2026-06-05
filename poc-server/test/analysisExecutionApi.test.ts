import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { seedDemoStore } from '../src/seedStoreLearning.js';
import { createAnalysisRunRoutes } from '../src/storeLearning/routes/analysisRuns.js';
import { createStoreRoutes } from '../src/storeLearning/routes/stores.js';

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

describe('analysis execution API', () => {
  let connection: DbConnection;
  let server: ReturnType<express.Express['listen']>;
  let baseUrl: string;

  beforeEach(() => {
    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    seedDemoStore(connection);

    const app = express();
    app.use(express.json());
    app.use('/api/stores', createStoreRoutes({ connection, env: {} }));
    app.use('/api/analysis-runs', createAnalysisRunRoutes({ connection }));
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    });
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    connection.close();
  });

  it('generates a learning snapshot, marketing ruleset, editable fields, and item-linked evidence', async () => {
    const createResponse = await fetch(`${baseUrl}/api/analysis-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: 'store_demo_cake',
        collectionRunId: 'collection_run_demo_store_learning',
        selectedItemIds: [
          'collection_item_demo_blog',
          'collection_item_demo_place_profile',
          'collection_item_demo_place_review'
        ]
      })
    });
    const created = await readJson(createResponse);

    const startResponse = await fetch(`${baseUrl}/api/analysis-runs/${created.analysisRunId}/start`, {
      method: 'POST'
    });
    const started = await readJson(startResponse);
    const repos = createStoreLearningRepositories(connection);
    const persistedRun = repos.analysisRuns.findById(created.analysisRunId);
    const snapshots = repos.learningSnapshots.listByAnalysisRunId(created.analysisRunId);
    const evidence = repos.analysisEvidence.listByAnalysisRunId(created.analysisRunId);
    const rulesets = repos.marketingRulesets.listByStoreId('store_demo_cake');
    const generatedRuleset = rulesets.find((ruleset) => ruleset.learningSnapshotId === snapshots[0]?.id);
    const fields = generatedRuleset ? repos.rulesetFields.listByRulesetId(generatedRuleset.id) : [];

    expect(startResponse.status).toBe(200);
    expect(started.analysisRun.status).toBe('completed');
    expect(persistedRun?.status).toBe('completed');
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].snapshot).toMatchObject({
      storePositioning: expect.any(String),
      keyStrengths: expect.any(Array),
      targetCustomers: expect.any(Array),
      toneAndManner: expect.any(String),
      blogWritingStyle: expect.any(String),
      seoKeywords: expect.any(Array),
      ctaStyle: expect.any(String),
      imageDirection: expect.any(String),
      negativeExpressions: expect.any(Array)
    });
    expect(generatedRuleset).toBeTruthy();
    expect(generatedRuleset?.status).toBe('draft');
    expect(evidence.length).toBeGreaterThanOrEqual(3);
    expect(evidence.map((item) => item.collectionItemId)).toEqual(
      expect.arrayContaining([
        'collection_item_demo_blog',
        'collection_item_demo_place_profile',
        'collection_item_demo_place_review'
      ])
    );
    expect(fields.map((field) => field.fieldKey)).toEqual(
      expect.arrayContaining([
        'storePositioning',
        'keyStrengths',
        'targetCustomers',
        'toneAndManner',
        'blogWritingStyle',
        'seoKeywords',
        'ctaStyle',
        'imageDirection',
        'negativeExpressions'
      ])
    );
    expect(fields.find((field) => field.fieldKey === 'storePositioning')).toMatchObject({
      aiValue: expect.any(String),
      userValue: null,
      finalValue: expect.any(String),
      source: 'mock_analyzer',
      locked: 0,
      evidenceItemIds: expect.arrayContaining(['collection_item_demo_place_profile'])
    });
  });

  it('returns the latest completed analysis artifacts for a store', async () => {
    const createResponse = await fetch(`${baseUrl}/api/analysis-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: 'store_demo_cake',
        collectionRunId: 'collection_run_demo_store_learning',
        selectedItemIds: ['collection_item_demo_place_profile', 'collection_item_demo_place_review']
      })
    });
    const created = await readJson(createResponse);
    await fetch(`${baseUrl}/api/analysis-runs/${created.analysisRunId}/start`, { method: 'POST' });

    const latestResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/latest-analysis`);
    const latest = await readJson(latestResponse);

    expect(latestResponse.status).toBe(200);
    expect(latest.analysisRun.id).toBe(created.analysisRunId);
    expect(latest.analysisRun.status).toBe('completed');
    expect(latest.learningSnapshot.status).toBe('active');
    expect(latest.marketingRuleset.status).toBe('draft');
    expect(latest.rulesetFields.length).toBeGreaterThanOrEqual(9);
    expect(latest.analysisEvidence.length).toBeGreaterThanOrEqual(2);
  });
});
