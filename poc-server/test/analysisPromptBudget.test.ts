import { describe, expect, it } from 'vitest';
import type { CollectionItem } from '../src/repositories/collection_items.js';
import type { Store } from '../src/repositories/stores.js';
import { buildAnalysisPromptInput } from '../src/storeLearning/analysis/analysisPromptBudget.js';
import { REQUIRED_ANALYZER_RULESET_FIELD_KEYS } from '../src/storeLearning/rulesets/rulesetSourceMatrix.js';

function baseItem(overrides: Partial<CollectionItem>): CollectionItem {
  const timestamp = '2026-06-10T00:00:00.000Z';
  return {
    id: overrides.id ?? 'collection_item_test',
    runId: 'collection_run_test',
    storeId: 'store_test',
    channel: overrides.channel ?? 'blog',
    sourceType: overrides.sourceType ?? 'post',
    status: 'collected',
    sourceUrl: overrides.sourceUrl ?? 'https://example.com/post',
    title: overrides.title ?? '테스트 콘텐츠',
    bodyText: overrides.bodyText ?? '본문',
    selectedForAnalysis: 1,
    selectionReason: null,
    selectedAt: timestamp,
    metadata: overrides.metadata ?? {},
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function baseStore(overrides: Partial<Store> = {}): Store {
  const timestamp = '2026-06-10T00:00:00.000Z';
  return {
    id: overrides.id ?? 'store_test',
    name: overrides.name ?? '테라스의원',
    naverPlaceUrl: overrides.naverPlaceUrl ?? 'https://map.naver.com/p/entry/place/123',
    naverPlaceId: overrides.naverPlaceId ?? '123',
    category: overrides.category ?? '피부과 의원',
    address: overrides.address ?? '서울 강남구 테스트로 1',
    phone: overrides.phone ?? '02-123-4567',
    description: overrides.description ?? '피부 진료 안내',
    metadata: overrides.metadata ?? {},
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? timestamp
  };
}

describe('analysis prompt budget', () => {
  it('removes large provider metadata while preserving useful facts and staying under the prompt budget', () => {
    const store = baseStore({
      metadata: {
        rawRenderedHtml: '<html>'.repeat(1000),
        graphQLSnapshot: { huge: 'payload'.repeat(1000) },
        storeMetadata: {
          parking: '건물 지하 주차 가능',
          businessHours: '월-금 10:00-19:00',
          treatmentSubjects: ['피부관리', '여드름']
        }
      }
    });
    const selectedItems = [
      baseItem({
        id: 'profile_1',
        channel: 'place',
        sourceType: 'profile',
        bodyText: '프로필 원문은 입력 예산에서 제외되어야 합니다.',
        metadata: {
          imageUrls: Array.from({ length: 100 }, (_, index) => `https://cdn.example.com/${index}.jpg`),
          rawProviderPayload: { html: '<div>'.repeat(1000) },
          parking: '건물 지하 주차 가능',
          businessHours: '월-금 10:00-19:00',
          treatmentSubjects: ['피부관리', '여드름']
        }
      }),
      baseItem({
        id: 'review_1',
        channel: 'place',
        sourceType: 'review',
        bodyText: '친절하고 대기가 짧았다는 방문자 리뷰입니다.'.repeat(80),
        metadata: {
          reviewDate: '2026-06-01',
          rating: 5,
          reviewerName: '방문자',
          rawGraphQL: { review: 'x'.repeat(5000) }
        }
      }),
      ...Array.from({ length: 20 }, (_, index) =>
        baseItem({
          id: `blog_${index + 1}`,
          channel: 'blog',
          sourceType: 'post',
          title: `블로그 ${index + 1}`,
          bodyText: `블로그 본문 ${index + 1} `.repeat(300),
          metadata: {
            publishedAt: `2026-05-${String(index + 1).padStart(2, '0')}`,
            blogId: `blogger_${index + 1}`,
            logNo: `log_${index + 1}`,
            tags: ['피부과', '강남'],
            imageUrls: Array.from({ length: 200 }, (_, imageIndex) => `https://cdn.example.com/${index}-${imageIndex}.jpg`),
            renderedHtml: '<article>'.repeat(1200),
            providerPayload: { duplicatedBody: `블로그 본문 ${index + 1} `.repeat(300) }
          }
        })
      )
    ];

    const { promptInput, metadata } = buildAnalysisPromptInput(
      { store, selectedItems },
      { promptCharacterBudget: 26000, bodyCharacterBudget: 1800 }
    );
    const serialized = JSON.stringify(promptInput);

    expect(metadata.promptCharacterCount).toBeLessThanOrEqual(26000);
    expect(metadata.selectedItemCount).toBe(selectedItems.length);
    expect(metadata.promptItemCount).toBeLessThan(selectedItems.length);
    expect(metadata.omittedItemCount).toBeGreaterThan(0);
    expect(metadata.promptBudgetReason).toBe('blog_item_limit_exceeded');
    expect(serialized).toContain('건물 지하 주차 가능');
    expect(serialized).toContain('피부관리');
    expect(serialized).toContain('2026-06-01');
    expect(serialized).toContain('blogger_');
    expect(serialized).not.toContain('rawRenderedHtml');
    expect(serialized).not.toContain('graphQLSnapshot');
    expect(serialized).not.toContain('rawProviderPayload');
    expect(serialized).not.toContain('renderedHtml');
    expect(serialized).not.toContain('https://cdn.example.com');
    expect(promptInput.selectedItems.find((item) => item.id === 'profile_1')?.bodyText).toBeNull();
    expect((promptInput.selectedItems.find((item) => item.id === 'review_1')?.bodyText ?? '').length).toBeLessThanOrEqual(500);
  });

  it('limits blog sources to 3 even when the prompt budget allows more', () => {
    const selectedItems = [
      baseItem({
        id: 'profile_1',
        channel: 'place',
        sourceType: 'profile',
        bodyText: '프로필 본문',
        metadata: { businessHours: '월-금 10:00-19:00' }
      }),
      baseItem({
        id: 'review_1',
        channel: 'place',
        sourceType: 'review',
        bodyText: '친절한 방문자 리뷰',
        metadata: { reviewDate: '2026-06-01' }
      }),
      ...Array.from({ length: 12 }, (_, index) => {
        const day = index + 1;
        return baseItem({
          id: `blog_${day}`,
          channel: 'blog',
          sourceType: 'post',
          title: `블로그 ${day}`,
          bodyText: `블로그 본문 ${day}`,
          metadata: {
            publishedAt: `2026-05-${String(day).padStart(2, '0')}`,
            blogId: `blogger_${day}`,
            logNo: `log_${day}`
          }
        });
      })
    ];

    const { promptInput, metadata } = buildAnalysisPromptInput(
      { store: baseStore(), selectedItems },
      { promptCharacterBudget: 100000, bodyCharacterBudget: 100000 }
    );
    const promptBlogIds = promptInput.selectedItems.filter((item) => item.channel === 'blog').map((item) => item.id);

    expect(promptBlogIds).toHaveLength(3);
    expect(promptBlogIds).toEqual(['blog_12', 'blog_11', 'blog_10']);
    expect(promptInput.promptItemIds).toEqual(['profile_1', 'review_1', 'blog_12', 'blog_11', 'blog_10']);
    expect(promptInput.promptItemIds).not.toContain('blog_1');
    expect(promptInput.selectedItems.map((item) => item.id)).toContain('profile_1');
    expect(promptInput.selectedItems.map((item) => item.id)).toContain('review_1');
    expect(metadata.omittedItemCount).toBe(9);
    expect(metadata.blogItemLimit).toBe(3);
    expect(metadata.promptBlogItemCount).toBe(3);
    expect(metadata.omittedBlogItemCount).toBe(9);
    expect(metadata.promptBudgetReason).toBe('blog_item_limit_exceeded');
  });

  it('limits place review sources to 10 even when the prompt budget allows more', () => {
    const selectedItems = [
      baseItem({
        id: 'profile_1',
        channel: 'place',
        sourceType: 'profile',
        bodyText: '프로필 본문',
        metadata: { businessHours: '월-금 10:00-19:00' }
      }),
      ...Array.from({ length: 12 }, (_, index) => {
        const day = index + 1;
        return baseItem({
          id: `review_${day}`,
          channel: 'place',
          sourceType: 'review',
          title: `리뷰 ${day}`,
          bodyText: `리뷰 본문 ${day}`,
          metadata: {
            reviewDate: `2026-06-${String(day).padStart(2, '0')}`,
            rating: 5
          }
        });
      }),
      baseItem({
        id: 'blog_1',
        channel: 'blog',
        sourceType: 'post',
        title: '블로그 1',
        bodyText: '블로그 본문 1'
      })
    ];

    const { promptInput, metadata } = buildAnalysisPromptInput(
      { store: baseStore(), selectedItems },
      { promptCharacterBudget: 100000, bodyCharacterBudget: 100000 }
    );
    const promptReviewIds = promptInput.selectedItems
      .filter((item) => item.sourceType === 'review')
      .map((item) => item.id);

    expect(promptReviewIds).toHaveLength(10);
    expect(promptReviewIds).toEqual([
      'review_12',
      'review_11',
      'review_10',
      'review_9',
      'review_8',
      'review_7',
      'review_6',
      'review_5',
      'review_4',
      'review_3'
    ]);
    expect(promptInput.selectedItems.map((item) => item.id)).toContain('profile_1');
    expect(promptInput.selectedItems.map((item) => item.id)).toContain('blog_1');
    expect(metadata.omittedItemCount).toBe(2);
    expect(metadata.reviewItemLimit).toBe(10);
    expect(metadata.promptReviewItemCount).toBe(10);
    expect(metadata.omittedReviewItemCount).toBe(2);
    expect(metadata.promptBudgetReason).toBe('review_item_limit_exceeded');
  });

  it('sends structured guidance for every SL-A1 ruleset field that requires AI interpretation', () => {
    const { promptInput } = buildAnalysisPromptInput({
      store: baseStore(),
      selectedItems: [
        baseItem({
          id: 'profile_1',
          channel: 'place',
          sourceType: 'profile',
          metadata: {
            representativeMenu: ['피부관리', '여드름 관리'],
            businessHours: '월-금 10:00-19:00'
          }
        }),
        baseItem({
          id: 'blog_1',
          channel: 'blog',
          sourceType: 'post',
          title: '피부관리 안내 블로그',
          bodyText: '피부관리 블로그 문체와 상담 안내 예시'
        })
      ]
    });

    expect(promptInput.requiredRulesetFields.map((field) => field.fieldKey)).toEqual(
      REQUIRED_ANALYZER_RULESET_FIELD_KEYS
    );
    expect(promptInput.requiredRulesetFields).toHaveLength(REQUIRED_ANALYZER_RULESET_FIELD_KEYS.length);
    expect(promptInput.requiredRulesetFields.map((field) => field.fieldKey)).not.toContain('operatingHours');
    expect(promptInput.requiredRulesetFields.map((field) => field.fieldKey)).not.toContain('parking');
    expect(promptInput.requiredRulesetFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: 'storePositioning',
          label: '포지셔닝',
          section: 'brand',
          valueKind: 'text',
          sourceTier: 'ai_processing',
          inputSources: expect.arrayContaining(['Place profile item']),
          expectedOutput: expect.stringContaining('포지셔닝'),
          evidenceGuidance: expect.stringContaining('selected collection item IDs')
        }),
        expect.objectContaining({
          fieldKey: 'representativeMenu',
          label: '대표 메뉴',
          sourceTier: 'place_then_ai',
          expectedOutput: expect.stringContaining('대표 메뉴'),
          evidenceGuidance: expect.stringContaining('direct Place facts')
        }),
        expect.objectContaining({
          fieldKey: 'reviewWeakness',
          label: '리뷰 약점',
          expectedOutput: expect.stringContaining('리뷰 약점'),
          evidenceGuidance: expect.stringContaining('strategy-only')
        }),
        expect.objectContaining({
          fieldKey: 'blogImageFormat',
          label: '비율·포맷',
          section: 'image_blog',
          expectedOutput: expect.stringContaining('비율·포맷')
        })
      ])
    );
  });
});
