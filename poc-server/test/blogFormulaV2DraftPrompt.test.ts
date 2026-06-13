import { describe, expect, it } from 'vitest';
import {
  BLOG_FORMULA_V2_DRAFT_CALL_ID,
  BLOG_FORMULA_V2_DRAFT_PROMPT_SCHEMA_VERSION,
  BLOG_FORMULA_V2_DRAFT_RESPONSE_FORMAT_NAME,
  buildBlogFormulaV2DraftPromptInput
} from '../src/storeLearning/blogFormulaV2/blogDraftPrompt.js';
import { parseStoredBlogFormulaV2, type BlogRetrievedSampleV2, type BlogTopicBriefInput } from '../src/storeLearning/blogFormulaV2/types.js';
import { generationReadyFormulaFixture } from './fixtures/blogFormulaV2Fixtures.js';

const store = { id: 'store_1', name: '테라스의원', category: '피부과', address: '서울' };
const formula = parseStoredBlogFormulaV2(generationReadyFormulaFixture);

const topicBrief: BlogTopicBriefInput = {
  topic: '리팟레이저',
  mainKeyword: '리팟레이저 부작용',
  secondaryKeywords: ['색소침착'],
  targetReader: '부작용이 걱정되는 고객',
  coreConcern: '부작용과 재발 우려',
  mainAngle: '원리와 상담 기준 설명',
  mustInclude: ['개인차', '부작용 가능성', '의료진 상담'],
  mustAvoid: ['효과보장'],
  ctaDirection: '상담 예약'
};

function makeSample(id: string, rank: number, bodyText: string): BlogRetrievedSampleV2 {
  return {
    collectionItemId: id,
    title: `샘플 ${rank}`,
    sourceUrl: `https://blog.example/${id}`,
    sourceKind: 'owner_blog_post',
    rank,
    totalScore: 0.5,
    scoring: { treatmentMatch: 1, concernMatch: 0.5, titleMatch: 0.5, bodyKeywordOverlap: 0.5 },
    whySelected: '주제가 유사합니다.',
    bodyText
  };
}

describe('buildBlogFormulaV2DraftPromptInput (SL-G1)', () => {
  it('builds a SL-G1 draft prompt input from the formula, topic brief, and samples', () => {
    expect(BLOG_FORMULA_V2_DRAFT_CALL_ID).toBe('SL-G1');
    expect(BLOG_FORMULA_V2_DRAFT_PROMPT_SCHEMA_VERSION).toBe('blog_formula_v2_draft_input.v1');
    expect(BLOG_FORMULA_V2_DRAFT_RESPONSE_FORMAT_NAME).toBe('store_learning_blog_formula_v2_draft');

    const samples = [makeSample('item_1', 1, '본문 A'), makeSample('item_2', 2, '본문 B')];
    const { promptInput, metadata } = buildBlogFormulaV2DraftPromptInput({ store, formula, topicBrief, samples });

    expect(promptInput.schemaVersion).toBe('blog_formula_v2_draft_input.v1');
    expect(promptInput.storeProfile).toEqual(store);
    expect(promptInput.formula).toEqual(formula);
    expect(promptInput.topicBrief.mainKeyword).toBe('리팟레이저 부작용');
    expect(promptInput.styleSamples).toHaveLength(2);
    expect(promptInput.styleSamples[0]).toMatchObject({ rank: 1, collectionItemId: 'item_1', bodyText: '본문 A' });
    expect(promptInput.requestedOutputBlocks).toContain('blogDraft');

    expect(metadata.sampleCount).toBe(2);
    expect(metadata.promptSampleCount).toBe(2);
    expect(metadata.omittedSampleCollectionItemIds).toEqual([]);
    expect(metadata.promptBudgetReason).toBe('within_budget');
  });

  it('caps samples to maxSamples and records the omitted ones', () => {
    const samples = [
      makeSample('item_1', 1, '본문 A'),
      makeSample('item_2', 2, '본문 B'),
      makeSample('item_3', 3, '본문 C'),
      makeSample('item_4', 4, '본문 D')
    ];
    const { promptInput, metadata } = buildBlogFormulaV2DraftPromptInput({ store, formula, topicBrief, samples });

    expect(promptInput.styleSamples).toHaveLength(3);
    expect(metadata.promptSampleCount).toBe(3);
    expect(metadata.omittedSampleCollectionItemIds).toEqual(['item_4']);
    expect(metadata.promptBudgetReason).toBe('sample_limit_exceeded');
  });

  it('truncates long sample bodies to the per-sample budget and flags it', () => {
    const longBody = '가'.repeat(5000);
    const samples = [makeSample('item_1', 1, longBody)];
    const { promptInput, metadata } = buildBlogFormulaV2DraftPromptInput({
      store,
      formula,
      topicBrief,
      samples,
      options: { maxSampleBodyChars: 1000 }
    });

    const sample = promptInput.styleSamples[0];
    expect(sample.includedCharCount).toBeLessThan(sample.charCount);
    expect(sample.includedCharCount).toBe(1000);
    expect(sample.isTruncated).toBe(true);
    expect(metadata.promptBudgetReason).toBe('sample_body_truncated_to_budget');
  });
});
