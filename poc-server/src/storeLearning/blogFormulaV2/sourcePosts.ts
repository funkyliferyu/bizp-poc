import type { JsonValue } from '../../repositories/base.js';
import type { CollectionItem } from '../../repositories/collection_items.js';
import type { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';

export type OwnerBlogPostV2 = {
  collectionItemId: string;
  title: string | null;
  sourceUrl: string | null;
  bodyText: string;
  charCount: number;
  isTruncated: boolean;
  sourceKind: 'owner_blog_post';
  publishedAt: string | null;
  createdAt: string;
};

type StoreLearningRepositories = ReturnType<typeof createStoreLearningRepositories>;

function asRecord(value: JsonValue | undefined): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function textValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function booleanValue(value: unknown) {
  return typeof value === 'boolean' ? value : false;
}

function isOwnerBlogPost(item: CollectionItem) {
  const metadata = asRecord(item.metadata);
  return (
    item.status === 'collected' &&
    item.channel === 'blog' &&
    item.sourceType === 'post' &&
    textValue(item.bodyText) !== null &&
    metadata.sourceKind === 'owner_blog_post'
  );
}

export function serializeOwnerBlogPostV2(item: CollectionItem): OwnerBlogPostV2 {
  const metadata = asRecord(item.metadata);
  const bodyText = textValue(item.bodyText) ?? '';
  return {
    collectionItemId: item.id,
    title: textValue(item.title),
    sourceUrl: textValue(item.sourceUrl),
    bodyText,
    charCount: bodyText.length,
    isTruncated: booleanValue(metadata.isTruncated),
    sourceKind: 'owner_blog_post',
    publishedAt: textValue(metadata.publishedAt) ?? textValue(metadata.postDate),
    createdAt: item.createdAt
  };
}

export function listOwnerBlogPostsForFormulaV2(repos: StoreLearningRepositories, storeId: string) {
  return repos.collectionItems
    .listByStoreId(storeId)
    .filter(isOwnerBlogPost)
    .map(serializeOwnerBlogPostV2)
    .sort((left, right) => {
      const leftDate = left.publishedAt ?? left.createdAt;
      const rightDate = right.publishedAt ?? right.createdAt;
      return rightDate.localeCompare(leftDate);
    });
}
