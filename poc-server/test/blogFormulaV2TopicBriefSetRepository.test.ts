import { describe, expect, it } from 'vitest';
import { createDatabaseConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { seedBlogFormulaV2Fixture } from './helpers/blogFormulaV2Fixtures.js';

function setup() {
  const connection = createDatabaseConnection({ filename: ':memory:' });
  migrateDatabase(connection);
  const fixture = seedBlogFormulaV2Fixture(connection);
  const repos = createStoreLearningRepositories(connection);
  const formulaSet = repos.v2BlogFormulaSets.create({
    id: 'formula_set_brief_sets',
    storeId: fixture.storeId,
    version: 'formula_v2.1',
    status: 'generated',
    formula: {},
    sourcePostIds: fixture.ownerPostIds,
    model: 'test'
  });
  return { connection, repos, fixture, formulaSetId: formulaSet.id };
}

function baseRow(formulaSetId: string, storeId: string, sourcePostId: string) {
  return {
    id: `tbs_${sourcePostId}`,
    formulaSetId,
    storeId,
    sourcePostId,
    topic: '리팟레이저',
    mainKeyword: '리팟레이저',
    secondaryKeywords: ['흑자'],
    targetReader: '리팟레이저 정보를 찾는 잠재 고객',
    coreConcern: '부작용·재발 등 시술 전 걱정',
    mainAngle: '걱정 해소와 정보 제공 중심 전개',
    mustInclude: ['개인차', '부작용 가능성', '의료진 상담'],
    mustAvoid: [],
    ctaDirection: '상담을 통해 본인에게 맞는 계획을 확인하도록 안내',
    confidence: 0.4,
    status: 'candidate'
  };
}

describe('v2_blog_topic_brief_sets repository', () => {
  it('persists json columns and lists rows by formula set', () => {
    const { repos, fixture, formulaSetId } = setup();
    repos.v2BlogTopicBriefSets.create(baseRow(formulaSetId, fixture.storeId, fixture.ownerPostIds[0]));
    repos.v2BlogTopicBriefSets.create(baseRow(formulaSetId, fixture.storeId, fixture.ownerPostIds[1]));

    const rows = repos.v2BlogTopicBriefSets.listByFormulaSetId(formulaSetId);
    expect(rows).toHaveLength(2);
    expect(rows[0].secondaryKeywords).toEqual(['흑자']);
    expect(rows[0].mustInclude).toEqual(['개인차', '부작용 가능성', '의료진 상담']);
    expect(rows[0].confidence).toBe(0.4);
    expect(rows[0].status).toBe('candidate');
  });

  it('rejects duplicate (formula_set_id, source_post_id)', () => {
    const { repos, fixture, formulaSetId } = setup();
    repos.v2BlogTopicBriefSets.create(baseRow(formulaSetId, fixture.storeId, fixture.ownerPostIds[0]));
    expect(() =>
      repos.v2BlogTopicBriefSets.create({
        ...baseRow(formulaSetId, fixture.storeId, fixture.ownerPostIds[0]),
        id: 'tbs_duplicate'
      })
    ).toThrow();
  });
});
