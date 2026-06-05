import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { JsonRecord, ParsedNaverPlaceUrl, PlaceImportResult, ProviderEnv } from './placeImportTypes.js';
import { parseNaverPlaceUrl } from './naverPlaceUrlParser.js';

const NAVER_LOCAL_SEARCH_ENDPOINT = 'https://openapi.naver.com/v1/search/local.json';

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

export function canUseNaverLocalSearchProvider(env: ProviderEnv) {
  return Boolean(env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET);
}

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

function sanitizeStoreId(seed: string) {
  const sanitized = seed
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-z_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return sanitized || createHash('sha1').update(seed).digest('hex').slice(0, 10);
}

function pathSearchQuery(parsed: ParsedNaverPlaceUrl) {
  const segments = parsed.path
    .split('/')
    .map((segment) => decodeURIComponent(segment).trim())
    .filter(Boolean);
  const searchIndex = segments.findIndex((segment) => segment === 'search');
  const candidate = searchIndex >= 0 ? segments[searchIndex + 1] : null;
  if (!candidate || candidate === 'place') return null;
  return candidate;
}

function queryParamSearchQuery(parsed: ParsedNaverPlaceUrl) {
  const query = typeof parsed.metadata.query === 'string' ? parsed.metadata.query : '';
  const params = new URLSearchParams(query);
  return (
    cleanText(params.get('query')) ??
    cleanText(params.get('q')) ??
    cleanText(params.get('keyword')) ??
    cleanText(params.get('name')) ??
    cleanText(params.get('placeName'))
  );
}

function nonNumericCandidateQuery(parsed: ParsedNaverPlaceUrl) {
  if (!parsed.candidateId || /^\d+$/.test(parsed.candidateId)) return null;
  if (/^[A-Za-z0-9_-]+$/.test(parsed.candidateId)) return null;
  return cleanText(parsed.candidateId.replace(/[-_]+/g, ' '));
}

function localSearchQuery(parsed: ParsedNaverPlaceUrl) {
  return queryParamSearchQuery(parsed) ?? pathSearchQuery(parsed) ?? nonNumericCandidateQuery(parsed);
}

function itemPlaceId(link: string | null) {
  if (!link) return null;
  return parseNaverPlaceUrl(link)?.candidateId ?? null;
}

function mapCoordinate(value: string | number | undefined) {
  if (value === undefined) return null;
  return String(value).trim() || null;
}

export async function importWithNaverLocalSearchProvider(
  parsed: ParsedNaverPlaceUrl,
  env: ProviderEnv
): Promise<PlaceImportResult | null> {
  if (!canUseNaverLocalSearchProvider(env)) return null;

  const query = localSearchQuery(parsed);
  if (!query) return null;

  const endpoint = env.NAVER_LOCAL_SEARCH_ENDPOINT ?? NAVER_LOCAL_SEARCH_ENDPOINT;
  const requestUrl = new URL(endpoint);
  requestUrl.searchParams.set('query', query);
  requestUrl.searchParams.set('display', '1');
  requestUrl.searchParams.set('start', '1');
  requestUrl.searchParams.set('sort', 'random');

  const response = await fetch(requestUrl, {
    headers: {
      'X-Naver-Client-Id': env.NAVER_CLIENT_ID ?? '',
      'X-Naver-Client-Secret': env.NAVER_CLIENT_SECRET ?? ''
    }
  });

  if (!response.ok) {
    throw new Error(`Naver Local Search failed with HTTP ${response.status}`);
  }

  const payload = LocalSearchResponseSchema.parse(await response.json());
  const item = payload.items[0];
  if (!item) return null;

  const name = cleanText(item.title);
  if (!name) return null;

  const naverPlaceId = parsed.candidateId ?? itemPlaceId(cleanText(item.link));
  const metadata: JsonRecord = {
    provider: 'naverLocalSearchProvider',
    importMode: 'real',
    query,
    bodyAvailability: 'official_local_search_metadata_only',
    parsedUrl: parsed.metadata,
    officialApi: {
      name: 'Naver Search API - Local',
      endpoint: NAVER_LOCAL_SEARCH_ENDPOINT,
      responseFields: ['title', 'link', 'category', 'description', 'telephone', 'address', 'roadAddress', 'mapx', 'mapy']
    },
    limitations: ['place_reviews_not_available_from_official_local_search', 'full_place_body_requires_fallback_provider'],
    localSearch: {
      total: payload.total,
      start: payload.start,
      display: payload.display,
      itemLink: cleanText(item.link),
      mapx: mapCoordinate(item.mapx),
      mapy: mapCoordinate(item.mapy)
    }
  };

  return {
    provider: {
      name: 'naverLocalSearchProvider',
      mode: 'real'
    },
    store: {
      id: `store_${sanitizeStoreId(naverPlaceId ?? name)}`,
      name,
      naverPlaceUrl: parsed.normalizedUrl,
      naverPlaceId,
      category: cleanText(item.category),
      address: cleanText(item.roadAddress) ?? cleanText(item.address),
      phone: cleanText(item.telephone),
      description: cleanText(item.description),
      metadata
    }
  };
}
