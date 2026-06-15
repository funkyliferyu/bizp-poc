import { describe, expect, it } from 'vitest';
import { createSafeMockBlogDraftV2Provider } from '../src/storeLearning/blogFormulaV2/providers/safeMockBlogDraftProvider.js';
import { createBlogDraftV2ProviderForMode } from '../src/storeLearning/blogFormulaV2/providers/draftProviderFactory.js';
import { parseStoredBlogFormulaV2, type BlogRetrievedSampleV2, type BlogTopicBriefInput } from '../src/storeLearning/blogFormulaV2/types.js';
import { generationReadyFormulaFixture } from './fixtures/blogFormulaV2Fixtures.js';

const store = { id: 'store_1', name: '테라스의원', category: '피부과', address: '서울' };
const formula = parseStoredBlogFormulaV2(generationReadyFormulaFixture);
const topicBrief: BlogTopicBriefInput = {
  topic: '리팟레이저',
  mainKeyword: '리팟레이저 부작용',
  secondaryKeywords: ['색소침착'],
  targetReader: null,
  coreConcern: '부작용 우려',
  mainAngle: null,
  mustInclude: ['개인차', '부작용 가능성', '의료진 상담'],
  mustAvoid: [],
  ctaDirection: '상담 예약'
};
const samples: BlogRetrievedSampleV2[] = [
  {
    collectionItemId: 'item_1',
    title: '샘플 1',
    sourceUrl: null,
    sourceKind: 'owner_blog_post',
    rank: 1,
    totalScore: 0.5,
    scoring: { treatmentMatch: 1, concernMatch: 0.5, titleMatch: 0.5, bodyKeywordOverlap: 0.5 },
    whySelected: '유사',
    bodyText: '본문'
  }
];

describe('createSafeMockBlogDraftV2Provider', () => {
  it('returns deterministic creative content and a mock self-report with no external calls', async () => {
    const provider = createSafeMockBlogDraftV2Provider();
    expect(provider.mode).toBe('safe_mock');

    const result = await provider.generateDraft({ store, formula, topicBrief, samples });
    expect(result.creative.selectedTitle.length).toBeGreaterThan(0);
    expect(result.creative.blogDraft.length).toBeGreaterThan(0);
    expect(result.modelReportedCompliance.safetyCheck.requiredDisclosures.length).toBeGreaterThan(0);
    expect(result.provider.callId).toBe('SL-G1');
    expect(result.provider.noExternalCalls).toBe(true);
    expect(result.inputBudget.sampleCount).toBe(1);
  });
});

describe('createBlogDraftV2ProviderForMode', () => {
  it('returns null for undefined and deterministic', () => {
    expect(createBlogDraftV2ProviderForMode(undefined)).toBeNull();
    expect(createBlogDraftV2ProviderForMode('deterministic')).toBeNull();
  });

  it('returns a safe_mock provider for safe_mock', () => {
    expect(createBlogDraftV2ProviderForMode('safe_mock')?.mode).toBe('safe_mock');
  });

  it('returns an openai provider for openai', () => {
    expect(createBlogDraftV2ProviderForMode('openai', { openAIClient: null })?.mode).toBe('openai');
  });

  it('auto uses openai when a key is present and safe_mock otherwise', () => {
    expect(
      createBlogDraftV2ProviderForMode('auto', { env: { OPENAI_API_KEY: 'k' }, openAIClient: null })?.mode
    ).toBe('openai');
    expect(createBlogDraftV2ProviderForMode('auto', { env: {} })?.mode).toBe('safe_mock');
  });
});
