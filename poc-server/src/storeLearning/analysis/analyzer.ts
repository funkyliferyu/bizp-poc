import { z } from 'zod';
import type { CollectionItem } from '../../repositories/collection_items.js';
import type { Store } from '../../repositories/stores.js';
import { REQUIRED_ANALYZER_RULESET_FIELD_KEYS } from '../rulesets/rulesetSourceMatrix.js';

const EvidenceSchema = z.object({
  collectionItemId: z.string().min(1),
  evidenceType: z.string().min(1),
  summary: z.string().min(1),
  score: z.number().min(0).max(1).nullable()
});

const RulesetFieldSchema = z.object({
  fieldKey: z.string().min(1),
  aiValue: z.string().min(1),
  userValue: z.string().nullable(),
  finalValue: z.string().min(1),
  source: z.string().min(1),
  locked: z.boolean(),
  evidenceItemIds: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1).nullable()
});

export const AnalyzerOutputSchema = z.object({
  storePositioning: z.string().min(1),
  keyStrengths: z.array(z.string().min(1)).min(1),
  targetCustomers: z.array(z.string().min(1)).min(1),
  toneAndManner: z.string().min(1),
  blogWritingStyle: z.string().min(1),
  seoKeywords: z.array(z.string().min(1)).min(1),
  ctaStyle: z.string().min(1),
  imageDirection: z.string().min(1),
  negativeExpressions: z.array(z.string().min(1)).min(1),
  evidence: z.array(EvidenceSchema).min(1),
  rulesetFields: z.array(RulesetFieldSchema).min(1)
});

export type AnalyzerOutput = z.infer<typeof AnalyzerOutputSchema>;

export type AnalyzerInput = {
  store: Store;
  selectedItems: CollectionItem[];
};

export type AnalysisProvider = {
  name: string;
  mode: 'mock' | 'openai';
  analyze(input: AnalyzerInput): Promise<unknown>;
};

function firstItemId(items: CollectionItem[], predicate: (item: CollectionItem) => boolean) {
  return items.find(predicate)?.id ?? items[0]?.id ?? 'unknown_collection_item';
}

function itemSummary(item: CollectionItem) {
  const body = item.bodyText?.trim();
  if (body) return body.length > 90 ? `${body.slice(0, 90)}...` : body;
  return item.title ?? item.sourceType;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function csv(values: string[]) {
  return values.join(', ');
}

function field(fieldKey: string, aiValue: string, evidenceItemIds: string[], confidence: number): AnalyzerOutput['rulesetFields'][number] {
  return {
    fieldKey,
    aiValue,
    userValue: null,
    finalValue: aiValue,
    source: 'mock_analyzer',
    locked: false,
    evidenceItemIds: unique(evidenceItemIds),
    confidence
  };
}

export function createMockAnalysisProvider(): AnalysisProvider {
  return {
    name: 'mockDeterministicAnalyzer',
    mode: 'mock',
    async analyze({ store, selectedItems }) {
      const blogItemId = firstItemId(selectedItems, (item) => item.channel === 'blog');
      const profileItemId = firstItemId(selectedItems, (item) => item.sourceType === 'profile');
      const reviewItemId = firstItemId(selectedItems, (item) => item.sourceType === 'review');
      const allItemIds = selectedItems.map((item) => item.id);
      const category = store.category === 'bakery' ? '커스텀 케이크' : store.category ?? '지역 매장';
      const area = store.address?.split(' ').slice(0, 2).join(' ') || '지역';
      const storePositioning = `${area} ${category} 전문점`;
      const keyStrengths = ['당일 제작 상담', '커스텀 디자인', '친절한 픽업 안내'];
      const targetCustomers = ['기념일 케이크를 찾는 고객', '레터링 케이크 예약 고객', '근처 픽업 가능한 선물 수요'];
      const toneAndManner = '친절하고 구체적인 예약 안내형';
      const blogWritingStyle = '실제 후기 근거를 먼저 제시하고 주문/픽업 정보를 자연스럽게 연결하는 검색 유입형';
      const seoKeywords = unique([store.name, '분당 케이크', '레터링 케이크', '당일 제작 케이크']);
      const ctaStyle = '예약 가능 여부와 픽업 시간을 확인하도록 부드럽게 유도';
      const imageDirection = '케이크 디테일, 레터링 문구, 포장 상태, 픽업 동선을 함께 보여주는 이미지 구성';
      const negativeExpressions = ['전국 최고', '무조건 가능', '효능 보장', '과장된 원조 표현'];
      const isHealthcareCategory = ['병원', '의원', '클리닉', '정형외과', '피부과', '치과'].some((keyword) =>
        String(store.category || '').includes(keyword)
      );
      const industryCommonRules = isHealthcareCategory
        ? '블로그 하단에 반드시 의료법 관련 내용 포함'
        : '업종 공통 필수 고지 없음';
      const blogRequiredIntroCopy = isHealthcareCategory
        ? '대표원장 소개, 전문의 이력, 진료 철학처럼 모든 블로그 인트로에 반복 포함할 문구'
        : '브랜드 소개나 반복 인트로가 있을 때만 직접 입력';
      const blogRequiredFooterCopy = isHealthcareCategory
        ? [
            `*본 포스팅은 ${store.name}에서 의료정보 제공 및 병원 광고 목적으로 직접 작성한 글이며, <의료법 제 56조 제 1항>을 준수합니다.`,
            '*모든 시술은 개인의 피부에 따라 크고 작은 부작용이 발생할 수 있습니다. 반드시 사전에 의료진과 충분한 상담을 진행한 후 시술을 결정하시는 것을 권장드립니다.'
          ].join('\n')
        : '예약, 문의, 운영 안내 등 반복 푸터가 있을 때만 직접 입력';
      const fieldValues: Record<string, { aiValue: string; evidenceItemIds: string[]; confidence: number }> = {
        storePositioning: { aiValue: storePositioning, evidenceItemIds: [profileItemId, reviewItemId], confidence: 0.91 },
        keyStrengths: { aiValue: csv(keyStrengths), evidenceItemIds: [reviewItemId, blogItemId], confidence: 0.88 },
        representativeMenu: {
          aiValue: '레터링 케이크, 딸기 생크림 케이크, 커스텀 기념일 케이크',
          evidenceItemIds: [profileItemId, blogItemId],
          confidence: 0.79
        },
        targetCustomers: { aiValue: csv(targetCustomers), evidenceItemIds: [blogItemId, reviewItemId], confidence: 0.84 },
        contentKeywords: {
          aiValue: csv(unique([...seoKeywords, '기념일 케이크', '픽업 예약'])),
          evidenceItemIds: allItemIds,
          confidence: 0.87
        },
        reviewStrength: {
          aiValue: '친절한 디자인 상담, 사진과 비슷한 완성도, 빠른 제작 안내',
          evidenceItemIds: [reviewItemId, blogItemId],
          confidence: 0.86
        },
        reviewWeakness: {
          aiValue: '주차 공간이 협소할 수 있어 픽업 시간과 이동 동선을 미리 안내해야 함',
          evidenceItemIds: [reviewItemId],
          confidence: 0.74
        },
        toneAndManner: { aiValue: toneAndManner, evidenceItemIds: [blogItemId], confidence: 0.86 },
        catchphrase: {
          aiValue: '특별한 날을 더 특별하게, 분당에서 차분하게 준비하는 레터링 케이크',
          evidenceItemIds: [blogItemId, profileItemId],
          confidence: 0.76
        },
        industryCommonRules: {
          aiValue: industryCommonRules,
          evidenceItemIds: [profileItemId],
          confidence: isHealthcareCategory ? 0.84 : 0.62
        },
        blogRequiredIntroCopy: {
          aiValue: blogRequiredIntroCopy,
          evidenceItemIds: [profileItemId, blogItemId],
          confidence: 0.7
        },
        blogRequiredFooterCopy: {
          aiValue: blogRequiredFooterCopy,
          evidenceItemIds: [profileItemId],
          confidence: isHealthcareCategory ? 0.84 : 0.62
        },
        negativeExpressions: { aiValue: csv(negativeExpressions), evidenceItemIds: allItemIds, confidence: 0.9 },
        humorLevel: {
          aiValue: '낮음 — 가벼운 언어 유희만 허용',
          evidenceItemIds: [blogItemId],
          confidence: 0.73
        },
        trendSensitivity: {
          aiValue: '중간 — 시즌과 기념일 트렌드만 선별 반영',
          evidenceItemIds: [blogItemId, profileItemId],
          confidence: 0.72
        },
        instagramPurpose: {
          aiValue: '비주얼 중심 브랜딩과 신규 고객 유입',
          evidenceItemIds: [profileItemId],
          confidence: 0.72
        },
        instagramWritingStyle: {
          aiValue: '짧은 단정 서술과 지역/메뉴 해시태그 중심',
          evidenceItemIds: [blogItemId],
          confidence: 0.72
        },
        instagramPreferredLength: {
          aiValue: '캡션 80-150자와 해시태그 4-6개',
          evidenceItemIds: [blogItemId],
          confidence: 0.71
        },
        instagramHashtags: {
          aiValue: '#분당케이크 #레터링케이크 #커스텀케이크 #당일제작케이크',
          evidenceItemIds: allItemIds,
          confidence: 0.78
        },
        instagramEmojiPolicy: {
          aiValue: '문장 끝 1-2개까지 허용',
          evidenceItemIds: [blogItemId],
          confidence: 0.7
        },
        blogPurpose: {
          aiValue: '검색 유입, 예약 상담 유도, 신뢰 형성',
          evidenceItemIds: [blogItemId, profileItemId],
          confidence: 0.85
        },
        blogWritingStyle: { aiValue: blogWritingStyle, evidenceItemIds: [blogItemId], confidence: 0.87 },
        blogPreferredLength: {
          aiValue: '본문 700-1,000자와 사진 8장 이상 권장',
          evidenceItemIds: [blogItemId],
          confidence: 0.77
        },
        blogHashtags: {
          aiValue: '#분당케이크 #레터링케이크 #커스텀케이크 #당일제작케이크',
          evidenceItemIds: allItemIds,
          confidence: 0.78
        },
        blogEmojiPolicy: {
          aiValue: '검색형 본문에서는 이모지 사용 안 함',
          evidenceItemIds: [blogItemId],
          confidence: 0.78
        },
        seoKeywords: { aiValue: csv(seoKeywords), evidenceItemIds: allItemIds, confidence: 0.89 },
        ctaStyle: { aiValue: ctaStyle, evidenceItemIds: [profileItemId], confidence: 0.82 },
        primaryColors: {
          aiValue: '#FAD9E3 파스텔 핑크, #FFFFFF 화이트',
          evidenceItemIds: [profileItemId, blogItemId],
          confidence: 0.69
        },
        accentColors: {
          aiValue: '#E8A0BF 로즈 핑크',
          evidenceItemIds: [profileItemId, blogItemId],
          confidence: 0.68
        },
        imageDirection: { aiValue: imageDirection, evidenceItemIds: [profileItemId, reviewItemId], confidence: 0.81 },
        imageStyle: {
          aiValue: '감성적 미니멀, 케이크 클로즈업 중심',
          evidenceItemIds: [profileItemId, blogItemId],
          confidence: 0.74
        },
        imageAvoidStyle: {
          aiValue: '어두운 톤, 과도한 필터, 복잡한 배경',
          evidenceItemIds: [profileItemId],
          confidence: 0.73
        },
        instagramImageFormat: {
          aiValue: '정방형 1:1 또는 세로 4:5',
          evidenceItemIds: [profileItemId],
          confidence: 0.7
        },
        instagramImageStyle: {
          aiValue: '감성 접사와 플랫레이 중심',
          evidenceItemIds: [profileItemId, blogItemId],
          confidence: 0.7
        },
        instagramOverlayPolicy: {
          aiValue: '카드뉴스형 가능, 로고 워터마크는 owner asset이 있을 때만 사용',
          evidenceItemIds: [profileItemId],
          confidence: 0.68
        },
        blogImageFormat: {
          aiValue: '가로 3:2 권장, 최소 8장, 1200x800px 이상',
          evidenceItemIds: [profileItemId, blogItemId],
          confidence: 0.76
        },
        blogImageStyle: {
          aiValue: '전체샷, 디테일샷, 공간샷을 혼합',
          evidenceItemIds: [profileItemId, blogItemId],
          confidence: 0.75
        },
        blogOverlayPolicy: {
          aiValue: '이미지 내 텍스트 최소화',
          evidenceItemIds: [profileItemId],
          confidence: 0.74
        }
      };
      const evidence = selectedItems.map((item, index) => ({
        collectionItemId: item.id,
        evidenceType:
          item.sourceType === 'profile' ? 'store_profile' : item.sourceType === 'review' ? 'customer_review' : 'blog_post',
        summary: itemSummary(item),
        score: Math.max(0.72, 0.94 - index * 0.03)
      }));

      return {
        storePositioning,
        keyStrengths,
        targetCustomers,
        toneAndManner,
        blogWritingStyle,
        seoKeywords,
        ctaStyle,
        imageDirection,
        negativeExpressions,
        evidence,
        rulesetFields: REQUIRED_ANALYZER_RULESET_FIELD_KEYS.map((fieldKey) => {
          const definition = fieldValues[fieldKey];
          if (!definition) throw new Error(`Missing mock analyzer field definition: ${fieldKey}`);
          return field(fieldKey, definition.aiValue, definition.evidenceItemIds, definition.confidence);
        })
      };
    }
  };
}

export function validateAnalyzerOutput(output: unknown) {
  return AnalyzerOutputSchema.parse(output);
}
