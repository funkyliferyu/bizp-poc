import type { JsonValue } from '../../repositories/base.js';

export type JsonRecord = { [key: string]: JsonValue };

export type ParsedNaverPlaceUrl = {
  originalUrl: string;
  normalizedUrl: string;
  host: string;
  path: string;
  candidateId: string | null;
  metadata: JsonRecord;
};

export type PlaceImportStoreDraft = {
  id: string;
  name: string;
  naverPlaceUrl: string;
  naverPlaceId: string | null;
  category: string | null;
  address: string | null;
  phone: string | null;
  description: string | null;
  metadata: JsonRecord;
};

export type PlaceImportProvider = {
  name: string;
  mode: 'mock' | 'parser' | 'real';
};

export type PlaceImportResult = {
  store: PlaceImportStoreDraft;
  provider: PlaceImportProvider;
};

export type ProviderEnv = Record<string, string | undefined>;
