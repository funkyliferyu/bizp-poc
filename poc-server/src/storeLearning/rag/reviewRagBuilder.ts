import type { JsonValue } from '../../repositories/base.js';
import type { CollectionItem } from '../../repositories/collection_items.js';
import type { Store } from '../../repositories/stores.js';
import {
  StoreReviewRagDocumentSchema,
  type StoreReviewEntry,
  type StoreReviewRagDocument
} from './ragDocumentTypes.js';
import { RAG_REVIEW_LIMIT } from './ragReviewPolicy.js';
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

function ownerReplyKey(text: string): string {
  return text
    .replace(/[~!?.。！？]+/g, '.')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function sentenceParts(text: string): string[] {
  return text
    .split(/[.!?。！？\n]+/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function isPlaceholderOwnerReply(text: string): boolean {
  return /^(?:사장님\s*)?(?:답글|댓글)\s*(?:없음|없습니다|미등록)$/i.test(text);
}

function isGenericOwnerReply(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return [
    /^감사(?:합니다|드립니다)[.!~\s]*$/i,
    /^고맙습니다[.!~\s]*$/i,
    /^소중한\s*(?:리뷰|후기|방문)?\s*감사(?:합니다|드립니다)[.!~\s]*$/i,
    /^방문해\s*주셔서\s*감사(?:합니다|드립니다)[.!~\s]*$/i,
    /^이용해\s*주셔서\s*감사(?:합니다|드립니다)[.!~\s]*$/i,
    /^좋은\s*하루\s*되세요[.!~\s]*$/i,
    /^또\s*방문해\s*주세요[.!~\s]*$/i
  ].some((pattern) => pattern.test(normalized));
}

function hasRepeatedSentenceOnly(text: string): boolean {
  const parts = sentenceParts(text);
  if (parts.length < 2) return false;
  return new Set(parts.map((part) => ownerReplyKey(part))).size === 1;
}

function candidateOwnerReply(value: unknown): string | null {
  const text = cleanText(value);
  if (!text || isPlaceholderOwnerReply(text) || isGenericOwnerReply(text) || hasRepeatedSentenceOnly(text)) return null;
  return text;
}

function ownerReplyCounts(items: CollectionItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const reply = candidateOwnerReply(asRecord(item.metadata).ownerReplyText);
    if (!reply) continue;
    const key = ownerReplyKey(reply);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function meaningfulOwnerReply(value: unknown, counts: Map<string, number>): string | null {
  const reply = candidateOwnerReply(value);
  if (!reply) return null;
  return (counts.get(ownerReplyKey(reply)) ?? 0) > 1 ? null : reply;
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
  const replyCounts = ownerReplyCounts(sampledReviews);

  const entries: StoreReviewEntry[] = sampledReviews.map((item, index) => {
    const metadata = asRecord(item.metadata);
    const ownerReplyText = meaningfulOwnerReply(metadata.ownerReplyText, replyCounts);
    return {
      ordinal: index + 1,
      reviewId: item.id,
      reviewerName: cleanText(metadata.reviewerName),
      reviewDate: cleanText(metadata.reviewDate),
      rating: asNumber(metadata.rating),
      bodyText: cleanText(item.bodyText) ?? '',
      ownerReplyText,
      replyStatus: ownerReplyText ? 'replied' : 'not_replied',
      sourceUrl: null,
      keywords: []
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
      collectedReviews.length > RAG_REVIEW_LIMIT
        ? `최근 20개와 이전 리뷰 ${RAG_REVIEW_LIMIT - 20}개를 seeded random interval 방식으로 샘플링했습니다.`
        : '수집된 방문자 리뷰 전체를 포함했습니다.',
    entries,
    warnings: collectedReviews.length === 0 ? ['수집된 방문자 리뷰가 없습니다.'] : []
  });
}
