import type { Store } from '../../repositories/stores.js';
import { configuredBlogProvider } from '../providers/ownerSourcePolicy.js';
import type { JsonRecord, ProviderEnv } from '../providers/placeImportTypes.js';
import { parseNaverPlaceUrl } from '../providers/naverPlaceUrlParser.js';
import {
  renderNaverPlacePage,
  type NaverPlaceRenderer,
  type RenderedPlaceSnapshot
} from '../providers/naverPlaceRenderedProvider.js';
import type { CollectionPlan, CollectionProvider, CollectionProviderItemDraft } from './collectionProviders.js';
import { createNaverSearchCollectionProvider } from './naverSearchCollectionProvider.js';

export type RenderedPlaceReview = {
  reviewId: string | null;
  reviewerName: string | null;
  reviewDate: string | null;
  rating: number | null;
  bodyText: string | null;
  reviewKeywords: string[];
  hasMedia: boolean;
  hasVideo: boolean;
  hasOwnerReply: boolean;
  ownerReplyText: string | null;
  replyStatus: 'replied' | 'not_replied';
  sourceUrl: string | null;
  ordinal: number;
};

const RESTRICTED_MARKERS = [
  '서비스 이용이 제한되었습니다',
  '과도한 접근 요청으로 서비스 이용이 제한되었습니다',
  '잠시 후 다시 시도해주세요'
];

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
  const text = `${snapshot.bodyText ?? ''}\n${snapshot.html}`;
  return RESTRICTED_MARKERS.some((marker) => text.includes(marker));
}

function isVisitorReviewUrl(value: string) {
  return /\/review\/visitor(?:[/?#]|$)/.test(value);
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

function reviewFromTaggedBlock(block: string, ordinal: number): RenderedPlaceReview {
  const firstTag = block.match(/^<\w+\b[^>]*>/)?.[0] ?? '';
  const ownerReplyText = ownerReplyFrom(block);
  const hasOwnerReply = Boolean(ownerReplyText);
  return {
    reviewId: attribute(firstTag, 'data-review-id'),
    reviewerName: attribute(firstTag, 'data-reviewer'),
    reviewDate: attribute(firstTag, 'data-review-date'),
    rating: numberValue(attribute(firstTag, 'data-rating')),
    bodyText: textFromClass(block, 'review-body') ?? stripTags(block),
    reviewKeywords: reviewKeywordsFrom(block),
    hasMedia: asBooleanAttribute(attribute(firstTag, 'data-media')),
    hasVideo: asBooleanAttribute(attribute(firstTag, 'data-video')),
    hasOwnerReply,
    ownerReplyText,
    replyStatus: hasOwnerReply ? 'replied' : 'not_replied',
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

export function extractRenderedPlaceReviews(input: {
  html: string;
  bodyText: string | null;
  finalUrl: string;
}): RenderedPlaceReview[] {
  const blocks = taggedBlocks(input.html);
  if (blocks.length > 0) {
    return blocks.map((block, index) => reviewFromTaggedBlock(block, index + 1)).filter((review) => Boolean(review.bodyText));
  }
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

async function collectBlogItems(env: ProviderEnv, plan: CollectionPlan, store: Store) {
  if (plan.blogPostLimit <= 0) return [];
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
  if (isRestrictedSnapshot(rendered.snapshot)) {
    throw new Error('Naver Place rendered review request was restricted by Naver.');
  }

  const reviews = extractRenderedPlaceReviews({
    html: rendered.snapshot.html,
    bodyText: rendered.snapshot.bodyText,
    finalUrl: rendered.snapshot.finalUrl || rendered.reviewUrl
  }).slice(0, plan.placeReviewLimit);

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
        ordinal: review.ordinal,
        reviewTabUrl: rendered.reviewUrl
      }
    };
  });

  if (items.length < plan.placeReviewLimit) {
    return [
      ...items,
      ...failedReviewItems(plan, rendered.reviewUrl, 'rendered_place_review_not_found', items.length + 1)
    ];
  }
  return items;
}

export function createNaverPlaceRenderedCollectionProvider(
  renderer: NaverPlaceRenderer = renderNaverPlacePage
): CollectionProvider {
  return {
    name: 'naverPlaceRenderedCollectionProvider',
    mode: 'real',
    async collect({ env, plan, store }) {
      const [blogItems, reviewItems] = await Promise.all([
        collectBlogItems(env, plan, store),
        collectReviewItems(env, plan, store, renderer)
      ]);
      return [...blogItems, ...profileItem(store, plan), ...reviewItems];
    }
  };
}
