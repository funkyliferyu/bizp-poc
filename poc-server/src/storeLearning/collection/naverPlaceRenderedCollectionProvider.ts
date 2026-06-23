import type { Store } from '../../repositories/stores.js';
import { configuredBlogProvider } from '../providers/ownerSourcePolicy.js';
import type { JsonRecord, ProviderEnv } from '../providers/placeImportTypes.js';
import { parseNaverPlaceUrl } from '../providers/naverPlaceUrlParser.js';
import {
  extractNaverApolloState,
  renderNaverPlacePage,
  resolveNaverApolloRef,
  type NaverPlaceRenderer,
  type RenderedPlaceSnapshot
} from '../providers/naverPlaceRenderedProvider.js';
import type { CollectionPlan, CollectionProvider, CollectionProviderItemDraft } from './collectionProviders.js';
import { collectRenderedBlogItems, isRenderedBlogCollectionProvider } from './naverBlogRenderedCollectionProvider.js';
import { createNaverSearchCollectionProvider } from './naverSearchCollectionProvider.js';

export type RenderedPlaceReview = {
  reviewId: string | null;
  reviewerName: string | null;
  reviewDate: string | null;
  rating: number | null;
  bodyText: string | null;
  cursor?: string | null;
  reviewKeywords: string[];
  hasMedia: boolean;
  hasVideo: boolean;
  hasOwnerReply: boolean;
  ownerReplyText: string | null;
  replyStatus: 'replied' | 'not_replied';
  photoUrls: string[];
  sourceUrl: string | null;
  ordinal: number;
};

const RESTRICTED_MARKERS = [
  '서비스 이용이 제한되었습니다',
  '과도한 접근 요청으로 서비스 이용이 제한되었습니다',
  '잠시 후 다시 시도해주세요'
];

const NAVER_MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_match, number: string) => String.fromCodePoint(parseInt(number, 10)));
}

function cleanText(value: unknown) {
  if (value === null || value === undefined) return null;
  const cleaned = decodeHtmlEntities(String(value))
    .replace(/\u001c/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
}

function stripTags(value: string) {
  return cleanText(
    value
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(?:br|\/p|\/div|\/section|\/h[1-6]|\/li|\/article)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );
}

function attribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'));
  return cleanText(match?.[1]);
}

function absoluteUrl(value: string | null, baseUrl: string) {
  if (!value) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function imageUrlsFromReviewBlock(block: string, baseUrl: string) {
  const urls = new Set<string>();
  for (const match of block.matchAll(/<img\b[^>]*>/gi)) {
    const src = attribute(match[0], 'src') ?? attribute(match[0], 'data-src');
    const absolute = absoluteUrl(src, baseUrl);
    if (absolute) urls.add(absolute);
  }
  return Array.from(urls);
}

function imageUrlsFromMedia(media: unknown) {
  if (!Array.isArray(media)) return [];
  const urls = new Set<string>();
  for (const value of media) {
    const record = asRecord(value);
    for (const key of ['imageUrl', 'url', 'origin', 'thumbnailUrl', 'thumbnail', 'previewImageUrl']) {
      const url = asString(record?.[key]);
      if (url) urls.add(url);
    }
  }
  return Array.from(urls);
}

function asBooleanAttribute(value: string | null) {
  if (!value) return false;
  return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
}

function numberValue(value: string | null) {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function isRestrictedSnapshot(snapshot: RenderedPlaceSnapshot) {
  const text = snapshot.bodyText ?? stripTags(snapshot.html) ?? '';
  return RESTRICTED_MARKERS.some((marker) => text.includes(marker));
}

function isVisitorReviewUrl(value: string) {
  return /\/review\/visitor(?:[/?#]|$)/.test(value);
}

function nextReviewUrlFromSnapshot(html: string, baseUrl: string) {
  const dataNext =
    html.match(/data-next-review-url=["']([^"']+)["']/i)?.[1] ??
    html.match(/data-next-url=["']([^"']*\/review\/visitor[^"']*)["']/i)?.[1];
  const nextFromData = absoluteUrl(cleanText(dataNext), baseUrl);
  if (nextFromData) return nextFromData;

  const relNext = html.match(/<a\b[^>]*rel=["'][^"']*\bnext\b[^"']*["'][^>]*>/i)?.[0];
  const nextFromRel = absoluteUrl(attribute(relNext ?? '', 'href'), baseUrl);
  if (nextFromRel && isVisitorReviewUrl(nextFromRel)) return nextFromRel;

  return null;
}

function categorySegmentFromPath(segments: string[], idIndex: number) {
  const previous = segments[idIndex - 1];
  if (!previous || ['entry', 'place', 'p'].includes(previous)) return 'place';
  return previous;
}

export function toNaverPlaceVisitorReviewUrl(placeUrl: string | null) {
  if (!placeUrl?.trim()) return null;
  let url: URL;
  try {
    url = new URL(placeUrl.trim());
  } catch {
    return null;
  }

  if (isVisitorReviewUrl(url.toString())) {
    url.search = '';
    url.hash = '';
    return url.toString();
  }

  if (url.hostname.toLowerCase().replace(/^www\./, '') === 'naver.me') return url.toString();

  const segments = url.pathname.split('/').filter(Boolean);
  const idIndex = segments.findIndex((segment) => /^\d{5,}$/.test(segment));
  if (idIndex >= 0) {
    const placeId = segments[idIndex];
    const category = categorySegmentFromPath(segments, idIndex);
    return `https://m.place.naver.com/${category}/${placeId}/review/visitor`;
  }

  const parsed = parseNaverPlaceUrl(url.toString());
  if (!parsed?.candidateId || !/^\d{5,}$/.test(parsed.candidateId)) return null;
  return `https://m.place.naver.com/place/${parsed.candidateId}/review/visitor`;
}

function taggedBlocks(html: string) {
  return Array.from(html.matchAll(/<article\b[^>]*data-review-card\b[^>]*>[\s\S]*?<\/article>/gi)).map(
    (match) => match[0]
  );
}

function textFromClass(block: string, className: string) {
  const match = block.match(new RegExp(`<[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i'));
  return stripTags(match?.[1] ?? '');
}

function reviewKeywordsFrom(block: string) {
  const keywords = new Set<string>();
  for (const match of block.matchAll(/<[^>]*data-review-keyword(?:=["'][^"']*["'])?[^>]*>([\s\S]*?)<\/[^>]+>/gi)) {
    const attr = attribute(match[0], 'data-review-keyword');
    const keyword = attr && attr !== 'true' ? attr : stripTags(match[1]);
    if (keyword) keywords.add(keyword);
  }
  return Array.from(keywords);
}

function ownerReplyFrom(block: string) {
  const match =
    block.match(/<[^>]*data-owner-reply(?:=["'][^"']*["'])?[^>]*>([\s\S]*?)<\/[^>]+>/i) ??
    block.match(/<[^>]*class=["'][^"']*owner-reply[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
  return stripTags(match?.[1] ?? '');
}

function reviewFromTaggedBlock(block: string, ordinal: number, finalUrl = ''): RenderedPlaceReview {
  const firstTag = block.match(/^<\w+\b[^>]*>/)?.[0] ?? '';
  const ownerReplyText = ownerReplyFrom(block);
  const hasOwnerReply = Boolean(ownerReplyText);
  const photoUrls = imageUrlsFromReviewBlock(block, finalUrl);
  return {
    reviewId: attribute(firstTag, 'data-review-id'),
    reviewerName: attribute(firstTag, 'data-reviewer'),
    reviewDate: attribute(firstTag, 'data-review-date'),
    rating: numberValue(attribute(firstTag, 'data-rating')),
    bodyText: textFromClass(block, 'review-body') ?? stripTags(block),
    reviewKeywords: reviewKeywordsFrom(block),
    hasMedia: asBooleanAttribute(attribute(firstTag, 'data-media')) || photoUrls.length > 0,
    hasVideo: asBooleanAttribute(attribute(firstTag, 'data-video')),
    hasOwnerReply,
    ownerReplyText,
    replyStatus: hasOwnerReply ? 'replied' : 'not_replied',
    photoUrls,
    sourceUrl: attribute(firstTag, 'data-source-url'),
    ordinal
  };
}

function reviewsFromJsonLd(html: string, finalUrl: string) {
  const reviews: RenderedPlaceReview[] = [];
  for (const match of html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(decodeHtmlEntities(match[1])) as unknown;
      const values = Array.isArray(parsed) ? parsed : [parsed];
      for (const value of values) {
        if (!value || typeof value !== 'object') continue;
        const record = value as Record<string, unknown>;
        const nestedReviews = Array.isArray(record.review) ? record.review : record.review ? [record.review] : [];
        for (const review of nestedReviews) {
          if (!review || typeof review !== 'object') continue;
          const reviewRecord = review as Record<string, unknown>;
          const bodyText = cleanText(reviewRecord.reviewBody ?? reviewRecord.description);
          if (!bodyText) continue;
          const ordinal = reviews.length + 1;
          const author = reviewRecord.author && typeof reviewRecord.author === 'object' ? reviewRecord.author : null;
          const rating = reviewRecord.reviewRating && typeof reviewRecord.reviewRating === 'object' ? reviewRecord.reviewRating : null;
          reviews.push({
            reviewId: cleanText(reviewRecord['@id'] ?? reviewRecord.identifier),
            reviewerName: cleanText(author ? (author as Record<string, unknown>).name : reviewRecord.author),
            reviewDate: cleanText(reviewRecord.datePublished),
            rating: numberValue(cleanText(rating ? (rating as Record<string, unknown>).ratingValue : reviewRecord.ratingValue)),
            bodyText,
            reviewKeywords: [],
            hasMedia: false,
            hasVideo: false,
            hasOwnerReply: false,
            ownerReplyText: null,
            replyStatus: 'not_replied',
            photoUrls: asString(reviewRecord.image) ? [asString(reviewRecord.image) as string] : [],
            sourceUrl: `${finalUrl}#review-${ordinal}`,
            ordinal
          });
        }
      }
    } catch {
      continue;
    }
  }
  return reviews;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function refKey(value: unknown) {
  return asString(asRecord(value)?.__ref);
}

function reviewRefsFromApolloState(state: Record<string, unknown>) {
  const refs: string[] = [];
  const seen = new Set<string>();
  const root = asRecord(state.ROOT_QUERY);
  if (root) {
    for (const [key, value] of Object.entries(root)) {
      if (!key.startsWith('visitorReviews(')) continue;
      const result = asRecord(value);
      const items = Array.isArray(result?.items) ? result.items : [];
      for (const item of items) {
        const key = refKey(item);
        if (key && !seen.has(key)) {
          seen.add(key);
          refs.push(key);
        }
      }
    }
  }

  for (const [key, value] of Object.entries(state)) {
    if (!key.startsWith('VisitorReview:') || key.startsWith('VisitorReviewAuthor:')) continue;
    const record = asRecord(value);
    if (!record || !asString(record.body) || seen.has(key)) continue;
    seen.add(key);
    refs.push(key);
  }

  return refs;
}

function reviewKeywordsFromApolloReview(review: Record<string, unknown>) {
  const keywords = new Set<string>();
  const votedKeywords = Array.isArray(review.votedKeywords) ? review.votedKeywords : [];
  for (const value of votedKeywords) {
    const name = asString(asRecord(value)?.name);
    if (name) keywords.add(name);
  }
  const visitCategories = Array.isArray(review.visitCategories) ? review.visitCategories : [];
  for (const category of visitCategories) {
    const categoryRecord = asRecord(category);
    const keywordsInCategory = Array.isArray(categoryRecord?.keywords) ? categoryRecord.keywords : [];
    for (const value of keywordsInCategory) {
      const name = asString(asRecord(value)?.name);
      if (name) keywords.add(name);
    }
  }
  return Array.from(keywords);
}

function reviewBodyTextFrom(body: unknown, keywords: string[], media: unknown) {
  const bodyText = cleanText(body);
  if (bodyText) return bodyText;
  if (keywords.length > 0) return `방문자 리뷰 키워드: ${keywords.join(', ')}`;
  if (Array.isArray(media) && media.length > 0) return '사진이 포함된 방문자 리뷰입니다.';
  return null;
}

function hasVideoMedia(media: unknown) {
  if (!Array.isArray(media)) return false;
  return media.some((value) => {
    const record = asRecord(value);
    return record?.type === 'video' || Boolean(record?.videoId) || Boolean(record?.videoUrl);
  });
}

function reviewsFromApolloState(html: string, finalUrl: string) {
  const state = extractNaverApolloState(html);
  if (!state) return [];

  const reviews: RenderedPlaceReview[] = [];
  for (const key of reviewRefsFromApolloState(state)) {
    const review = asRecord(state[key]);
    if (!review) continue;
    const keywords = reviewKeywordsFromApolloReview(review);
    const author = resolveNaverApolloRef(state, review.author);
    const media = Array.isArray(review.media) ? review.media : [];
    const bodyText = reviewBodyTextFrom(review.body, keywords, media);
    if (!bodyText) continue;
    const photoUrls = imageUrlsFromMedia(media);
    const reply = asRecord(review.reply);
    const ownerReplyText = cleanText(reply?.body);
    const reviewId = cleanText(review.reviewId ?? review.id);
    const ordinal = reviews.length + 1;
    reviews.push({
      reviewId,
      reviewerName: cleanText(author?.nickname ?? review.nickname),
      reviewDate: cleanText(review.representativeVisitDateTime ?? review.created ?? review.visited),
      rating: asNumber(review.rating),
      bodyText,
      cursor: cleanText(review.cursor),
      reviewKeywords: keywords,
      hasMedia: media.length > 0 || Boolean(asString(review.thumbnail)),
      hasVideo: hasVideoMedia(media),
      hasOwnerReply: Boolean(ownerReplyText),
      ownerReplyText,
      replyStatus: ownerReplyText ? 'replied' : 'not_replied',
      photoUrls,
      sourceUrl: `${finalUrl}#${reviewId ?? `review-${ordinal}`}`,
      ordinal
    });
  }

  return reviews;
}

function visitorReviewInputFromApolloState(html: string) {
  const state = extractNaverApolloState(html);
  const root = asRecord(state?.ROOT_QUERY);
  if (!root) return null;

  const inputs: Array<Record<string, unknown>> = [];
  for (const key of Object.keys(root)) {
    const match = key.match(/^visitorReviews\((.*)\)$/);
    if (!match) continue;
    try {
      const parsed = JSON.parse(match[1]) as unknown;
      const input = asRecord(asRecord(parsed)?.input);
      if (input) inputs.push(input);
    } catch {
      continue;
    }
  }

  return inputs.find((input) => input.includeContent === true) ?? inputs[0] ?? null;
}

function reviewFromGraphQlItem(item: Record<string, unknown>, finalUrl: string, ordinal: number): RenderedPlaceReview | null {
  const author = asRecord(item.author);
  const reply = asRecord(item.reply);
  const media = asArray(item.media);
  const photoUrls = imageUrlsFromMedia(media);
  const reviewId = cleanText(item.reviewId ?? item.id);
  const keywords = new Set<string>();
  for (const keyword of asArray(item.votedKeywords)) {
    const name = cleanText(asRecord(keyword)?.name);
    if (name) keywords.add(name);
  }
  for (const category of asArray(item.visitCategories)) {
    for (const keyword of asArray(asRecord(category)?.keywords)) {
      const name = cleanText(asRecord(keyword)?.name);
      if (name) keywords.add(name);
    }
  }
  const keywordList = Array.from(keywords);
  const bodyText = reviewBodyTextFrom(item.body, keywordList, media);
  if (!bodyText) return null;
  const ownerReplyText = cleanText(reply?.body);
  return {
    reviewId,
    reviewerName: cleanText(author?.nickname ?? item.nickname),
    reviewDate: cleanText(item.representativeVisitDateTime ?? item.created ?? item.visited),
    rating: asNumber(item.rating),
    bodyText,
    cursor: cleanText(item.cursor),
    reviewKeywords: keywordList,
    hasMedia: media.length > 0 || Boolean(asString(item.thumbnail)),
    hasVideo: hasVideoMedia(media),
    hasOwnerReply: Boolean(ownerReplyText),
    ownerReplyText,
    replyStatus: ownerReplyText ? 'replied' : 'not_replied',
    photoUrls,
    sourceUrl: `${finalUrl}#${reviewId ?? `review-${ordinal}`}`,
    ordinal
  };
}

const VISITOR_REVIEWS_QUERY = `query visitorReviews($input: VisitorReviewsInput) {
  visitorReviews(input: $input) {
    total
    items {
      id
      reviewId
      cursor
      body
      rating
      created
      representativeVisitDateTime
      author { id nickname }
      reply { body }
      votedKeywords { name }
      visitCategories { keywords { name } }
      media { type videoId videoUrl thumbnail thumbnailRatio }
    }
  }
}`;

function graphQlBatchSize(env: ProviderEnv, requestedLimit: number) {
  const configured = Number(env.NAVER_PLACE_REVIEW_GRAPHQL_BATCH_SIZE ?? '50');
  const batchSize = Number.isFinite(configured) ? configured : 50;
  return Math.max(1, Math.min(50, requestedLimit, Math.floor(batchSize)));
}

async function fetchGraphQlVisitorReviews(input: Record<string, unknown>, finalUrl: string, env: ProviderEnv) {
  const endpoint = env.NAVER_PLACE_GRAPHQL_ENDPOINT ?? 'https://api.place.naver.com/graphql';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      origin: 'https://m.place.naver.com',
      referer: finalUrl,
      'user-agent': env.NAVER_RENDERER_USER_AGENT ?? env.NAVER_PLACE_RENDERER_USER_AGENT ?? NAVER_MOBILE_USER_AGENT
    },
    body: JSON.stringify([
      {
        operationName: 'visitorReviews',
        variables: { input },
        query: VISITOR_REVIEWS_QUERY
      }
    ])
  });
  if (!response.ok) throw new Error(`Naver Place review GraphQL failed with HTTP ${response.status}`);
  const payload = (await response.json()) as unknown;
  const result = asRecord(asRecord(Array.isArray(payload) ? payload[0] : payload)?.data)?.visitorReviews;
  const items = asArray(asRecord(result)?.items);
  return {
    total: asNumber(asRecord(result)?.total),
    reviews: items
      .map((item, index) => reviewFromGraphQlItem(asRecord(item) ?? {}, finalUrl, index + 1))
      .filter((review): review is RenderedPlaceReview => Boolean(review))
  };
}

function reviewKey(review: RenderedPlaceReview) {
  return review.reviewId ?? review.sourceUrl ?? review.bodyText ?? `ordinal:${review.ordinal}`;
}

function addUniqueReviews(
  target: RenderedPlaceReview[],
  seenReviews: Set<string>,
  candidates: RenderedPlaceReview[],
  limit: number
) {
  for (const review of candidates) {
    const key = reviewKey(review);
    if (seenReviews.has(key)) continue;
    seenReviews.add(key);
    target.push({ ...review, ordinal: target.length + 1 });
    if (target.length >= limit) break;
  }
}

async function collectGraphQlReviewFallback(input: {
  html: string;
  finalUrl: string;
  env: ProviderEnv;
  limit: number;
  reviews: RenderedPlaceReview[];
  seenReviews: Set<string>;
}) {
  const baseInput = visitorReviewInputFromApolloState(input.html);
  if (!baseInput) return null;
  const size = graphQlBatchSize(input.env, input.limit);
  let afterCursor: string | null = null;
  const seenAfterCursors = new Set<string>();
  const maxPages = Math.min(40, Math.ceil(input.limit / size) + 2);
  let availableTotal: number | null = null;

  for (let page = 0; page < maxPages && input.reviews.length < input.limit; page += 1) {
    if (afterCursor) {
      if (seenAfterCursors.has(afterCursor)) break;
      seenAfterCursors.add(afterCursor);
    }
    if (input.reviews.length >= input.limit) break;
    const pageInput: Record<string, unknown> = {
      ...baseInput,
      includeContent: true,
      size,
      ...(afterCursor ? { after: afterCursor } : {})
    };
    const result: Awaited<ReturnType<typeof fetchGraphQlVisitorReviews>> | null = await fetchGraphQlVisitorReviews(
      pageInput,
      input.finalUrl,
      input.env
    ).catch(() => null);
    const reviews: RenderedPlaceReview[] = result?.reviews ?? [];
    if (result?.total !== null && result?.total !== undefined) {
      availableTotal = Math.max(availableTotal ?? 0, result.total);
    }
    if (reviews.length === 0) break;
    addUniqueReviews(input.reviews, input.seenReviews, reviews, input.limit);
    const nextCursor: string | null = reviews[reviews.length - 1]?.cursor ?? null;
    if (!nextCursor || seenAfterCursors.has(nextCursor)) break;
    afterCursor = nextCursor;
  }
  return availableTotal;
}

export function extractRenderedPlaceReviews(input: {
  html: string;
  bodyText: string | null;
  finalUrl: string;
}): RenderedPlaceReview[] {
  const blocks = taggedBlocks(input.html);
  if (blocks.length > 0) {
    return blocks
      .map((block, index) => reviewFromTaggedBlock(block, index + 1, input.finalUrl))
      .filter((review) => Boolean(review.bodyText));
  }
  const apolloReviews = reviewsFromApolloState(input.html, input.finalUrl);
  if (apolloReviews.length > 0) return apolloReviews;
  return reviewsFromJsonLd(input.html, input.finalUrl);
}

function mockBlogItems(plan: CollectionPlan): CollectionProviderItemDraft[] {
  const items: CollectionProviderItemDraft[] = [];
  for (let index = 1; index <= plan.blogPostLimit; index += 1) {
    items.push({
      channel: 'blog',
      sourceType: 'post',
      sourceUrl: `https://blog.naver.com/mock-store/${index}`,
      title: `수집된 블로그 글 ${index}`,
      bodyText: `mock provider가 생성한 블로그 본문 ${index}입니다.`,
      metadata: {
        provider: 'mockCollectionProvider',
        providerMode: 'mock',
        bodyAvailability: 'mock_body',
        fallbackReason: 'blog_collection_is_out_of_scope_for_naver_place_review_step',
        ordinal: index
      }
    });
  }
  return items;
}

function unavailableBlogItems(plan: CollectionPlan): CollectionProviderItemDraft[] {
  const items: CollectionProviderItemDraft[] = [];
  for (let index = 1; index <= plan.blogPostLimit; index += 1) {
    items.push({
      channel: 'blog',
      sourceType: 'post',
      status: 'failed',
      sourceUrl: null,
      title: `블로그 본문 ${index} 수집 보류`,
      bodyText: null,
      metadata: {
        provider: 'naverPlaceRenderedCollectionProvider',
        providerMode: 'real',
        bodyAvailability: 'unavailable',
        reason: 'blog_body_provider_not_implemented_in_naver_place_review_step',
        ordinal: index
      }
    });
  }
  return items;
}

async function collectBlogItems(
  env: ProviderEnv,
  plan: CollectionPlan,
  store: Store,
  storeChannels: Parameters<typeof collectRenderedBlogItems>[0]['storeChannels']
) {
  if (plan.blogPostLimit <= 0) return [];
  if (isRenderedBlogCollectionProvider(env)) {
    return collectRenderedBlogItems({ env, plan, store, storeChannels });
  }
  if (configuredBlogProvider(env) === 'official_search' && env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET) {
    return createNaverSearchCollectionProvider().collect({
      env,
      plan: {
        blogPostLimit: plan.blogPostLimit,
        includePlaceProfile: false,
        placeReviewLimit: 0
      },
      store
    });
  }
  if (configuredBlogProvider(env) === 'mock') return mockBlogItems(plan);
  return unavailableBlogItems(plan);
}

function profileItem(store: Store, plan: CollectionPlan): CollectionProviderItemDraft[] {
  if (!plan.includePlaceProfile) return [];
  const bodyText =
    [store.category, store.address, store.phone, store.description].filter((value): value is string => Boolean(value)).join('\n') ||
    null;
  return [
    {
      channel: 'place',
      sourceType: 'profile',
      sourceUrl: store.naverPlaceUrl,
      title: store.name,
      bodyText,
      metadata: {
        provider: 'naverPlaceRenderedCollectionProvider',
        providerMode: 'real',
        bodyAvailability: 'store_profile_snapshot',
        naverPlaceId: store.naverPlaceId,
        storeMetadata: (store.metadata ?? null) as JsonRecord | null
      }
    }
  ];
}

function failedReviewItems(plan: CollectionPlan, sourceUrl: string | null, reason: string, startOrdinal = 1) {
  const items: CollectionProviderItemDraft[] = [];
  for (let index = startOrdinal; index <= plan.placeReviewLimit; index += 1) {
    items.push({
      channel: 'place',
      sourceType: 'review',
      status: 'failed',
      sourceUrl,
      title: `플레이스 방문자 리뷰 ${index} 수집 보류`,
      bodyText: null,
      metadata: {
        provider: 'naverPlaceRenderedCollectionProvider',
        providerMode: 'real',
        bodyAvailability: 'unavailable',
        reviewAvailability: 'rendered_place_visitor_review_unavailable',
        reason,
        ordinal: index
      }
    });
  }
  return items;
}

async function renderVisitorReviewSnapshot(
  placeUrl: string,
  env: ProviderEnv,
  renderer: NaverPlaceRenderer
): Promise<{ reviewUrl: string; snapshot: RenderedPlaceSnapshot } | null> {
  const initialReviewUrl = toNaverPlaceVisitorReviewUrl(placeUrl);
  if (!initialReviewUrl) return null;

  let reviewUrl = initialReviewUrl;
  let snapshot = await renderer(reviewUrl, env);

  if (!isVisitorReviewUrl(snapshot.finalUrl)) {
    const resolvedReviewUrl = toNaverPlaceVisitorReviewUrl(snapshot.finalUrl);
    if (resolvedReviewUrl && resolvedReviewUrl !== reviewUrl) {
      reviewUrl = resolvedReviewUrl;
      snapshot = await renderer(reviewUrl, env);
    }
  }

  return { reviewUrl, snapshot };
}

async function collectReviewItems(env: ProviderEnv, plan: CollectionPlan, store: Store, renderer: NaverPlaceRenderer) {
  if (plan.placeReviewLimit <= 0) return [];
  if (!store.naverPlaceUrl) return failedReviewItems(plan, null, 'store_missing_naver_place_url');

  const rendered = await renderVisitorReviewSnapshot(store.naverPlaceUrl, env, renderer);
  if (!rendered) return failedReviewItems(plan, store.naverPlaceUrl, 'unable_to_build_naver_place_visitor_review_url');
  const reviews: RenderedPlaceReview[] = [];
  const seenReviews = new Set<string>();
  const seenPages = new Set<string>();
  let currentReviewUrl = rendered.reviewUrl;
  let currentSnapshot: RenderedPlaceSnapshot | null = rendered.snapshot;

  for (let attempt = 0; currentSnapshot && attempt < 10 && reviews.length < plan.placeReviewLimit; attempt += 1) {
    if (isRestrictedSnapshot(currentSnapshot)) {
      throw new Error('Naver Place rendered review request was restricted by Naver.');
    }
    const finalUrl = currentSnapshot.finalUrl || currentReviewUrl;
    const extracted = extractRenderedPlaceReviews({
      html: currentSnapshot.html,
      bodyText: currentSnapshot.bodyText,
      finalUrl
    });

    for (const review of extracted) {
      addUniqueReviews(reviews, seenReviews, [review], plan.placeReviewLimit);
      if (reviews.length >= plan.placeReviewLimit) break;
    }

    if (reviews.length >= plan.placeReviewLimit) break;
    seenPages.add(currentReviewUrl);
    const nextReviewUrl = nextReviewUrlFromSnapshot(currentSnapshot.html, finalUrl);
    if (!nextReviewUrl || seenPages.has(nextReviewUrl)) break;
    currentReviewUrl = nextReviewUrl;
    currentSnapshot = await renderer(nextReviewUrl, env);
  }

  let availableReviewTotal: number | null = null;
  if (reviews.length < plan.placeReviewLimit) {
    availableReviewTotal = await collectGraphQlReviewFallback({
      html: rendered.snapshot.html,
      finalUrl: rendered.reviewUrl,
      env,
      limit: plan.placeReviewLimit,
      reviews,
      seenReviews
    });
  }

  const items = reviews.map((review): CollectionProviderItemDraft => {
    const sourceUrl = review.sourceUrl ?? `${rendered.reviewUrl}#review-${review.ordinal}`;
    return {
      channel: 'place',
      sourceType: 'review',
      sourceUrl,
      title: review.reviewerName ? `방문자 리뷰 - ${review.reviewerName}` : `방문자 리뷰 ${review.ordinal}`,
      bodyText: review.bodyText,
      metadata: {
        provider: 'naverPlaceRenderedCollectionProvider',
        providerMode: 'real',
        bodyAvailability: 'rendered_place_visitor_review',
        reviewId: review.reviewId,
        reviewerName: review.reviewerName,
        reviewDate: review.reviewDate,
        rating: review.rating,
        reviewKeywords: review.reviewKeywords,
        hasMedia: review.hasMedia,
        hasVideo: review.hasVideo,
        hasOwnerReply: review.hasOwnerReply,
        ownerReplyText: review.ownerReplyText,
        replyStatus: review.replyStatus,
        photoUrls: review.photoUrls,
        visitorPhotoUrls: review.photoUrls,
        ordinal: review.ordinal,
        reviewTabUrl: rendered.reviewUrl,
        availableReviewTotal: availableReviewTotal ?? reviews.length,
        requestedReviewLimit: plan.placeReviewLimit
      }
    };
  });

  return items;
}

export function createNaverPlaceRenderedCollectionProvider(
  renderer: NaverPlaceRenderer = renderNaverPlacePage
): CollectionProvider {
  return {
    name: 'naverPlaceRenderedCollectionProvider',
    mode: 'real',
    async collect({ env, plan, store, storeChannels }) {
      const [blogItems, reviewItems] = await Promise.all([
        collectBlogItems(env, plan, store, storeChannels),
        collectReviewItems(env, plan, store, renderer)
      ]);
      return [...blogItems, ...profileItem(store, plan), ...reviewItems];
    }
  };
}
