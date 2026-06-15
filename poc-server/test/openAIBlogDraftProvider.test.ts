import { describe, expect, it } from 'vitest';
import { createOpenAIBlogDraftV2Provider } from '../src/storeLearning/blogFormulaV2/providers/openAIBlogDraftProvider.js';
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

const validModelResponse = {
  titleCandidates: ['리팟레이저 부작용 걱정 없이 확인할 점'],
  selectedTitle: '리팟레이저 부작용 걱정 없이 확인할 점',
  blogDraft: '리팟레이저 부작용은 개인차가 있어 의료진 상담이 필요합니다.',
  styleComplianceReport: { appliedBlocks: ['titleFormula', 'bodyFormula'] },
  safetyCheck: { requiredDisclosures: ['개인차', '부작용 가능성', '의료진 상담'], bannedPhrasesAvoided: true },
  seoCheck: { mainKeywordInTitle: true, mainKeywordInIntro: true, secondaryKeywordsUsed: ['색소침착'] }
};

function fakeClient(parsed: unknown) {
  return {
    beta: { chat: { completions: { parse: async () => ({ choices: [{ message: { parsed } }] }) } } }
  };
}

describe('createOpenAIBlogDraftV2Provider (SL-G1)', () => {
  it('splits a valid model response into creative content and model-reported compliance', async () => {
    const provider = createOpenAIBlogDraftV2Provider({ client: fakeClient(validModelResponse) });
    const result = await provider.generateDraft({ store, formula, topicBrief, samples });

    expect(result.creative.selectedTitle).toBe(validModelResponse.selectedTitle);
    expect(result.creative.titleCandidates).toEqual(validModelResponse.titleCandidates);
    expect(result.creative.blogDraft).toBe(validModelResponse.blogDraft);
    expect(result.modelReportedCompliance.safetyCheck.bannedPhrasesAvoided).toBe(true);
    expect(result.modelReportedCompliance.styleComplianceReport.appliedBlocks).toContain('bodyFormula');
    expect(result.provider.callId).toBe('SL-G1');
    expect(result.provider.mode).toBe('openai');
    expect(result.provider.noExternalCalls).toBe(false);
    expect(result.inputBudget.sampleCount).toBe(1);
    expect(provider.getLastAuditMetadata?.()).not.toBeNull();
    expect(provider.getLastAuditMetadata?.()?.errorJson ?? null).toBeNull();
  });

  it('throws and records error metadata when the model output is invalid', async () => {
    const provider = createOpenAIBlogDraftV2Provider({ client: fakeClient({ selectedTitle: 'x' }) });
    await expect(provider.generateDraft({ store, formula, topicBrief, samples })).rejects.toThrow();
    expect(provider.getLastAuditMetadata?.()?.errorJson ?? null).not.toBeNull();
  });

  it('throws when the OpenAI client is unavailable', async () => {
    const provider = createOpenAIBlogDraftV2Provider({ client: null });
    await expect(provider.generateDraft({ store, formula, topicBrief, samples })).rejects.toThrow(/unavailable/i);
  });
});
