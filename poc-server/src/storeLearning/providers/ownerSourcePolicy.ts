import type { JsonRecord, ProviderEnv } from './placeImportTypes.js';

export type PlaceProviderConfig = 'mock' | 'official_search' | 'rendered';
export type BlogProviderConfig = 'mock' | 'official_search' | 'rss' | 'page' | 'rendered';
export type SourceKind = 'owner_blog_post' | 'place_profile' | 'place_visitor_review' | 'place_blog_review';
export type SourceOwnership = 'owner_managed' | 'user_generated' | 'third_party_blog';

const PLACE_PROVIDERS = new Set<PlaceProviderConfig>(['mock', 'official_search', 'rendered']);
const BLOG_PROVIDERS = new Set<BlogProviderConfig>(['mock', 'official_search', 'rss', 'page', 'rendered']);

function explicitValue<T extends string>(value: string | undefined, allowed: Set<T>) {
  const normalized = value?.trim();
  if (!normalized) return null;
  return allowed.has(normalized as T) ? (normalized as T) : null;
}

export function ownerAuthorized(env: ProviderEnv) {
  return env.NAVER_OWNER_AUTHORIZED === 'true';
}

export function mockModeForced(env: ProviderEnv) {
  return env.STORE_LEARNING_MOCK_MODE !== 'false';
}

export function configuredPlaceProvider(env: ProviderEnv): PlaceProviderConfig {
  return explicitValue(env.NAVER_PLACE_PROVIDER, PLACE_PROVIDERS) ?? (mockModeForced(env) ? 'mock' : 'official_search');
}

export function configuredBlogProvider(env: ProviderEnv): BlogProviderConfig {
  return explicitValue(env.NAVER_BLOG_PROVIDER, BLOG_PROVIDERS) ?? (mockModeForced(env) ? 'mock' : 'official_search');
}

export function ownerSourcePolicy(env: ProviderEnv): JsonRecord {
  return {
    ownerAuthorized: ownerAuthorized(env),
    placeProvider: configuredPlaceProvider(env),
    blogProvider: configuredBlogProvider(env)
  };
}

export function sourceOwnershipFor(kind: SourceKind): SourceOwnership {
  if (kind === 'place_visitor_review') return 'user_generated';
  if (kind === 'place_blog_review') return 'third_party_blog';
  return 'owner_managed';
}

export function sourceMetadata(kind: SourceKind, env: ProviderEnv): JsonRecord {
  const metadata: JsonRecord = {
    ownerAuthorized: ownerAuthorized(env),
    sourceKind: kind,
    sourceOwnership: sourceOwnershipFor(kind)
  };

  if (kind === 'owner_blog_post' || kind === 'place_blog_review') {
    metadata.configuredBlogProvider = configuredBlogProvider(env);
  }
  if (kind === 'place_profile' || kind === 'place_visitor_review') {
    metadata.configuredPlaceProvider = configuredPlaceProvider(env);
  }

  return metadata;
}
