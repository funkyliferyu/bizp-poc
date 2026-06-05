import { z } from 'zod';
import type { JsonRecord, ProviderEnv } from '../providers/placeImportTypes.js';
import type { Store } from '../../repositories/stores.js';
import type { CollectionPlan, CollectionProvider, CollectionProviderItemDraft } from './collectionProviders.js';

const NAVER_BLOG_SEARCH_ENDPOINT = 'https://openapi.naver.com/v1/search/blog.json';
const NAVER_LOCAL_SEARCH_ENDPOINT = 'https://openapi.naver.com/v1/search/local.json';

const BlogSearchItemSchema = z
  .object({
    title: z.string().optional().default(''),
    link: z.string().optional().default(''),
    description: z.string().optional().default(''),
    bloggername: z.string().optional().default(''),
    bloggerlink: z.string().optional().default(''),
    postdate: z.string().optional().default('')
  })
  .passthrough();

const BlogSearchResponseSchema = z
  .object({
    total: z.number().optional().default(0),
    start: z.number().optional().default(1),
    display: z.number().optional().default(0),
    items: z.array(BlogSearchItemSchema).optional().default([])
  })
  .passthrough();

const LocalSearchItemSchema = z
  .object({
    title: z.string().optional().default(''),
    link: z.string().optional().default(''),
    category: z.string().optional().default(''),
    description: z.string().optional().default(''),
    telephone: z.string().optional().default(''),
    address: z.string().optional().default(''),
    roadAddress: z.string().optional().default(''),
    mapx: z.union([z.string(), z.number()]).optional(),
    mapy: z.union([z.string(), z.number()]).optional()
  })
  .passthrough();

const LocalSearchResponseSchema = z
  .object({
    total: z.number().optional().default(0),
    start: z.number().optional().default(1),
    display: z.number().optional().default(0),
    items: z.array(LocalSearchItemSchema).optional().default([])
  })
  .passthrough();

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanText(value: unknown) {
  if (value === null || value === undefined) return null;
  const cleaned = decodeHtmlEntities(String(value))
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
}

function searchHeaders(env: ProviderEnv) {
  return {
    'X-Naver-Client-Id': env.NAVER_CLIENT_ID ?? '',
    'X-Naver-Client-Secret': env.NAVER_CLIENT_SECRET ?? ''
  };
}

function storeKeyword(store: Store) {
  const category = cleanText(store.category)?.split(/[>／/]/).at(-1);
  return [cleanText(store.name), category].filter(Boolean).join(' ');
}

function blogQuery(store: Store) {
  return `${storeKeyword(store)} 후기`.trim();
}

function localQuery(store: Store) {
  return storeKeyword(store);
}

async function fetchJson(url: URL, env: ProviderEnv) {
  const response = await fetch(url, { headers: searchHeaders(env) });
  if (!response.ok) {
    throw new Error(`Naver Search API failed with HTTP ${response.status}`);
  }
  return response.json();
}

function mapCoordinate(value: string | number | undefined) {
  if (value === undefined) return null;
  return String(value).trim() || null;
}

async function collectBlogItems(env: ProviderEnv, plan: CollectionPlan, store: Store) {
  if (plan.blogPostLimit <= 0) return [];

  const display = Math.min(Math.max(plan.blogPostLimit, 1), 100);
  const requestUrl = new URL(env.NAVER_BLOG_SEARCH_ENDPOINT ?? NAVER_BLOG_SEARCH_ENDPOINT);
  requestUrl.searchParams.set('query', blogQuery(store));
  requestUrl.searchParams.set('display', String(display));
  requestUrl.searchParams.set('start', '1');
  requestUrl.searchParams.set('sort', 'date');

  const payload = BlogSearchResponseSchema.parse(await fetchJson(requestUrl, env));
  return payload.items.slice(0, plan.blogPostLimit).map((item, index): CollectionProviderItemDraft => {
    const title = cleanText(item.title);
    const description = cleanText(item.description);
    return {
      channel: 'blog',
      sourceType: 'post',
      sourceUrl: cleanText(item.link),
      title: title ?? `네이버 블로그 검색 결과 ${index + 1}`,
      bodyText: description,
      metadata: {
        provider: 'naverSearchCollectionProvider',
        providerMode: 'real',
        officialApi: 'naver_blog_search',
        bodyAvailability: 'official_blog_search_snippet_only',
        query: blogQuery(store),
        ordinal: index + 1,
        bloggerName: cleanText(item.bloggername),
        bloggerLink: cleanText(item.bloggerlink),
        postdate: cleanText(item.postdate),
        total: payload.total
      }
    };
  });
}

async function collectPlaceProfileItem(env: ProviderEnv, plan: CollectionPlan, store: Store) {
  if (!plan.includePlaceProfile) return [];

  const requestUrl = new URL(env.NAVER_LOCAL_SEARCH_ENDPOINT ?? NAVER_LOCAL_SEARCH_ENDPOINT);
  requestUrl.searchParams.set('query', localQuery(store));
  requestUrl.searchParams.set('display', '1');
  requestUrl.searchParams.set('start', '1');
  requestUrl.searchParams.set('sort', 'random');

  const payload = LocalSearchResponseSchema.parse(await fetchJson(requestUrl, env));
  const item = payload.items[0];
  if (!item) return [];

  const title = cleanText(item.title) ?? store.name;
  const description = cleanText(item.description);
  const roadAddress = cleanText(item.roadAddress);
  const address = cleanText(item.address);
  const bodyText = [description, roadAddress ?? address].filter(Boolean).join('\n') || null;

  return [
    {
      channel: 'place',
      sourceType: 'profile',
      sourceUrl: cleanText(item.link) ?? store.naverPlaceUrl,
      title,
      bodyText,
      metadata: {
        provider: 'naverSearchCollectionProvider',
        providerMode: 'real',
        officialApi: 'naver_local_search',
        bodyAvailability: 'official_local_search_metadata_only',
        query: localQuery(store),
        category: cleanText(item.category),
        telephone: cleanText(item.telephone),
        address,
        roadAddress,
        mapx: mapCoordinate(item.mapx),
        mapy: mapCoordinate(item.mapy),
        total: payload.total
      }
    }
  ];
}

function collectPlaceReviewFallbackItems(plan: CollectionPlan, store: Store) {
  const items: CollectionProviderItemDraft[] = [];
  for (let index = 1; index <= plan.placeReviewLimit; index += 1) {
    items.push({
      channel: 'place',
      sourceType: 'review',
      status: 'failed',
      sourceUrl: store.naverPlaceUrl,
      title: `플레이스 리뷰 ${index} 수집 보류`,
      bodyText: null,
      metadata: {
        provider: 'naverSearchCollectionProvider',
        providerMode: 'real',
        reviewAvailability: 'requires_fallback_provider',
        reason: 'official_naver_local_search_does_not_return_place_reviews',
        ordinal: index
      }
    });
  }
  return items;
}

export function createNaverSearchCollectionProvider(): CollectionProvider {
  return {
    name: 'naverSearchCollectionProvider',
    mode: 'real',
    async collect({ env, plan, store }) {
      const [blogItems, profileItems] = await Promise.all([
        collectBlogItems(env, plan, store),
        collectPlaceProfileItem(env, plan, store)
      ]);
      return [...blogItems, ...profileItems, ...collectPlaceReviewFallbackItems(plan, store)];
    }
  };
}
