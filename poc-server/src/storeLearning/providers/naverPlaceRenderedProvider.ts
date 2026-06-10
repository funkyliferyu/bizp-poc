import { createHash } from 'node:crypto';
import type { Page } from 'playwright';
import type { JsonValue } from '../../repositories/base.js';
import type { JsonRecord, ParsedNaverPlaceUrl, PlaceImportResult, ProviderEnv } from './placeImportTypes.js';
import { configuredPlaceProvider, sourceMetadata } from './ownerSourcePolicy.js';
import { extractExternalChannelLinks, type StoreExternalChannel } from './placeExternalChannels.js';

export type RenderedPlaceSnapshot = {
  finalUrl: string;
  html: string;
  bodyText: string | null;
};

export type RenderedHospitalInfo = {
  sourceName: string;
  sourceUrl: string | null;
  subjects: string[];
  specialistSubjects: Array<{ name: string; count: number | null }>;
  specialEquipments: Array<{ name: string; count: number | null }>;
  specialOperations: Array<{ name: string; count: number | null }>;
  specialSubjects: Array<{ name: string; count: number | null }>;
};

export type RenderedWeeklyBusinessHour = {
  day: string;
  dayLabel: string;
  closed: boolean;
  openTime: string | null;
  closeTime: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  description: string | null;
};

export type RenderedPlaceProfile = {
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  description: string | null;
  placeIntro: string | null;
  aiSummary: string | null;
  descriptionSource: string | null;
  openTime: string | null;
  closeTime: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  closedDays: string[];
  weeklyBusinessHours: RenderedWeeklyBusinessHour[];
  parking: 'y' | 'n' | 'near' | null;
  parkingNote: string | null;
  homepageUrl: string | null;
  homepageType: string | null;
  facilities: string[];
  paymentInfo: string[];
  menuItems: Array<{ name: string; price: string | null; description: string | null }>;
  menuImageUrls: string[];
  reviewStats: {
    rating: number | null;
    visitorReviewCount: number | null;
    blogReviewCount: number | null;
    visitorTextReviewCount: number | null;
  };
  broadcastInfos: Array<{ channel: string | null; program: string | null; date: string | null; menu: string | null }>;
  keywords: string[];
  bookingUrl: string | null;
  externalLinks: Array<{ type: string | null; url: string }>;
  externalChannelLinks: StoreExternalChannel[];
  routeUrl: string | null;
  coordinates: { x: string | null; y: string | null; mapZoomLevel: number | null } | null;
  transitInfo: string[];
  hospitalInfo: RenderedHospitalInfo | null;
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

export type NaverPlaceRenderLayer = {
  name: string;
  render: NaverPlaceRenderer;
};

const NAVER_MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function isRestrictedSnapshot(snapshot: RenderedPlaceSnapshot) {
  const text = snapshot.bodyText ?? stripTagsToLines(snapshot.html);
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
  return normalizePlaceImageUrls(Array.from(urls));
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

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function extractJsonAssignment(html: string, marker: string) {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;

  const start = html.indexOf('{', markerIndex + marker.length);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = inString;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return html.slice(start, index + 1);
    }
  }

  return null;
}

export function extractNaverApolloState(html: string) {
  const jsonText = extractJsonAssignment(html, 'window.__APOLLO_STATE__');
  if (!jsonText) return null;
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    return asRecord(parsed);
  } catch {
    return null;
  }
}

function apolloRefKey(value: unknown) {
  return asString(asRecord(value)?.__ref);
}

export function resolveNaverApolloRef(state: Record<string, unknown>, value: unknown) {
  const key = apolloRefKey(value);
  return key ? asRecord(state[key]) : asRecord(value);
}

function placeBaseFromApolloState(state: Record<string, unknown>, naverPlaceId: string | null) {
  if (naverPlaceId) {
    const exact = asRecord(state[`PlaceDetailBase:${naverPlaceId}`]);
    if (exact) return exact;
  }
  return Object.values(state).map(asRecord).find((record) => record?.__typename === 'PlaceDetailBase') ?? null;
}

function placeDetailFromApolloState(state: Record<string, unknown>, naverPlaceId: string | null) {
  const rootQuery = asRecord(state.ROOT_QUERY);
  const records = Object.values(rootQuery ?? {}).map(asRecord);
  const expectedBaseRef = naverPlaceId ? `PlaceDetailBase:${naverPlaceId}` : null;
  return (
    records.find((record) => {
      if (record?.__typename !== 'PlaceDetail') return false;
      return !expectedBaseRef || apolloRefKey(record.base) === expectedBaseRef;
    }) ??
    records.find((record) => record?.__typename === 'PlaceDetail') ??
    null
  );
}

function firstCleanStringFromMatchingKey(record: Record<string, unknown> | null, predicate: (key: string) => boolean) {
  if (!record) return null;
  for (const [key, value] of Object.entries(record)) {
    if (!predicate(key)) continue;
    const text = cleanText(value);
    if (text) return text;
  }
  return null;
}

function placeIntroFromApolloState(state: Record<string, unknown>, naverPlaceId: string | null) {
  const detail = placeDetailFromApolloState(state, naverPlaceId);
  return (
    firstCleanStringFromMatchingKey(detail, (key) => key === 'description' || key.startsWith('description(')) ??
    cleanText(asRecord(detail?.shopWindow)?.description)
  );
}

function firstValueFromMatchingKey(record: Record<string, unknown> | null, predicate: (key: string) => boolean) {
  if (!record) return null;
  for (const [key, value] of Object.entries(record)) {
    if (predicate(key)) return value;
  }
  return null;
}

function detailValue(record: Record<string, unknown> | null, keyName: string) {
  return firstValueFromMatchingKey(record, (key) => key === keyName || key.startsWith(`${keyName}(`));
}

function dayValue(koreanDay: string) {
  return (
    {
      월: 'mon',
      화: 'tue',
      수: 'wed',
      목: 'thu',
      금: 'fri',
      토: 'sat',
      일: 'sun',
      공휴일: 'hol'
    } as const
  )[koreanDay as '월' | '화' | '수' | '목' | '금' | '토' | '일' | '공휴일'] ?? null;
}

function daysFromText(value: unknown) {
  const text = cleanText(value);
  if (!text) return [];
  return Array.from(new Set(Array.from(text.matchAll(/공휴일|[월화수목금토일]/g)).map((match) => dayValue(match[0])).filter(Boolean))) as string[];
}

function firstTimeRange(value: unknown) {
  if (typeof value === 'string') {
    const match = value.match(/(\d{1,2}:\d{2})\s*(?:~|-|부터|부터\s*)\s*(\d{1,2}:\d{2})/);
    return match ? { start: match[1], end: match[2] } : null;
  }
  const record = asRecord(value);
  if (!record) return null;
  const start = cleanText(record.start ?? record.from ?? record.startTime ?? record.openTime ?? record.begin);
  const end = cleanText(record.end ?? record.to ?? record.endTime ?? record.closeTime ?? record.finish);
  return start && end ? { start, end } : null;
}

function firstArrayItem(value: unknown) {
  return Array.isArray(value) ? value[0] : null;
}

function firstNewBusinessHour(detail: Record<string, unknown> | null) {
  return asRecord(firstArrayItem(detailValue(detail, 'newBusinessHours')));
}

function businessHourRows(group: Record<string, unknown> | null) {
  return Array.isArray(group?.businessHours)
    ? group.businessHours.map(asRecord).filter((row): row is Record<string, unknown> => Boolean(row))
    : [];
}

function timeRangeLabel(value: unknown) {
  const range = firstTimeRange(value);
  return range ? `${range.start} - ${range.end}` : null;
}

function breakHourLabels(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(timeRangeLabel).filter((label): label is string => Boolean(label));
}

function businessHourLinesFromDetail(detail: Record<string, unknown> | null) {
  const group = firstNewBusinessHour(detail);
  return businessHourRows(group)
    .map((row) => {
      const day = cleanText(row.day);
      const range = timeRangeLabel(row.businessHours);
      const description = cleanText(row.description);
      const breaks = breakHourLabels(row.breakHours);
      if (day && range) {
        const suffix = breaks.length > 0 ? ` / 브레이크타임 ${breaks.join(', ')}` : '';
        return `${day} ${range}${suffix}`;
      }
      if (day && description) return `${day} ${description}`;
      return null;
    })
    .filter((line): line is string => Boolean(line));
}

function weeklyBusinessHoursFromDetail(detail: Record<string, unknown> | null): RenderedWeeklyBusinessHour[] {
  const group = firstNewBusinessHour(detail);
  return businessHourRows(group)
    .flatMap((row): RenderedWeeklyBusinessHour[] => {
      const dayLabel = cleanText(row.day);
      if (!dayLabel) return [];

      const day = dayLabel ? dayValue(dayLabel) : null;
      if (!day || day === 'hol') return [];

      const businessRange = firstTimeRange(row.businessHours);
      const breakRange = firstTimeRange(firstArrayItem(row.breakHours));
      const description = cleanText(row.description);
      const closed = !businessRange && Boolean(description && /휴무|휴진|휴업/.test(description));
      if (!businessRange && !breakRange && !closed && !description) return [];

      return [{
        day,
        dayLabel,
        closed,
        openTime: businessRange?.start ?? null,
        closeTime: businessRange?.end ?? null,
        breakStart: breakRange?.start ?? null,
        breakEnd: breakRange?.end ?? null,
        description: description || null
      }];
    });
}

function closedDaysFromBusinessHourRows(rows: Array<Record<string, unknown> | null>) {
  const values: string[] = [];
  for (const row of rows) {
    if (!row) continue;
    const description = cleanText(row.description);
    if (!description || !/휴무|휴진|휴업/.test(description)) continue;
    const day = cleanText(row.day);
    const value = day ? dayValue(day) : null;
    if (value) values.push(value);
  }
  return values;
}

function businessHourSummary(detail: Record<string, unknown> | null) {
  const group = firstNewBusinessHour(detail);
  const rows = businessHourRows(group);
  const firstWorkingHour = rows.find((row) => Boolean(firstTimeRange(row?.businessHours))) ?? null;
  const businessRange = firstTimeRange(firstWorkingHour?.businessHours);
  const breakRange = firstTimeRange(firstArrayItem(firstWorkingHour?.breakHours));
  const closedDays = [
    ...daysFromText(group?.comingRegularClosedDays),
    ...closedDaysFromBusinessHourRows(rows)
  ];
  return {
    openTime: businessRange?.start ?? null,
    closeTime: businessRange?.end ?? null,
    breakStart: breakRange?.start ?? null,
    breakEnd: breakRange?.end ?? null,
    closedDays: Array.from(new Set(closedDays))
  };
}

function parkingFromNote(note: string | null): 'y' | 'n' | 'near' | null {
  if (!note) return null;
  if (/불가|없음|없습니다/.test(note)) return 'n';
  if (/인근|유료|공영|주차장|AJ파크|파크타운/.test(note)) return 'near';
  if (/주차/.test(note)) return 'y';
  return null;
}

function informationTab(detail: Record<string, unknown> | null) {
  return asRecord(detailValue(detail, 'informationTab'));
}

function parkingInfoFromDetail(detail: Record<string, unknown> | null) {
  const info = informationTab(detail);
  const parkingInfo = asRecord(info?.parkingInfo);
  const note = cleanText(parkingInfo?.description);
  return {
    parking: parkingFromNote(note),
    parkingNote: note
  };
}

function homepageFromDetail(detail: Record<string, unknown> | null) {
  const repr = asRecord(asRecord(detail?.homepages)?.repr);
  return {
    homepageUrl: cleanText(repr?.url ?? repr?.landingUrl),
    homepageType: cleanText(repr?.type ?? repr?.typeI18n)
  };
}

function stringsFromRefs(state: Record<string, unknown> | null, values: unknown, fallback: string[]) {
  const names = [...fallback];
  if (!Array.isArray(values) || !state) return Array.from(new Set(names));
  for (const value of values) {
    const record = resolveNaverApolloRef(state, value);
    const name = cleanText(record?.name ?? record?.title ?? record?.text);
    if (name) names.push(name);
  }
  return Array.from(new Set(names));
}

function menuItemsFromDetail(state: Record<string, unknown> | null, detail: Record<string, unknown> | null) {
  const menus = detailValue(detail, 'menus');
  if (!Array.isArray(menus) || !state) return [];
  return menus
    .map((menu) => resolveNaverApolloRef(state, menu))
    .map((menu) => {
      const name = cleanText(menu?.name ?? menu?.menuName);
      if (!name) return null;
      return {
        name,
        price: cleanText(menu?.price ?? menu?.priceText),
        description: cleanText(menu?.description ?? menu?.desc)
      };
    })
    .filter((menu): menu is { name: string; price: string | null; description: string | null } => Boolean(menu));
}

function menuImageUrlsFromDetail(detail: Record<string, unknown> | null) {
  const images = detail?.menuImages;
  if (!Array.isArray(images)) return [];
  return normalizePlaceImageUrls(images.map((image) => cleanText(asRecord(image)?.imageUrl)));
}

function unwrapNaverImageUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.hostname === 'search.pstatic.net' && url.pathname.includes('/common/')) {
      const source = url.searchParams.get('src');
      if (source && /^https?:\/\//i.test(source)) return source.replace(/#\d+x\d+$/i, '');
    }
  } catch {
    return value;
  }
  return value.replace(/#\d+x\d+$/i, '');
}

function isUsablePlaceImageUrl(value: string | null) {
  if (!value || !/^https?:\/\//i.test(value)) return false;
  const lower = value.toLowerCase();
  if (
    lower.includes('icon_default_profile') ||
    lower.includes('/assets/shared/images/') ||
    lower.includes('blog.naver.com') ||
    lower.includes('cafe.naver.com') ||
    lower.includes('tvcast') ||
    lower.includes('/place/panorama/') ||
    lower.includes('instagram.com') ||
    lower.includes('booking.naver.com')
  ) {
    return false;
  }
  return (
    lower.includes('ldb-phinf.pstatic.net') ||
    lower.includes('search.pstatic.net/common') ||
    /\.(?:jpe?g|png|webp)(?:[?#].*)?$/i.test(lower)
  );
}

function normalizePlaceImageUrls(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const value of values) {
    const normalized = unwrapNaverImageUrl(cleanText(value));
    if (!isUsablePlaceImageUrl(normalized) || !normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
  }
  return urls;
}

function placeImageUrlsFromDetail(state: Record<string, unknown> | null, detail: Record<string, unknown> | null) {
  const imagesRecord = asRecord(detailValue(detail, 'images')) ?? asRecord(detail?.images);
  const images = asRecord(imagesRecord)?.images;
  if (!Array.isArray(images) || !state) return [];
  const candidates = images
    .map((image) => resolveNaverApolloRef(state, image))
    .flatMap((image) => [image?.origin, image?.url, image?.imageUrl, image?.thumbnail])
    .map((value) => cleanText(value));
  return normalizePlaceImageUrls(candidates);
}

function broadcastInfosFromDetail(detail: Record<string, unknown> | null) {
  const infos = detail?.broadcastInfos;
  if (!Array.isArray(infos)) return [];
  return infos
    .map(asRecord)
    .filter((record): record is Record<string, unknown> => Boolean(record))
    .map((record) => ({
      channel: cleanText(record.channel),
      program: cleanText(record.program),
      date: cleanText(record.date),
      menu: cleanText(record.menu)
    }));
}

function keywordsFromDetail(detail: Record<string, unknown> | null) {
  return Array.from(new Set([...asStringArray(informationTab(detail)?.keywordList), ...asStringArray(detail?.themes)]));
}

function bookingUrlFromDetail(detail: Record<string, unknown> | null) {
  return cleanText(asRecord(detailValue(detail, 'naverBooking'))?.naverBookingUrl);
}

function externalLinksFromDetail(detail: Record<string, unknown> | null) {
  if (!Array.isArray(detail?.relatedLinks)) return [];
  return detail.relatedLinks
    .map(asRecord)
    .filter((record): record is Record<string, unknown> => Boolean(record))
    .map((record) => {
      const url = cleanText(record.url ?? record.link ?? record.href);
      if (!url) return null;
      return {
        type: cleanText(record.name ?? record.type ?? record.iconName),
        url
      };
    })
    .filter((link): link is { type: string | null; url: string } => Boolean(link));
}

function coordinatesFromBase(base: Record<string, unknown> | null) {
  const coordinate = asRecord(base?.coordinate);
  const x = cleanText(coordinate?.x);
  const y = cleanText(coordinate?.y);
  if (!x && !y) return null;
  return {
    x,
    y,
    mapZoomLevel: asNumber(coordinate?.mapZoomLevel)
  };
}

function transitInfoFromDetail(state: Record<string, unknown> | null, detail: Record<string, unknown> | null) {
  if (!Array.isArray(detail?.subwayStations)) return [];
  const labels = detail.subwayStations
    .map(asRecord)
    .filter((record): record is Record<string, unknown> => Boolean(record))
    .map((record) => {
      const station = state ? resolveNaverApolloRef(state, record.station) : null;
      const stationName = cleanText(station?.name);
      const typeDesc = cleanText(record.typeDesc);
      const lineName = cleanText(record.no ?? record.name);
      if (typeDesc) return typeDesc;
      return [stationName ? `${stationName}역` : null, lineName].filter(Boolean).join(' ');
    })
    .filter((label): label is string => Boolean(label));
  return Array.from(new Set(labels));
}

function nameCountItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map(asRecord)
    .filter((record): record is Record<string, unknown> => Boolean(record))
    .map((record) => {
      const name = cleanText(record.name);
      if (!name) return null;
      return {
        name,
        count: asNumber(record.count)
      };
    })
    .filter((item): item is { name: string; count: number | null } => Boolean(item));
}

function hiraHospitalInfoUrl(extKey: string | null) {
  if (!extKey) return null;
  return `https://www.hira.or.kr/ra/hosp/hospInfoAjax.do?isNewWindow=Y&ykiho=${encodeURIComponent(extKey)}&isPopupYn=Y`;
}

function hospitalInfoFromDetail(detail: Record<string, unknown> | null): RenderedHospitalInfo | null {
  const info = asRecord(detail?.hospitalInfo);
  if (!info) return null;

  const sortedSubjects = nameCountItems(info.sortedSubjects ?? info.processedSubjects ?? info.subjects);
  const specialistSubjects = sortedSubjects.filter((item) => Number(item.count ?? 0) > 0);
  const specialEquipments = nameCountItems(info.specialEquipments);
  const specialOperations = nameCountItems(info.specialOperations);
  const specialSubjects = nameCountItems(info.specialSubjects);
  const subjects = Array.from(new Set(sortedSubjects.map((item) => item.name)));
  const hasAny =
    subjects.length > 0 ||
    specialistSubjects.length > 0 ||
    specialEquipments.length > 0 ||
    specialOperations.length > 0 ||
    specialSubjects.length > 0;
  if (!hasAny) return null;

  return {
    sourceName: '건강보험심사평가원',
    sourceUrl: hiraHospitalInfoUrl(cleanText(info.ext_key)),
    subjects,
    specialistSubjects,
    specialEquipments,
    specialOperations,
    specialSubjects
  };
}

function descriptionSourceFor(placeIntro: string | null, aiSummary: string | null, fallback: string | null) {
  if (placeIntro && aiSummary) return 'place_intro_with_ai_summary';
  if (placeIntro) return 'place_intro';
  if (aiSummary) return 'ai_summary';
  if (fallback) return 'fallback';
  return null;
}

function profileDescriptionFrom({
  placeIntro,
  aiSummary,
  fallback
}: {
  placeIntro: string | null;
  aiSummary: string | null;
  fallback: string | null;
}) {
  const parts = [placeIntro, aiSummary ? `(AI요약정보) ${aiSummary}` : null].filter((value): value is string =>
    Boolean(value)
  );
  if (parts.length > 0) return parts.join('\n\n');
  return fallback;
}

function imageUrlsFromApolloState(state: Record<string, unknown>) {
  const urls = new Set<string>();
  const collect = (value: unknown, depth = 0) => {
    if (depth > 4) return;
    if (Array.isArray(value)) {
      value.forEach((item) => collect(item, depth + 1));
      return;
    }
    const record = asRecord(value);
    if (!record) return;
    for (const key of ['origin', 'url', 'thumbnail', 'imageUrl']) {
      const url = asString(record[key]);
      if (url && /^https?:\/\//i.test(url)) urls.add(url);
    }
    for (const nested of Object.values(record)) collect(nested, depth + 1);
  };

  for (const value of Object.values(state)) collect(value);

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

function jsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as JsonValue;
}

function byteLength(value: string | null) {
  return value ? Buffer.byteLength(value, 'utf8') : 0;
}

function numericPlaceId(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d{5,}$/.test(trimmed) ? trimmed : null;
}

function placeIdFromNaverUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const searchId =
      numericPlaceId(url.searchParams.get('pinId')) ??
      numericPlaceId(url.searchParams.get('id')) ??
      numericPlaceId(url.searchParams.get('placeId')) ??
      numericPlaceId(url.searchParams.get('place_id'));
    if (searchId) return searchId;

    return (
      url.pathname
        .split('/')
        .map((segment) => numericPlaceId(segment))
        .find((segment): segment is string => Boolean(segment)) ?? null
    );
  } catch {
    return null;
  }
}

function isNaverMapAppLink(value: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return (host === 'map.naver.com' || host === 'm.map.naver.com') && url.pathname.includes('appLink.naver');
  } catch {
    return false;
  }
}

function mobilePlaceHomeUrl(naverPlaceId: string) {
  return `https://m.place.naver.com/place/${naverPlaceId}/home`;
}

async function renderResolvedPlaceSnapshot(
  parsed: ParsedNaverPlaceUrl,
  env: ProviderEnv,
  renderer: NaverPlaceRenderer
) {
  const initialSnapshot = await renderer(parsed.normalizedUrl, env);
  if (isRestrictedSnapshot(initialSnapshot)) {
    throw new Error('Naver Place rendered request was restricted by Naver.');
  }

  const resolvedPlaceId = placeIdFromNaverUrl(initialSnapshot.finalUrl);
  if (resolvedPlaceId && isNaverMapAppLink(initialSnapshot.finalUrl) && !extractNaverApolloState(initialSnapshot.html)) {
    const resolvedPlaceUrl = mobilePlaceHomeUrl(resolvedPlaceId);
    const resolvedSnapshot = await renderer(resolvedPlaceUrl, env);
    if (isRestrictedSnapshot(resolvedSnapshot)) {
      throw new Error('Naver Place rendered request was restricted by Naver.');
    }
    return {
      snapshot: resolvedSnapshot,
      naverPlaceId: resolvedPlaceId,
      naverPlaceUrl: resolvedPlaceUrl,
      initialFinalUrl: initialSnapshot.finalUrl,
      resolvedPlaceUrl
    };
  }

  return {
    snapshot: initialSnapshot,
    naverPlaceId: placeIdFromNaverUrl(initialSnapshot.finalUrl) ?? parsed.candidateId,
    naverPlaceUrl: parsed.normalizedUrl,
    initialFinalUrl: null,
    resolvedPlaceUrl: null
  };
}

export function extractRenderedPlaceProfile(input: {
  html: string;
  bodyText: string | null;
  finalUrl: string;
  naverPlaceId: string | null;
}): RenderedPlaceProfile {
  const apolloState = extractNaverApolloState(input.html);
  const apolloBase = apolloState ? placeBaseFromApolloState(apolloState, input.naverPlaceId) : null;
  const apolloDetail = apolloState ? placeDetailFromApolloState(apolloState, input.naverPlaceId) : null;
  const metas = metaMap(input.html);
  const lines = textLines(input.html, input.bodyText);
  const joined = lines.join('\n');
  const name = cleanText(apolloBase?.name) ?? nameFrom(metas, lines);
  if (!name) {
    throw new Error('Rendered Naver Place profile did not include a store name.');
  }

  const directionsLines = collectSection(lines, '찾아가는길', ['영업시간', '전화번호', '홈페이지', '편의']);
  const hours = collectSection(lines, '영업시간', ['전화번호', '홈페이지', 'TV방송정보', '편의']);
  const stats = reviewStatsFrom(joined);
  const directions = cleanText(apolloBase?.road) ?? (directionsLines.join(' ') || null);
  const convenience = asStringArray(apolloBase?.conveniences).join(', ') || lineAfter(lines, '편의', (line) => !['정보', '더보기'].includes(line));
  const placeImageUrls = placeImageUrlsFromDetail(apolloState, apolloDetail);
  const placeIntro = apolloState ? placeIntroFromApolloState(apolloState, input.naverPlaceId) : null;
  const aiSummary = cleanText(asStringArray(apolloBase?.microReviews).join(' '));
  const descriptionFallback = directions;
  const businessHourSummaryFromApollo = businessHourSummary(apolloDetail);
  const businessHourLinesFromApollo = businessHourLinesFromDetail(apolloDetail);
  const weeklyBusinessHoursFromApollo = weeklyBusinessHoursFromDetail(apolloDetail);
  const parkingInfo = parkingInfoFromDetail(apolloDetail);
  const homepageInfo = homepageFromDetail(apolloDetail);
  const facilities = stringsFromRefs(apolloState, informationTab(apolloDetail)?.facilities, asStringArray(apolloBase?.conveniences));
  const menuItems = menuItemsFromDetail(apolloState, apolloDetail);
  const externalLinks = externalLinksFromDetail(apolloDetail);
  const homepage = homepageInfo.homepageUrl ?? lineAfter(lines, '홈페이지', (line) => /^https?:\/\//i.test(line));
  const externalChannelLinks = extractExternalChannelLinks([
    homepageInfo.homepageUrl,
    homepage,
    apolloDetail?.homepages,
    externalLinks
  ]);
  const reviewStats = {
    rating: asNumber(apolloBase?.visitorReviewsScore) ?? stats.rating,
    visitorReviewCount: asNumber(apolloBase?.visitorReviewsTotal) ?? stats.visitorReviewCount,
    blogReviewCount: asNumber(apolloBase?.cafeBlogReviewsTotal) ?? stats.blogReviewCount,
    visitorTextReviewCount: asNumber(apolloBase?.visitorReviewsTextReviewTotal)
  };
  const description = profileDescriptionFrom({
    placeIntro,
    aiSummary,
    fallback: descriptionFallback
  });

  return {
    name,
    category: cleanText(apolloBase?.category) ?? categoryFrom(lines, name),
    address: cleanText(apolloBase?.roadAddress) ?? stripAddressControls(lineAfter(lines, '주소')),
    phone:
      cleanText(apolloBase?.virtualPhone) ??
      cleanText(apolloBase?.phone) ??
      lineAfter(lines, '전화번호', (line) => /\d{2,4}-\d{3,4}-\d{4}/.test(line)),
    description,
    placeIntro,
    aiSummary,
    descriptionSource: descriptionSourceFor(placeIntro, aiSummary, descriptionFallback),
    openTime: businessHourSummaryFromApollo.openTime,
    closeTime: businessHourSummaryFromApollo.closeTime,
    breakStart: businessHourSummaryFromApollo.breakStart,
    breakEnd: businessHourSummaryFromApollo.breakEnd,
    closedDays: businessHourSummaryFromApollo.closedDays,
    weeklyBusinessHours: weeklyBusinessHoursFromApollo,
    parking: parkingInfo.parking,
    parkingNote: parkingInfo.parkingNote,
    homepageUrl: homepageInfo.homepageUrl,
    homepageType: homepageInfo.homepageType,
    facilities,
    paymentInfo: asStringArray(apolloBase?.paymentInfo),
    menuItems,
    menuImageUrls: menuImageUrlsFromDetail(apolloDetail),
    reviewStats,
    broadcastInfos: broadcastInfosFromDetail(apolloDetail),
    keywords: keywordsFromDetail(apolloDetail),
    bookingUrl: bookingUrlFromDetail(apolloDetail),
    externalLinks,
    externalChannelLinks,
    routeUrl: cleanText(apolloBase?.routeUrl),
    coordinates: coordinatesFromBase(apolloBase),
    transitInfo: transitInfoFromDetail(apolloState, apolloDetail),
    hospitalInfo: hospitalInfoFromDetail(apolloDetail),
    directions,
    businessHours: businessHourLinesFromApollo.length > 0 ? businessHourLinesFromApollo : hours,
    homepage,
    convenience: cleanText(convenience),
    rating: reviewStats.rating,
    visitorReviewCount: reviewStats.visitorReviewCount,
    blogReviewCount: reviewStats.blogReviewCount,
    imageUrls: Array.from(new Set([...placeImageUrls, ...imageUrlsFrom(input.html, metas)]))
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

export function shouldUseInteractiveNaverReviewRendering(url: string) {
  try {
    return /\/review\/visitor(?:[/?#]|$)/.test(new URL(url).pathname + new URL(url).search + new URL(url).hash);
  } catch {
    return /\/review\/visitor(?:[/?#]|$)/.test(url);
  }
}

function reviewMoreAttempts(env: ProviderEnv) {
  const parsed = Number(env.NAVER_PLACE_REVIEW_MORE_ATTEMPTS ?? '10');
  return Number.isFinite(parsed) ? Math.max(0, Math.min(20, Math.floor(parsed))) : 10;
}

function reviewMoreDelayMs(env: ProviderEnv) {
  const parsed = Number(env.NAVER_PLACE_REVIEW_MORE_DELAY_MS ?? '700');
  return Number.isFinite(parsed) ? Math.max(100, Math.min(5000, Math.floor(parsed))) : 700;
}

export async function renderNaverHttpSnapshot(url: string, env: ProviderEnv): Promise<RenderedPlaceSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs(env));
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': env.NAVER_RENDERER_USER_AGENT ?? env.NAVER_PLACE_RENDERER_USER_AGENT ?? NAVER_MOBILE_USER_AGENT,
        'accept-language': env.NAVER_RENDERER_ACCEPT_LANGUAGE ?? 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    if (!response.ok) {
      throw new Error(`Naver HTTP snapshot request failed with HTTP ${response.status}`);
    }
    return {
      finalUrl: response.url || url,
      html: await response.text(),
      bodyText: null
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function clickReviewMoreButton(page: Page) {
  const selectors = [
    'button:has-text("펼쳐서 더보기")',
    'a:has-text("펼쳐서 더보기")',
    '[role="button"]:has-text("펼쳐서 더보기")',
    'button:has-text("더보기")',
    'a:has-text("더보기")',
    '[role="button"]:has-text("더보기")'
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = count - 1; index >= 0; index -= 1) {
      const candidate = locator.nth(index);
      const visible = await candidate.isVisible({ timeout: 300 }).catch(() => false);
      if (!visible) continue;
      await candidate.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => {});
      await candidate.click({ timeout: 1500 }).catch(() => null);
      return true;
    }
  }

  return false;
}

async function expandNaverPlaceReviews(page: Page, env: ProviderEnv) {
  const attempts = reviewMoreAttempts(env);
  const delayMs = reviewMoreDelayMs(env);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const beforeText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await page.waitForTimeout(delayMs);

    const clicked = await clickReviewMoreButton(page);
    if (clicked) {
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(delayMs);
    }

    const afterText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
    if (!clicked && afterText.length <= beforeText.length + 20) break;
  }
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
        NAVER_MOBILE_USER_AGENT
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs(env) });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(Number(env.NAVER_PLACE_RENDERER_SETTLE_MS ?? '1200'));
    if (shouldUseInteractiveNaverReviewRendering(url) || shouldUseInteractiveNaverReviewRendering(page.url())) {
      await expandNaverPlaceReviews(page, env);
    }
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
  const layers: NaverPlaceRenderLayer[] = [];
  const preferInteractiveReview = shouldUseInteractiveNaverReviewRendering(url);
  if (env.NAVER_PLACE_RENDERER_ENDPOINT) {
    layers.push({
      name: 'renderer_endpoint',
      render: async (targetUrl, rendererEnv) => {
        const snapshot = await renderWithEndpoint(targetUrl, rendererEnv);
        if (!snapshot) throw new Error('Naver Place renderer endpoint returned no snapshot.');
        return snapshot;
      }
    });
  }
  if (preferInteractiveReview) {
    layers.push({ name: 'playwright_review_interactive', render: renderWithPlaywright });
  }
  if (env.NAVER_DIRECT_FETCH !== 'false' && env.NAVER_PLACE_DIRECT_FETCH !== 'false') {
    layers.push({ name: 'direct_http', render: renderNaverHttpSnapshot });
  }
  if (!preferInteractiveReview) {
    layers.push({ name: 'playwright', render: renderWithPlaywright });
  }
  return renderNaverPlacePageWithRenderers(url, env, layers);
}

export async function renderNaverPlacePageWithRenderers(
  url: string,
  env: ProviderEnv,
  layers: NaverPlaceRenderLayer[]
): Promise<RenderedPlaceSnapshot> {
  const errors: string[] = [];
  for (const layer of layers) {
    try {
      const snapshot = await layer.render(url, env);
      if (!snapshot.html && !snapshot.bodyText) {
        errors.push(`${layer.name}: empty snapshot`);
        continue;
      }
      if (isRestrictedSnapshot(snapshot)) {
        errors.push(`${layer.name}: restricted snapshot`);
        continue;
      }
      return snapshot;
    } catch (error) {
      errors.push(`${layer.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`Naver Place rendered request failed across all render layers. ${errors.join(' | ')}`);
}

export async function importWithNaverPlaceRenderedProvider(
  parsed: ParsedNaverPlaceUrl,
  env: ProviderEnv,
  renderer: NaverPlaceRenderer = renderNaverPlacePage
): Promise<PlaceImportResult | null> {
  const resolved = await renderResolvedPlaceSnapshot(parsed, env, renderer);
  const { snapshot, naverPlaceId, naverPlaceUrl } = resolved;
  if (!snapshot.html && !snapshot.bodyText) return null;

  const profile = extractRenderedPlaceProfile({
    html: snapshot.html,
    bodyText: snapshot.bodyText,
    finalUrl: snapshot.finalUrl,
    naverPlaceId
  });
  const apolloState = extractNaverApolloState(snapshot.html);
  const apolloBase = apolloState ? placeBaseFromApolloState(apolloState, naverPlaceId) : null;
  const apolloDetail = apolloState ? placeDetailFromApolloState(apolloState, naverPlaceId) : null;
  const capturedAt = new Date().toISOString();
  const naverPlaceParsed = {
    placeIntro: profile.placeIntro,
    aiSummary: profile.aiSummary,
    openTime: profile.openTime,
    closeTime: profile.closeTime,
    breakStart: profile.breakStart,
    breakEnd: profile.breakEnd,
    closedDays: profile.closedDays,
    weeklyBusinessHours: profile.weeklyBusinessHours,
    parking: profile.parking,
    parkingNote: profile.parkingNote,
    homepageUrl: profile.homepageUrl,
    homepageType: profile.homepageType,
    facilities: profile.facilities,
    paymentInfo: profile.paymentInfo,
    menuItems: profile.menuItems,
    menuImageUrls: profile.menuImageUrls,
    placeImageUrls: profile.imageUrls,
    businessHours: profile.businessHours,
    reviewStats: profile.reviewStats,
    broadcastInfos: profile.broadcastInfos,
    keywords: profile.keywords,
    bookingUrl: profile.bookingUrl,
    externalLinks: profile.externalLinks,
    externalChannelLinks: profile.externalChannelLinks,
    routeUrl: profile.routeUrl,
    coordinates: profile.coordinates,
    transitInfo: profile.transitInfo,
    hospitalInfo: profile.hospitalInfo
  };
  const naverPlaceSnapshot = {
    finalUrl: snapshot.finalUrl,
    capturedAt,
    renderer: 'naverPlaceRenderedProvider',
    apolloStateAvailable: Boolean(apolloState),
    bodyTextAvailable: Boolean(snapshot.bodyText),
    htmlHash: createHash('sha256').update(snapshot.html).digest('hex'),
    sourceSize: {
      htmlBytes: byteLength(snapshot.html),
      bodyTextBytes: byteLength(snapshot.bodyText)
    },
    apolloState: apolloState
        ? {
          base: jsonValue(apolloBase),
          detail: jsonValue(apolloDetail)
        }
      : null
  };
  const metadata: JsonRecord = {
    provider: 'naverPlaceRenderedProvider',
    importMode: 'real',
    bodyAvailability: 'rendered_place_profile',
    finalUrl: snapshot.finalUrl,
    originalUrl: parsed.normalizedUrl,
    initialFinalUrl: resolved.initialFinalUrl,
    resolvedPlaceUrl: resolved.resolvedPlaceUrl,
    parsedUrl: parsed.metadata,
    homepage: profile.homepage,
    directions: profile.directions,
    placeIntro: profile.placeIntro,
    aiSummary: profile.aiSummary,
    descriptionSource: profile.descriptionSource,
    openTime: profile.openTime,
    closeTime: profile.closeTime,
    breakStart: profile.breakStart,
    breakEnd: profile.breakEnd,
    closedDays: profile.closedDays,
    weeklyBusinessHours: profile.weeklyBusinessHours,
    parking: profile.parking,
    parkingNote: profile.parkingNote,
    homepageUrl: profile.homepageUrl,
    homepageType: profile.homepageType,
    facilities: profile.facilities,
    paymentInfo: profile.paymentInfo,
    menuItems: profile.menuItems,
    menuImageUrls: profile.menuImageUrls,
    reviewStats: profile.reviewStats,
    broadcastInfos: profile.broadcastInfos,
    keywords: profile.keywords,
    bookingUrl: profile.bookingUrl,
    externalLinks: profile.externalLinks,
    externalChannelLinks: profile.externalChannelLinks,
    routeUrl: profile.routeUrl,
    coordinates: profile.coordinates,
    transitInfo: profile.transitInfo,
    hospitalInfo: profile.hospitalInfo,
    naverPlaceImportedAt: capturedAt,
    naverPlaceSnapshot: jsonValue(naverPlaceSnapshot),
    naverPlaceParsed: jsonValue(naverPlaceParsed),
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
      naverPlaceUrl,
      naverPlaceId,
      category: profile.category,
      address: profile.address,
      phone: profile.phone,
      description: profile.description,
      metadata
    }
  };
}
