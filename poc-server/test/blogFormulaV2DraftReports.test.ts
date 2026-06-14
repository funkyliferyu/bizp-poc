import { describe, expect, it } from 'vitest';
import {
  assembleDraftOutput,
  buildDeterministicDraftCreative,
  deriveDraftReports
} from '../src/storeLearning/blogFormulaV2/draftOutput.js';
import { parseStoredBlogFormulaV2, type BlogRetrievedSampleV2, type BlogTopicBriefInput } from '../src/storeLearning/blogFormulaV2/types.js';
import { generationReadyFormulaFixture } from './fixtures/blogFormulaV2Fixtures.js';

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

function makeSample(id: string, rank: number): BlogRetrievedSampleV2 {
  return {
    collectionItemId: id,
    title: `샘플 ${rank}`,
    sourceUrl: null,
    sourceKind: 'owner_blog_post',
    rank,
    totalScore: 0.5,
    scoring: { treatmentMatch: 1, concernMatch: 0.5, titleMatch: 0.5, bodyKeywordOverlap: 0.5 },
    whySelected: '유사',
    bodyText: '본문'
  };
}

const samples = [makeSample('item_1', 1), makeSample('item_2', 2)];

describe('deriveDraftReports (server-authoritative)', () => {
  it('flags bannedPhrasesAvoided=false when the draft contains a banned claim', () => {
    const reports = deriveDraftReports({
      formulaSetId: 'fs_1',
      formula,
      topicBrief,
      samples,
      selectedTitle: '리팟레이저 부작용 확인',
      blogDraft: '이 시술은 효과보장 됩니다.'
    });
    expect(reports.safetyCheck.bannedPhrasesAvoided).toBe(false);
  });

  it('reports bannedPhrasesAvoided=true for a clean draft and echoes required disclosures', () => {
    const reports = deriveDraftReports({
      formulaSetId: 'fs_1',
      formula,
      topicBrief,
      samples,
      selectedTitle: '리팟레이저 부작용 걱정 없이 확인할 점',
      blogDraft: '리팟레이저 부작용은 개인차가 있어 의료진 상담이 필요합니다.'
    });
    expect(reports.safetyCheck.bannedPhrasesAvoided).toBe(true);
    expect(reports.safetyCheck.requiredDisclosures).toEqual(formula.medicalSafetyFormula.requiredDisclosures);
  });

  it('computes seoCheck from the real title and intro text', () => {
    const reports = deriveDraftReports({
      formulaSetId: 'fs_1',
      formula,
      topicBrief,
      samples,
      selectedTitle: '리팟레이저 부작용 걱정 없이 확인할 점',
      blogDraft: '리팟레이저 부작용을 검색하는 분께 색소침착 걱정을 차분히 정리합니다.\n\n두 번째 문단.'
    });
    expect(reports.seoCheck.mainKeywordInTitle).toBe(true);
    expect(reports.seoCheck.mainKeywordInIntro).toBe(true);
    expect(reports.seoCheck.secondaryKeywordsUsed).toContain('색소침착');
  });

  it('builds a styleComplianceReport from the formula set id and retrieved sample ids', () => {
    const reports = deriveDraftReports({
      formulaSetId: 'fs_1',
      formula,
      topicBrief,
      samples,
      selectedTitle: '제목',
      blogDraft: '본문'
    });
    expect(reports.styleComplianceReport.formulaSetId).toBe('fs_1');
    expect(reports.styleComplianceReport.sourcePostIds).toEqual(['item_1', 'item_2']);
    expect(reports.styleComplianceReport.appliedBlocks).toContain('titleFormula');
    expect(reports.styleComplianceReport.appliedBlocks).toContain('medicalSafetyFormula');
  });
});

describe('buildDeterministicDraftCreative', () => {
  it('produces non-empty title candidates and a draft body', () => {
    const creative = buildDeterministicDraftCreative(formula, topicBrief, samples, '테라스의원');
    expect(creative.titleCandidates.length).toBeGreaterThan(0);
    expect(creative.selectedTitle.length).toBeGreaterThan(0);
    expect(creative.blogDraft.length).toBeGreaterThan(0);
  });
});

describe('assembleDraftOutput', () => {
  const creative = { titleCandidates: ['제목 후보'], selectedTitle: '제목 후보', blogDraft: '리팟레이저 부작용 본문' };
  const reports = deriveDraftReports({
    formulaSetId: 'fs_1',
    formula,
    topicBrief,
    samples,
    selectedTitle: creative.selectedTitle,
    blogDraft: creative.blogDraft
  });

  it('carries model-reported compliance through when provided', () => {
    const modelReportedCompliance = {
      styleComplianceReport: { appliedBlocks: ['titleFormula'] },
      safetyCheck: { requiredDisclosures: ['개인차'], bannedPhrasesAvoided: true },
      seoCheck: { mainKeywordInTitle: false, mainKeywordInIntro: true, secondaryKeywordsUsed: [] }
    };
    const output = assembleDraftOutput(creative, reports, modelReportedCompliance);
    expect(output.modelReportedCompliance).toEqual(modelReportedCompliance);
    expect(output.safetyCheck).toEqual(reports.safetyCheck);
  });

  it('leaves model-reported compliance null for the deterministic path', () => {
    const output = assembleDraftOutput(creative, reports);
    expect(output.modelReportedCompliance ?? null).toBeNull();
  });
});
