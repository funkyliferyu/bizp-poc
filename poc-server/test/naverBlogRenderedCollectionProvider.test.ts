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
  collectRenderedBlogItems,
  extractRenderedBlogPost,
  extractRenderedBlogPostLinks,
  toNaverBlogListUrl,
  toNaverBlogPostUrl
} from '../src/storeLearning/collection/naverBlogRenderedCollectionProvider.js';

const listFixturePath = fileURLToPath(new URL('./fixtures/naver-blog-rendered-list.html', import.meta.url));
const rssFixturePath = fileURLToPath(new URL('./fixtures/naver-blog-rss.xml', import.meta.url));
const postOneFixturePath = fileURLToPath(new URL('./fixtures/naver-blog-rendered-post-1.html', import.meta.url));
const postTwoFixturePath = fileURLToPath(new URL('./fixtures/naver-blog-rendered-post-2.html', import.meta.url));
const listFixtureHtml = readFileSync(listFixturePath, 'utf8');
const rssFixtureXml = readFileSync(rssFixturePath, 'utf8');
const postOneFixtureHtml = readFileSync(postOneFixturePath, 'utf8');
const postTwoFixtureHtml = readFileSync(postTwoFixturePath, 'utf8');
const blogRootUrl = 'https://blog.naver.com/demo-cake';
const blogListUrl = 'https://m.blog.naver.com/PostList.naver?blogId=demo-cake';
const blogRssUrl = 'https://rss.blog.naver.com/demo-cake.xml';
const blogPostOneUrl = 'https://m.blog.naver.com/PostView.naver?blogId=demo-cake&logNo=223500000001';
const blogPostTwoUrl = 'https://m.blog.naver.com/PostView.naver?blogId=demo-cake&logNo=223500000002';

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

describe('Naver Blog rendered collection provider', () => {
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

  it('normalizes Naver Blog root/list/post URLs', () => {
    expect(toNaverBlogListUrl(blogRootUrl)).toBe(blogListUrl);
    expect(toNaverBlogPostUrl('https://blog.naver.com/demo-cake/223500000001')).toBe(blogPostOneUrl);
    expect(toNaverBlogPostUrl(blogPostTwoUrl)).toBe(blogPostTwoUrl);
  });

  it('extracts post links and full blog body fields from rendered Blog HTML', () => {
    expect(extractRenderedBlogPostLinks({ html: listFixtureHtml, finalUrl: blogListUrl })).toEqual([
      blogPostOneUrl,
      blogPostTwoUrl
    ]);

    const post = extractRenderedBlogPost({
      html: postOneFixtureHtml,
      bodyText: null,
      finalUrl: blogPostOneUrl
    });

    expect(post).toEqual(
      expect.objectContaining({
        blogId: 'demo-cake',
        logNo: '223500000001',
        title: '레터링 케이크 예약 안내',
        authorName: '분당 케이크하우스',
        publishedAt: '2026.06.01',
        sourceUrl: 'https://blog.naver.com/demo-cake/223500000001',
        bodyText: expect.stringContaining('최소 하루 전 예약을 권장합니다.'),
        tags: ['분당케이크', '레터링케이크'],
        imageUrls: ['https://postfiles.pstatic.net/demo-cake-1.jpg']
      })
    );
  });

  it('falls back to Naver Blog RSS when PostList has no post links', async () => {
    const requestedUrls: string[] = [];
    const items = await collectRenderedBlogItems({
      env: {
        NAVER_OWNER_AUTHORIZED: 'true',
        NAVER_BLOG_PROVIDER: 'rendered',
        NAVER_PLACE_PROVIDER: 'mock'
      },
      plan: {
        blogPostLimit: 2,
        includePlaceProfile: false,
        placeReviewLimit: 0
      },
      store: {
        id: 'store_rss_blog',
        name: 'RSS Blog Store',
        naverPlaceUrl: null,
        naverPlaceId: null,
        category: null,
        address: null,
        phone: null,
        description: null,
        metadata: null,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString()
      },
      storeChannels: [
        {
          id: 'channel_rss_blog',
          storeId: 'store_rss_blog',
          channel: 'blog',
          sourceUrl: blogRootUrl,
          status: 'connected',
          providerMode: 'real',
          settings: null,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString()
        }
      ],
      renderer: async (url) => {
        requestedUrls.push(url);
        if (url === blogListUrl) return { finalUrl: blogListUrl, html: '<html><body>no posts</body></html>', bodyText: null };
        if (url === blogRssUrl) return { finalUrl: blogRssUrl, html: rssFixtureXml, bodyText: null };
        if (url === blogPostOneUrl) return { finalUrl: blogPostOneUrl, html: postOneFixtureHtml, bodyText: null };
        if (url === blogPostTwoUrl) return { finalUrl: blogPostTwoUrl, html: postTwoFixtureHtml, bodyText: null };
        throw new Error(`unexpected rendered URL: ${url}`);
      }
    });

    expect(requestedUrls).toContain(blogListUrl);
    expect(requestedUrls).toContain(blogRssUrl);
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.status ?? 'pending')).toEqual(['pending', 'pending']);
    expect(items.map((item) => item.sourceUrl)).toEqual([blogPostOneUrl, blogPostTwoUrl]);
    expect(items[0].metadata).toEqual(expect.objectContaining({ blogSourceDiscovery: 'rss' }));
  });

  it('falls back to Naver Blog RSS when PostList is restricted', async () => {
    const items = await collectRenderedBlogItems({
      env: {
        NAVER_OWNER_AUTHORIZED: 'true',
        NAVER_BLOG_PROVIDER: 'rendered',
        NAVER_PLACE_PROVIDER: 'mock'
      },
      plan: {
        blogPostLimit: 1,
        includePlaceProfile: false,
        placeReviewLimit: 0
      },
      store: {
        id: 'store_restricted_blog',
        name: 'Restricted Blog Store',
        naverPlaceUrl: null,
        naverPlaceId: null,
        category: null,
        address: null,
        phone: null,
        description: null,
        metadata: null,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString()
      },
      storeChannels: [
        {
          id: 'channel_restricted_blog',
          storeId: 'store_restricted_blog',
          channel: 'blog',
          sourceUrl: blogRootUrl,
          status: 'connected',
          providerMode: 'real',
          settings: null,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString()
        }
      ],
      renderer: async (url) => {
        if (url === blogListUrl) {
          return {
            finalUrl: blogListUrl,
            html: '<html><body>서비스 이용이 제한되었습니다</body></html>',
            bodyText: '서비스 이용이 제한되었습니다'
          };
        }
        if (url === blogRssUrl) return { finalUrl: blogRssUrl, html: rssFixtureXml, bodyText: null };
        if (url === blogPostOneUrl) return { finalUrl: blogPostOneUrl, html: postOneFixtureHtml, bodyText: null };
        throw new Error(`unexpected rendered URL: ${url}`);
      }
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(
      expect.objectContaining({
        sourceUrl: blogPostOneUrl,
        title: '레터링 케이크 예약 안내',
        bodyText: expect.stringContaining('최소 하루 전 예약을 권장합니다.')
      })
    );
    expect(items[0].metadata).toEqual(expect.objectContaining({ blogSourceDiscovery: 'rss' }));
  });

  it('persists rendered Blog full bodies as collection items through the collection run API', async () => {
    const providerEnv = {
      NAVER_OWNER_AUTHORIZED: 'true',
      NAVER_BLOG_PROVIDER: 'rendered',
      NAVER_PLACE_PROVIDER: 'mock',
      NAVER_BLOG_RENDERER_ENDPOINT: ''
    };
    const app = express();
    app.use(express.json());
    app.get('/fake-blog-renderer', (req, res) => {
      const url = String(req.query.url);
      if (url === blogListUrl) {
        res.json({ finalUrl: blogListUrl, html: listFixtureHtml, bodyText: null });
        return;
      }
      if (url === blogPostOneUrl) {
        res.json({ finalUrl: blogPostOneUrl, html: postOneFixtureHtml, bodyText: null });
        return;
      }
      if (url === blogPostTwoUrl) {
        res.json({ finalUrl: blogPostTwoUrl, html: postTwoFixtureHtml, bodyText: null });
        return;
      }
      res.status(404).json({ error: `unexpected rendered URL: ${url}` });
    });
    app.use('/api/stores', createStoreRoutes({ connection, env: providerEnv }));
    app.use('/api/collection-runs', createCollectionRunRoutes({ connection, stepDelayMs: 0, env: providerEnv }));
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    providerEnv.NAVER_BLOG_RENDERER_ENDPOINT = `${baseUrl}/fake-blog-renderer`;

    const repos = createStoreLearningRepositories(connection);
    repos.stores.create({
      id: 'store_blog_url_from_training',
      name: '블로그 URL 학습 매장',
      naverPlaceUrl: null,
      naverPlaceId: null,
      category: '디저트',
      address: '서울시 테스트구',
      phone: null,
      description: null,
      metadata: {}
    });

    await fetch(`${baseUrl}/api/stores/store_blog_url_from_training/training-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channels: {
          naverBlog: { enabled: true, blogPostLimit: 2, sourceUrl: blogRootUrl },
          naverPlace: { enabled: false, placeReviewLimit: 0 },
          instagram: { enabled: false, instagramPostLimit: 0 },
          daangn: { enabled: false, daangnPostLimit: 0 }
        }
      })
    });
    const blogChannel = repos.storeChannels
      .listByStoreId('store_blog_url_from_training')
      .find((channel) => channel.channel === 'blog');
    expect(blogChannel).toEqual(
      expect.objectContaining({
        sourceUrl: blogRootUrl,
        status: 'connected',
        providerMode: 'real'
      })
    );

    const createRunResponse = await fetch(`${baseUrl}/api/stores/store_blog_url_from_training/collection-runs`, {
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
      name: 'naverBlogRenderedCollectionProvider',
      mode: 'real'
    });

    const terminal = await waitForTerminalRun(baseUrl, created.collectionRunId);
    expect(terminal.status).toBe('completed');
    expect(terminal.mode).toBe('real');
    expect(terminal.summary.collectedCounts).toEqual({
      blogPosts: 2,
      placeProfiles: 0,
      placeReviews: 0
    });

    const itemsResponse = await fetch(`${baseUrl}/api/collection-runs/${created.collectionRunId}/items`);
    const items = await readJson(itemsResponse);
    const posts = items.collectionItems.filter((item: { sourceType: string }) => item.sourceType === 'post');

    expect(posts).toHaveLength(2);
    expect(posts[0]).toEqual(
      expect.objectContaining({
        status: 'collected',
        sourceUrl: blogPostOneUrl,
        title: '레터링 케이크 예약 안내',
        bodyText: expect.stringContaining('네이버 톡톡으로 먼저 문의해주세요.')
      })
    );
    expect(posts[0].metadata).toEqual(
      expect.objectContaining({
        provider: 'naverBlogRenderedCollectionProvider',
        providerMode: 'real',
        bodyAvailability: 'rendered_blog_full_body',
        sourceKind: 'owner_blog_post',
        sourceOwnership: 'owner_managed',
        ownerAuthorized: true,
        configuredBlogProvider: 'rendered',
        blogId: 'demo-cake',
        logNo: '223500000001',
        publishedAt: '2026.06.01',
        tags: ['분당케이크', '레터링케이크'],
        imageUrls: ['https://postfiles.pstatic.net/demo-cake-1.jpg']
      })
    );
  });
});
