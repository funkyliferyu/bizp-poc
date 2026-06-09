import type { JsonValue } from '../../repositories/base.js';
import type { CollectionItem } from '../../repositories/collection_items.js';
import type { Store } from '../../repositories/stores.js';
import {
  StoreReviewRagDocumentSchema,
  type StoreReviewEntry,
  type StoreReviewRagDocument
} from './ragDocumentTypes.js';
import { selectReviewSample } from './reviewSampler.js';

type JsonRecord = Record<string, JsonValue>;

type ReviewDocumentInput = {
  store: Store;
  collectionItems: CollectionItem[];
  latestRunId?: string | null;
};

function isRecord(value: JsonValue | undefined): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: JsonValue | undefined): JsonRecord {
  return isRecord(value) ? value : {};
}

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseReviewDate(value: unknown): number | null {
  const text = cleanText(value);
  if (!text) return null;
  const isoTime = Date.parse(text);
  if (Number.isFinite(isoTime)) return isoTime;
  const match = text.match(/(?:(20\d{2})[.\-/년]\s*)?(\d{1,2})[.\-/월]\s*(\d{1,2})/);
  if (!match) return null;
  const year = match[1] ? Number(match[1]) : new Date().getFullYear();
  const month = Number(match[2]);
  const day = Number(match[3]);
  const time = Date.UTC(year, month - 1, day);
  return Number.isFinite(time) ? time : null;
}

function reviewOrdinal(item: CollectionItem): number {
  return asNumber(asRecord(item.metadata).ordinal) ?? Number.MAX_SAFE_INTEGER;
}

function sortReviews(items: CollectionItem[]) {
  return [...items].sort((left, right) => {
    const leftDate = parseReviewDate(asRecord(left.metadata).reviewDate);
    const rightDate = parseReviewDate(asRecord(right.metadata).reviewDate);
    if (leftDate !== null && rightDate !== null && leftDate !== rightDate) return rightDate - leftDate;
    if (leftDate !== null && rightDate === null) return -1;
    if (leftDate === null && rightDate !== null) return 1;

    const leftOrdinal = reviewOrdinal(left);
    const rightOrdinal = reviewOrdinal(right);
    if (leftOrdinal !== rightOrdinal) return leftOrdinal - rightOrdinal;

    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
}

function reviewKeywords(metadata: JsonRecord): string[] {
  const raw = metadata.reviewKeywords ?? metadata.keywords;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => cleanText(item)).filter((item): item is string => Boolean(item));
}

export function buildStoreReviewRagDocument(input: ReviewDocumentInput): StoreReviewRagDocument {
  const collectedReviews = sortReviews(
    input.collectionItems.filter((item) => {
      return item.channel === 'place' && item.sourceType === 'review' && item.status === 'collected' && cleanText(item.bodyText);
    })
  );
  const sampledReviews = selectReviewSample(collectedReviews, {
    seed: `${input.store.id}:${input.latestRunId ?? 'unknown_run'}`
  });

  const entries: StoreReviewEntry[] = sampledReviews.map((item, index) => {
    const metadata = asRecord(item.metadata);
    const ownerReplyText = cleanText(metadata.ownerReplyText);
    return {
      ordinal: index + 1,
      reviewId: item.id,
      reviewerName: cleanText(metadata.reviewerName),
      reviewDate: cleanText(metadata.reviewDate),
      rating: asNumber(metadata.rating),
      bodyText: cleanText(item.bodyText) ?? '',
      ownerReplyText,
      replyStatus: ownerReplyText ? 'replied' : 'not_replied',
      sourceUrl: item.sourceUrl,
      keywords: reviewKeywords(metadata)
    };
  });

  return StoreReviewRagDocumentSchema.parse({
    storeId: input.store.id,
    storeName: input.store.name,
    title: `${input.store.name} 방문자 리뷰 모음`,
    generatedAt: new Date().toISOString(),
    totalCollectedReviews: collectedReviews.length,
    includedReviewCount: entries.length,
    samplingStrategy:
      collectedReviews.length > 100
        ? '최근 20개와 이전 리뷰 80개를 seeded random interval 방식으로 샘플링했습니다.'
        : '수집된 방문자 리뷰 전체를 포함했습니다.',
    entries,
    warnings: collectedReviews.length === 0 ? ['수집된 방문자 리뷰가 없습니다.'] : []
  });
}
