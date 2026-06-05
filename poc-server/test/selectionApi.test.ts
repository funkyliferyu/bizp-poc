import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { seedDemoStore } from '../src/seedStoreLearning.js';
import { createAnalysisRunRoutes } from '../src/storeLearning/routes/analysisRuns.js';
import { createCollectionItemRoutes } from '../src/storeLearning/routes/collectionItems.js';
import { createCollectionRunRoutes } from '../src/storeLearning/routes/collectionRuns.js';

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

describe('selection API', () => {
  let connection: DbConnection;
  let server: ReturnType<express.Express['listen']>;
  let baseUrl: string;

  beforeEach(() => {
    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    seedDemoStore(connection);

    const repos = createStoreLearningRepositories(connection);
    repos.collectionItems.upsert({
      id: 'collection_item_demo_ai_blog',
      runId: 'collection_run_demo_store_learning',
      storeId: 'store_demo_cake',
      channel: 'blog',
      sourceType: 'post',
      status: 'collected',
      sourceUrl: 'https://blog.naver.com/demo-cake/ai',
      title: 'AI 작성 의심 블로그 글',
      bodyText: '반복적인 문체의 mock 블로그 글입니다.',
      selectedForAnalysis: 0,
      selectionReason: null,
      selectedAt: null,
      metadata: { provider: 'mock', aiSuspected: true },
      createdAt: '2026-06-05T00:00:30.000Z',
      updatedAt: '2026-06-05T00:00:30.000Z'
    });

    const app = express();
    app.use(express.json());
    app.use('/api/collection-runs', createCollectionRunRoutes({ connection, stepDelayMs: 0 }));
    app.use('/api/collection-items', createCollectionItemRoutes({ connection }));
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

  it('returns collected selectable items with default selection hints', async () => {
    const response = await fetch(`${baseUrl}/api/collection-runs/collection_run_demo_store_learning/selectable-items`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.collectionRunId).toBe('collection_run_demo_store_learning');
    expect(body.items.map((item: { id: string }) => item.id)).toContain('collection_item_demo_place_profile');
    expect(body.items.every((item: { status: string }) => item.status === 'collected')).toBe(true);
    expect(body.items.find((item: { id: string }) => item.id === 'collection_item_demo_place_profile')).toMatchObject({
      sourceType: 'profile',
      selectedForAnalysis: 1,
      defaultIncluded: true
    });
    expect(body.items.find((item: { id: string }) => item.id === 'collection_item_demo_ai_blog')).toMatchObject({
      selectedForAnalysis: 0,
      defaultIncluded: false,
      qualityFlags: ['ai_suspected']
    });
  });

  it('persists item selection and creates a queued analysis run', async () => {
    const patchResponse = await fetch(`${baseUrl}/api/collection-items/collection_item_demo_blog/selection`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected: false, selectionReason: 'manual smoke toggle' })
    });
    const patched = await readJson(patchResponse);

    expect(patchResponse.status).toBe(200);
    expect(patched.collectionItem.selectedForAnalysis).toBe(0);
    expect(patched.collectionItem.selectionReason).toBe('manual smoke toggle');

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
    const repos = createStoreLearningRepositories(connection);
    const blog = repos.collectionItems.findById('collection_item_demo_blog');
    const profile = repos.collectionItems.findById('collection_item_demo_place_profile');
    const analysisRun = repos.analysisRuns.findById(created.analysisRunId);

    expect(createResponse.status).toBe(200);
    expect(created.analysisRun.status).toBe('queued');
    expect(created.analysisRun.result.selectedItemIds).toEqual([
      'collection_item_demo_place_profile',
      'collection_item_demo_place_review'
    ]);
    expect(analysisRun?.status).toBe('queued');
    expect(profile?.selectedForAnalysis).toBe(1);
    expect(blog?.selectedForAnalysis).toBe(0);
  });
});
