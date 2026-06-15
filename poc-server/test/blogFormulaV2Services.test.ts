import { describe, expect, it } from 'vitest';
import { createDatabaseConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import {
  extractBlogFormulaV2,
  extractBlogFormulaV2WithProvider,
  generateBlogFormulaV2Draft,
  retrieveBlogFormulaV2Samples,
  validateBlogFormulaV2Draft
} from '../src/storeLearning/blogFormulaV2/blogFormulaV2Service.js';
import { createSafeMockBlogFormulaV2Provider } from '../src/storeLearning/blogFormulaV2/providers/safeMockBlogFormulaProvider.js';
import { evaluateBlogFormulaV2Quality } from '../src/storeLearning/blogFormulaV2/formulaQuality.js';
import { parseStoredBlogFormulaV2 } from '../src/storeLearning/blogFormulaV2/types.js';
import { validateBlogFormulaV2DraftText } from '../src/storeLearning/blogFormulaV2/validator.js';
import { BLOG_FORMULA_V2_STORE_ID, seedBlogFormulaV2Fixture } from './helpers/blogFormulaV2Fixtures.js';
import { legacyFormulaFixture } from './fixtures/blogFormulaV2Fixtures.js';

const topicBriefInput = {
  topic: '리팟레이저',
  mainKeyword: '리팟레이저 부작용',
  secondaryKeywords: ['흑자 제거', '색소침착'],
  targetReader: '흑자 제거를 고민하지만 부작용, 재발, 착색이 걱정되는 고객',
  coreConcern: '부작용과 재발 우려',
  mainAngle: '원리와 의료진 상담 기준을 먼저 설명',
  mustInclude: ['개인차', '의료진 상담', '부작용 가능성'],
  mustAvoid: ['효과보장', '부작용 없음'],
  ctaDirection: '상담 예약'
};

describe('Blog Formula V2 deterministic services', () => {
  const futureCombinedMode = ['hybrid', 'v1', 'v2'].join('_');

  it('extracts a formula set only from owner_blog_post collection items', () => {
    const connection = createDatabaseConnection({ filename: ':memory:' });
    try {
      migrateDatabase(connection);
      const fixture = seedBlogFormulaV2Fixture(connection);
      const repos = createStoreLearningRepositories(connection);

      const result = extractBlogFormulaV2(repos, BLOG_FORMULA_V2_STORE_ID);

      expect(result.formulaSet).toMatchObject({
        storeId: BLOG_FORMULA_V2_STORE_ID,
        version: 'formula_v2.1',
        status: 'generated',
        model: 'deterministic-blog-formula-v2'
      });
      expect(result.formulaSet.sourcePostIds).toEqual(fixture.ownerPostIds);
      expect(result.formulaSet.sourcePostIds).not.toContain(fixture.reviewItemId);
      expect(result.sourcePosts).toHaveLength(fixture.ownerPostIds.length);
      expect(result.sourcePosts.every((post) => post.sourceKind === 'owner_blog_post')).toBe(true);
      expect(JSON.stringify(result.formulaSet.formula)).not.toContain('collection_item_v2_place_review');
      expect(JSON.stringify(result.formulaSet.formula)).toContain('의료진 상담');
    } finally {
      connection.close();
    }
  });

  it('deterministic extraction produces a generation-ready v2.1 formula with no quality issues', () => {
    const connection = createDatabaseConnection({ filename: ':memory:' });
    try {
      migrateDatabase(connection);
      seedBlogFormulaV2Fixture(connection);
      const repos = createStoreLearningRepositories(connection);

      const { formulaSet } = extractBlogFormulaV2(repos, BLOG_FORMULA_V2_STORE_ID);
      const formula = parseStoredBlogFormulaV2(formulaSet.formula);

      expect(formula.schemaVersion).toBe('blog_formula_v2.1');
      expect(formula.titleFormula.length).toBeGreaterThanOrEqual(2);
      expect(formula.titleFormula.every((title) => /\{[^}]+\}/u.test(title.pattern))).toBe(true);
      expect(formula.introFormula.sequence.length).toBeGreaterThanOrEqual(3);
      expect(formula.bodyFormula.sequence.length).toBeGreaterThanOrEqual(4);
      expect(formula.toneAndMannerFormula.preferredPhrases.length).toBeGreaterThan(0);
      expect(formula.ctaFormula.hardReservationAllowed).toBe(false);
      expect(formula.medicalSafetyFormula.bannedClaims).toContain('부작용 없음');
      expect(evaluateBlogFormulaV2Quality(formula)).toEqual([]);
    } finally {
      connection.close();
    }
  });

  it('persists provider provenance when extracting through the safe mock provider path', async () => {
    const connection = createDatabaseConnection({ filename: ':memory:' });
    try {
      migrateDatabase(connection);
      seedBlogFormulaV2Fixture(connection);
      const repos = createStoreLearningRepositories(connection);
      const provider = createSafeMockBlogFormulaV2Provider();

      const result = await extractBlogFormulaV2WithProvider(repos, BLOG_FORMULA_V2_STORE_ID, provider);

      expect(result.formulaSet).toMatchObject({
        storeId: BLOG_FORMULA_V2_STORE_ID,
        status: 'generated',
        model: 'safe-mock-blog-formula-v2'
      });
      expect(result.provider).toMatchObject({
        mode: 'safe_mock',
        noExternalCalls: true,
        callId: 'SL-F1'
      });
      expect(result.run.input).toMatchObject({
        provider: expect.objectContaining({
          mode: 'safe_mock',
          noExternalCalls: true
        }),
        inputBudget: expect.objectContaining({
          schemaVersion: 'blog_formula_v2_extraction_input.v2'
        })
      });
      expect(result.run.output).toMatchObject({
        provider: expect.objectContaining({
          mode: 'safe_mock'
        })
      });
      expect(repos.llmAuditLogs.latest()).toHaveLength(0);
      expect(JSON.stringify(result)).not.toContain('marketing_ruleset');
      expect(JSON.stringify(result)).not.toContain('ruleset_field');
    } finally {
      connection.close();
    }
  });

  it('retrieves at most three similar samples and excludes Place visitor reviews', () => {
    const connection = createDatabaseConnection({ filename: ':memory:' });
    try {
      migrateDatabase(connection);
      seedBlogFormulaV2Fixture(connection);
      const repos = createStoreLearningRepositories(connection);
      const extraction = extractBlogFormulaV2(repos, BLOG_FORMULA_V2_STORE_ID);

      const result = retrieveBlogFormulaV2Samples(repos, BLOG_FORMULA_V2_STORE_ID, {
        formulaSetId: extraction.formulaSet.id,
        topicBrief: topicBriefInput,
        maxSamples: 3
      });

      expect(result.samples).toHaveLength(3);
      expect(result.samples.map((sample) => sample.rank)).toEqual([1, 2, 3]);
      expect(result.samples.every((sample) => sample.sourceKind === 'owner_blog_post')).toBe(true);
      expect(result.samples.map((sample) => sample.collectionItemId)).not.toContain('collection_item_v2_place_review');
      expect(result.samples[0]).toMatchObject({
        scoring: expect.objectContaining({
          treatmentMatch: expect.any(Number),
          concernMatch: expect.any(Number),
          titleMatch: expect.any(Number),
          bodyKeywordOverlap: expect.any(Number)
        }),
        whySelected: expect.stringContaining('리팟레이저')
      });
    } finally {
      connection.close();
    }
  });

  it('generates a mock-safe v2_formula draft without V1 or hybrid generation modes', () => {
    const connection = createDatabaseConnection({ filename: ':memory:' });
    try {
      migrateDatabase(connection);
      seedBlogFormulaV2Fixture(connection);
      const repos = createStoreLearningRepositories(connection);
      const extraction = extractBlogFormulaV2(repos, BLOG_FORMULA_V2_STORE_ID);
      const retrieval = retrieveBlogFormulaV2Samples(repos, BLOG_FORMULA_V2_STORE_ID, {
        formulaSetId: extraction.formulaSet.id,
        topicBrief: topicBriefInput,
        maxSamples: 3
      });

      const result = generateBlogFormulaV2Draft(repos, BLOG_FORMULA_V2_STORE_ID, {
        formulaSetId: extraction.formulaSet.id,
        topicBriefId: retrieval.topicBrief.id,
        retrievalRunId: retrieval.retrievalRun.id
      });

      expect(result.draftGeneration).toMatchObject({
        storeId: BLOG_FORMULA_V2_STORE_ID,
        generationMode: 'v2_formula',
        status: 'generated',
        model: 'deterministic-blog-formula-v2'
      });
      expect(result.output.selectedTitle).toContain('리팟레이저 부작용');
      expect(result.output.blogDraft).toContain('개인차');
      expect(result.output.blogDraft).toContain('부작용');
      expect(result.output.blogDraft).toContain('의료진 상담');
      expect(result.output.styleComplianceReport.sourcePostIds).toEqual(retrieval.samples.map((sample) => sample.collectionItemId));
      expect(JSON.stringify(result)).not.toContain(futureCombinedMode);
      expect(JSON.stringify(result)).not.toContain('v1_ruleset');
    } finally {
      connection.close();
    }
  });

  it('draft generation consumes the stored formula set, not just its id', () => {
    const connection = createDatabaseConnection({ filename: ':memory:' });
    try {
      migrateDatabase(connection);
      seedBlogFormulaV2Fixture(connection);
      const repos = createStoreLearningRepositories(connection);

      const { formulaSet } = extractBlogFormulaV2(repos, BLOG_FORMULA_V2_STORE_ID);
      const formula = parseStoredBlogFormulaV2(formulaSet.formula);
      const { topicBrief, retrievalRun } = retrieveBlogFormulaV2Samples(repos, BLOG_FORMULA_V2_STORE_ID, {
        formulaSetId: formulaSet.id,
        topicBrief: {
          topic: '리팟레이저',
          mainKeyword: '리팟레이저 부작용',
          secondaryKeywords: [],
          mustInclude: ['개인차', '부작용 가능성', '의료진 상담'],
          mustAvoid: []
        }
      });
      const { output } = generateBlogFormulaV2Draft(repos, BLOG_FORMULA_V2_STORE_ID, {
        formulaSetId: formulaSet.id,
        topicBriefId: topicBrief.id,
        retrievalRunId: retrievalRun.id
      });

      // Title candidates come from slot-filled title formula patterns.
      expect(output.titleCandidates.length).toBeGreaterThanOrEqual(formula.titleFormula.length);
      expect(output.titleCandidates[0]).not.toContain('{');
      expect(output.selectedTitle).toContain('리팟레이저');

      // Draft applies tone habits, soft CTA, and required disclosures from the formula.
      expect(formula.toneAndMannerFormula.preferredPhrases.some((phrase) => output.blogDraft.includes(phrase))).toBe(true);
      expect(formula.ctaFormula.softPatterns.some((pattern) => output.blogDraft.includes(pattern))).toBe(true);
      for (const disclosure of formula.medicalSafetyFormula.requiredDisclosures) {
        expect(output.blogDraft).toContain(disclosure);
      }

      // Compliance report names the actually applied blocks.
      expect(output.styleComplianceReport.appliedBlocks).toEqual(
        expect.arrayContaining([
          'titleFormula',
          'introFormula',
          'bodyFormula',
          'toneAndMannerFormula',
          'ctaFormula',
          'footerFormula',
          'medicalSafetyFormula'
        ])
      );
      expect(output.safetyCheck.requiredDisclosures).toEqual(formula.medicalSafetyFormula.requiredDisclosures);
    } finally {
      connection.close();
    }
  });

  it('draft generation still works for a legacy v2.0 stored formula', () => {
    const connection = createDatabaseConnection({ filename: ':memory:' });
    try {
      migrateDatabase(connection);
      seedBlogFormulaV2Fixture(connection);
      const repos = createStoreLearningRepositories(connection);

      const { formulaSet } = extractBlogFormulaV2(repos, BLOG_FORMULA_V2_STORE_ID);
      // Simulate a legacy stored row by overwriting the formula JSON.
      repos.v2BlogFormulaSets.update(formulaSet.id, {
        formula: legacyFormulaFixture
      });
      const { topicBrief, retrievalRun } = retrieveBlogFormulaV2Samples(repos, BLOG_FORMULA_V2_STORE_ID, {
        formulaSetId: formulaSet.id,
        topicBrief: topicBriefInput
      });
      const { output } = generateBlogFormulaV2Draft(repos, BLOG_FORMULA_V2_STORE_ID, {
        formulaSetId: formulaSet.id,
        topicBriefId: topicBrief.id,
        retrievalRunId: retrievalRun.id
      });

      expect(output.selectedTitle.length).toBeGreaterThan(0);
      expect(output.blogDraft.length).toBeGreaterThan(0);
    } finally {
      connection.close();
    }
  });

  it('flags broken unicode, banned medical ad phrases, missing disclosures, sample overlap, and hardcoded hours', () => {
    const validation = validateBlogFormulaV2DraftText({
      selectedTitle: '리팟레이저 효과보장 안내',
      blogDraft:
        '리팟레이저 효과보장으로 흑자를 완전 제거할 수 있습니다. 부작용 없음이라고 안내할 수 있으며 тщ실한 care를 제공합니다.\n\n진료시간은 10:00-19:00입니다.',
      topicBrief: topicBriefInput,
      retrievedSamples: [
        {
          collectionItemId: 'collection_item_v2_owner_1',
          title: '리팟레이저 부작용 걱정 없이 하려면 [리팟 공식 인증 피부과]',
          bodyText: '리팟레이저 부작용을 검색하는 분들은 흑자 치료 후 색소침착이나 재발을 가장 걱정합니다.'
        }
      ]
    });

    expect(validation.status).toBe('failed');
    expect(validation.riskLevel).toBe('high');
    expect(validation.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'broken_unicode',
        'banned_medical_ad_phrase',
        'missing_required_disclosure',
        'sample_copy_overlap',
        'hardcoded_operating_hours'
      ])
    );
  });
});

const SELF_INTRO_STORE_ID = 'store_self_intro_v2';
const SELF_INTRO_DIRECTOR_GREETING = '안녕하세요. 테라스의원 대표원장 권유정입니다.';
const SELF_INTRO_NAME_GREETING = '안녕하세요. 테라스의원입니다.';

function seedSelfIntroductionFixture(connection: ReturnType<typeof createDatabaseConnection>) {
  const repos = createStoreLearningRepositories(connection);
  const storeId = SELF_INTRO_STORE_ID;
  const runId = 'collection_run_self_intro_v2';

  repos.stores.create({
    id: storeId,
    name: '테라스의원',
    naverPlaceUrl: 'https://naver.me/test-terrace-2',
    naverPlaceId: '1020864099',
    category: '피부과',
    address: '서울 강남구 테스트로 99',
    phone: '02-000-1111',
    description: '리팟레이저와 색소 진료를 안내하는 피부과입니다.',
    metadata: {
      representativeKeywords: ['리팟레이저', '흑자', '색소 치료'],
      operatingHours: '월-금 10:00-19:00',
      healthcare: true
    },
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z'
  });

  repos.collectionRuns.create({
    id: runId,
    storeId,
    status: 'selection_ready',
    mode: 'mock',
    startedAt: '2026-06-01T00:00:01.000Z',
    completedAt: '2026-06-01T00:00:02.000Z',
    summary: { blog: { collected: 5 }, place: { collected: 0 } },
    createdAt: '2026-06-01T00:00:01.000Z',
    updatedAt: '2026-06-01T00:00:02.000Z'
  });

  const bodyTail =
    '\n\n오늘은 리팟레이저 부작용을 검색하는 분들을 위해 장비 원리와 의료진 상담 기준을 먼저 설명드리겠습니다.\n\n개인의 피부 상태에 따라 붉어짐, 열감, 색소 변화가 생길 수 있어 의료진 상담 후 결정하는 것이 중요합니다.\n\n테라스의원은 진단 후 필요한 경우에만 치료 계획을 안내드립니다.';

  const posts = [
    { id: 'collection_item_self_intro_1', bodyText: SELF_INTRO_DIRECTOR_GREETING + bodyTail, publishedAt: '2026-05-30T03:00:00.000Z' },
    { id: 'collection_item_self_intro_2', bodyText: SELF_INTRO_DIRECTOR_GREETING + bodyTail, publishedAt: '2026-05-28T03:00:00.000Z' },
    { id: 'collection_item_self_intro_3', bodyText: SELF_INTRO_DIRECTOR_GREETING + bodyTail, publishedAt: '2026-05-26T03:00:00.000Z' },
    { id: 'collection_item_self_intro_4', bodyText: SELF_INTRO_DIRECTOR_GREETING + bodyTail, publishedAt: '2026-05-24T03:00:00.000Z' },
    { id: 'collection_item_self_intro_5', bodyText: SELF_INTRO_NAME_GREETING + bodyTail, publishedAt: '2026-05-22T03:00:00.000Z' }
  ];

  for (const [index, post] of posts.entries()) {
    repos.collectionItems.create({
      id: post.id,
      runId,
      storeId,
      channel: 'blog',
      sourceType: 'post',
      status: 'collected',
      sourceUrl: `https://blog.naver.com/terrace2/${index + 1}`,
      title: `리팟레이저 부작용 안내 ${index + 1}`,
      bodyText: post.bodyText,
      selectedForAnalysis: 1,
      selectionReason: 'Self-introduction pattern fixture',
      selectedAt: '2026-06-01T00:00:10.000Z',
      metadata: {
        sourceKind: 'owner_blog_post',
        sourceOwnership: 'owned',
        bodyAvailability: 'available',
        isTruncated: false,
        publishedAt: post.publishedAt
      },
      createdAt: '2026-06-01T00:00:10.000Z',
      updatedAt: '2026-06-01T00:00:10.000Z'
    });
  }

  return { storeId, runId, postIds: posts.map((post) => post.id) };
}

describe('Self-introduction pattern library', () => {
  it('extractBlogFormulaV2 discovers repeating self-introduction patterns weighted by usage', () => {
    const connection = createDatabaseConnection({ filename: ':memory:' });
    try {
      migrateDatabase(connection);
      const fixture = seedSelfIntroductionFixture(connection);
      const repos = createStoreLearningRepositories(connection);

      const { formulaSet } = extractBlogFormulaV2(repos, fixture.storeId);
      const formula = parseStoredBlogFormulaV2(formulaSet.formula);
      const patterns = formula.introFormula.selfIntroductionPatterns;

      expect(patterns).toHaveLength(2);
      expect(patterns[0]).toMatchObject({
        id: 'store_director_greeting',
        directorName: '권유정',
        usageCount: 4,
        usageRatio: 0.8,
        status: 'confirmed'
      });
      expect(patterns[0].sourcePostIds).toHaveLength(4);
      expect(patterns[1]).toMatchObject({
        id: 'store_name_greeting',
        directorName: null,
        usageCount: 1,
        usageRatio: 0.2,
        status: 'candidate'
      });
    } finally {
      connection.close();
    }
  });

  it('generateBlogFormulaV2Draft opens the deterministic draft with the store\'s most common self-introduction pattern', () => {
    const connection = createDatabaseConnection({ filename: ':memory:' });
    try {
      migrateDatabase(connection);
      const fixture = seedSelfIntroductionFixture(connection);
      const repos = createStoreLearningRepositories(connection);

      const { formulaSet } = extractBlogFormulaV2(repos, fixture.storeId);
      const { topicBrief, retrievalRun } = retrieveBlogFormulaV2Samples(repos, fixture.storeId, {
        formulaSetId: formulaSet.id,
        topicBrief: topicBriefInput
      });
      const { output } = generateBlogFormulaV2Draft(repos, fixture.storeId, {
        formulaSetId: formulaSet.id,
        topicBriefId: topicBrief.id,
        retrievalRunId: retrievalRun.id
      });

      expect(output.blogDraft.startsWith(SELF_INTRO_DIRECTOR_GREETING)).toBe(true);
    } finally {
      connection.close();
    }
  });

  it('validateBlogFormulaV2Draft flags a self-introduction mismatch but not a matching opener', () => {
    const connection = createDatabaseConnection({ filename: ':memory:' });
    try {
      migrateDatabase(connection);
      const fixture = seedSelfIntroductionFixture(connection);
      const repos = createStoreLearningRepositories(connection);

      const { formulaSet } = extractBlogFormulaV2(repos, fixture.storeId);
      const { topicBrief, retrievalRun } = retrieveBlogFormulaV2Samples(repos, fixture.storeId, {
        formulaSetId: formulaSet.id,
        topicBrief: topicBriefInput
      });
      const { draftGeneration } = generateBlogFormulaV2Draft(repos, fixture.storeId, {
        formulaSetId: formulaSet.id,
        topicBriefId: topicBrief.id,
        retrievalRunId: retrievalRun.id
      });

      const matching = validateBlogFormulaV2Draft(repos, fixture.storeId, { draftGenerationId: draftGeneration.id });
      expect(matching.validation.issues.map((issue) => issue.code)).not.toContain('self_introduction_pattern_mismatch');

      repos.v2BlogDraftGenerations.update(draftGeneration.id, {
        blogDraft:
          '안녕하세요. 😊 테라스 의원의 의료진입니다.\n\n리팟레이저 부작용을 검색하는 분들은 개인차에 따라 부작용이 생길 수 있다는 점을 걱정합니다. 의료진 상담을 통해 본인에게 맞는 치료 계획을 확인하는 것이 중요합니다.'
      });

      const mismatch = validateBlogFormulaV2Draft(repos, fixture.storeId, { draftGenerationId: draftGeneration.id });
      expect(mismatch.validation.issues.map((issue) => issue.code)).toContain('self_introduction_pattern_mismatch');
      expect(mismatch.validation.status).toBe('needs_human_review');
    } finally {
      connection.close();
    }
  });
});
