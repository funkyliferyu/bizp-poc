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

  it('returns blog tab data with source URL, publication date, and real view counts', async () => {
    const repos = createStoreLearningRepositories(connection);
    repos.collectionItems.upsert({
      id: 'collection_item_real_blog_with_views',
      runId: 'collection_run_demo_store_learning',
      storeId: 'store_demo_cake',
      channel: 'blog',
      sourceType: 'post',
      status: 'collected',
      sourceUrl: 'https://blog.naver.com/demo-cake/real-views',
      title: '실제 발행일과 조회수가 있는 블로그',
      bodyText: '실제 블로그 본문 일부입니다.',
      selectedForAnalysis: 1,
      selectionReason: 'real blog metadata',
      selectedAt: '2026-06-06T00:00:00.000Z',
      metadata: {
        provider: 'naverBlogRenderedCollectionProvider',
        publishedAt: '2026-05-28T09:30:00.000+09:00',
        viewCount: 1280
      },
      createdAt: '2026-06-06T01:00:00.000Z',
      updatedAt: '2026-06-06T01:00:00.000Z'
    });
    repos.collectionItems.upsert({
      id: 'collection_item_real_blog_without_views',
      runId: 'collection_run_demo_store_learning',
      storeId: 'store_demo_cake',
      channel: 'blog',
      sourceType: 'post',
      status: 'collected',
      sourceUrl: 'https://blog.naver.com/demo-cake/no-views',
      title: 'postdate만 있는 블로그',
      bodyText: '조회수는 제공되지 않는 블로그입니다.',
      selectedForAnalysis: 0,
      selectionReason: null,
      selectedAt: null,
      metadata: {
        provider: 'naverSearchCollectionProvider',
        postdate: '20260527'
      },
      createdAt: '2026-06-06T02:00:00.000Z',
      updatedAt: '2026-06-06T02:00:00.000Z'
    });
    repos.collectionItems.upsert({
      id: 'collection_item_real_blog_without_published_date',
      runId: 'collection_run_demo_store_learning',
      storeId: 'store_demo_cake',
      channel: 'blog',
      sourceType: 'post',
      status: 'collected',
      sourceUrl: 'https://blog.naver.com/demo-cake/no-published-date',
      title: '발행일이 제공되지 않는 블로그',
      bodyText: '발행일 metadata가 없는 블로그입니다.',
      selectedForAnalysis: 0,
      selectionReason: null,
      selectedAt: null,
      metadata: {
        provider: 'naverBlogRenderedCollectionProvider'
      },
      createdAt: '2026-06-06T03:00:00.000Z',
      updatedAt: '2026-06-06T03:00:00.000Z'
    });

    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/learning-status/blog`);
    const body = await readJson(response);
    const withViews = body.items.find((item: { id: string }) => item.id === 'collection_item_real_blog_with_views');
    const withoutViews = body.items.find((item: { id: string }) => item.id === 'collection_item_real_blog_without_views');
    const withoutPublishedDate = body.items.find((item: { id: string }) => item.id === 'collection_item_real_blog_without_published_date');

    expect(response.status).toBe(200);
    expect(withViews).toEqual(
      expect.objectContaining({
        sourceUrl: 'https://blog.naver.com/demo-cake/real-views',
        publishedAt: '2026-05-28T09:30:00.000+09:00',
        collectedAt: '2026-06-06T01:00:00.000Z',
        viewCount: 1280
      })
    );
    expect(withViews.publishedAt).not.toBe(withViews.collectedAt);
    expect(withoutViews).toEqual(
      expect.objectContaining({
        sourceUrl: 'https://blog.naver.com/demo-cake/no-views',
        publishedAt: '20260527',
        collectedAt: '2026-06-06T02:00:00.000Z'
      })
    );
    expect(withoutViews).not.toHaveProperty('viewCount');
    expect(withoutPublishedDate).toEqual(
      expect.objectContaining({
        publishedAt: null,
        collectedAt: '2026-06-06T03:00:00.000Z'
      })
    );
  });

  it('deduplicates repeated Blog collection items and keeps the latest real metadata', async () => {
    const repos = createStoreLearningRepositories(connection);
    repos.collectionItems.upsert({
      id: 'collection_item_duplicate_blog_old',
      runId: 'collection_run_demo_store_learning',
      storeId: 'store_demo_cake',
      channel: 'blog',
      sourceType: 'post',
      status: 'collected',
      sourceUrl: 'https://blog.naver.com/demo-cake/223500000001',
      title: '중복 블로그 글',
      bodyText: '이전 수집 본문입니다.',
      selectedForAnalysis: 0,
      selectionReason: null,
      selectedAt: null,
      metadata: {
        provider: 'naverSearchCollectionProvider',
        postdate: '20260601',
        viewCount: 10
      },
      createdAt: '2026-06-06T01:00:00.000Z',
      updatedAt: '2026-06-06T01:00:00.000Z'
    });
    repos.collectionItems.upsert({
      id: 'collection_item_duplicate_blog_latest',
      runId: 'collection_run_demo_store_learning',
      storeId: 'store_demo_cake',
      channel: 'blog',
      sourceType: 'post',
      status: 'collected',
      sourceUrl: 'https://m.blog.naver.com/PostView.naver?blogId=demo-cake&logNo=223500000001',
      title: '중복 블로그 글',
      bodyText: '최신 수집 본문입니다.',
      selectedForAnalysis: 1,
      selectionReason: 'latest collection',
      selectedAt: '2026-06-07T01:00:00.000Z',
      metadata: {
        provider: 'naverBlogRenderedCollectionProvider',
        publishedAt: '2026.05.19',
        readCount: '1,240'
      },
      createdAt: '2026-06-07T01:00:00.000Z',
      updatedAt: '2026-06-07T01:00:00.000Z'
    });

    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/learning-status/blog`);
    const body = await readJson(response);
    const duplicates = body.items.filter((item: { title: string }) => item.title === '중복 블로그 글');

    expect(response.status).toBe(200);
    expect(duplicates).toEqual([
      expect.objectContaining({
        id: 'collection_item_duplicate_blog_latest',
        sourceUrl: 'https://m.blog.naver.com/PostView.naver?blogId=demo-cake&logNo=223500000001',
        publishedAt: '2026.05.19',
        collectedAt: '2026-06-07T01:00:00.000Z',
        selectedForAnalysis: true,
        viewCount: 1240
      })
    ]);
  });

  it('returns place tab data with real facts, industry sections, photos, review dates, and empty news', async () => {
    const repos = createStoreLearningRepositories(connection);
    repos.stores.update('store_demo_cake', {
      name: '테라스의원',
      naverPlaceUrl: 'https://m.place.naver.com/hospital/1020864025/home',
      naverPlaceId: '1020864025',
      category: '의료,건강 > 병원 > 피부과',
      address: '서울 종로구 송월길 99 경희궁자이2단지',
      phone: '02-6105-0010',
      description: '피부과 전문 진료를 제공하는 의원입니다.',
      metadata: {
        naverPlaceParsed: {
          businessHours: ['월-금 10:00-19:00', '토 10:00-14:00'],
          closedDays: '일요일',
          parking: 'near',
          parkingNote: '상가 주차장 이용 가능',
          placeIntro: '대표원장 직접 상담으로 차별화된 진료를 제공합니다.',
          imageUrls: ['https://ldb-phinf.pstatic.net/place-1.jpg', 'https://ldb-phinf.pstatic.net/place-2.jpg'],
          menuItems: [],
          hospitalInfo: {
            subjects: ['피부과', '가정의학과'],
            doctors: [{ name: '홍길동', subject: '피부과', isRepresentative: true }]
          }
        }
      }
    });
    repos.collectionItems.upsert({
      id: 'collection_item_real_hospital_profile',
      runId: 'collection_run_demo_store_learning',
      storeId: 'store_demo_cake',
      channel: 'place',
      sourceType: 'profile',
      status: 'collected',
      sourceUrl: 'https://m.place.naver.com/hospital/1020864025/home',
      title: '테라스의원 기본 정보',
      bodyText: '대표원장 직접 상담으로 차별화된 진료를 제공합니다.',
      selectedForAnalysis: 1,
      selectionReason: 'real place profile',
      selectedAt: '2026-06-06T03:00:00.000Z',
      metadata: {
        provider: 'naverPlaceRenderedCollectionProvider',
        storeMetadata: {
          businessHours: ['월-금 10:00-19:00', '토 10:00-14:00'],
          closedDays: '일요일',
          parking: 'near',
          parkingNote: '상가 주차장 이용 가능',
          placeIntro: '대표원장 직접 상담으로 차별화된 진료를 제공합니다.',
          placeImageUrls: ['https://ldb-phinf.pstatic.net/place-1.jpg', 'https://ldb-phinf.pstatic.net/place-2.jpg'],
          menuItems: [],
          hospitalInfo: {
            subjects: ['피부과', '가정의학과']
          }
        }
      },
      createdAt: '2026-06-06T03:00:00.000Z',
      updatedAt: '2026-06-06T03:00:00.000Z'
    });
    repos.collectionItems.upsert({
      id: 'collection_item_real_place_review_with_photo',
      runId: 'collection_run_demo_store_learning',
      storeId: 'store_demo_cake',
      channel: 'place',
      sourceType: 'review',
      status: 'collected',
      sourceUrl: 'https://m.place.naver.com/hospital/1020864025/review/visitor#review-1',
      title: '방문자 리뷰 - real',
      bodyText: '상담이 꼼꼼하고 설명이 자세했어요.',
      selectedForAnalysis: 1,
      selectionReason: 'real review',
      selectedAt: '2026-06-06T04:00:00.000Z',
      metadata: {
        provider: 'naverPlaceRenderedCollectionProvider',
        reviewDate: '2026.06.01',
        photoUrls: ['https://pup-review-phinf.pstatic.net/review-1.jpg'],
        visitorPhotoUrls: ['https://pup-review-phinf.pstatic.net/review-visitor-1.jpg']
      },
      createdAt: '2026-06-06T04:00:00.000Z',
      updatedAt: '2026-06-06T04:00:00.000Z'
    });

    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/learning-status/place`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.profile.facts).toEqual(
      expect.objectContaining({
        category: '의료,건강 > 병원 > 피부과',
        address: '서울 종로구 송월길 99 경희궁자이2단지',
        phone: '02-6105-0010',
        operatingHours: ['월-금 10:00-19:00', '토 10:00-14:00'],
        closedDays: '일요일',
        parking: 'near',
        parkingNote: '상가 주차장 이용 가능',
        introduction: '대표원장 직접 상담으로 차별화된 진료를 제공합니다.'
      })
    );
    expect(body.profile.industrySections).toEqual([
      {
        type: 'hospital_subjects',
        label: '진료과목',
        items: ['피부과', '가정의학과']
      }
    ]);
    expect(body.profile.industrySections).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'menu' })])
    );
    expect(body.photos).toEqual(
      expect.objectContaining({
        place: ['https://ldb-phinf.pstatic.net/place-1.jpg', 'https://ldb-phinf.pstatic.net/place-2.jpg'],
        visitor: ['https://pup-review-phinf.pstatic.net/review-1.jpg', 'https://pup-review-phinf.pstatic.net/review-visitor-1.jpg'],
        placeMoreUrl: 'https://m.place.naver.com/hospital/1020864025/photo',
        visitorMoreUrl: 'https://m.place.naver.com/hospital/1020864025/photo?filterType=visitor'
      })
    );
    const review = body.reviews.find((item: { id: string }) => item.id === 'collection_item_real_place_review_with_photo');
    expect(review).toEqual(
      expect.objectContaining({
        reviewDate: '2026.06.01',
        collectedAt: '2026-06-06T04:00:00.000Z'
      })
    );
    expect(body.newsItems).toEqual([]);
  });
});
