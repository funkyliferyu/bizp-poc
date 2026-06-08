import express from 'express';
import { readFileSync } from 'node:fs';
import { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { seedDemoStore } from '../src/seedStoreLearning.js';
import { createCollectionRunRoutes } from '../src/storeLearning/routes/collectionRuns.js';
import { createStoreRoutes } from '../src/storeLearning/routes/stores.js';
import {
  extractRenderedPlaceReviews,
  toNaverPlaceVisitorReviewUrl
} from '../src/storeLearning/collection/naverPlaceRenderedCollectionProvider.js';

const fixturePath = fileURLToPath(new URL('./fixtures/naver-place-rendered-review-visitor.html', import.meta.url));
const fixtureHtml = readFileSync(fixturePath, 'utf8');
const placeUrl = 'https://m.place.naver.com/restaurant/1838952735/home';
const reviewUrl = 'https://m.place.naver.com/restaurant/1838952735/review/visitor';

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
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

describe('Naver Place rendered collection provider', () => {
  let connection: DbConnection;
  let server: ReturnType<express.Express['listen']> | null = null;

  beforeEach(() => {
    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    seedDemoStore(connection);
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      server = null;
    }
    connection.close();
  });

  it('builds a visitor review tab URL from a rendered Place URL', () => {
    expect(toNaverPlaceVisitorReviewUrl(placeUrl)).toBe(reviewUrl);
    expect(toNaverPlaceVisitorReviewUrl(reviewUrl)).toBe(reviewUrl);
    expect(toNaverPlaceVisitorReviewUrl('https://map.naver.com/p/entry/place/1838952735')).toBe(
      'https://m.place.naver.com/place/1838952735/review/visitor'
    );
  });

  it('extracts visitor reviews, owner reply state, and review keywords from rendered HTML', () => {
    const reviews = extractRenderedPlaceReviews({
      html: fixtureHtml,
      bodyText: null,
      finalUrl: reviewUrl
    });

    expect(reviews).toHaveLength(3);
    expect(reviews[0]).toEqual(
      expect.objectContaining({
        reviewId: 'visitor-review-1001',
        reviewerName: '케이크러버',
        reviewDate: '2026.06.01',
        rating: 5,
        bodyText: '레터링 케이크 문구가 깔끔했고 당일 픽업 안내가 친절했어요.',
        reviewKeywords: ['디저트가 맛있어요', '포장이 꼼꼼해요'],
        hasMedia: true,
        hasVideo: false,
        hasOwnerReply: true,
        ownerReplyText: '소중한 리뷰 감사합니다. 다음에도 예쁘게 준비해드릴게요.',
        replyStatus: 'replied'
      })
    );
    expect(reviews[1].replyStatus).toBe('not_replied');
    expect(reviews[2]).toEqual(
      expect.objectContaining({
        hasVideo: true,
        reviewKeywords: ['맞춤 제작을 잘해요', '응대가 빨라요']
      })
    );
  });

  it('persists rendered Place visitor reviews as collection items through the collection run API', async () => {
    const providerEnv = {
      NAVER_OWNER_AUTHORIZED: 'true',
      NAVER_PLACE_PROVIDER: 'rendered',
      NAVER_BLOG_PROVIDER: 'mock',
      NAVER_PLACE_RENDERER_ENDPOINT: ''
    };
    const app = express();
    app.use(express.json());
    app.get('/fake-renderer', (req, res) => {
      expect(req.query.url).toBe(reviewUrl);
      res.json({
        finalUrl: reviewUrl,
        html: fixtureHtml,
        bodyText: null
      });
    });
    app.use('/api/stores', createStoreRoutes({ connection, env: providerEnv }));
    app.use('/api/collection-runs', createCollectionRunRoutes({ connection, stepDelayMs: 0, env: providerEnv }));
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    providerEnv.NAVER_PLACE_RENDERER_ENDPOINT = `${baseUrl}/fake-renderer`;

    const repos = createStoreLearningRepositories(connection);
    repos.stores.update('store_demo_cake', {
      naverPlaceUrl: placeUrl,
      naverPlaceId: '1838952735'
    });

    await fetch(`${baseUrl}/api/stores/store_demo_cake/training-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channels: {
          naverBlog: { enabled: true, blogPostLimit: 1 },
          naverPlace: { enabled: true, placeReviewLimit: 2 },
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
    expect(started.collectionRun.summary.provider).toEqual({
      name: 'naverPlaceRenderedCollectionProvider',
      mode: 'real'
    });

    const terminal = await waitForTerminalRun(baseUrl, created.collectionRunId);
    expect(terminal.status).toBe('completed');
    expect(terminal.mode).toBe('real');
    expect(terminal.summary.collectedCounts).toEqual({
      blogPosts: 1,
      placeProfiles: 1,
      placeReviews: 2
    });

    const itemsResponse = await fetch(`${baseUrl}/api/collection-runs/${created.collectionRunId}/items`);
    const items = await readJson(itemsResponse);
    const reviews = items.collectionItems.filter((item: { sourceType: string }) => item.sourceType === 'review');
    const post = items.collectionItems.find((item: { sourceType: string }) => item.sourceType === 'post');
    const profile = items.collectionItems.find((item: { sourceType: string }) => item.sourceType === 'profile');

    expect(post.metadata).toEqual(
      expect.objectContaining({
        provider: 'mockCollectionProvider',
        providerMode: 'mock',
        bodyAvailability: 'mock_body'
      })
    );
    expect(profile.metadata).toEqual(
      expect.objectContaining({
        provider: 'naverPlaceRenderedCollectionProvider',
        bodyAvailability: 'store_profile_snapshot'
      })
    );
    expect(reviews).toHaveLength(2);
    expect(reviews[0]).toEqual(
      expect.objectContaining({
        status: 'collected',
        sourceUrl: 'https://m.place.naver.com/restaurant/1838952735/review/visitor#visitor-review-1001',
        bodyText: '레터링 케이크 문구가 깔끔했고 당일 픽업 안내가 친절했어요.'
      })
    );
    expect(reviews[0].metadata).toEqual(
      expect.objectContaining({
        provider: 'naverPlaceRenderedCollectionProvider',
        providerMode: 'real',
        bodyAvailability: 'rendered_place_visitor_review',
        sourceKind: 'place_visitor_review',
        sourceOwnership: 'user_generated',
        ownerAuthorized: true,
        configuredPlaceProvider: 'rendered',
        replyStatus: 'replied',
        hasOwnerReply: true,
        reviewKeywords: ['디저트가 맛있어요', '포장이 꼼꼼해요']
      })
    );
    expect(reviews[1].metadata).toEqual(
      expect.objectContaining({
        replyStatus: 'not_replied',
        hasOwnerReply: false,
        reviewKeywords: ['선물하기 좋아요', '매장이 청결해요']
      })
    );
  });
});
