import { createHash } from 'node:crypto';

export type CollectionIdentityInput = {
  channel: string;
  sourceType: string;
  sourceUrl?: string | null;
  title?: string | null;
  bodyText?: string | null;
  metadata?: unknown;
};

function cleanText(value: unknown): string | null {
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? text : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const text: string = value.map(cleanText).filter(Boolean).join(', ');
    return text || null;
  }
  if (value && typeof value === 'object') {
    const text = stableJson(value);
    return text === '{}' ? null : text;
  }
  return null;
}

function normalizeTitle(value: string | null | undefined) {
  const text = cleanText(value);
  return text ? text.replace(/\s+/g, ' ').toLocaleLowerCase('ko-KR') : null;
}

function normalizeGenericUrl(value: string | null | undefined) {
  const text = cleanText(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }
    const params = [...url.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      const keyOrder = leftKey.localeCompare(rightKey);
      return keyOrder === 0 ? leftValue.localeCompare(rightValue) : keyOrder;
    });
    url.search = '';
    params.forEach(([key, paramValue]) => url.searchParams.append(key, paramValue));
    return url.toString();
  } catch {
    return text.toLocaleLowerCase('ko-KR');
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value ?? null;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined && item !== null && item !== '')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)])
  );
}

function stableJson(value: unknown) {
  return JSON.stringify(stableValue(value));
}

function profileMetadata(input: CollectionIdentityInput) {
  const metadata = asRecord(input.metadata);
  const storeMetadata = asRecord(metadata.storeMetadata);
  return {
    title: cleanText(input.title),
    bodyText: cleanText(input.bodyText),
    sourceUrl: normalizeGenericUrl(input.sourceUrl),
    category: cleanText(storeMetadata.category as string | null | undefined),
    address: cleanText(storeMetadata.address as string | null | undefined),
    phone: cleanText(storeMetadata.phone as string | null | undefined),
    businessHours: stableValue(storeMetadata.businessHours),
    operatingHours: stableValue(storeMetadata.operatingHours),
    closedDays: cleanText(storeMetadata.closedDays as string | null | undefined),
    parking: cleanText(storeMetadata.parking as string | null | undefined),
    parkingNote: cleanText(storeMetadata.parkingNote as string | null | undefined),
    placeIntro: cleanText(storeMetadata.placeIntro as string | null | undefined),
    introduction: cleanText(storeMetadata.introduction as string | null | undefined),
    description: cleanText(storeMetadata.description as string | null | undefined),
    hospitalInfo: stableValue(storeMetadata.hospitalInfo),
    menuItems: stableValue(storeMetadata.menuItems),
    reviewStats: stableValue(storeMetadata.reviewStats)
  };
}

export function collectionProfileFingerprint(input: CollectionIdentityInput) {
  if (input.channel !== 'place' || input.sourceType !== 'profile') return null;
  return createHash('sha256').update(stableJson(profileMetadata(input))).digest('hex').slice(0, 24);
}

export function canonicalBlogSourceUrl(value: string | null | undefined) {
  const text = cleanText(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase().replace(/^m\./, '');
    if (host !== 'blog.naver.com') return normalizeGenericUrl(text);

    const segments = url.pathname.split('/').filter(Boolean);
    const queryBlogId = cleanText(url.searchParams.get('blogId'));
    const queryLogNo = cleanText(url.searchParams.get('logNo'));
    const pathBlogId = segments[0] && segments[0] !== 'PostView.naver' ? segments[0] : null;
    const pathLogNo = pathBlogId && segments[1] ? segments[1] : null;
    const blogId = queryBlogId ?? pathBlogId;
    const logNo = queryLogNo ?? pathLogNo;

    if (blogId && logNo) {
      return `https://blog.naver.com/${encodeURIComponent(blogId)}/${encodeURIComponent(logNo)}`;
    }
    return normalizeGenericUrl(text);
  } catch {
    return normalizeGenericUrl(text);
  }
}

export function collectionItemIdentity(input: CollectionIdentityInput) {
  if (input.channel === 'place' && input.sourceType === 'profile') {
    const urlKey = normalizeGenericUrl(input.sourceUrl);
    if (urlKey) return `place:profile:url:${urlKey}`;
    const titleKey = normalizeTitle(input.title);
    return titleKey ? `place:profile:title:${titleKey}` : null;
  }

  if (input.channel === 'blog' && input.sourceType === 'post') {
    const urlKey = canonicalBlogSourceUrl(input.sourceUrl);
    if (urlKey) return `blog:post:url:${urlKey}`;
    const titleKey = normalizeTitle(input.title);
    return titleKey ? `blog:post:title:${titleKey}` : null;
  }

  if (input.channel === 'place' && input.sourceType === 'review') {
    const urlKey = normalizeGenericUrl(input.sourceUrl);
    return urlKey ? `place:review:url:${urlKey}` : null;
  }

  return null;
}
