import type { JsonValue } from '../../repositories/base.js';
import type { CollectionItem } from '../../repositories/collection_items.js';
import type { Store } from '../../repositories/stores.js';

type JsonRecord = Record<string, unknown>;

function asRecord(value: JsonValue | unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function asStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  const single = asString(value);
  return single ? [single] : [];
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = asString(value);
    if (text) return text;
  }
  return null;
}

function summarizeBody(item: CollectionItem) {
  const text = item.bodyText?.trim();
  return text ? (text.length > 120 ? `${text.slice(0, 120)}...` : text) : null;
}

function itemBase(item: CollectionItem) {
  return {
    id: item.id,
    channel: item.channel,
    sourceType: item.sourceType,
    title: item.title,
    sourceUrl: item.sourceUrl,
    collectedAt: item.createdAt,
    selectedForAnalysis: item.selectedForAnalysis === 1,
    summary: summarizeBody(item)
  };
}

function publicationDate(metadata: JsonRecord, item: CollectionItem) {
  return firstText(
    metadata.publishedAt,
    metadata.publishedDate,
    metadata.postDate,
    metadata.postdate,
    metadata.datePublished,
    metadata.pubDate
  ) ?? item.createdAt;
}

function viewCount(metadata: JsonRecord) {
  return asNumber(metadata.viewCount ?? metadata.views ?? metadata.view_count ?? metadata.hitCount ?? metadata.readCount ?? metadata.read_count);
}

export function presentBlogItem(item: CollectionItem) {
  const metadata = asRecord(item.metadata);
  const views = viewCount(metadata);
  return {
    ...itemBase(item),
    publishedAt: publicationDate(metadata, item),
    ...(views === null ? {} : { viewCount: views })
  };
}

function parsedStoreMetadata(store: Store, profileItem: CollectionItem | null) {
  const storeMetadata = asRecord(store.metadata);
  const parsed = asRecord(storeMetadata.naverPlaceParsed);
  const itemMetadata = asRecord(profileItem?.metadata);
  const itemStoreMetadata = asRecord(itemMetadata.storeMetadata);
  return {
    ...storeMetadata,
    ...parsed,
    ...itemStoreMetadata
  };
}

function operatingHours(metadata: JsonRecord) {
  const hours = asStringArray(metadata.businessHours);
  if (hours.length > 0) return hours;
  return asStringArray(metadata.operatingHours ?? metadata.openHours ?? metadata.hours);
}

function placeIntro(store: Store, metadata: JsonRecord) {
  return firstText(metadata.placeIntro, metadata.introduction, metadata.description, store.description);
}

function placeFacts(store: Store, metadata: JsonRecord) {
  return {
    category: firstText(metadata.category, store.category),
    address: firstText(metadata.address, store.address),
    phone: firstText(metadata.phone, store.phone),
    operatingHours: operatingHours(metadata),
    closedDays: firstText(metadata.closedDays),
    parking: firstText(metadata.parking),
    parkingNote: firstText(metadata.parkingNote),
    introduction: placeIntro(store, metadata)
  };
}

function menuItems(metadata: JsonRecord) {
  return Array.isArray(metadata.menuItems)
    ? metadata.menuItems
        .map((item) => asRecord(item))
        .filter((item) => firstText(item.name))
        .map((item) => ({
          name: firstText(item.name) as string,
          price: firstText(item.price),
          description: firstText(item.description)
        }))
    : [];
}

export function presentPlaceIndustrySections(_store: Store, metadata: JsonRecord) {
  const hospitalInfo = asRecord(metadata.hospitalInfo);
  const subjects = asStringArray(hospitalInfo.subjects);
  if (subjects.length > 0) {
    return [
      {
        type: 'hospital_subjects',
        label: '진료과목',
        items: subjects
      }
    ];
  }

  const menus = menuItems(metadata);
  if (menus.length === 0) return [];
  return [
    {
      type: 'menu',
      label: '메뉴',
      items: menus
    }
  ];
}

function pathCategoryAndId(store: Store) {
  const rawUrl = firstText(store.naverPlaceUrl);
  if (rawUrl) {
    try {
      const url = new URL(rawUrl);
      const segments = url.pathname.split('/').filter(Boolean);
      const idIndex = segments.findIndex((segment) => /^\d{5,}$/.test(segment));
      if (idIndex >= 0) {
        const category = segments[idIndex - 1] && !['entry', 'place', 'p'].includes(segments[idIndex - 1])
          ? segments[idIndex - 1]
          : 'place';
        return { category, placeId: segments[idIndex] };
      }
    } catch {
      // Ignore invalid Place URLs; fall back to the imported place id.
    }
  }
  const placeId = firstText(store.naverPlaceId);
  return placeId ? { category: 'place', placeId } : null;
}

function photoTabUrl(store: Store, visitor = false) {
  const parsed = pathCategoryAndId(store);
  if (!parsed) return null;
  const base = `https://m.place.naver.com/${parsed.category}/${parsed.placeId}/photo`;
  return visitor ? `${base}?filterType=visitor` : base;
}

function imageUrlsFromMetadata(metadata: JsonRecord) {
  return [
    ...asStringArray(metadata.placeImageUrls),
    ...asStringArray(metadata.imageUrls),
    ...asStringArray(metadata.images)
  ];
}

function reviewPhotoUrls(item: CollectionItem) {
  const metadata = asRecord(item.metadata);
  return [
    ...asStringArray(metadata.photoUrls),
    ...asStringArray(metadata.visitorPhotoUrls),
    ...asStringArray(metadata.imageUrls)
  ];
}

function unique(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function presentPlacePhotos(store: Store, items: CollectionItem[]) {
  const profile = items.find((item) => item.sourceType === 'profile') ?? null;
  const metadata = parsedStoreMetadata(store, profile);
  const visitorPhotos = items.filter((item) => item.sourceType === 'review').flatMap((item) => reviewPhotoUrls(item));
  return {
    place: unique(imageUrlsFromMetadata(metadata)),
    visitor: unique(visitorPhotos),
    placeMoreUrl: photoTabUrl(store),
    visitorMoreUrl: photoTabUrl(store, true)
  };
}

export function presentPlaceNews(metadata: JsonRecord) {
  const candidates = Array.isArray(metadata.newsItems)
    ? metadata.newsItems
    : Array.isArray(metadata.notices)
      ? metadata.notices
      : [];
  return candidates.map((item) => asRecord(item)).filter((item) => Object.keys(item).length > 0);
}

export function presentPlaceProfile(store: Store, profileItem: CollectionItem | null) {
  if (!profileItem) return null;
  const metadata = parsedStoreMetadata(store, profileItem);
  return {
    ...itemBase(profileItem),
    facts: placeFacts(store, metadata),
    industrySections: presentPlaceIndustrySections(store, metadata)
  };
}

export function presentPlaceReview(item: CollectionItem) {
  const metadata = asRecord(item.metadata);
  return {
    ...itemBase(item),
    reviewDate: firstText(metadata.reviewDate),
    rating: asNumber(metadata.rating),
    reviewerName: firstText(metadata.reviewerName),
    photoUrls: unique(reviewPhotoUrls(item))
  };
}

export function placeMetadataForStatus(store: Store, profileItem: CollectionItem | null) {
  return parsedStoreMetadata(store, profileItem);
}
