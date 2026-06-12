import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';

type StoreLearningRepositories = ReturnType<typeof createStoreLearningRepositories>;
import {
  extractBlogFormulaV2WithProvider,
  generateBlogFormulaV2Draft,
  retrieveBlogFormulaV2Samples,
  validateBlogFormulaV2Draft
} from '../src/storeLearning/blogFormulaV2/blogFormulaV2Service.js';
import { createSafeMockBlogFormulaV2Provider } from '../src/storeLearning/blogFormulaV2/providers/safeMockBlogFormulaProvider.js';
import { createOpenAIBlogFormulaV2Provider } from '../src/storeLearning/blogFormulaV2/providers/openAIBlogFormulaProvider.js';
import type { BlogFormulaV2Provider } from '../src/storeLearning/blogFormulaV2/providers/blogFormulaV2Provider.js';
import { BLOG_FORMULA_V2_STORE_ID, seedBlogFormulaV2Fixture } from './helpers/blogFormulaV2Fixtures.js';
import { generationReadyFormulaFixture } from './fixtures/blogFormulaV2Fixtures.js';

const ripotTopicBrief = {
  topic: '리팟레이저',
  mainKeyword: '리팟레이저 부작용',
  secondaryKeywords: [],
  mustInclude: ['개인차', '부작용 가능성', '의료진 상담'],
  mustAvoid: []
};

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
});
