import { z } from 'zod';
import type { CollectionItem } from '../../repositories/collection_items.js';
import type { Store } from '../../repositories/stores.js';
import type { LlmAuditMetadataProvider } from '../llmAudit/llmAuditMetadata.js';
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
  negativeExpressions: z.array(z.string().min(1)).min(1),
  evidence: z.array(EvidenceSchema).min(1),
  rulesetFields: z.array(RulesetFieldSchema).min(1)
});

export type AnalyzerOutput = z.infer<typeof AnalyzerOutputSchema>;

export type AnalyzerInput = {
  store: Store;
  selectedItems: CollectionItem[];
};

export type AnalysisProvider = LlmAuditMetadataProvider & {
  name: string;
  mode: 'mock' | 'openai';
  model?: string | null;
  getLastRunMetadata?: () => Record<string, unknown> | null;
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
      const area = store.address?.includes('분당') ? '분당' : store.address?.split(' ').slice(0, 2).join(' ') || '지역';
      const storePositioning = `${area} 당일 제작 ${category} 전문점`;
      const keyStrengths = ['당일 제작 상담', '커스텀 디자인', '친절한 픽업 안내'];
      const targetCustomers = ['기념일 케이크 고객', '레터링 케이크 예약 고객', '정자동 픽업 고객'];
      const toneAndManner = '친절하고 구체적인 예약 안내형';
      const blogWritingStyle = '실제 후기 근거를 먼저 제시하고 주문/픽업 정보를 자연스럽게 연결하는 검색 유입형';
      const seoKeywords = unique(['분당 케이크', '레터링 케이크', '정자동 케이크', '당일 제작 케이크']);
      const ctaStyle = '예약 가능 여부와 픽업 시간을 확인하도록 부드럽게 유도';
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
        keywordMap: {
          aiValue: '분당 케이크 예약: 분당 케이크, 예약, 픽업 / 레터링 주문: 레터링 케이크, 문구 상담 / 당일 제작: 당일 제작 케이크, 가능 여부',
          evidenceItemIds: [blogItemId, profileItemId],
          confidence: 0.84
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
        blogPurpose: {
          aiValue: '검색 유입, 예약 상담 유도, 신뢰 형성',
          evidenceItemIds: [blogItemId, profileItemId],
          confidence: 0.85
        },
        titlePatterns: {
          aiValue: '{지역키워드} {대표서비스} 예약 안내, {상황}에 맞는 {대표서비스} 고르는 법, {지역키워드}에서 {서비스} 찾는 분들을 위한 안내',
          evidenceItemIds: [blogItemId],
          confidence: 0.83
        },
        introPattern: {
          aiValue: '고객 상황 제시 -> 자주 묻는 질문 제시 -> 이 글에서 안내할 내용 예고',
          evidenceItemIds: [blogItemId],
          confidence: 0.82
        },
        bodyOutlinePattern: {
          aiValue: '고객 상황 설명, 상품/서비스 선택 기준, 예약 또는 상담 필요 정보, 주의사항, CTA',
          evidenceItemIds: [blogItemId],
          confidence: 0.82
        },
        headingPattern: {
          aiValue: '3~5개 소제목, 질문형 또는 안내형, 모바일에서 한눈에 읽히는 짧은 문장',
          evidenceItemIds: [blogItemId],
          confidence: 0.8
        },
        blogWritingStyle: { aiValue: blogWritingStyle, evidenceItemIds: [blogItemId], confidence: 0.87 },
        blogPreferredLength: {
          aiValue: '본문 700-1,000자, 소제목 3-5개, CTA 포함 권장',
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
        seoPlacementPolicy: {
          aiValue: '제목에는 지역+대표 키워드 1회, 도입 300자 안에 mainKeyword 1회, 소제목에는 보조 키워드, 본문에는 자연스럽게 분산하고 무의미한 반복 금지',
          evidenceItemIds: [blogItemId],
          confidence: 0.84
        },
        ctaStyle: { aiValue: ctaStyle, evidenceItemIds: [profileItemId], confidence: 0.82 },
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
