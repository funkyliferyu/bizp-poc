import type { ParsedNaverPlaceUrl, PlaceImportResult, ProviderEnv } from './placeImportTypes.js';

export function canUseNaverLocalSearchProvider(env: ProviderEnv) {
  return Boolean(env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET);
}

export async function importWithNaverLocalSearchProvider(
  _parsed: ParsedNaverPlaceUrl,
  env: ProviderEnv
): Promise<PlaceImportResult | null> {
  if (!canUseNaverLocalSearchProvider(env)) return null;

  // STORE-001 keeps the provider boundary but does not call Naver yet.
  // Official Naver Local Search can help enrich names/addresses later, but
  // full Place bodies and reviews need a separate fallback/provider design.
  return null;
}
