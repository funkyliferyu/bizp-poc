import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { seedDemoStore } from '../src/seedStoreLearning.js';
import { createStoreRoutes } from '../src/storeLearning/routes/stores.js';

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

describe('Training settings API', () => {
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

  it('loads and saves channel limits for a store', async () => {
    const getResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/training-settings`);
    const existing = await readJson(getResponse);

    expect(getResponse.status).toBe(200);
    expect(existing.settings.storeId).toBe('store_demo_cake');
    expect(existing.settings.settings.channels.blog.postLimit).toBe(50);

    const putResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/training-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channels: {
          naverBlog: { enabled: true, blogPostLimit: 75 },
          naverPlace: { enabled: true, placeReviewLimit: 42 },
          instagram: { enabled: false, instagramPostLimit: 0 }
        }
      })
    });
    const saved = await readJson(putResponse);

    expect(putResponse.status).toBe(200);
    expect(saved.settings).toEqual(
      expect.objectContaining({
        storeId: 'store_demo_cake',
        status: 'ready'
      })
    );
    expect(saved.settings.settings.channels).toEqual({
      naverBlog: { enabled: true, blogPostLimit: 75 },
      naverPlace: { enabled: true, placeReviewLimit: 42 },
      instagram: { enabled: false, instagramPostLimit: 0 }
    });

    const repos = createStoreLearningRepositories(connection);
    const persisted = repos.trainingSettings.listByStoreId('store_demo_cake').at(-1);
    expect(persisted?.settings).toEqual(saved.settings.settings);
  });

  it('creates a queued collection run from saved training settings', async () => {
    await fetch(`${baseUrl}/api/stores/store_demo_cake/training-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channels: {
          naverBlog: { enabled: true, blogPostLimit: 30 },
          naverPlace: { enabled: true, placeReviewLimit: 20 },
          instagram: { enabled: true, instagramPostLimit: 10 }
        }
      })
    });

    const runResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/collection-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const run = await readJson(runResponse);

    expect(runResponse.status).toBe(200);
    expect(run.collectionRunId).toEqual(expect.stringContaining('collection_run_store_demo_cake_'));
    expect(run.collectionRun).toEqual(
      expect.objectContaining({
        id: run.collectionRunId,
        storeId: 'store_demo_cake',
        status: 'queued',
        mode: 'mock'
      })
    );
    expect(run.collectionRun.summary).toEqual({
      requestedLimits: {
        blogPostLimit: 30,
        placeReviewLimit: 20,
        instagramPostLimit: 10
      },
      channelPlan: {
        naverBlog: { enabled: true, limit: 30 },
        naverPlace: { enabled: true, limit: 20 },
        instagram: { enabled: true, limit: 10 }
      },
      sourcePolicy: {
        ownerAuthorized: false,
        placeProvider: 'mock',
        blogProvider: 'mock'
      }
    });
  });
});
