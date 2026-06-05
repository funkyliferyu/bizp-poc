import { z } from 'zod';
import type { CollectionItem } from '../../repositories/collection_items.js';
import type { Store } from '../../repositories/stores.js';

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
        rulesetFields: [
          field('storePositioning', storePositioning, [profileItemId, reviewItemId], 0.91),
          field('keyStrengths', csv(keyStrengths), [reviewItemId, blogItemId], 0.88),
          field('targetCustomers', csv(targetCustomers), [blogItemId, reviewItemId], 0.84),
          field('toneAndManner', toneAndManner, [blogItemId], 0.86),
          field('blogWritingStyle', blogWritingStyle, [blogItemId], 0.87),
          field('seoKeywords', csv(seoKeywords), allItemIds, 0.89),
          field('ctaStyle', ctaStyle, [profileItemId], 0.82),
          field('imageDirection', imageDirection, [profileItemId, reviewItemId], 0.81),
          field('negativeExpressions', csv(negativeExpressions), allItemIds, 0.9)
        ]
      };
    }
  };
}

export function validateAnalyzerOutput(output: unknown) {
  return AnalyzerOutputSchema.parse(output);
}
