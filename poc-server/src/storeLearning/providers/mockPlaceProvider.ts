import type { ParsedNaverPlaceUrl, PlaceImportResult, ProviderEnv } from './placeImportTypes.js';

function mockModeEnabled(env: ProviderEnv) {
  if (env.NAVER_PLACE_PROVIDER === 'mock') return true;
  return env.STORE_LEARNING_MOCK_MODE !== 'false';
}

function mockStoreId(parsed: ParsedNaverPlaceUrl) {
  return `store_${(parsed.candidateId ?? 'demo_tteokbokki').replace(/[^0-9A-Za-z_]/g, '_')}`;
}

export function importWithMockPlaceProvider(parsed: ParsedNaverPlaceUrl, env: ProviderEnv): PlaceImportResult | null {
  if (!mockModeEnabled(env)) return null;

  return {
    provider: {
      name: 'mockPlaceProvider',
      mode: 'mock'
    },
    store: {
      id: mockStoreId(parsed),
      name: '맛있는 떡볶이 홍대점',
      naverPlaceUrl: parsed.normalizedUrl,
      naverPlaceId: parsed.candidateId ?? 'demo-tteokbokki',
      category: '음식점 > 한식 > 분식',
      address: '서울 마포구 홍익로 5길 12',
      phone: '02-1234-5678',
      description: '신선한 재료로 만드는 홍대 대표 분식집. 매콤달콤한 떡볶이와 바삭한 튀김이 인기예요.',
      metadata: {
        provider: 'mockPlaceProvider',
        importMode: 'mock',
        businessNumber: '123-45-67890',
        email: 'demo@bizplanet.local',
        addressDetail: '1층',
        openTime: '11:00',
        closeTime: '22:00',
        breakStart: '15:00',
        breakEnd: '16:00',
        closedDays: ['sun'],
        parking: 'near',
        parkingNote: '인근 유료 주차장 이용 가능',
        parsedUrl: parsed.metadata
      }
    }
  };
}
