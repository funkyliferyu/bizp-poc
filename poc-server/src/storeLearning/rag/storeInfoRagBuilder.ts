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

function externalLinkLines(parsed: JsonRecord): string[] {
  const homepageLinks = asArray(parsed.homepageLinks).flatMap((item) => {
    const record = asRecord(item);
    const url = cleanText(record.url);
    if (!url) return [];
    const type = cleanText(record.type ?? record.homepageType) ?? '외부채널';
    return [`외부채널 링크(${type}): ${url}`];
  });
  const homepageUrl = cleanText(parsed.homepageUrl ?? parsed.homepage);
  const homepageType = cleanText(parsed.homepageType) ?? '대표';
  const reprHomepage = asRecord(parsed.homepages).repr;
  const reprUrl = isRecord(reprHomepage) ? cleanText(reprHomepage.url) : null;
  const reprType = isRecord(reprHomepage) ? cleanText(reprHomepage.type) ?? homepageType : homepageType;

  return [
    ...homepageLinks,
    homepageUrl ? `외부채널 링크(${homepageType}): ${homepageUrl}` : null,
    reprUrl ? `외부채널 링크(${reprType}): ${reprUrl}` : null
  ].filter((line): line is string => Boolean(line));
}

function businessHourLines(parsed: JsonRecord): string[] {
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
      ...businessHourLines(parsed),
      kv('정기휴무', textList(parsed.closedDays ?? parsed.comingRegularClosedDays).join(', '))
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
    section('예약 안내', bookingLines(parsed)),
    section('리뷰 지표', reviewStatsLines(parsed)),
    section('방송 정보', broadcastLines(parsed)),
    section('키워드', [keywords.length > 0 ? `대표 키워드: ${keywords.join(', ')}` : null])
  ].filter((item): item is StoreInfoSection => Boolean(item));

  return StoreInfoRagDocumentSchema.parse({
    storeId: store.id,
    storeName,
    title: `${storeName} 식당 정보`,
    generatedAt: new Date().toISOString(),
    sections,
    warnings
  });
}
