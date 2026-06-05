import { createHash } from 'node:crypto';
import type { JsonRecord, ParsedNaverPlaceUrl, PlaceImportResult } from './placeImportTypes.js';

const NAVER_PLACE_HOSTS = new Set([
  'naver.me',
  'place.naver.com',
  'm.place.naver.com',
  'map.naver.com',
  'm.map.naver.com'
]);

function withProtocol(input: string) {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function safeSegment(value: string | null) {
  if (!value) return null;
  const decoded = decodeURIComponent(value).trim();
  if (!decoded || decoded === 'place' || decoded === 'restaurant') return null;
  return decoded.replace(/[^0-9A-Za-z_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || null;
}

function candidateFromUrl(url: URL) {
  const searchCandidate =
    url.searchParams.get('placeId') ??
    url.searchParams.get('place_id') ??
    url.searchParams.get('entry') ??
    url.searchParams.get('id');
  if (safeSegment(searchCandidate)) return safeSegment(searchCandidate);

  const segments = url.pathname.split('/').map(safeSegment).filter((segment): segment is string => Boolean(segment));
  const numericPlaceId = segments.find((segment) => /^\d{5,}$/.test(segment));
  if (numericPlaceId) return numericPlaceId;

  const genericSegments = new Set(['entry', 'home', 'map', 'menu', 'p', 'photo', 'review', 'search']);
  const meaningfulSegments = segments.filter((segment) => !genericSegments.has(segment));
  return meaningfulSegments.at(-1) ?? null;
}

export function parseNaverPlaceUrl(input: string): ParsedNaverPlaceUrl | null {
  if (!input.trim()) return null;

  let url: URL;
  try {
    url = new URL(withProtocol(input));
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!NAVER_PLACE_HOSTS.has(host)) return null;

  const normalizedUrl = url.toString();
  const candidateId = candidateFromUrl(url);
  return {
    originalUrl: input,
    normalizedUrl,
    host,
    path: url.pathname,
    candidateId,
    metadata: {
      host,
      path: url.pathname,
      query: url.searchParams.toString()
    }
  };
}

function fallbackStoreId(parsed: ParsedNaverPlaceUrl) {
  const seed = parsed.candidateId ?? createHash('sha1').update(parsed.normalizedUrl).digest('hex').slice(0, 10);
  return `store_${seed}`;
}

export function importWithNaverPlaceUrlParser(parsed: ParsedNaverPlaceUrl): PlaceImportResult {
  const metadata: JsonRecord = {
    provider: 'naverPlaceUrlParser',
    importMode: 'parser',
    parsedUrl: parsed.metadata
  };

  return {
    provider: {
      name: 'naverPlaceUrlParser',
      mode: 'parser'
    },
    store: {
      id: fallbackStoreId(parsed),
      name: parsed.candidateId ? `네이버 플레이스 ${parsed.candidateId}` : '네이버 플레이스 매장',
      naverPlaceUrl: parsed.normalizedUrl,
      naverPlaceId: parsed.candidateId,
      category: null,
      address: null,
      phone: null,
      description: null,
      metadata
    }
  };
}
