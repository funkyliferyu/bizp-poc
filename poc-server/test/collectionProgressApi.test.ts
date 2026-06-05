import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createCollectionRunRoutes } from '../src/storeLearning/routes/collectionRuns.js';
import { createStoreRoutes } from '../src/storeLearning/routes/stores.js';
import { seedDemoStore } from '../src/seedStoreLearning.js';

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function waitForCompleted(baseUrl: string, runId: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/collection-runs/${runId}`);
    const body = await readJson(response);
    if (body.collectionRun.status === 'completed') return body.collectionRun;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('collection run did not complete');
}

describe('Collection progress API', () => {
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
    app.use('/api/collection-runs', createCollectionRunRoutes({ connection, stepDelayMs: 0 }));
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

  it('starts a queued run and persists item statuses using mock provider data', async () => {
    await fetch(`${baseUrl}/api/stores/store_demo_cake/training-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channels: {
          naverBlog: { enabled: true, blogPostLimit: 2 },
          naverPlace: { enabled: true, placeReviewLimit: 3 },
          instagram: { enabled: false, instagramPostLimit: 0 }
        }
      })
    });
    const createRunResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/collection-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const created = await readJson(createRunResponse);

    const startResponse = await fetch(`${baseUrl}/api/collection-runs/${created.collectionRunId}/start`, {
      method: 'POST'
    });
    const started = await readJson(startResponse);

    expect(startResponse.status).toBe(200);
    expect(started.collectionRun.status).toBe('collecting');

    const completed = await waitForCompleted(baseUrl, created.collectionRunId);
    expect(completed.status).toBe('completed');
    expect(completed.summary.collectedCounts).toEqual({
      blogPosts: 2,
      placeProfiles: 1,
      placeReviews: 3
    });

    const itemsResponse = await fetch(`${baseUrl}/api/collection-runs/${created.collectionRunId}/items`);
    const items = await readJson(itemsResponse);

    expect(items.collectionItems).toHaveLength(6);
    expect(items.collectionItems.map((item: { status: string }) => item.status)).toEqual(
      Array(6).fill('collected')
    );
    expect(items.collectionItems.filter((item: { sourceType: string }) => item.sourceType === 'post')).toHaveLength(2);
    expect(items.collectionItems.filter((item: { sourceType: string }) => item.sourceType === 'profile')).toHaveLength(1);
    expect(items.collectionItems.filter((item: { sourceType: string }) => item.sourceType === 'review')).toHaveLength(3);
  });
});
