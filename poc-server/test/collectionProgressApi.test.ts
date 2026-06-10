import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createCollectionRunRoutes } from '../src/storeLearning/routes/collectionRuns.js';
import { createStoreRoutes } from '../src/storeLearning/routes/stores.js';
import { seedDemoStore } from '../src/seedStoreLearning.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';

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

async function waitForTerminalRun(baseUrl: string, runId: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/collection-runs/${runId}`);
    const body = await readJson(response);
    if (['completed', 'partial_completed', 'failed'].includes(body.collectionRun.status)) return body.collectionRun;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('collection run did not reach a terminal state');
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

  it('skips Blog items already collected for the same store on repeated runs', async () => {
    await fetch(`${baseUrl}/api/stores/store_demo_cake/training-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channels: {
          naverBlog: { enabled: true, blogPostLimit: 2 },
          naverPlace: { enabled: false, placeReviewLimit: 0 },
          instagram: { enabled: false, instagramPostLimit: 0 }
        }
      })
    });

    const firstCreateResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/collection-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const firstCreated = await readJson(firstCreateResponse);
    await fetch(`${baseUrl}/api/collection-runs/${firstCreated.collectionRunId}/start`, { method: 'POST' });
    await waitForCompleted(baseUrl, firstCreated.collectionRunId);

    const secondCreateResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/collection-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const secondCreated = await readJson(secondCreateResponse);
    await fetch(`${baseUrl}/api/collection-runs/${secondCreated.collectionRunId}/start`, { method: 'POST' });
    const secondRun = await waitForCompleted(baseUrl, secondCreated.collectionRunId);

    const secondItemsResponse = await fetch(`${baseUrl}/api/collection-runs/${secondCreated.collectionRunId}/items`);
    const secondItems = await readJson(secondItemsResponse);
    const repos = createStoreLearningRepositories(connection);
    const mockBlogUrls = repos.collectionItems
      .listByStoreId('store_demo_cake')
      .filter((item) => item.channel === 'blog' && item.sourceType === 'post')
      .map((item) => item.sourceUrl)
      .filter((url): url is string => Boolean(url?.startsWith('https://blog.naver.com/mock-store/')));

    expect(secondRun.summary.totalItems).toBe(0);
    expect(secondItems.collectionItems).toEqual([]);
    expect(mockBlogUrls).toHaveLength(2);
    expect(new Set(mockBlogUrls).size).toBe(2);
  });

  it('records collection delta and skips unchanged Place profiles on repeated runs', async () => {
    await fetch(`${baseUrl}/api/stores/store_demo_cake/training-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channels: {
          naverBlog: { enabled: true, blogPostLimit: 1 },
          naverPlace: { enabled: true, placeReviewLimit: 1 },
          instagram: { enabled: false, instagramPostLimit: 0 }
        }
      })
    });

    const firstCreateResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/collection-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const firstCreated = await readJson(firstCreateResponse);
    await fetch(`${baseUrl}/api/collection-runs/${firstCreated.collectionRunId}/start`, { method: 'POST' });
    const firstRun = await waitForCompleted(baseUrl, firstCreated.collectionRunId);

    expect(firstRun.summary.collectionDelta).toEqual(
      expect.objectContaining({
        hasMeaningfulChanges: true,
        counts: { new: 3, duplicate: 0, unchanged: 0, changed: 0 }
      })
    );

    const secondCreateResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/collection-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const secondCreated = await readJson(secondCreateResponse);
    await fetch(`${baseUrl}/api/collection-runs/${secondCreated.collectionRunId}/start`, { method: 'POST' });
    const secondRun = await waitForCompleted(baseUrl, secondCreated.collectionRunId);

    const secondItemsResponse = await fetch(`${baseUrl}/api/collection-runs/${secondCreated.collectionRunId}/items`);
    const secondItems = await readJson(secondItemsResponse);
    const repos = createStoreLearningRepositories(connection);
    const storedProfiles = repos.collectionItems
      .listByStoreId('store_demo_cake')
      .filter((item) => item.channel === 'place' && item.sourceType === 'profile' && item.sourceUrl === 'https://naver.me/mock-place');

    expect(secondRun.summary.totalItems).toBe(0);
    expect(secondRun.summary.collectionDelta).toEqual(
      expect.objectContaining({
        hasMeaningfulChanges: false,
        counts: { new: 0, duplicate: 2, unchanged: 1, changed: 0 }
      })
    );
    expect(secondItems.collectionItems).toEqual([]);
    expect(storedProfiles).toHaveLength(1);
    expect(storedProfiles[0].metadata).toEqual(
      expect.objectContaining({
        collectionDelta: 'new',
        profileFingerprint: expect.any(String)
      })
    );
  });

  it('keeps requested limits available before provider items are created', async () => {
    await fetch(`${baseUrl}/api/stores/store_demo_cake/training-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channels: {
          naverBlog: { enabled: true, blogPostLimit: 10 },
          naverPlace: { enabled: true, placeReviewLimit: 50 },
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

    expect(createRunResponse.status).toBe(200);
    expect(created.collectionRun.status).toBe('queued');
    expect(created.collectionRun.summary.requestedLimits).toEqual(
      expect.objectContaining({
        blogPostLimit: 10,
        placeReviewLimit: 50
      })
    );
    expect(created.collectionRun.summary.channelPlan).toEqual(
      expect.objectContaining({
        naverBlog: { enabled: true, limit: 10 },
        naverPlace: { enabled: true, limit: 50 }
      })
    );

    const itemsResponse = await fetch(`${baseUrl}/api/collection-runs/${created.collectionRunId}/items`);
    const items = await readJson(itemsResponse);
    expect(items.collectionItems).toEqual([]);
    expect(items.collectionRunId).toBe(created.collectionRunId);
  });

  it('persists owner-authorized source metadata on collection runs and items', async () => {
    const ownerEnv = {
      NAVER_OWNER_AUTHORIZED: 'true',
      NAVER_PLACE_PROVIDER: 'mock',
      NAVER_BLOG_PROVIDER: 'mock'
    };
    const ownerApp = express();
    ownerApp.use(express.json());
    ownerApp.use('/api/stores', createStoreRoutes({ connection, env: ownerEnv }));
    ownerApp.use('/api/collection-runs', createCollectionRunRoutes({ connection, stepDelayMs: 0, env: ownerEnv }));
    const ownerServer = ownerApp.listen(0);
    const ownerAddress = ownerServer.address() as AddressInfo;
    const ownerBaseUrl = `http://127.0.0.1:${ownerAddress.port}`;

    try {
      await fetch(`${ownerBaseUrl}/api/stores/store_demo_cake/training-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channels: {
            naverBlog: { enabled: true, blogPostLimit: 1 },
            naverPlace: { enabled: true, placeReviewLimit: 1 },
            instagram: { enabled: false, instagramPostLimit: 0 }
          }
        })
      });
      const createRunResponse = await fetch(`${ownerBaseUrl}/api/stores/store_demo_cake/collection-runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const created = await readJson(createRunResponse);

      expect(created.collectionRun.summary.sourcePolicy).toEqual({
        ownerAuthorized: true,
        placeProvider: 'mock',
        blogProvider: 'mock'
      });

      await fetch(`${ownerBaseUrl}/api/collection-runs/${created.collectionRunId}/start`, {
        method: 'POST'
      });
      await waitForCompleted(ownerBaseUrl, created.collectionRunId);

      const itemsResponse = await fetch(`${ownerBaseUrl}/api/collection-runs/${created.collectionRunId}/items`);
      const items = await readJson(itemsResponse);
      const post = items.collectionItems.find((item: { sourceType: string }) => item.sourceType === 'post');
      const profile = items.collectionItems.find((item: { sourceType: string }) => item.sourceType === 'profile');
      const review = items.collectionItems.find((item: { sourceType: string }) => item.sourceType === 'review');

      expect(post.metadata).toEqual(
        expect.objectContaining({
          ownerAuthorized: true,
          sourceKind: 'owner_blog_post',
          sourceOwnership: 'owner_managed',
          configuredBlogProvider: 'mock'
        })
      );
      expect(profile.metadata).toEqual(
        expect.objectContaining({
          ownerAuthorized: true,
          sourceKind: 'place_profile',
          sourceOwnership: 'owner_managed',
          configuredPlaceProvider: 'mock'
        })
      );
      expect(review.metadata).toEqual(
        expect.objectContaining({
          ownerAuthorized: true,
          sourceKind: 'place_visitor_review',
          sourceOwnership: 'user_generated',
          configuredPlaceProvider: 'mock'
        })
      );
    } finally {
      await new Promise<void>((resolve) => ownerServer.close(() => resolve()));
    }
  });

  it('uses Naver Search providers for collection metadata when mock mode is disabled', async () => {
    const providerEnv = {
      STORE_LEARNING_MOCK_MODE: 'false',
      NAVER_CLIENT_ID: 'collection-client-id',
      NAVER_CLIENT_SECRET: 'collection-client-secret',
      NAVER_BLOG_SEARCH_ENDPOINT: '',
      NAVER_LOCAL_SEARCH_ENDPOINT: ''
    };
    const realApp = express();
    realApp.use(express.json());
    realApp.get('/fake-naver/blog', (req, res) => {
      expect(req.header('X-Naver-Client-Id')).toBe('collection-client-id');
      expect(req.header('X-Naver-Client-Secret')).toBe('collection-client-secret');
      expect(String(req.query.query)).toContain('분당 케이크하우스');
      expect(req.query.display).toBe('2');
      res.json({
        total: 2,
        start: 1,
        display: 2,
        items: [
          {
            title: '<b>분당</b> 케이크하우스 예약 후기',
            link: 'https://blog.naver.com/demo-cake/100',
            description: '레터링 케이크 예약 과정을 요약한 검색 snippet입니다.',
            bloggername: '케이크 리뷰어',
            bloggerlink: 'https://blog.naver.com/demo-cake',
            postdate: '20260601'
          },
          {
            title: '정자동 케이크 픽업 후기',
            link: 'https://blog.naver.com/demo-cake/101',
            description: '픽업 동선과 포장 상태를 요약한 검색 snippet입니다.',
            bloggername: '디저트 노트',
            bloggerlink: 'https://blog.naver.com/dessert-note',
            postdate: '20260602'
          }
        ]
      });
    });
    realApp.get('/fake-naver/local', (req, res) => {
      expect(req.header('X-Naver-Client-Id')).toBe('collection-client-id');
      expect(req.header('X-Naver-Client-Secret')).toBe('collection-client-secret');
      expect(String(req.query.query)).toContain('분당 케이크하우스');
      res.json({
        total: 1,
        start: 1,
        display: 1,
        items: [
          {
            title: '<b>분당</b> 케이크하우스',
            link: 'https://map.naver.com/p/entry/place/place_demo_cake',
            category: '음식점>카페,디저트',
            description: '정자동 레터링 케이크 예약 전문점입니다.',
            telephone: '',
            address: '경기도 성남시 분당구 정자동',
            roadAddress: '경기도 성남시 분당구 정자일로 1',
            mapx: '321000',
            mapy: '532000'
          }
        ]
      });
    });
    realApp.use('/api/stores', createStoreRoutes({ connection, env: providerEnv }));
    realApp.use('/api/collection-runs', createCollectionRunRoutes({ connection, stepDelayMs: 0, env: providerEnv }));
    const realServer = realApp.listen(0);
    const realAddress = realServer.address() as AddressInfo;
    const realBaseUrl = `http://127.0.0.1:${realAddress.port}`;
    providerEnv.NAVER_BLOG_SEARCH_ENDPOINT = `${realBaseUrl}/fake-naver/blog`;
    providerEnv.NAVER_LOCAL_SEARCH_ENDPOINT = `${realBaseUrl}/fake-naver/local`;

    try {
      await fetch(`${realBaseUrl}/api/stores/store_demo_cake/training-settings`, {
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
      const createRunResponse = await fetch(`${realBaseUrl}/api/stores/store_demo_cake/collection-runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const created = await readJson(createRunResponse);

      const startResponse = await fetch(`${realBaseUrl}/api/collection-runs/${created.collectionRunId}/start`, {
        method: 'POST'
      });
      const started = await readJson(startResponse);

      expect(startResponse.status).toBe(200);
      expect(started.collectionRun.summary.provider).toEqual({
        name: 'naverSearchCollectionProvider',
        mode: 'real'
      });

      const terminal = await waitForTerminalRun(realBaseUrl, created.collectionRunId);
      expect(terminal.status).toBe('partial_completed');
      expect(terminal.mode).toBe('real');
      expect(terminal.summary.collectedCounts).toEqual({
        blogPosts: 2,
        placeProfiles: 1,
        placeReviews: 0
      });
      expect(terminal.summary.itemStatusCounts).toEqual({ collected: 3, failed: 3 });

      const itemsResponse = await fetch(`${realBaseUrl}/api/collection-runs/${created.collectionRunId}/items`);
      const items = await readJson(itemsResponse);
      const posts = items.collectionItems.filter((item: { sourceType: string }) => item.sourceType === 'post');
      const profile = items.collectionItems.find((item: { sourceType: string }) => item.sourceType === 'profile');
      const reviews = items.collectionItems.filter((item: { sourceType: string }) => item.sourceType === 'review');

      expect(posts).toHaveLength(2);
      expect(posts[0]).toEqual(
        expect.objectContaining({
          status: 'collected',
          sourceUrl: 'https://blog.naver.com/demo-cake/100',
          bodyText: '레터링 케이크 예약 과정을 요약한 검색 snippet입니다.'
        })
      );
      expect(posts[0].metadata).toEqual(
        expect.objectContaining({
          provider: 'naverSearchCollectionProvider',
          bodyAvailability: 'official_blog_search_snippet_only',
          postdate: '20260601'
        })
      );
      expect(profile).toEqual(
        expect.objectContaining({
          status: 'collected',
          title: '분당 케이크하우스',
          bodyText: expect.stringContaining('정자동 레터링 케이크')
        })
      );
      expect(reviews).toHaveLength(3);
      expect(reviews.map((item: { status: string }) => item.status)).toEqual(Array(3).fill('failed'));
      expect(reviews[0].metadata).toEqual(
        expect.objectContaining({
          provider: 'naverSearchCollectionProvider',
          reviewAvailability: 'requires_fallback_provider'
        })
      );
    } finally {
      await new Promise<void>((resolve) => realServer.close(() => resolve()));
    }
  });
});
