import { describe, expect, it } from 'vitest';
import { createDatabaseConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { BLOG_FORMULA_V2_STORE_ID, seedBlogFormulaV2Fixture } from './helpers/blogFormulaV2Fixtures.js';

function tableNames(connection: ReturnType<typeof createDatabaseConnection>) {
  return connection
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name ASC")
    .all()
    .map((row) => (row as { name: string }).name);
}

function countRows(connection: ReturnType<typeof createDatabaseConnection>, tableName: string) {
  return (connection.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get() as { count: number }).count;
}

describe('Blog Formula V2 repositories', () => {
  it('migrates separate v2-prefixed tables without adding a hybrid comparison table', () => {
    const connection = createDatabaseConnection({ filename: ':memory:' });
    try {
      migrateDatabase(connection);
      const futureComparisonTable = ['v2_blog_generation', 'comparisons'].join('_');

      expect(tableNames(connection)).toEqual(
        expect.arrayContaining([
          'v2_blog_formula_sets',
          'v2_blog_formula_runs',
          'v2_blog_formula_source_posts',
          'v2_blog_topic_briefs',
          'v2_blog_retrieval_runs',
          'v2_blog_retrieved_samples',
          'v2_blog_draft_generations',
          'v2_blog_draft_validations'
        ])
      );
      expect(tableNames(connection)).not.toContain(futureComparisonTable);
    } finally {
      connection.close();
    }
  });

  it('round-trips V2 formula, retrieval, draft, and validation rows without touching V1 tables', () => {
    const connection = createDatabaseConnection({ filename: ':memory:' });
    try {
      migrateDatabase(connection);
      const fixture = seedBlogFormulaV2Fixture(connection);
      const repos = createStoreLearningRepositories(connection);

      const formulaSet = repos.v2BlogFormulaSets.create({
        id: 'v2_formula_set_test',
        storeId: BLOG_FORMULA_V2_STORE_ID,
        version: 'formula_v2.0',
        status: 'generated',
        formula: {
          titleFormula: {
            name: '걱정 해소형 제목',
            pattern: '{시술명} 부작용 걱정 없이 하려면',
            confidence: 0.91
          },
          medicalSafetyFormula: {
            description: '개인차와 의료진 상담 고지를 푸터에 포함한다.',
            requiredDisclosures: ['개인차', '부작용 가능성', '의료진 상담']
          }
        },
        sourcePostIds: fixture.ownerPostIds.slice(0, 3),
        model: 'deterministic-blog-formula-v2'
      });

      repos.v2BlogFormulaRuns.create({
        id: 'v2_formula_run_test',
        storeId: BLOG_FORMULA_V2_STORE_ID,
        formulaSetId: formulaSet.id,
        input: { sourceKind: 'owner_blog_post', sourcePostCount: 3 },
        output: { formulaSetId: formulaSet.id },
        validation: { status: 'needs_human_review' },
        model: 'deterministic-blog-formula-v2',
        status: 'completed'
      });

      repos.v2BlogFormulaSourcePosts.create({
        id: 'v2_formula_source_1',
        formulaSetId: formulaSet.id,
        storeId: BLOG_FORMULA_V2_STORE_ID,
        collectionItemId: fixture.ownerPostIds[0],
        title: '리팟레이저 부작용 걱정 없이 하려면 [리팟 공식 인증 피부과]',
        sourceUrl: 'https://blog.naver.com/terrace/1',
        charCount: 184,
        isTruncated: 0,
        usedFor: ['titleFormula', 'introFormula', 'medicalSafetyFormula']
      });

      const topicBrief = repos.v2BlogTopicBriefs.create({
        id: 'v2_topic_brief_test',
        storeId: BLOG_FORMULA_V2_STORE_ID,
        topic: '리팟레이저',
        mainKeyword: '리팟레이저 부작용',
        secondaryKeywords: ['흑자 제거', '색소침착'],
        targetReader: '흑자 제거를 고민하지만 부작용이 걱정되는 고객',
        coreConcern: '부작용과 재발 우려',
        mainAngle: '원리와 상담 기준을 먼저 설명',
        mustInclude: ['의료진 상담', '개인차'],
        mustAvoid: ['효과보장', '부작용 없음'],
        ctaDirection: '상담 예약'
      });

      const retrievalRun = repos.v2BlogRetrievalRuns.create({
        id: 'v2_retrieval_run_test',
        storeId: BLOG_FORMULA_V2_STORE_ID,
        topicBriefId: topicBrief.id,
        formulaSetId: formulaSet.id,
        input: { maxSamples: 3 },
        output: { selectedCount: 1 }
      });

      repos.v2BlogRetrievedSamples.create({
        id: 'v2_retrieved_sample_test',
        retrievalRunId: retrievalRun.id,
        storeId: BLOG_FORMULA_V2_STORE_ID,
        collectionItemId: fixture.ownerPostIds[0],
        rank: 1,
        totalScore: 0.96,
        scoring: {
          treatmentMatch: 1,
          concernMatch: 1,
          titleMatch: 1,
          bodyKeywordOverlap: 0.8
        },
        whySelected: '동일 시술명과 부작용 고민이 일치합니다.'
      });

      const draft = repos.v2BlogDraftGenerations.create({
        id: 'v2_draft_generation_test',
        storeId: BLOG_FORMULA_V2_STORE_ID,
        generationMode: 'v2_formula',
        formulaSetId: formulaSet.id,
        topicBriefId: topicBrief.id,
        retrievalRunId: retrievalRun.id,
        input: { generationMode: 'v2_formula' },
        output: { titleCandidates: ['리팟레이저 부작용 걱정 없이 확인할 점'] },
        selectedTitle: '리팟레이저 부작용 걱정 없이 확인할 점',
        blogDraft: '개인차와 부작용 가능성을 안내하고 의료진 상담을 권합니다.',
        model: 'deterministic-blog-formula-v2',
        status: 'generated'
      });

      repos.v2BlogDraftValidations.create({
        id: 'v2_draft_validation_test',
        storeId: BLOG_FORMULA_V2_STORE_ID,
        draftGenerationId: draft.id,
        validation: {
          status: 'needs_human_review',
          issues: [{ code: 'required_disclosure_present', severity: 'info' }]
        },
        status: 'needs_human_review',
        riskLevel: 'medium'
      });

      expect(repos.v2BlogFormulaSets.findById(formulaSet.id)?.formula).toMatchObject({
        titleFormula: { pattern: '{시술명} 부작용 걱정 없이 하려면' }
      });
      expect(repos.v2BlogTopicBriefs.findById(topicBrief.id)?.secondaryKeywords).toEqual(['흑자 제거', '색소침착']);
      expect(repos.v2BlogRetrievedSamples.listByRetrievalRunId(retrievalRun.id)).toHaveLength(1);
      expect(repos.v2BlogDraftGenerations.findById(draft.id)?.generationMode).toBe('v2_formula');
      expect(repos.v2BlogDraftValidations.listByDraftGenerationId(draft.id)[0].riskLevel).toBe('medium');
      expect(countRows(connection, 'marketing_rulesets')).toBe(0);
      expect(countRows(connection, 'ruleset_fields')).toBe(0);
    } finally {
      connection.close();
    }
  });
});
