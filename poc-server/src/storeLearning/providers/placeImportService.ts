import type { PlaceImportResult, ProviderEnv } from './placeImportTypes.js';
import { importWithMockPlaceProvider } from './mockPlaceProvider.js';
import { importWithNaverLocalSearchProvider } from './naverLocalSearchProvider.js';
import { importWithNaverPlaceUrlParser, parseNaverPlaceUrl } from './naverPlaceUrlParser.js';

export async function importNaverPlaceUrl(naverPlaceUrl: string, env: ProviderEnv): Promise<PlaceImportResult> {
  const parsed = parseNaverPlaceUrl(naverPlaceUrl);
  if (!parsed) {
    throw new Error('지원하는 네이버 플레이스 URL을 입력해주세요.');
  }

  const mockResult = importWithMockPlaceProvider(parsed, env);
  if (mockResult) return mockResult;

  const localSearchResult = await importWithNaverLocalSearchProvider(parsed, env);
  if (localSearchResult) return localSearchResult;

  return importWithNaverPlaceUrlParser(parsed);
}
