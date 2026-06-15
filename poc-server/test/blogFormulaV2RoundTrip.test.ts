import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';

type StoreLearningRepositories = ReturnType<typeof createStoreLearningRepositories>;
import {
  extractBlogFormulaV2WithProvider,
  generateBlogFormulaV2Draft,
  generateBlogFormulaV2DraftWithProvider,
  retrieveBlogFormulaV2Samples,
  validateBlogFormulaV2Draft
} from '../src/storeLearning/blogFormulaV2/blogFormulaV2Service.js';
import { createSafeMockBlogFormulaV2Provider } from '../src/storeLearning/blogFormulaV2/providers/safeMockBlogFormulaProvider.js';
import { createOpenAIBlogFormulaV2Provider } from '../src/storeLearning/blogFormulaV2/providers/openAIBlogFormulaProvider.js';
import { createSafeMockBlogDraftV2Provider } from '../src/storeLearning/blogFormulaV2/providers/safeMockBlogDraftProvider.js';
import { createOpenAIBlogDraftV2Provider } from '../src/storeLearning/blogFormulaV2/providers/openAIBlogDraftProvider.js';
import type { BlogFormulaV2Provider } from '../src/storeLearning/blogFormulaV2/providers/blogFormulaV2Provider.js';
import type { BlogDraftV2Provider } from '../src/storeLearning/blogFormulaV2/providers/blogDraftV2Provider.js';
import { BLOG_FORMULA_V2_STORE_ID, seedBlogFormulaV2Fixture } from './helpers/blogFormulaV2Fixtures.js';
import { generationReadyFormulaFixture } from './fixtures/blogFormulaV2Fixtures.js';

const ripotTopicBrief = {
  topic: '리팟레이저',
  mainKeyword: '리팟레이저 부작용',
  secondaryKeywords: [],
  mustInclude: ['개인차', '부작용 가능성', '의료진 상담'],
  mustAvoid: []
};

// The fixture ships with placeholder evidence.sourcePostIds (item_1/2/3) that don't
// exist in a freshly-seeded DB; rewrite every sourcePostIds field (at any nesting
// depth) to the real seeded owner-post IDs so downstream lookups resolve correctly.
function withSourcePostIds(formula: typeof generationReadyFormulaFixture, ids: string[]) {
  return JSON.parse(JSON.stringify(formula), (key, value) => (key === 'sourcePostIds' ? ids : value));
}

async function runRoundTrip(repos: StoreLearningRepositories, storeId: string, provider: BlogFormulaV2Provider) {
  const { formulaSet } = await extractBlogFormulaV2WithProvider(repos, storeId, provider);
  expect(repos.v2BlogFormulaSets.findById(formulaSet.id)).not.toBeNull();

  const { topicBrief, retrievalRun, samples } = retrieveBlogFormulaV2Samples(repos, storeId, {
    formulaSetId: formulaSet.id,
    topicBrief: ripotTopicBrief,
    maxSamples: 3
  });
  expect(samples.length).toBeGreaterThanOrEqual(1);
  expect(samples.length).toBeLessThanOrEqual(3);
  expect(samples.every((sample) => sample.sourceKind === 'owner_blog_post')).toBe(true);

  const { draftGeneration, output } = generateBlogFormulaV2Draft(repos, storeId, {
    formulaSetId: formulaSet.id,
    topicBriefId: topicBrief.id,
    retrievalRunId: retrievalRun.id
  });
  expect(output.selectedTitle.length).toBeGreaterThan(0);
  expect(output.blogDraft.length).toBeGreaterThan(0);
  expect(output.styleComplianceReport).toBeDefined();
  expect(output.styleComplianceReport.formulaSetId).toBe(formulaSet.id);
  expect(output.safetyCheck).toBeDefined();

  const { validation } = validateBlogFormulaV2Draft(repos, storeId, {
    draftGenerationId: draftGeneration.id
  });
  expect(validation.status).not.toBe('failed');

  // No visitor review leaked into style examples.
  const styleExampleIds = output.styleComplianceReport.sourcePostIds;
  const reviewItemIds = repos.collectionItems
    .listByStoreId(storeId)
    .filter((item) => {
      const metadata = item.metadata as Record<string, unknown> | null;
      return metadata?.sourceKind === 'place_visitor_review';
    })
    .map((item) => item.id);
  expect(styleExampleIds.some((id) => reviewItemIds.includes(id))).toBe(false);
}

async function runProviderDraftRoundTrip(
  repos: StoreLearningRepositories,
  storeId: string,
  draftProvider: BlogDraftV2Provider
) {
  const { formulaSet } = await extractBlogFormulaV2WithProvider(repos, storeId, createSafeMockBlogFormulaV2Provider());
  const { topicBrief, retrievalRun, samples } = retrieveBlogFormulaV2Samples(repos, storeId, {
    formulaSetId: formulaSet.id,
    topicBrief: ripotTopicBrief,
    maxSamples: 3
  });
  expect(samples.length).toBeGreaterThanOrEqual(1);

  const { draftGeneration, output } = await generateBlogFormulaV2DraftWithProvider(
    repos,
    storeId,
    { formulaSetId: formulaSet.id, topicBriefId: topicBrief.id, retrievalRunId: retrievalRun.id },
    draftProvider
  );
  expect(output.selectedTitle.length).toBeGreaterThan(0);
  expect(output.blogDraft.length).toBeGreaterThan(0);
  expect(output.modelReportedCompliance).not.toBeNull();
  // server-derived authoritative report
  expect(output.styleComplianceReport.formulaSetId).toBe(formulaSet.id);

  // validate-draft stays the deterministic quality gate over the generated draft.
  const { validation } = validateBlogFormulaV2Draft(repos, storeId, { draftGenerationId: draftGeneration.id });
  expect(['pass', 'needs_human_review', 'failed']).toContain(validation.status);

  // No visitor review leaked into the style examples.
  const styleExampleIds = output.styleComplianceReport.sourcePostIds;
  const reviewItemIds = repos.collectionItems
    .listByStoreId(storeId)
    .filter((item) => {
      const metadata = item.metadata as Record<string, unknown> | null;
      return metadata?.sourceKind === 'place_visitor_review';
    })
    .map((item) => item.id);
  expect(styleExampleIds.some((id) => reviewItemIds.includes(id))).toBe(false);
}

describe('Blog Formula V2 round-trip compatibility', () => {
  let connection: DbConnection;
  let repos: StoreLearningRepositories;
  let storeId: string;
  let ownerPostIds: string[];

  beforeEach(() => {
    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    const fixture = seedBlogFormulaV2Fixture(connection);
    repos = createStoreLearningRepositories(connection);
    storeId = fixture.storeId;
    ownerPostIds = fixture.ownerPostIds;
  });

  afterEach(() => {
    connection.close();
  });

  it('safe_mock formula set drives the existing deterministic draft path end to end', async () => {
    await runRoundTrip(repos, storeId, createSafeMockBlogFormulaV2Provider());
  });

  it('fake-openai formula set drives the existing deterministic draft path end to end', async () => {
    const fakeOpenAiFormula = withSourcePostIds(generationReadyFormulaFixture, ownerPostIds);
    const fakeClient = {
      beta: {
        chat: {
          completions: {
            parse: async () => ({
              choices: [{ message: { parsed: fakeOpenAiFormula } }]
            })
          }
        }
      }
    };

    await runRoundTrip(repos, storeId, createOpenAIBlogFormulaV2Provider({ client: fakeClient }));
  });

  it('keeps all round-trip writes inside v2_ tables and llm audit logs', async () => {
    const rulesetsBefore = JSON.stringify(repos.marketingRulesets.listByStoreId(storeId));
    await runRoundTrip(repos, storeId, createSafeMockBlogFormulaV2Provider());
    expect(JSON.stringify(repos.marketingRulesets.listByStoreId(storeId))).toBe(rulesetsBefore);
  });

  it('safe_mock draft provider runs extract -> retrieve -> generate -> validate end to end', async () => {
    await runProviderDraftRoundTrip(repos, storeId, createSafeMockBlogDraftV2Provider());
  });

  it('fake-openai draft provider runs extract -> retrieve -> generate -> validate end to end', async () => {
    const draftClient = {
      beta: {
        chat: {
          completions: {
            parse: async () => ({
              choices: [
                {
                  message: {
                    parsed: {
                      titleCandidates: ['리팟레이저 부작용 걱정 없이 확인할 점'],
                      selectedTitle: '리팟레이저 부작용 걱정 없이 확인할 점',
                      blogDraft:
                        '리팟레이저 부작용을 검색하는 분이라면 개인차가 있어 걱정될 수 있습니다.\n\n부작용 가능성도 있으니 의료진 상담 후 결정하시길 권합니다.',
                      styleComplianceReport: { appliedBlocks: ['titleFormula', 'bodyFormula', 'medicalSafetyFormula'] },
                      safetyCheck: {
                        requiredDisclosures: ['개인차', '부작용 가능성', '의료진 상담'],
                        bannedPhrasesAvoided: true
                      },
                      seoCheck: { mainKeywordInTitle: true, mainKeywordInIntro: true, secondaryKeywordsUsed: [] }
                    }
                  }
                }
              ]
            })
          }
        }
      }
    };

    await runProviderDraftRoundTrip(repos, storeId, createOpenAIBlogDraftV2Provider({ client: draftClient, model: 'gpt-test-draft' }));
  });
});
