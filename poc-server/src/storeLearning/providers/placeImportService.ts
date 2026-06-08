import type { PlaceImportResult, ProviderEnv } from './placeImportTypes.js';
import { importWithMockPlaceProvider } from './mockPlaceProvider.js';
import { importWithNaverLocalSearchProvider } from './naverLocalSearchProvider.js';
import { importWithNaverPlaceRenderedProvider } from './naverPlaceRenderedProvider.js';
import { importWithNaverPlaceUrlParser, parseNaverPlaceUrl } from './naverPlaceUrlParser.js';
import { configuredPlaceProvider, sourceMetadata } from './ownerSourcePolicy.js';

function withOwnerSourceMetadata(result: PlaceImportResult, env: ProviderEnv): PlaceImportResult {
  return {
    ...result,
    store: {
      ...result.store,
      metadata: {
        ...result.store.metadata,
        ...sourceMetadata('place_profile', env),
        configuredPlaceProvider: configuredPlaceProvider(env)
      }
    }
  };
}

export async function importNaverPlaceUrl(naverPlaceUrl: string, env: ProviderEnv): Promise<PlaceImportResult> {
  const parsed = parseNaverPlaceUrl(naverPlaceUrl);
  if (!parsed) {
    throw new Error('지원하는 네이버 플레이스 URL을 입력해주세요.');
  }

  const placeProvider = configuredPlaceProvider(env);
  if (placeProvider === 'mock') {
    const mockResult = importWithMockPlaceProvider(parsed, env);
    if (mockResult) return withOwnerSourceMetadata(mockResult, env);
  }

  if (placeProvider === 'official_search') {
    const localSearchResult = await importWithNaverLocalSearchProvider(parsed, env);
    if (localSearchResult) return withOwnerSourceMetadata(localSearchResult, env);
  }

  if (placeProvider === 'rendered') {
    const renderedResult = await importWithNaverPlaceRenderedProvider(parsed, env);
    if (renderedResult) return withOwnerSourceMetadata(renderedResult, env);
  }

  return withOwnerSourceMetadata(importWithNaverPlaceUrlParser(parsed), env);
}
