import type { JsonValue } from '../../repositories/base.js';
import type { Store } from '../../repositories/stores.js';
import {
  StoreInfoRagDocumentSchema,
  type StoreInfoRagDocument,
  type StoreInfoSection
} from './ragDocumentTypes.js';

type JsonRecord = Record<string, JsonValue>;

function isRecord(value: JsonValue | undefined): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: JsonValue | undefined): JsonRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    const text = value.map((item) => cleanText(item)).filter(Boolean).join(', ');
    return text.length > 0 ? text : null;
  }
  if (typeof value === 'object') return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : null;
}

function textList(value: JsonValue | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item)).filter((item): item is string => Boolean(item));
  }
  if (isRecord(value)) {
    return Object.values(value).flatMap((item) => textList(item));
  }
  const text = cleanText(value);
  return text ? [text] : [];
}

function section(title: string, lines: Array<string | null | undefined>): StoreInfoSection | null {
  const cleaned = lines.map((line) => cleanText(line)).filter((line): line is string => Boolean(line));
  return cleaned.length > 0 ? { title, lines: cleaned } : null;
}

function kv(label: string, value: unknown): string | null {
  const text = cleanText(value);
  return text ? `${label}: ${text}` : null;
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return null;
}

function uniqueLines(lines: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  return lines
    .map((line) => cleanText(line))
    .filter((line): line is string => {
      if (!line || seen.has(line)) return false;
      seen.add(line);
      return true;
    });
}

function textValues(value: JsonValue | undefined): string[] {
  return asArray(value).map((item) => cleanText(item)).filter((item): item is string => Boolean(item));
}

function timeRangeLine(label: string, start: unknown, end: unknown): string | null {
  const startText = cleanText(start);
  const endText = cleanText(end);
  if (startText && endText) return `${label}: ${startText} ~ ${endText}`;
  return kv(label, firstText(startText, endText));
}

function isClosedValue(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function timeRangeFrom(value: JsonValue | undefined): { start: string; end: string } | null {
  const record = asRecord(value);
  const start = firstText(record.start, record.from, record.openTime, record.open, record.begin);
  const end = firstText(record.end, record.to, record.closeTime, record.close, record.finish);
  return start && end ? { start, end } : null;
}

function firstTimeRange(value: JsonValue | undefined): { start: string; end: string } | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const range = firstTimeRange(item);
      if (range) return range;
    }
    return null;
  }
  return timeRangeFrom(value);
}

function weeklyBusinessHourLine(value: JsonValue): string | null {
  const record = asRecord(value);
  const day = firstText(record.dayLabel, record.day, record.dayName, record.name) ?? '요일';
  const description = cleanText(record.description);
  const closed = isClosedValue(record.closed) || Boolean(description && /휴무|휴진|휴업/.test(description));
  const directRange = timeRangeFrom(record);
  const nestedRange = firstTimeRange(record.businessHours);
  const range = directRange ?? nestedRange;
  const breakStart = firstText(record.breakStart, record.breakOpen, record.breakFrom);
  const breakEnd = firstText(record.breakEnd, record.breakClose, record.breakTo);
  const breakRange = firstTimeRange(record.breakHours);
  const breakText =
    breakStart && breakEnd
      ? `${breakStart}~${breakEnd}`
      : breakRange
        ? `${breakRange.start}~${breakRange.end}`
        : firstText(record.breakTime, record.breakText);

  if (closed) return `${day}: ${description || '휴무'}`;
  const time = range ? `${range.start}~${range.end}` : firstText(record.time, record.text, description);
  if (!time) return null;
  return `${day}: ${time}${breakText ? ` / 브레이크타임 ${breakText}` : ''}`;
}

function canonicalDayKey(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.replace(/\([^)]*\)/g, '').trim().toLowerCase();
  const matched = normalized.match(/공휴일|[월화수목금토일]|mon|tue|wed|thu|fri|sat|sun/)?.[0] ?? normalized;
  const dayMap: Record<string, string> = {
    mon: 'mon',
    tue: 'tue',
    wed: 'wed',
    thu: 'thu',
    fri: 'fri',
    sat: 'sat',
    sun: 'sun',
    월: 'mon',
    화: 'tue',
    수: 'wed',
    목: 'thu',
    금: 'fri',
    토: 'sat',
    일: 'sun',
    공휴일: 'hol'
  };
  return dayMap[matched] ?? matched;
}

function weeklyBusinessHourDayKey(value: JsonValue): string | null {
  const record = asRecord(value);
  const day = firstText(record.day, record.dayLabel, record.dayName, record.name);
  return canonicalDayKey(day);
}

function weeklyBusinessHourLines(value: JsonValue | undefined): string[] {
  return asArray(value)
    .map(weeklyBusinessHourLine)
    .filter((line): line is string => Boolean(line));
}

type ParsedBusinessHourLine = {
  dayKey: string;
  line: string;
};

function parsedBusinessHourLine(value: JsonValue): ParsedBusinessHourLine | null {
  const text = cleanText(value);
  const match = text?.match(/^([월화수목금토일])(?:\([^)]*\))?\s+(.+)$/);
  if (!match) return null;

  const dayLabel = match[1];
  const content = match[2];
  const businessRange = content.match(/(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/);
  const breakRange = content.match(/브레이크타임\s*(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/);
  const closed = /휴무|휴진|휴업/.test(content);
  if (closed) {
    return { dayKey: canonicalDayKey(dayLabel) ?? dayLabel, line: `${dayLabel}: ${content}` };
  }
  if (!businessRange) return null;
  return {
    dayKey: canonicalDayKey(dayLabel) ?? dayLabel,
    line: `${dayLabel}: ${businessRange[1]}~${businessRange[2]}${breakRange ? ` / 브레이크타임 ${breakRange[1]}~${breakRange[2]}` : ''}`
  };
}

function businessHourLineRows(value: JsonValue | undefined): ParsedBusinessHourLine[] {
  return asArray(value)
    .map(parsedBusinessHourLine)
    .filter((line): line is ParsedBusinessHourLine => Boolean(line));
}

function mergeMissingBusinessHourLineRows(primaryRows: JsonValue[], fallbackRows: ParsedBusinessHourLine[]): string[] {
  const seenDays = new Set(primaryRows.map(weeklyBusinessHourDayKey).filter((day): day is string => Boolean(day)));
  const lines = weeklyBusinessHourLines(primaryRows);
  for (const fallback of fallbackRows) {
    if (seenDays.has(fallback.dayKey)) continue;
    seenDays.add(fallback.dayKey);
    lines.push(fallback.line);
  }
  return uniqueLines(lines);
}

type ExternalLinkCandidate = {
  label: string | null;
  url: string;
};

function normalizeExternalLinkLabel(value: string | null): string {
  const label = cleanText(value) ?? '외부채널';
  const lower = label.toLowerCase();
  const known: Record<string, string> = {
    blog: '블로그',
    naver_blog: '블로그',
    instagram: '인스타그램',
    youtube: '유튜브',
    tiktok: '틱톡',
    daangn: '당근',
    karrot: '당근'
  };
  return known[lower] ?? label;
}

function looksLikeUrl(value: string | null): value is string {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function collectExternalLinks(value: unknown, fallbackLabel: string | null, links: ExternalLinkCandidate[], depth = 0): void {
  if (depth > 5 || value === null || value === undefined) return;

  if (Array.isArray(value)) {
    value.forEach((item) => collectExternalLinks(item, fallbackLabel, links, depth + 1));
    return;
  }

  if (typeof value !== 'object') {
    const url = cleanText(value);
    if (looksLikeUrl(url)) links.push({ label: fallbackLabel, url });
    return;
  }

  const record = asRecord(value as JsonValue);
  const url = firstText(record.url, record.landingUrl, record.href, record.link, record.sourceUrl, record.homepageUrl);
  if (looksLikeUrl(url)) {
    links.push({
      label: firstText(
        record.label,
        record.type,
        record.homepageType,
        record.typeI18n,
        record.name,
        record.iconName,
        record.title,
        record.channel,
        fallbackLabel
      ),
      url
    });
  }

  for (const nested of Object.values(record)) {
    if (nested && typeof nested === 'object') collectExternalLinks(nested, fallbackLabel, links, depth + 1);
  }
}

function externalLinkLines(parsed: JsonRecord): string[] {
  const links: ExternalLinkCandidate[] = [];
  collectExternalLinks(parsed.homepageLinks, null, links);
  collectExternalLinks(parsed.homepages, null, links);
  collectExternalLinks(parsed.externalLinks, null, links);
  collectExternalLinks(parsed.externalChannelLinks, null, links);

  const homepageUrl = cleanText(parsed.homepageUrl ?? parsed.homepage);
  const homepageType = cleanText(parsed.homepageType) ?? '대표';
  collectExternalLinks(homepageUrl, homepageType, links);

  const seen = new Set<string>();
  return links
    .filter((link) => {
      if (seen.has(link.url)) return false;
      seen.add(link.url);
      return true;
    })
    .map((link) => `외부채널 링크(${normalizeExternalLinkLabel(link.label)}): ${link.url}`);
}

function businessHourLines(parsed: JsonRecord, metadata: JsonRecord): string[] {
  const fallbackLineRows = businessHourLineRows(parsed.businessHours);
  const editedWeeklyRows = asArray(metadata.weeklyBusinessHours);
  if (editedWeeklyRows.length > 0) return mergeMissingBusinessHourLineRows(editedWeeklyRows, fallbackLineRows);

  const importedWeeklyRows = asArray(parsed.weeklyBusinessHours);
  if (importedWeeklyRows.length > 0) return mergeMissingBusinessHourLineRows(importedWeeklyRows, fallbackLineRows);

  if (fallbackLineRows.length > 0) return uniqueLines(fallbackLineRows.map((row) => row.line));

  const businessHours = asArray(parsed.businessHours);
  const detailedLines = businessHours
    .map((item) => {
      const record = asRecord(item);
      const day = firstText(record.day, record.dayName, record.name) ?? '요일';
      const open = firstText(record.open, record.start, record.openAt);
      const close = firstText(record.close, record.end, record.closeAt);
      const breakHours = asArray(record.breakHours)
        .map((breakHour) => {
          const breakRecord = asRecord(breakHour);
          const start = firstText(breakRecord.start, breakRecord.open, breakRecord.from);
          const end = firstText(breakRecord.end, breakRecord.close, breakRecord.to);
          return start && end ? `${start}~${end}` : cleanText(breakHour);
        })
        .filter((line): line is string => Boolean(line));
      const time = open && close ? `${open}~${close}` : firstText(record.time, record.description, record.text);
      const suffix = breakHours.length > 0 ? ` / 브레이크타임 ${breakHours.join(', ')}` : '';
      return time ? `${day}: ${time}${suffix}` : null;
    })
    .filter((line): line is string => Boolean(line));

  if (detailedLines.length > 0) return detailedLines;

  return uniqueLines([
    kv('운영시간', firstText(parsed.businessHoursText, parsed.openHours, parsed.hours)),
    timeRangeLine('운영시간', parsed.openTime, parsed.closeTime),
    timeRangeLine('브레이크타임', parsed.breakStart, parsed.breakEnd),
    timeRangeLine('라스트오더', parsed.lastOrderStart, parsed.lastOrderEnd),
    kv('라스트오더', firstText(parsed.lastOrder, parsed.lastOrderTime))
  ]);
}

function parkingLine(parsed: JsonRecord): string | null {
  const parkingInfo = asRecord(parsed.parkingInfo);
  return kv('주차 안내', firstText(parkingInfo.description, parkingInfo.text, parsed.parkingNote, parsed.parking));
}

function parkingStatusLine(parsed: JsonRecord): string | null {
  const parking = cleanText(parsed.parking);
  if (!parking) return null;
  const labels: Record<string, string> = {
    available: '가능',
    possible: '가능',
    yes: '가능',
    near: '인근 유료 주차 가능',
    paid_nearby: '인근 유료 주차 가능',
    unavailable: '불가',
    no: '불가'
  };
  return kv('주차 가능 여부', labels[parking] ?? parking);
}

function reviewStatsLines(parsed: JsonRecord): string[] {
  const reviewStats = asRecord(parsed.reviewStats);
  const rating = firstText(reviewStats.rating, parsed.rating);
  return [
    kv('방문자 리뷰 수', firstText(reviewStats.visitorReviewCount, parsed.visitorReviewCount, parsed.visitorReviewsTotal)),
    kv('블로그 리뷰 수', firstText(reviewStats.blogReviewCount, parsed.blogReviewCount, parsed.cafeBlogReviewsTotal)),
    kv('텍스트 리뷰 수', firstText(reviewStats.visitorTextReviewCount, reviewStats.textReviewCount, parsed.textReviewCount)),
    kv('평점', rating === '0' ? null : rating)
  ].filter((line): line is string => Boolean(line));
}

function broadcastLines(parsed: JsonRecord): string[] {
  return asArray(parsed.broadcastInfos).flatMap((item) => {
    const record = asRecord(item);
    const parts = [
      cleanText(record.channel),
      cleanText(record.program),
      cleanText(record.date),
      cleanText(record.menu)
    ].filter((part): part is string => Boolean(part));
    return parts.length > 0 ? [parts.join(' / ')] : [];
  });
}

function menuLines(parsed: JsonRecord): string[] {
  const menuItems = asArray(parsed.menuItems).flatMap((item) => {
    const record = asRecord(item);
    const name = cleanText(record.name);
    if (!name) return [];
    const price = cleanText(record.price);
    const description = cleanText(record.description);
    return [`${name}${price ? ` - ${price}` : ''}${description ? `: ${description}` : ''}`];
  });
  const menuImageCount = asArray(parsed.menuImageUrls).length;
  return [
    menuImageCount > 0 ? `메뉴 사진 수: ${menuImageCount}개` : null,
    ...menuItems
  ].filter((line): line is string => Boolean(line));
}

function unwrapImageUrl(value: string | null) {
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

function isUsableImageUrl(value: string | null) {
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

function normalizeImageUrls(values: string[]) {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const value of values) {
    const normalized = unwrapImageUrl(value);
    if (!isUsableImageUrl(normalized) || !normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
  }
  return urls;
}

function photoLines(parsed: JsonRecord): string[] {
  const placeImageUrls = normalizeImageUrls(textValues(parsed.placeImageUrls));
  const menuImageUrls = normalizeImageUrls(textValues(parsed.menuImageUrls));
  return uniqueLines([
    placeImageUrls.length > 0 ? `매장 사진 수: ${placeImageUrls.length}개` : null,
    ...placeImageUrls.slice(0, 8).map((url, index) => `매장 사진 URL ${index + 1}: ${url}`),
    menuImageUrls.length > 0 ? `업체제공 메뉴 사진 수: ${menuImageUrls.length}개` : null,
    ...menuImageUrls.slice(0, 8).map((url, index) => `메뉴 사진 URL ${index + 1}: ${url}`)
  ]);
}

function bookingLines(parsed: JsonRecord): string[] {
  const booking = asRecord(parsed.booking);
  const bookingUrl = firstText(parsed.bookingUrl, booking.url, booking.bookingUrl);
  return uniqueLines([
    kv('예약정보', bookingUrl),
    kv('예약 가능 여부', firstText(parsed.bookingAvailable, booking.available, booking.isAvailable)),
    kv('예약 안내', firstText(parsed.bookingDescription, booking.description, booking.text))
  ]);
}

type NameCountItem = {
  name: string;
  count: number | null;
};

function nameCountItems(value: JsonValue | undefined): NameCountItem[] {
  return asArray(value)
    .map((item) => {
      const record = asRecord(item);
      const name = cleanText(record.name ?? item);
      if (!name) return null;
      return {
        name,
        count: typeof record.count === 'number' && Number.isFinite(record.count) ? record.count : null
      };
    })
    .filter((item): item is NameCountItem => Boolean(item));
}

function nameCountLine(label: string, items: NameCountItem[], unit: string): string | null {
  if (items.length === 0) return null;
  const text = items
    .map((item) => `${item.name}${item.count !== null ? ` ${item.count}${unit}` : ''}`)
    .join(', ');
  return `${label}: ${text}`;
}

function hospitalInfoLines(parsed: JsonRecord): string[] {
  const hospitalInfo = asRecord(parsed.hospitalInfo);
  const subjects = textList(hospitalInfo.subjects);
  return uniqueLines([
    subjects.length > 0 ? `진료과목: ${subjects.join(', ')}` : null,
    nameCountLine('진료과목별 전문의', nameCountItems(hospitalInfo.specialistSubjects), '명'),
    nameCountLine('특수진료장비', nameCountItems(hospitalInfo.specialEquipments), '개'),
    nameCountLine('특수진료', nameCountItems(hospitalInfo.specialOperations), '건'),
    nameCountLine('특수진료과목', nameCountItems(hospitalInfo.specialSubjects), '건')
  ]);
}

export function buildStoreInfoRagDocument(store: Store): StoreInfoRagDocument {
  const metadata = asRecord(store.metadata);
  const parsed = asRecord(metadata.naverPlaceParsed);
  const warnings: string[] = [];
  if (Object.keys(parsed).length === 0) {
    warnings.push('stores.metadata.naverPlaceParsed가 없어 저장된 기본 매장 정보만 사용했습니다.');
  }

  const storeName = firstText(parsed.name, store.name) ?? store.name;
  const storeCategory = firstText(parsed.category, store.category);
  const roadAddress = firstText(parsed.roadAddress, parsed.address, store.address);
  const phone = firstText(parsed.phone, parsed.virtualPhone, store.phone);
  const intro = firstText(parsed.placeIntro, parsed.description, store.description);
  const aiSummary = firstText(parsed.aiSummary, parsed.summary, parsed.microReview, parsed.microReviews);
  const keywords = textList(parsed.keywords ?? metadata.representativeKeywords);
  const facilities = textList(parsed.facilities);
  const hoursLines = businessHourLines(parsed, metadata);
  const usesWeeklyHours =
    weeklyBusinessHourLines(metadata.weeklyBusinessHours).length > 0 ||
    weeklyBusinessHourLines(parsed.weeklyBusinessHours).length > 0;

  const sections = [
    section('기본 정보', [
      kv('상호명', storeName),
      kv('업종', storeCategory),
      kv('전화번호', phone),
      kv('주소', roadAddress),
      kv('네이버 플레이스 URL', store.naverPlaceUrl),
      ...externalLinkLines(parsed)
    ]),
    section('오시는 길 및 주차', [
      kv('주소', roadAddress),
      kv('오시는 길', firstText(parsed.directions, parsed.wayToCome, parsed.routeDescription)),
      parkingStatusLine(parsed),
      parkingLine(parsed)
    ]),
    section('영업시간', [
      ...hoursLines,
      usesWeeklyHours ? null : kv('정기휴무', textList(parsed.closedDays ?? parsed.comingRegularClosedDays).join(', '))
    ]),
    section('편의시설 및 서비스', [
      facilities.length > 0 ? facilities.join(', ') : null,
      kv('결제/편의 정보', textList(parsed.paymentInfo).join(', '))
    ]),
    section('사장님 소개', [
      intro ? `소개: ${intro}` : null,
      aiSummary ? `AI요약정보: ${aiSummary}` : null
    ]),
    section('사진 자료', photoLines(parsed)),
    section('메뉴판', menuLines(parsed)),
    section('병원 정보', hospitalInfoLines(parsed)),
    section('예약 안내', bookingLines(parsed)),
    section('리뷰 지표', reviewStatsLines(parsed)),
    section('방송 정보', broadcastLines(parsed)),
    section('키워드', [keywords.length > 0 ? `대표 키워드: ${keywords.join(', ')}` : null])
  ].filter((item): item is StoreInfoSection => Boolean(item));

  return StoreInfoRagDocumentSchema.parse({
    storeId: store.id,
    storeName,
    title: `${storeName} 정보`,
    generatedAt: new Date().toISOString(),
    sections,
    warnings
  });
}
