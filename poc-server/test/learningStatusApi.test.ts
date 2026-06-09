import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { seedDemoStore } from '../src/seedStoreLearning.js';
import { createStoreRoutes } from '../src/storeLearning/routes/stores.js';

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

describe('learning status API', () => {
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

  it('returns shaped overall learning status for the store', async () => {
    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/learning-status`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.storeId).toBe('store_demo_cake');
    expect(body.lastAnalyzedAt).toBe('2026-06-05T00:00:20.000Z');
    expect(body.ruleset).toMatchObject({
      status: 'draft',
      version: 1
    });
    expect(body.channels.blog).toMatchObject({
      status: 'analyzed',
      collectedCount: 1,
      selectedCount: 1
    });
    expect(body.channels.place).toMatchObject({
      status: 'analyzed',
      collectedCount: 2,
      selectedCount: 2
    });
    expect(body.channels.instagram).toMatchObject({
      status: 'not_connected',
      collectedCount: 0,
      selectedCount: 0
    });
    expect(body.snapshot).toMatchObject({
      status: 'active'
    });
    expect(body.analysis).toMatchObject({
      status: 'succeeded'
    });
  });

  it('returns completion criteria from collected Blog, updated Place profile, analysis, and ruleset results', async () => {
    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/learning-status`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.completion).toMatchObject({
      status: 'completed',
      label: '학습 완료',
      criteria: {
        blogCollection: {
          status: 'complete',
          collectedCount: 1,
          selectedCount: 1
        },
        placeProfile: {
          status: 'complete',
          collectedCount: 1
        },
        aiAnalysis: {
          status: 'complete',
          analysisRunId: 'analysis_run_demo_store_learning'
        },
        marketingRuleset: {
          status: 'complete',
          rulesetId: 'marketing_ruleset_demo_v1',
          version: 1
        }
      }
    });
    expect(body.completion.message).toContain('블로그 수집');
    expect(body.completion.message).toContain('마케팅 전략 룰셋');
  });

  it('returns blog, place, and instagram tab data without raw collection item rows', async () => {
    const [blogResponse, placeResponse, instagramResponse] = await Promise.all([
      fetch(`${baseUrl}/api/stores/store_demo_cake/learning-status/blog`),
      fetch(`${baseUrl}/api/stores/store_demo_cake/learning-status/place`),
      fetch(`${baseUrl}/api/stores/store_demo_cake/learning-status/instagram`)
    ]);
    const blog = await readJson(blogResponse);
    const place = await readJson(placeResponse);
    const instagram = await readJson(instagramResponse);

    expect(blogResponse.status).toBe(200);
    expect(blog.items).toEqual([
      expect.objectContaining({
        id: 'collection_item_demo_blog',
        title: '분당 레터링 케이크 후기',
        selectedForAnalysis: true
      })
    ]);
    expect(blog.items[0]).not.toHaveProperty('bodyText');
    expect(blog.seoKeywords).toContain('분당 케이크');

    expect(placeResponse.status).toBe(200);
    expect(place.profile).toMatchObject({
      id: 'collection_item_demo_place_profile',
      title: '네이버 플레이스 매장 프로필',
      selectedForAnalysis: true
    });
    expect(place.reviews).toEqual([
      expect.objectContaining({
        id: 'collection_item_demo_place_review',
        title: '플레이스 리뷰 요약'
      })
    ]);
    expect(place.reviewKeywords).toEqual(expect.arrayContaining(['레터링 디자인', '당일 제작', '친절한 상담']));

    expect(instagramResponse.status).toBe(200);
    expect(instagram.status).toBe('not_connected');
    expect(instagram.items).toEqual([]);
    expect(instagram.message).toContain('인스타그램');
  });
});
