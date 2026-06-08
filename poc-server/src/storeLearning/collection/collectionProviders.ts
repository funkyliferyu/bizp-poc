import type { JsonRecord, ProviderEnv } from '../providers/placeImportTypes.js';
import type { Store } from '../../repositories/stores.js';
import type { StoreChannel } from '../../repositories/store_channels.js';
import { configuredBlogProvider, configuredPlaceProvider } from '../providers/ownerSourcePolicy.js';

export type CollectionPlan = {
  blogPostLimit: number;
  placeReviewLimit: number;
  includePlaceProfile: boolean;
};

export type CollectionProviderItemDraft = {
  channel: string;
  sourceType: string;
  status?: 'pending' | 'failed';
  sourceUrl: string | null;
  title: string | null;
  bodyText: string | null;
  metadata: JsonRecord;
};

export type CollectionProviderContext = {
  env: ProviderEnv;
  plan: CollectionPlan;
  store: Store;
  storeChannels?: StoreChannel[];
};

export type CollectionProvider = {
  name: string;
  mode: 'mock' | 'real';
  collect(context: CollectionProviderContext): Promise<CollectionProviderItemDraft[]>;
};

export function canUseRealNaverCollection(env: ProviderEnv) {
  const usesOfficialSearch =
    configuredPlaceProvider(env) === 'official_search' || configuredBlogProvider(env) === 'official_search';
  return usesOfficialSearch && Boolean(env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET);
}
