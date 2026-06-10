import express from 'express';
import { readFileSync } from 'node:fs';
import { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { seedDemoStore } from '../src/seedStoreLearning.js';
import { createCollectionRunRoutes } from '../src/storeLearning/routes/collectionRuns.js';
import { createStoreRoutes } from '../src/storeLearning/routes/stores.js';
import {
  createNaverPlaceRenderedCollectionProvider,
  extractRenderedPlaceReviews,
  toNaverPlaceVisitorReviewUrl
} from '../src/storeLearning/collection/naverPlaceRenderedCollectionProvider.js';

const fixturePath = fileURLToPath(new URL('./fixtures/naver-place-rendered-review-visitor.html', import.meta.url));
const fixtureHtml = readFileSync(fixturePath, 'utf8');
const placeUrl = 'https://m.place.naver.com/restaurant/1838952735/home';
const reviewUrl = 'https://m.place.naver.com/restaurant/1838952735/review/visitor';
const apolloReviewHtml = `<html><body>
<script>
window.__APOLLO_STATE__ = ${JSON.stringify({
  ROOT_QUERY: {
    __typename: 'Query',
    'visitorReviews({"input":{"businessId":"1838952735","size":10}})': {
      __typename: 'VisitorReviewsResult',
      items: [{ __ref: 'VisitorReview:review-state-1:true' }]
    }
  },
  'VisitorReviewAuthor:author-1': {
    __typename: 'VisitorReviewAuthor',
    id: 'author-1',
    nickname: '케이크러버'
  },
  'VisitorReview:review-state-1:true': {
    __typename: 'VisitorReview',
    id: 'review-state-1',
    reviewId: 'review-public-1',
    author: { __ref: 'VisitorReviewAuthor:author-1' },
    body: '직접 가져온 Apollo state 방문자 리뷰 본문입니다.',
    rating: '4.5',
    created: '6.1.월',
    media: [{ __typename: 'VisitorReviewMedia', type: 'video', videoId: 'video-1' }],
    votedKeywords: [
      { __typename: 'VisitorReviewVotedKeyword', name: '음식이 맛있어요' },
      { __typename: 'VisitorReviewVotedKeyword', name: '친절해요' }
    ],
    reply: {
      __typename: 'VisitorReviewReply',
      body: '방문해 주셔서 감사합니다.'
    }
  }
})};
</script>
</body></html>`;

function apolloReviewHtmlWithItems(count: number) {
  const state: Record<string, unknown> = {
    ROOT_QUERY: {
      __typename: 'Query',
      'visitorReviews({"input":{"bookingBusinessId":"1352276","businessId":"1824807602","businessType":"restaurant","cidList":["220036"],"getReactions":true,"getTrailer":true,"getUserStats":true,"includeContent":true,"includeReceiptPhotos":true,"isPhotoUsed":false,"item":"0","size":10}})': {
        __typename: 'VisitorReviewsResult',
        total: 120,
        items: Array.from({ length: count }, (_value, index) => ({ __ref: `VisitorReview:ssr-${index + 1}:true` }))
      }
    }
  };
  for (let index = 1; index <= count; index += 1) {
    state[`VisitorReviewAuthor:ssr-author-${index}`] = {
      __typename: 'VisitorReviewAuthor',
      id: `ssr-author-${index}`,
      nickname: `ssr-${index}`
    };
    state[`VisitorReview:ssr-${index}:true`] = {
      __typename: 'VisitorReview',
      id: `ssr-${index}`,
      reviewId: `ssr-public-${index}`,
      author: { __ref: `VisitorReviewAuthor:ssr-author-${index}` },
      body: `SSR review ${index}`,
      created: '2026.06.01',
      rating: '5',
      reply: { __typename: 'VisitorReviewReply', body: `SSR reply ${index}` }
    };
  }
  return `<html><body><script>window.__APOLLO_STATE__ = ${JSON.stringify(state)};</script></body></html>`;
}

function graphQlReviewItems(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_value, offset) => {
    const index = start + offset;
    return {
      id: `graphql-${index}`,
      reviewId: index <= 10 ? `ssr-public-${index}` : `graphql-public-${index}`,
      cursor: `cursor-${index}`,
      body: index === 4 ? '' : `GraphQL fallback review ${index}`,
      rating: '5',
      created: '2026.06.01',
      author: { id: `graphql-author-${index}`, nickname: `gql-${index}` },
      reply: { body: `GraphQL owner reply ${index}` },
      votedKeywords: [{ name: '신선해요' }],
      media: []
    };
  });
}

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

  it('extracts visitor reviews from Naver mobile Apollo state snapshots', () => {
    const reviews = extractRenderedPlaceReviews({
      html: apolloReviewHtml,
      bodyText: null,
      finalUrl: reviewUrl
    });

    expect(reviews).toEqual([
      expect.objectContaining({
        reviewId: 'review-public-1',
        reviewerName: '케이크러버',
        reviewDate: '6.1.월',
        rating: 4.5,
        bodyText: '직접 가져온 Apollo state 방문자 리뷰 본문입니다.',
        reviewKeywords: ['음식이 맛있어요', '친절해요'],
        hasMedia: true,
        hasVideo: true,
        hasOwnerReply: true,
        ownerReplyText: '방문해 주셔서 감사합니다.',
        replyStatus: 'replied',
        sourceUrl: `${reviewUrl}#review-public-1`
      })
    ]);
  });

  it('preserves review date metadata on rendered visitor review items', async () => {
    const provider = createNaverPlaceRenderedCollectionProvider(async () => ({
      finalUrl: reviewUrl,
      bodyText: null,
      html: `<html><body>
        <article data-review-card data-review-id="review-date-1" data-reviewer="date-user" data-review-date="2026.06.01">
          <p class="review-body">작성일을 가진 방문자 리뷰입니다.</p>
        </article>
      </body></html>`
    }));

    const items = await provider.collect({
      env: {},
      plan: { blogPostLimit: 0, includePlaceProfile: false, placeReviewLimit: 1 },
      store: {
        id: 'store_review_date',
        name: '리뷰 작성일 테스트 매장',
        naverPlaceUrl: placeUrl,
        naverPlaceId: '1838952735',
        category: null,
        address: null,
        phone: null,
        description: null,
        metadata: {},
        createdAt: '2026-06-09T00:00:00.000Z',
        updatedAt: '2026-06-09T00:00:00.000Z'
      }
    });

    expect(items[0].metadata).toEqual(
      expect.objectContaining({
        reviewDate: '2026.06.01'
      })
    );
  });

  it('preserves visitor photo URLs from rendered visitor reviews', async () => {
    const provider = createNaverPlaceRenderedCollectionProvider(async () => ({
      finalUrl: reviewUrl,
      bodyText: null,
      html: `<html><body>
        <article data-review-card data-review-id="review-photo-1" data-reviewer="photo-user" data-review-date="2026.06.01">
          <p class="review-body">사진이 포함된 방문자 리뷰입니다.</p>
          <img src="https://pup-review-phinf.pstatic.net/review-photo-1.jpg" alt="review photo">
        </article>
      </body></html>`
    }));

    const items = await provider.collect({
      env: {},
      plan: { blogPostLimit: 0, includePlaceProfile: false, placeReviewLimit: 1 },
      store: {
        id: 'store_visitor_photo',
        name: '방문자 사진 테스트 매장',
        naverPlaceUrl: placeUrl,
        naverPlaceId: '1838952735',
        category: null,
        address: null,
        phone: null,
        description: null,
        metadata: {},
        createdAt: '2026-06-09T00:00:00.000Z',
        updatedAt: '2026-06-09T00:00:00.000Z'
      }
    });

    expect(items[0].metadata).toEqual(
      expect.objectContaining({
        photoUrls: ['https://pup-review-phinf.pstatic.net/review-photo-1.jpg'],
        visitorPhotoUrls: ['https://pup-review-phinf.pstatic.net/review-photo-1.jpg']
      })
    );
  });

  it('loads additional rendered review batches until the requested limit is reached', async () => {
    const firstBatchUrl = 'https://m.place.naver.com/restaurant/1838952735/review/visitor';
    const secondBatchUrl = 'https://m.place.naver.com/restaurant/1838952735/review/visitor?cursor=second';
    const renderCalls: string[] = [];
    const provider = createNaverPlaceRenderedCollectionProvider(async (url) => {
      renderCalls.push(url);
      if (url === firstBatchUrl) {
        return {
          finalUrl: firstBatchUrl,
          bodyText: null,
          html: `<html><body>
            <article data-review-card data-review-id="batch-1" data-reviewer="a****" data-review-date="2026.06.01">
              <p class="review-body">첫 번째 배치 리뷰 1</p>
              <div data-owner-reply>첫 번째 답글</div>
            </article>
            <article data-review-card data-review-id="batch-2" data-reviewer="b****" data-review-date="2026.06.02">
              <p class="review-body">첫 번째 배치 리뷰 2</p>
            </article>
            <a data-next-review-url="${secondBatchUrl}">더보기</a>
          </body></html>`
        };
      }
      return {
        finalUrl: secondBatchUrl,
        bodyText: null,
        html: `<html><body>
          <article data-review-card data-review-id="batch-3" data-reviewer="c****" data-review-date="2026.06.03">
            <p class="review-body">두 번째 배치 리뷰 3</p>
            <div data-owner-reply>두 번째 답글</div>
          </article>
          <article data-review-card data-review-id="batch-4" data-reviewer="d****" data-review-date="2026.06.04">
            <p class="review-body">두 번째 배치 리뷰 4</p>
          </article>
        </body></html>`
      };
    });

    const items = await provider.collect({
      env: {},
      plan: { blogPostLimit: 0, includePlaceProfile: false, placeReviewLimit: 3 },
      store: {
        id: 'store_batch',
        name: '배치 테스트 매장',
        naverPlaceUrl: placeUrl,
        naverPlaceId: '1838952735',
        category: null,
        address: null,
        phone: null,
        description: null,
        metadata: {},
        createdAt: '2026-06-09T00:00:00.000Z',
        updatedAt: '2026-06-09T00:00:00.000Z'
      }
    });

    const reviews = items.filter((item) => item.sourceType === 'review');
    expect(renderCalls).toEqual([firstBatchUrl, secondBatchUrl]);
    expect(reviews).toHaveLength(3);
    expect(reviews.map((item) => item.bodyText)).toEqual([
      '첫 번째 배치 리뷰 1',
      '첫 번째 배치 리뷰 2',
      '두 번째 배치 리뷰 3'
    ]);
    expect(reviews[2].metadata).toEqual(expect.objectContaining({ ownerReplyText: '두 번째 답글' }));
  });

  it('uses the Naver GraphQL fallback when the rendered snapshot only contains the first review batch', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '[]')) as Array<{ variables?: { input?: { item?: string } } }>;
      const item = body[0]?.variables?.input?.item;
      const items = item === 'cursor-50' ? graphQlReviewItems(51, 100) : graphQlReviewItems(1, 50);
      return new Response(JSON.stringify([{ data: { visitorReviews: { total: 120, items } } }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const provider = createNaverPlaceRenderedCollectionProvider(async () => ({
        finalUrl: reviewUrl,
        bodyText: null,
        html: apolloReviewHtmlWithItems(10)
      }));

      const items = await provider.collect({
        env: {},
        plan: { blogPostLimit: 0, includePlaceProfile: false, placeReviewLimit: 100 },
        store: {
          id: 'store_graphql_fallback',
          name: '그래프큐엘 테스트 매장',
          naverPlaceUrl: placeUrl,
          naverPlaceId: '1824807602',
          category: null,
          address: null,
          phone: null,
          description: null,
          metadata: {},
          createdAt: '2026-06-09T00:00:00.000Z',
          updatedAt: '2026-06-09T00:00:00.000Z'
        }
      });

      const collectedReviews = items.filter((item) => item.sourceType === 'review' && item.status !== 'failed');
      expect(collectedReviews).toHaveLength(100);
      expect(fetchMock).toHaveBeenCalledWith('https://api.place.naver.com/graphql', expect.any(Object));
      expect(fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body ?? '[]'))[0].variables.input.item)).toEqual([
        '0',
        'cursor-50'
      ]);
      expect(collectedReviews.at(-1)).toEqual(
        expect.objectContaining({
          bodyText: 'GraphQL fallback review 100',
          title: '방문자 리뷰 - gql-100'
        })
      );
      expect(collectedReviews.at(-1)?.metadata).toEqual(
        expect.objectContaining({
          ownerReplyText: 'GraphQL owner reply 100',
          reviewKeywords: ['신선해요'],
          bodyAvailability: 'rendered_place_visitor_review'
        })
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('paginates Naver GraphQL fallback with supported media fields and review cursors', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '[]')) as Array<{
        query?: string;
        variables?: { input?: { item?: string; sort?: string; size?: number } };
      }>;
      const query = body[0]?.query ?? '';
      expect(query).not.toContain('imageUrl');
      expect(query).not.toContain('origin');
      expect(query).not.toContain('thumbnailUrl');

      const item = body[0]?.variables?.input?.item ?? '0';
      const page =
        item === '0'
          ? graphQlReviewItems(1, 10)
          : item === 'cursor-10'
            ? graphQlReviewItems(11, 20)
            : graphQlReviewItems(21, 25);
      return new Response(JSON.stringify([{ data: { visitorReviews: { total: 25, items: page } } }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const provider = createNaverPlaceRenderedCollectionProvider(async () => ({
        finalUrl: reviewUrl,
        bodyText: null,
        html: apolloReviewHtmlWithItems(1)
      }));

      const items = await provider.collect({
        env: {},
        plan: { blogPostLimit: 0, includePlaceProfile: false, placeReviewLimit: 25 },
        store: {
          id: 'store_graphql_cursor_fallback',
          name: '그래프큐엘 커서 테스트 매장',
          naverPlaceUrl: placeUrl,
          naverPlaceId: '1824807602',
          category: null,
          address: null,
          phone: null,
          description: null,
          metadata: {},
          createdAt: '2026-06-09T00:00:00.000Z',
          updatedAt: '2026-06-09T00:00:00.000Z'
        }
      });

      const collectedReviews = items.filter((item) => item.sourceType === 'review' && item.status !== 'failed');
      expect(collectedReviews).toHaveLength(25);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body ?? '[]'))[0].variables.input.item)).toEqual([
        '0',
        'cursor-10',
        'cursor-20'
      ]);
      expect(collectedReviews.at(-1)).toEqual(
        expect.objectContaining({
          bodyText: 'GraphQL fallback review 25',
          title: '방문자 리뷰 - gql-25'
        })
      );
      expect(collectedReviews[3]).toEqual(
        expect.objectContaining({
          bodyText: '방문자 리뷰 키워드: 신선해요',
          title: '방문자 리뷰 - gql-4'
        })
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not create failed placeholders when GraphQL reports fewer available reviews than requested', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '[]')) as Array<{ query?: string }>;
      expect(body[0]?.query).not.toContain('imageUrl');
      return new Response(JSON.stringify([{ data: { visitorReviews: { total: 45, items: graphQlReviewItems(1, 45) } } }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const provider = createNaverPlaceRenderedCollectionProvider(async () => ({
        finalUrl: reviewUrl,
        bodyText: null,
        html: apolloReviewHtmlWithItems(10)
      }));

      const items = await provider.collect({
        env: {},
        plan: { blogPostLimit: 0, includePlaceProfile: false, placeReviewLimit: 50 },
        store: {
          id: 'store_graphql_available_total',
          name: '그래프큐엘 전체수 테스트 매장',
          naverPlaceUrl: placeUrl,
          naverPlaceId: '1824807602',
          category: null,
          address: null,
          phone: null,
          description: null,
          metadata: {},
          createdAt: '2026-06-09T00:00:00.000Z',
          updatedAt: '2026-06-09T00:00:00.000Z'
        }
      });

      const reviews = items.filter((item) => item.sourceType === 'review');
      expect(reviews).toHaveLength(45);
      expect(reviews.every((item) => item.status !== 'failed')).toBe(true);
      expect(reviews.at(-1)).toEqual(expect.objectContaining({ title: '방문자 리뷰 - gql-45' }));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not create failed placeholders when GraphQL cannot confirm additional rendered reviews', async () => {
    const fetchMock = vi.fn(async () => new Response('temporarily unavailable', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      const provider = createNaverPlaceRenderedCollectionProvider(async () => ({
        finalUrl: reviewUrl,
        bodyText: null,
        html: apolloReviewHtmlWithItems(10)
      }));

      const items = await provider.collect({
        env: {},
        plan: { blogPostLimit: 0, includePlaceProfile: false, placeReviewLimit: 50 },
        store: {
          id: 'store_graphql_unconfirmed_total',
          name: '그래프큐엘 미확인 테스트 매장',
          naverPlaceUrl: placeUrl,
          naverPlaceId: '1824807602',
          category: null,
          address: null,
          phone: null,
          description: null,
          metadata: {},
          createdAt: '2026-06-09T00:00:00.000Z',
          updatedAt: '2026-06-09T00:00:00.000Z'
        }
      });

      const reviews = items.filter((item) => item.sourceType === 'review');
      expect(reviews).toHaveLength(10);
      expect(reviews.every((item) => item.status !== 'failed')).toBe(true);
      expect(reviews.at(-1)?.metadata).toEqual(
        expect.objectContaining({
          availableReviewTotal: 10,
          requestedReviewLimit: 50
        })
      );
    } finally {
      vi.unstubAllGlobals();
    }
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

  it('completes rendered collection when Place profile metadata contains non-string values', async () => {
    const providerEnv = {
      NAVER_OWNER_AUTHORIZED: 'true',
      NAVER_PLACE_PROVIDER: 'rendered',
      NAVER_BLOG_PROVIDER: 'mock',
      NAVER_PLACE_RENDERER_ENDPOINT: ''
    };
    const app = express();
    app.use(express.json());
    app.get('/fake-renderer', (_req, res) => {
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
      naverPlaceId: '1838952735',
      metadata: {
        category: ['의료/건강', '정형외과'],
        closedDays: ['매주 월요일'],
        parking: { available: false, note: null },
        reviewStats: { visitor: 61 },
        hospitalInfo: {
          subjects: ['정형외과', '내과']
        }
      }
    });

    await fetch(`${baseUrl}/api/stores/store_demo_cake/training-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channels: {
          naverBlog: { enabled: false, blogPostLimit: 0 },
          naverPlace: { enabled: true, placeReviewLimit: 1 },
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
    const terminal = await waitForTerminalRun(baseUrl, created.collectionRunId);

    expect(startResponse.status).toBe(200);
    expect(started.collectionRun.status).not.toBe('failed');
    expect(terminal.status).toBe('completed');
    expect(terminal.summary.error).toBeUndefined();
    expect(terminal.summary.collectionDelta).toEqual(
      expect.objectContaining({
        counts: expect.objectContaining({ new: 2 })
      })
    );
  });
});
