import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import {
  extractBlogFormulaV2WithProvider,
  generateBlogFormulaV2DraftWithProvider,
  retrieveBlogFormulaV2Samples
} from '../src/storeLearning/blogFormulaV2/blogFormulaV2Service.js';
import { createSafeMockBlogFormulaV2Provider } from '../src/storeLearning/blogFormulaV2/providers/safeMockBlogFormulaProvider.js';
import { createOpenAIBlogDraftV2Provider } from '../src/storeLearning/blogFormulaV2/providers/openAIBlogDraftProvider.js';
import { createSafeMockBlogDraftV2Provider } from '../src/storeLearning/blogFormulaV2/providers/safeMockBlogDraftProvider.js';
import { BLOG_FORMULA_V2_STORE_ID, seedBlogFormulaV2Fixture } from './helpers/blogFormulaV2Fixtures.js';

type StoreLearningRepositories = ReturnType<typeof createStoreLearningRepositories>;

const ripotTopicBrief = {
  topic: '리팟레이저',
  mainKeyword: '리팟레이저 부작용',
  secondaryKeywords: ['색소침착'],
  mustInclude: ['개인차', '부작용 가능성', '의료진 상담'],
  mustAvoid: []
};

const cleanModelResponse = {
  titleCandidates: ['리팟레이저 부작용 걱정 없이 확인할 점'],
  selectedTitle: '리팟레이저 부작용 걱정 없이 확인할 점',
  blogDraft:
    '리팟레이저 부작용을 검색하는 분이라면 재발이 걱정될 수 있습니다.\n\n개인차가 있어 의료진 상담 후 결정하시길 권합니다. 부작용 가능성도 함께 확인하세요.',
  styleComplianceReport: { appliedBlocks: ['titleFormula', 'bodyFormula', 'medicalSafetyFormula'] },
  safetyCheck: { requiredDisclosures: ['개인차', '부작용 가능성', '의료진 상담'], bannedPhrasesAvoided: true },
  seoCheck: { mainKeywordInTitle: true, mainKeywordInIntro: true, secondaryKeywordsUsed: [] }
};

function fakeDraftClient(parsed: unknown) {
  return {
    beta: { chat: { completions: { parse: async () => ({ choices: [{ message: { parsed } }] }) } } }
  };
}

async function setupDraftInputs(repos: StoreLearningRepositories) {
  const { formulaSet } = await extractBlogFormulaV2WithProvider(
    repos,
    BLOG_FORMULA_V2_STORE_ID,
    createSafeMockBlogFormulaV2Provider()
  );
  const { topicBrief, retrievalRun } = retrieveBlogFormulaV2Samples(repos, BLOG_FORMULA_V2_STORE_ID, {
    formulaSetId: formulaSet.id,
    topicBrief: ripotTopicBrief,
    maxSamples: 3
  });
  return {
    formulaSetId: formulaSet.id,
    topicBriefId: topicBrief.id,
    retrievalRunId: retrievalRun.id
  };
}

function draftAuditLogs(repos: StoreLearningRepositories) {
  return repos.llmAuditLogs.latest().filter((log) => log.action === 'blog_formula_v2_generate_draft');
}

describe('generateBlogFormulaV2DraftWithProvider', () => {
  let connection: DbConnection;
  let repos: StoreLearningRepositories;

  beforeEach(() => {
    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    seedBlogFormulaV2Fixture(connection);
    repos = createStoreLearningRepositories(connection);
  });

  afterEach(() => {
    connection.close();
  });

  it('persists an openai draft with server-derived reports plus the model self-report and writes an audit row', async () => {
    const inputs = await setupDraftInputs(repos);
    const provider = createOpenAIBlogDraftV2Provider({ client: fakeDraftClient(cleanModelResponse), model: 'gpt-test-draft' });

    const { draftGeneration, output } = await generateBlogFormulaV2DraftWithProvider(
      repos,
      BLOG_FORMULA_V2_STORE_ID,
      inputs,
      provider
    );

    expect(draftGeneration.status).toBe('generated');
    expect(draftGeneration.model).toBe('gpt-test-draft');
    expect(draftGeneration.selectedTitle).toBe(cleanModelResponse.selectedTitle);

    // server-authoritative report
    expect(output.styleComplianceReport.formulaSetId).toBe(inputs.formulaSetId);
    expect(output.styleComplianceReport.sourcePostIds.length).toBeGreaterThan(0);
    expect(output.safetyCheck.bannedPhrasesAvoided).toBe(true);
    // model self-report carried alongside
    expect(output.modelReportedCompliance).toEqual({
      styleComplianceReport: cleanModelResponse.styleComplianceReport,
      safetyCheck: cleanModelResponse.safetyCheck,
      seoCheck: cleanModelResponse.seoCheck
    });

    const logs = draftAuditLogs(repos);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      storeId: BLOG_FORMULA_V2_STORE_ID,
      relatedEntityType: 'v2_blog_draft_generation',
      relatedEntityId: draftGeneration.id,
      action: 'blog_formula_v2_generate_draft',
      status: 'completed',
      model: 'gpt-test-draft'
    });
  });

  it('persists a safe_mock draft without writing an audit row', async () => {
    const inputs = await setupDraftInputs(repos);
    const { draftGeneration, output } = await generateBlogFormulaV2DraftWithProvider(
      repos,
      BLOG_FORMULA_V2_STORE_ID,
      inputs,
      createSafeMockBlogDraftV2Provider()
    );

    expect(draftGeneration.status).toBe('generated');
    expect(output.modelReportedCompliance).not.toBeNull();
    expect(draftAuditLogs(repos)).toHaveLength(0);
  });

  it('records a failed draft row and failed audit row when the model output is invalid', async () => {
    const inputs = await setupDraftInputs(repos);
    const provider = createOpenAIBlogDraftV2Provider({ client: fakeDraftClient({ selectedTitle: 'x' }), model: 'gpt-test-draft' });

    await expect(
      generateBlogFormulaV2DraftWithProvider(repos, BLOG_FORMULA_V2_STORE_ID, inputs, provider)
    ).rejects.toThrow();

    const failedDraft = repos.v2BlogDraftGenerations
      .listByStoreId(BLOG_FORMULA_V2_STORE_ID)
      .find((draft) => draft.status === 'failed');
    expect(failedDraft).toBeDefined();

    const logs = draftAuditLogs(repos);
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('failed');
  });

  it('keeps all writes inside v2_ tables and llm audit logs (no V1 mutation)', async () => {
    const inputs = await setupDraftInputs(repos);
    const rulesetsBefore = JSON.stringify(repos.marketingRulesets.listByStoreId(BLOG_FORMULA_V2_STORE_ID));
    await generateBlogFormulaV2DraftWithProvider(
      repos,
      BLOG_FORMULA_V2_STORE_ID,
      inputs,
      createSafeMockBlogDraftV2Provider()
    );
    expect(JSON.stringify(repos.marketingRulesets.listByStoreId(BLOG_FORMULA_V2_STORE_ID))).toBe(rulesetsBefore);
  });
});
