import express from 'express';
import { mkdtempSync, rmSync } from 'node:fs';
import { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { createRagDocumentRoutes } from '../src/storeLearning/routes/ragDocuments.js';

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

describe('RAG document API', () => {
  let connection: DbConnection;
  let server: ReturnType<express.Express['listen']>;
  let baseUrl: string;
  let outputRoot: string;

  beforeEach(() => {
    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    outputRoot = mkdtempSync(path.join(os.tmpdir(), 'store-rag-api-'));

    const repos = createStoreLearningRepositories(connection);
    repos.stores.create({
      id: 'store_haehwaro',
      name: '해화로in수산',
      naverPlaceUrl: 'https://naver.me/xUwCQUxv',
      naverPlaceId: '1824807602',
      category: '음식점 > 일식 > 생선회',
      address: '서울 광진구 광나루로 383 1,2층',
      phone: '0507-1359-5863',
      description: '신선한 대방어의 겨울철 진미',
      metadata: {
        naverPlaceParsed: {
          name: '해화로in수산',
          category: '음식점 > 일식 > 생선회',
          placeIntro: '회전문점 해화로in수산입니다.',
          facilities: ['단체 이용 가능', '예약'],
          menuItems: [{ name: '대방어', price: '40000', description: '겨울 대표 메뉴' }]
        }
      }
    });
    repos.collectionRuns.create({
      id: 'collection_run_haehwaro',
      storeId: 'store_haehwaro',
      status: 'completed',
      mode: 'rendered',
      startedAt: '2026-06-09T00:00:00.000Z',
      completedAt: '2026-06-09T00:01:00.000Z',
      summary: {}
    });
    repos.collectionItems.create({
      id: 'collection_item_review_1',
      runId: 'collection_run_haehwaro',
      storeId: 'store_haehwaro',
      channel: 'place',
      sourceType: 'review',
      status: 'collected',
      sourceUrl: 'https://m.place.naver.com/restaurant/1824807602/review/visitor',
      title: '방문자 리뷰',
      bodyText: '회가 신선하고 직원분들이 친절했어요.',
      selectedForAnalysis: 0,
      selectionReason: null,
      selectedAt: null,
      metadata: {
        reviewerName: 'yys****',
        reviewDate: '2026.06.01',
        ownerReplyText: '소중한 리뷰 감사합니다.',
        replyStatus: 'replied',
        ordinal: 1
      }
    });

    const app = express();
    app.use(express.json());
    app.use('/api/stores/:storeId/rag-documents', createRagDocumentRoutes({
      connection,
      outputRoot,
      env: { NAVER_PLACE_PROVIDER: 'mock' }
    }));
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

  it('generates, stores, and downloads info and review DOCX files', async () => {
    const generateResponse = await fetch(`${baseUrl}/api/stores/store_haehwaro/rag-documents/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshReviews: false, reviewLimit: 100 })
    });
    const body = await readJson(generateResponse);

    expect(generateResponse.status).toBe(200);
    expect(body.manifest.storeId).toBe('store_haehwaro');
    expect(body.manifest.reviewCount).toBe(1);
    expect(body.manifest.files.info).toEqual({
      fileName: 'info_해화로in수산.docx',
      downloadPath: '/api/stores/store_haehwaro/rag-documents/info/download'
    });
    expect(body.manifest.files.reviews).toEqual({
      fileName: 'reviews_해화로in수산.docx',
      downloadPath: '/api/stores/store_haehwaro/rag-documents/reviews/download'
    });
    expect(JSON.stringify(body.manifest)).not.toContain(outputRoot);

    const listResponse = await fetch(`${baseUrl}/api/stores/store_haehwaro/rag-documents`);
    const listed = await readJson(listResponse);
    expect(listed.manifest.generatedAt).toBe(body.manifest.generatedAt);
    expect(JSON.stringify(listed.manifest)).not.toContain(outputRoot);

    const downloadResponse = await fetch(`${baseUrl}/api/stores/store_haehwaro/rag-documents/info/download`);
    const download = Buffer.from(await downloadResponse.arrayBuffer());
    expect(downloadResponse.status).toBe(200);
    expect(download.subarray(0, 2).toString()).toBe('PK');
  });

  it('refreshes persisted Place reviews before generating RAG documents when requested', async () => {
    const generateResponse = await fetch(`${baseUrl}/api/stores/store_haehwaro/rag-documents/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshReviews: true, reviewLimit: 100 })
    });
    const body = await readJson(generateResponse);

    expect(generateResponse.status).toBe(200);
    expect(body.manifest.reviewCount).toBe(100);
    expect(body.manifest.sourceCollectionRunId).toEqual(expect.stringContaining('collection_run_store_haehwaro_rag_'));

    const repos = createStoreLearningRepositories(connection);
    const refreshedReviews = repos.collectionItems
      .listByRunId(body.manifest.sourceCollectionRunId)
      .filter((item) => item.channel === 'place' && item.sourceType === 'review' && item.status === 'collected');
    expect(refreshedReviews).toHaveLength(100);
    expect(refreshedReviews[0].metadata).toEqual(
      expect.objectContaining({
        provider: 'mock',
        sourceKind: 'place_visitor_review'
      })
    );
  });
});
