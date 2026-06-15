import express from 'express';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { createStoreLearningReadinessRoutes } from '../src/storeLearning/routes/readiness.js';

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function writeRagManifest(outputRoot: string, storeId: string) {
  const storeDir = path.join(outputRoot, storeId);
  mkdirSync(storeDir, { recursive: true });
  const infoPath = path.join(storeDir, 'info.docx');
  const reviewsPath = path.join(storeDir, 'reviews.docx');
  writeFileSync(infoPath, 'info');
  writeFileSync(reviewsPath, 'reviews');
  writeFileSync(
    path.join(storeDir, 'manifest.json'),
    `${JSON.stringify({
      generatedAt: '2026-06-15T00:00:00.000Z',
      storeId,
      storeName: '테스트 매장',
      reviewCount: 1,
      sourceCollectionRunId: 'collection_run_dashboard',
      files: {
        info: { path: infoPath, fileName: 'info.docx', downloadPath: `/api/stores/${storeId}/rag-documents/info/download` },
        reviews: {
          path: reviewsPath,
          fileName: 'reviews.docx',
          downloadPath: `/api/stores/${storeId}/rag-documents/reviews/download`
        }
      },
      warnings: []
    })}\n`
  );
  return { storeDir, infoPath, reviewsPath };
}

function seedDashboardStore(connection: DbConnection, storeId = 'store_dashboard') {
  const repos = createStoreLearningRepositories(connection);
  const store = repos.stores.create({
    id: storeId,
    name: '테스트 매장',
    naverPlaceUrl: 'https://naver.me/test',
    naverPlaceId: 'place_test',
    category: 'clinic',
    address: '서울',
    phone: null,
    description: '대시보드 테스트 매장',
    metadata: {}
  });
  const collectionRun = repos.collectionRuns.create({
    id: `collection_run_${storeId}`,
    storeId: store.id,
    status: 'completed',
    mode: 'mock',
    startedAt: '2026-06-15T00:00:00.000Z',
    completedAt: '2026-06-15T00:01:00.000Z',
    summary: {}
  });
  repos.collectionItems.create({
    id: `place_profile_${storeId}`,
    runId: collectionRun.id,
    storeId: store.id,
    channel: 'place',
    sourceType: 'profile',
    status: 'collected',
    sourceUrl: null,
    title: '플레이스 프로필',
    bodyText: '플레이스 학습 정보',
    selectedForAnalysis: 1,
    selectionReason: null,
    selectedAt: null,
    metadata: {}
  });
  repos.collectionItems.create({
    id: `blog_post_${storeId}`,
    runId: collectionRun.id,
    storeId: store.id,
    channel: 'blog',
    sourceType: 'post',
    status: 'collected',
    sourceUrl: null,
    title: '블로그 학습 글',
    bodyText: '블로그 학습 정보',
    selectedForAnalysis: 1,
    selectionReason: null,
    selectedAt: null,
    metadata: {}
  });
  const generation = repos.contentGenerations.create({
    id: `content_generation_${storeId}`,
    storeId: store.id,
    rulesetId: null,
    status: 'generated',
    contentType: 'blog_post',
    prompt: {},
    output: {}
  });
  repos.blogPosts.create({
    id: `generated_blog_${storeId}`,
    storeId: store.id,
    contentGenerationId: generation.id,
    status: 'pending_approval',
    title: '생성 블로그',
    article: { bodySections: [{ heading: '본문', body: '생성 본문' }] },
    publishedUrl: null,
    scheduledAt: null,
    publishedAt: null
  });
  return store;
}

describe('SQL DB dashboard API', () => {
  let connection: DbConnection;
  let server: ReturnType<express.Express['listen']>;
  let baseUrl: string;
  let outputRoot: string;

  beforeEach(() => {
    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    outputRoot = path.join(os.tmpdir(), `sql-db-dashboard-${Date.now()}-${Math.random().toString(16).slice(2)}`);

    const app = express();
    app.use(express.json());
    app.use('/api/store-learning', createStoreLearningReadinessRoutes({ connection, ragOutputRoot: outputRoot }));
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
    rmSync(outputRoot, { recursive: true, force: true });
  });

  it('lists stores with learned Place/Blog counts, RAG document presence, and generated blog counts', async () => {
    seedDashboardStore(connection);
    writeRagManifest(outputRoot, 'store_dashboard');

    const response = await fetch(`${baseUrl}/api/store-learning/db-dashboard`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.stores).toEqual([
      expect.objectContaining({
        storeId: 'store_dashboard',
        storeName: '테스트 매장',
        learnedPlaceCount: 1,
        learnedBlogCount: 1,
        ragInfoExists: true,
        ragReviewsExists: true,
        generatedBlogPostCount: 1
      })
    ]);
  });

  it('resets RAG files independently and keeps the store registered', async () => {
    seedDashboardStore(connection);
    const rag = writeRagManifest(outputRoot, 'store_dashboard');

    const infoResponse = await fetch(`${baseUrl}/api/store-learning/db-dashboard/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: 'store_dashboard', target: 'rag_info' })
    });
    const infoBody = await readJson(infoResponse);
    expect(infoResponse.status).toBe(200);
    expect(infoBody.storeRemoved).toBe(false);
    expect(existsSync(rag.infoPath)).toBe(false);
    expect(existsSync(rag.reviewsPath)).toBe(true);

    const reviewsResponse = await fetch(`${baseUrl}/api/store-learning/db-dashboard/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: 'store_dashboard', target: 'rag_reviews' })
    });
    expect(reviewsResponse.status).toBe(200);
    expect(createStoreLearningRepositories(connection).stores.findById('store_dashboard')).not.toBeNull();
    expect(existsSync(rag.reviewsPath)).toBe(false);
  });

  it('resets Place and Blog rows without deleting the store registration', async () => {
    seedDashboardStore(connection);

    const placeResponse = await fetch(`${baseUrl}/api/store-learning/db-dashboard/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: 'store_dashboard', target: 'place' })
    });
    expect(placeResponse.status).toBe(200);

    const blogResponse = await fetch(`${baseUrl}/api/store-learning/db-dashboard/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: 'store_dashboard', target: 'blog' })
    });
    expect(blogResponse.status).toBe(200);

    const dashboard = await readJson(await fetch(`${baseUrl}/api/store-learning/db-dashboard`));
    expect(dashboard.stores[0]).toEqual(
      expect.objectContaining({
        storeId: 'store_dashboard',
        learnedPlaceCount: 0,
        learnedBlogCount: 0,
        generatedBlogPostCount: 0
      })
    );
  });

  it('deletes the store registration itself when target is all', async () => {
    seedDashboardStore(connection);
    const rag = writeRagManifest(outputRoot, 'store_dashboard');

    const response = await fetch(`${baseUrl}/api/store-learning/db-dashboard/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: 'store_dashboard', target: 'all' })
    });
    const body = await readJson(response);
    const repos = createStoreLearningRepositories(connection);

    expect(response.status).toBe(200);
    expect(body.storeRemoved).toBe(true);
    expect(repos.stores.findById('store_dashboard')).toBeNull();
    expect(repos.collectionItems.listByStoreId('store_dashboard')).toHaveLength(0);
    expect(repos.blogPosts.listByStoreId('store_dashboard')).toHaveLength(0);
    expect(existsSync(rag.storeDir)).toBe(false);
  });
});
