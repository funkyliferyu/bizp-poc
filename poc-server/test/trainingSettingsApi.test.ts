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
          naverBlog: { enabled: true, blogPostLimit: 75, sourceUrl: 'https://blog.naver.com/demo-cake' },
          naverPlace: { enabled: true, placeReviewLimit: 42, sourceUrl: 'https://naver.me/demo-cake' },
          instagram: { enabled: false, instagramPostLimit: 0, sourceUrl: null },
          daangn: { enabled: true, daangnPostLimit: 10, sourceUrl: 'https://www.daangn.com/kr/local-profile/demo' }
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
      naverBlog: { enabled: true, blogPostLimit: 75, sourceUrl: 'https://blog.naver.com/demo-cake' },
      naverPlace: { enabled: true, placeReviewLimit: 42, sourceUrl: 'https://naver.me/demo-cake' },
      instagram: { enabled: false, instagramPostLimit: 0, sourceUrl: null },
      daangn: { enabled: true, daangnPostLimit: 10, sourceUrl: 'https://www.daangn.com/kr/local-profile/demo' },
      youtube: { enabled: false, sourceUrl: null },
      tiktok: { enabled: false, sourceUrl: null }
    });

    const repos = createStoreLearningRepositories(connection);
    const persisted = repos.trainingSettings.listByStoreId('store_demo_cake').at(-1);
    expect(persisted?.settings).toEqual(saved.settings.settings);
    expect(repos.storeChannels.listByStoreId('store_demo_cake')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: 'blog', sourceUrl: 'https://blog.naver.com/demo-cake' }),
        expect.objectContaining({ channel: 'place', sourceUrl: 'https://naver.me/demo-cake' }),
        expect.objectContaining({ channel: 'daangn', sourceUrl: 'https://www.daangn.com/kr/local-profile/demo' })
      ])
    );
  });

  it('creates a queued collection run from saved training settings', async () => {
    await fetch(`${baseUrl}/api/stores/store_demo_cake/training-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channels: {
          naverBlog: { enabled: true, blogPostLimit: 30, sourceUrl: 'https://blog.naver.com/demo-cake' },
          naverPlace: { enabled: true, placeReviewLimit: 20, sourceUrl: 'https://naver.me/demo-cake' },
          instagram: { enabled: true, instagramPostLimit: 10, sourceUrl: 'https://instagram.com/demo-cake' },
          daangn: { enabled: true, daangnPostLimit: 1, sourceUrl: 'https://www.daangn.com/kr/local-profile/demo' }
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
        instagramPostLimit: 10,
        daangnPostLimit: 1
      },
      sourceUrls: {
        naverBlog: 'https://blog.naver.com/demo-cake',
        naverPlace: 'https://naver.me/demo-cake',
        instagram: 'https://instagram.com/demo-cake',
        daangn: 'https://www.daangn.com/kr/local-profile/demo',
        youtube: null,
        tiktok: null
      },
      channelPlan: {
        naverBlog: { enabled: true, limit: 30 },
        naverPlace: { enabled: true, limit: 20 },
        instagram: { enabled: true, limit: 10 },
        daangn: { enabled: true, limit: 1 }
      },
      sourcePolicy: {
        ownerAuthorized: false,
        placeProvider: 'mock',
        blogProvider: 'mock'
      }
    });
  });

  it('records configured source URLs in collection run summaries without enabling future providers', async () => {
    await fetch(`${baseUrl}/api/stores/store_demo_cake/training-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channels: {
          naverBlog: { enabled: true, blogPostLimit: 10, sourceUrl: 'https://blog.naver.com/demo-cake' },
          naverPlace: { enabled: true, placeReviewLimit: 10, sourceUrl: 'https://naver.me/demo-cake' },
          instagram: { enabled: false, instagramPostLimit: 0, sourceUrl: 'https://instagram.com/demo-cake' },
          daangn: { enabled: false, daangnPostLimit: 0, sourceUrl: null }
        }
      })
    });

    const runResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/collection-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const run = await readJson(runResponse);

    expect(run.collectionRun.summary.sourceUrls).toEqual({
      naverBlog: 'https://blog.naver.com/demo-cake',
      naverPlace: 'https://naver.me/demo-cake',
      instagram: 'https://instagram.com/demo-cake',
      daangn: null,
      youtube: null,
      tiktok: null
    });
    expect(run.collectionRun.summary.channelPlan.instagram).toEqual({ enabled: false, limit: 0 });
    expect(run.collectionRun.summary.channelPlan.daangn).toEqual({ enabled: false, limit: 0 });
  });

  it('preserves future-provider channel URLs and records them in collection run summaries without enabling collection', async () => {
    const repos = createStoreLearningRepositories(connection);
    repos.storeChannels.upsert({
      id: 'channel_store_demo_cake_youtube',
      storeId: 'store_demo_cake',
      channel: 'youtube',
      sourceUrl: 'https://www.youtube.com/@demo-cake',
      status: 'connected',
      providerMode: 'provider_ready',
      settings: {
        providerScope: 'not_implemented',
        detectedFrom: 'naver_place'
      }
    });
    repos.storeChannels.upsert({
      id: 'channel_store_demo_cake_tiktok',
      storeId: 'store_demo_cake',
      channel: 'tiktok',
      sourceUrl: 'https://www.tiktok.com/@demo-cake',
      status: 'connected',
      providerMode: 'provider_ready',
      settings: {
        providerScope: 'not_implemented',
        detectedFrom: 'naver_place'
      }
    });

    await fetch(`${baseUrl}/api/stores/store_demo_cake/training-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channels: {
          naverBlog: { enabled: true, blogPostLimit: 10, sourceUrl: 'https://blog.naver.com/demo-cake' },
          naverPlace: { enabled: true, placeReviewLimit: 10, sourceUrl: 'https://naver.me/demo-cake' },
          instagram: { enabled: false, instagramPostLimit: 0, sourceUrl: null },
          daangn: { enabled: false, daangnPostLimit: 0, sourceUrl: null }
        }
      })
    });

    const savedChannels = repos.storeChannels.listByStoreId('store_demo_cake');
    expect(savedChannels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: 'youtube',
          sourceUrl: 'https://www.youtube.com/@demo-cake',
          providerMode: 'provider_ready'
        }),
        expect.objectContaining({
          channel: 'tiktok',
          sourceUrl: 'https://www.tiktok.com/@demo-cake',
          providerMode: 'provider_ready'
        })
      ])
    );

    const runResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/collection-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const run = await readJson(runResponse);

    expect(runResponse.status).toBe(200);
    expect(run.collectionRun.summary.sourceUrls).toEqual(
      expect.objectContaining({
        youtube: 'https://www.youtube.com/@demo-cake',
        tiktok: 'https://www.tiktok.com/@demo-cake'
      })
    );
    expect(run.collectionRun.summary.channelPlan).not.toHaveProperty('youtube');
    expect(run.collectionRun.summary.channelPlan).not.toHaveProperty('tiktok');
  });
});
