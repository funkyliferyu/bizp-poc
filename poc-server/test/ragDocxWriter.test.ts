import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createInfoDocxBuffer, createReviewsDocxBuffer } from '../src/storeLearning/rag/docxWriter.js';
import type { StoreInfoRagDocument, StoreReviewRagDocument } from '../src/storeLearning/rag/ragDocumentTypes.js';

function documentXml(buffer: Buffer) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'rag-docx-'));
  const filePath = path.join(dir, 'document.docx');
  writeFileSync(filePath, buffer);
  return execFileSync('unzip', ['-p', filePath, 'word/document.xml'], { encoding: 'utf8' });
}

describe('RAG DOCX writer', () => {
  it('creates a Word document for static store info', async () => {
    const document: StoreInfoRagDocument = {
      storeId: 'store_haehwaro',
      storeName: '해화로in수산',
      title: '해화로in수산 정보',
      generatedAt: '2026-06-09T00:00:00.000Z',
      sections: [
        {
          title: '기본 정보',
          lines: ['상호명: 해화로in수산', '업종: 음식점 > 일식 > 생선회']
        }
      ],
      warnings: []
    };

    const buffer = await createInfoDocxBuffer(document);
    const xml = documentXml(buffer);

    expect(buffer.subarray(0, 2).toString()).toBe('PK');
    expect(xml).toContain('해화로in수산 정보');
    expect(xml).not.toContain('해화로in수산 식당 정보');
    expect(xml).toContain('상호명: 해화로in수산');
  });

  it('creates a Word document for visitor reviews and owner replies', async () => {
    const document: StoreReviewRagDocument = {
      storeId: 'store_haehwaro',
      storeName: '해화로in수산',
      title: '해화로in수산 방문자 리뷰 모음',
      generatedAt: '2026-06-09T00:00:00.000Z',
      totalCollectedReviews: 1,
      includedReviewCount: 1,
      samplingStrategy: '수집된 방문자 리뷰 전체를 포함했습니다.',
      entries: [
        {
          ordinal: 1,
          reviewId: 'review_1',
          reviewerName: 'yys****',
          reviewDate: '2026.06.01',
          rating: 5,
          bodyText: '회가 신선하고 직원분들이 친절했어요.',
          ownerReplyText: '소중한 리뷰 감사합니다.',
          replyStatus: 'replied',
          sourceUrl: 'https://m.place.naver.com/restaurant/1824807602/review/visitor',
          keywords: ['신선해요']
        }
      ],
      warnings: []
    };

    const buffer = await createReviewsDocxBuffer(document);
    const xml = documentXml(buffer);

    expect(buffer.subarray(0, 2).toString()).toBe('PK');
    expect(xml).toContain('해화로in수산 방문자 리뷰 모음');
    expect(xml).toContain('▶ 사장님 답글: 소중한 리뷰 감사합니다.');
    expect(xml).not.toContain('키워드:');
    expect(xml).not.toContain('출처:');
  });

  it('omits absent owner replies instead of writing placeholder reply text', async () => {
    const document: StoreReviewRagDocument = {
      storeId: 'store_haehwaro',
      storeName: '해화로in수산',
      title: '해화로in수산 방문자 리뷰 모음',
      generatedAt: '2026-06-09T00:00:00.000Z',
      totalCollectedReviews: 1,
      includedReviewCount: 1,
      samplingStrategy: '수집된 방문자 리뷰 전체를 포함했습니다.',
      entries: [
        {
          ordinal: 1,
          reviewId: 'review_1',
          reviewerName: null,
          reviewDate: null,
          rating: null,
          bodyText: '회가 신선하고 직원분들이 친절했어요.',
          ownerReplyText: null,
          replyStatus: 'not_replied',
          sourceUrl: null,
          keywords: []
        }
      ],
      warnings: []
    };

    const buffer = await createReviewsDocxBuffer(document);
    const xml = documentXml(buffer);

    expect(xml).toContain('회가 신선하고 직원분들이 친절했어요.');
    expect(xml).not.toContain('사장님 답글 없음');
    expect(xml).not.toContain('▶ 사장님 답글:');
  });
});
