import { createHash } from 'node:crypto';
import type { JsonRecord, ParsedNaverPlaceUrl, PlaceImportResult, ProviderEnv } from './placeImportTypes.js';
import { configuredPlaceProvider, sourceMetadata } from './ownerSourcePolicy.js';

export type RenderedPlaceSnapshot = {
  finalUrl: string;
  html: string;
  bodyText: string | null;
};

export type RenderedPlaceProfile = {
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  description: string | null;
  directions: string | null;
  businessHours: string[];
  homepage: string | null;
  convenience: string | null;
  rating: number | null;
  visitorReviewCount: number | null;
  blogReviewCount: number | null;
  imageUrls: string[];
};

export type NaverPlaceRenderer = (url: string, env: ProviderEnv) => Promise<RenderedPlaceSnapshot>;

function isRestrictedSnapshot(snapshot: RenderedPlaceSnapshot) {
  const text = `${snapshot.bodyText ?? ''}\n${snapshot.html}`;
  return (
    text.includes('서비스 이용이 제한되었습니다') ||
    text.includes('과도한 접근 요청으로 서비스 이용이 제한되었습니다') ||
    text.includes('잠시 후 다시 시도해주세요')
  );
}

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

function stripTagsToLines(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(?:br|\/p|\/div|\/section|\/h[1-6]|\/li|\/nav|\/main)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );
}

function textLines(html: string, bodyText: string | null) {
  return (bodyText ?? stripTagsToLines(html))
    .split(/\n+/)
    .map((line) => cleanText(line))
    .filter((line): line is string => Boolean(line));
}

function attribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'));
  return cleanText(match?.[1]);
}

function metaMap(html: string) {
  const values = new Map<string, string>();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const key = attribute(tag, 'property') ?? attribute(tag, 'name');
    const content = attribute(tag, 'content');
    if (key && content) values.set(key, content);
  }
  return values;
}

function imageUrlsFrom(html: string, metas: Map<string, string>) {
  const urls = new Set<string>();
  const ogImage = metas.get('og:image') ?? metas.get('twitter:image');
  if (ogImage) urls.add(ogImage);
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const src = attribute(match[0], 'src');
    if (src && /^https?:\/\//i.test(src)) urls.add(src);
  }
  return Array.from(urls);
}

function nameFrom(metas: Map<string, string>, lines: string[]) {
  const ogTitle = cleanText(metas.get('og:title'))?.replace(/\s*:\s*네이버.*$/i, '').trim();
  if (ogTitle) return ogTitle;
  return lines.find((line) => line && !line.includes('리뷰') && !line.includes('네이버')) ?? null;
}

function categoryFrom(lines: string[], name: string) {
  const categoryLine = lines.find((line) => line.startsWith(name) && line.length > name.length && !line.includes('리뷰'));
  return cleanText(categoryLine?.slice(name.length));
}

function numberValue(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function reviewStatsFrom(text: string) {
  const match = text.match(/별점\s*([\d.]+)?[\s\S]*?방문자\s*리뷰\s*([\d,]+)[\s\S]*?블로그\s*리뷰\s*([\d,]+)/);
  const fallback = text.match(/방문자\s*리뷰\s*([\d,]+)[\s\S]*?블로그\s*리뷰\s*([\d,]+)/);
  return {
    rating: match?.[1] ? Number(match[1]) : null,
    visitorReviewCount: numberValue(match?.[2] ?? fallback?.[1]),
    blogReviewCount: numberValue(match?.[3] ?? fallback?.[2])
  };
}

function lineAfter(lines: string[], label: string, predicate: (line: string) => boolean = () => true) {
  const index = lines.findIndex((line) => line === label || line.startsWith(`${label} `));
  if (index < 0) return null;
  return lines.slice(index + 1).find((line) => predicate(line)) ?? null;
}

function stripAddressControls(value: string | null) {
  return cleanText(value?.replace(/지도내비게이션거리뷰.*$/g, '').replace(/지도.*$/g, ''));
}

function collectSection(lines: string[], startLabel: string, stopLabels: string[], maxLines = 4) {
  const start = lines.findIndex((line) => line === startLabel || line.startsWith(`${startLabel} `));
  if (start < 0) return [];
  const values: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (stopLabels.some((label) => line === label || line.startsWith(`${label} `))) break;
    if (line === '내용 더보기' || line === '펼쳐보기' || line === '안내' || line === '복사') continue;
    values.push(line);
    if (values.length >= maxLines) break;
  }
  return values;
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

export function extractRenderedPlaceProfile(input: {
  html: string;
  bodyText: string | null;
  finalUrl: string;
  naverPlaceId: string | null;
}): RenderedPlaceProfile {
  const metas = metaMap(input.html);
  const lines = textLines(input.html, input.bodyText);
  const joined = lines.join('\n');
  const name = nameFrom(metas, lines);
  if (!name) {
    throw new Error('Rendered Naver Place profile did not include a store name.');
  }

  const directionsLines = collectSection(lines, '찾아가는길', ['영업시간', '전화번호', '홈페이지', '편의']);
  const hours = collectSection(lines, '영업시간', ['전화번호', '홈페이지', 'TV방송정보', '편의']);
  const stats = reviewStatsFrom(joined);

  return {
    name,
    category: categoryFrom(lines, name),
    address: stripAddressControls(lineAfter(lines, '주소')),
    phone: lineAfter(lines, '전화번호', (line) => /\d{2,4}-\d{3,4}-\d{4}/.test(line)),
    description: directionsLines.join(' ') || null,
    directions: directionsLines.join(' ') || null,
    businessHours: hours,
    homepage: lineAfter(lines, '홈페이지', (line) => /^https?:\/\//i.test(line)),
    convenience: lineAfter(lines, '편의', (line) => !['정보', '더보기'].includes(line)),
    rating: stats.rating,
    visitorReviewCount: stats.visitorReviewCount,
    blogReviewCount: stats.blogReviewCount,
    imageUrls: imageUrlsFrom(input.html, metas)
  };
}

async function renderWithEndpoint(url: string, env: ProviderEnv): Promise<RenderedPlaceSnapshot | null> {
  if (!env.NAVER_PLACE_RENDERER_ENDPOINT) return null;
  const endpoint = new URL(env.NAVER_PLACE_RENDERER_ENDPOINT);
  endpoint.searchParams.set('url', url);
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Naver Place renderer endpoint failed with HTTP ${response.status}`);
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const payload = (await response.json()) as Partial<RenderedPlaceSnapshot>;
    return {
      finalUrl: payload.finalUrl ?? url,
      html: payload.html ?? '',
      bodyText: payload.bodyText ?? null
    };
  }
  return {
    finalUrl: response.url || url,
    html: await response.text(),
    bodyText: null
  };
}

function timeoutMs(env: ProviderEnv) {
  const parsed = Number(env.NAVER_PLACE_RENDERER_TIMEOUT_MS ?? '15000');
  return Number.isFinite(parsed) ? Math.max(1000, parsed) : 15000;
}

async function renderWithPlaywright(url: string, env: ProviderEnv): Promise<RenderedPlaceSnapshot> {
  const { chromium } = await import('playwright');
  const launchOptions: Parameters<typeof chromium.launch>[0] = {
    headless: env.NAVER_PLACE_RENDERER_HEADLESS !== 'false',
    args: ['--no-sandbox']
  };

  if (env.NAVER_PLACE_RENDERER_CHROME_PATH) {
    launchOptions.executablePath = env.NAVER_PLACE_RENDERER_CHROME_PATH;
  } else if (env.NAVER_PLACE_RENDERER_CHANNEL !== 'bundled') {
    launchOptions.channel = env.NAVER_PLACE_RENDERER_CHANNEL ?? 'chrome';
  }

  const browser = await chromium.launch(launchOptions);
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 1000 },
      userAgent:
        env.NAVER_PLACE_RENDERER_USER_AGENT ??
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs(env) });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(Number(env.NAVER_PLACE_RENDERER_SETTLE_MS ?? '1200'));
    return {
      finalUrl: page.url(),
      html: await page.content(),
      bodyText: await page.locator('body').innerText({ timeout: 2000 }).catch(() => null)
    };
  } finally {
    await browser.close();
  }
}

export async function renderNaverPlacePage(url: string, env: ProviderEnv): Promise<RenderedPlaceSnapshot> {
  const endpointSnapshot = await renderWithEndpoint(url, env);
  if (endpointSnapshot) return endpointSnapshot;
  return renderWithPlaywright(url, env);
}

export async function importWithNaverPlaceRenderedProvider(
  parsed: ParsedNaverPlaceUrl,
  env: ProviderEnv,
  renderer: NaverPlaceRenderer = renderNaverPlacePage
): Promise<PlaceImportResult | null> {
  const snapshot = await renderer(parsed.normalizedUrl, env);
  if (!snapshot.html && !snapshot.bodyText) return null;
  if (isRestrictedSnapshot(snapshot)) {
    throw new Error('Naver Place rendered request was restricted by Naver.');
  }

  const profile = extractRenderedPlaceProfile({
    html: snapshot.html,
    bodyText: snapshot.bodyText,
    finalUrl: snapshot.finalUrl,
    naverPlaceId: parsed.candidateId
  });
  const naverPlaceId = parsed.candidateId;
  const metadata: JsonRecord = {
    provider: 'naverPlaceRenderedProvider',
    importMode: 'real',
    bodyAvailability: 'rendered_place_profile',
    finalUrl: snapshot.finalUrl,
    parsedUrl: parsed.metadata,
    homepage: profile.homepage,
    directions: profile.directions,
    businessHours: profile.businessHours,
    convenience: profile.convenience,
    rating: profile.rating,
    visitorReviewCount: profile.visitorReviewCount,
    blogReviewCount: profile.blogReviewCount,
    imageUrls: profile.imageUrls,
    ...sourceMetadata('place_profile', env),
    configuredPlaceProvider: configuredPlaceProvider(env)
  };

  return {
    provider: {
      name: 'naverPlaceRenderedProvider',
      mode: 'real'
    },
    store: {
      id: `store_${sanitizeStoreId(naverPlaceId ?? profile.name)}`,
      name: profile.name,
      naverPlaceUrl: parsed.normalizedUrl,
      naverPlaceId,
      category: profile.category,
      address: profile.address,
      phone: profile.phone,
      description: profile.description,
      metadata
    }
  };
}
