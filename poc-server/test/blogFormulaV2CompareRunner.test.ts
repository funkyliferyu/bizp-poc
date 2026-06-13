import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { runBlogFormulaV2ProviderComparison } from '../src/compareBlogFormulaV2Providers.js';
import { BLOG_FORMULA_V2_STORE_ID, seedBlogFormulaV2Fixture } from './helpers/blogFormulaV2Fixtures.js';
import { generationReadyFormulaFixture } from './fixtures/blogFormulaV2Fixtures.js';

describe('runBlogFormulaV2ProviderComparison', () => {
  let connection: DbConnection;
  let ownerPostIds: string[];

  beforeEach(() => {
    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    const fixture = seedBlogFormulaV2Fixture(connection);
    ownerPostIds = fixture.ownerPostIds;
  });

  afterEach(() => {
    connection.close();
  });

  it('compares deterministic, safe_mock, and an injected fake openai client', async () => {
    const fakeOpenAiFormula = JSON.parse(
      JSON.stringify(generationReadyFormulaFixture),
      (key, value) => (key === 'sourcePostIds' ? ownerPostIds : value)
    );
    const fakeClient = {
      beta: {
        chat: {
          completions: {
            parse: async () => ({ choices: [{ message: { parsed: fakeOpenAiFormula } }] })
          }
        }
      }
    };

    const report = await runBlogFormulaV2ProviderComparison({
      connection,
      storeId: BLOG_FORMULA_V2_STORE_ID,
      openAIClient: fakeClient,
      markdownOutPath: null
    });

    expect(report.storeId).toBe(BLOG_FORMULA_V2_STORE_ID);
    expect(report.ownerPostCount).toBeGreaterThan(0);
    expect(report.comparison.summary.comparedModes).toEqual(['deterministic', 'safe_mock', 'openai']);
    expect(report.comparison.summary.skippedModes).toEqual([]);
    expect(report.comparison.markdown).toContain('## openai');
  });

  it('records openai as skipped when no client is available', async () => {
    const report = await runBlogFormulaV2ProviderComparison({
      connection,
      storeId: BLOG_FORMULA_V2_STORE_ID,
      openAIClient: null,
      markdownOutPath: null
    });

    expect(report.comparison.summary.comparedModes).toEqual(['deterministic', 'safe_mock']);
    expect(report.comparison.summary.skippedModes).toEqual(['openai']);
  });

  it('fails fast when the store has no owner blog posts', async () => {
    const repos = await import('../src/repositories/storeLearningRepositories.js').then((module) =>
      module.createStoreLearningRepositories(connection)
    );
    repos.stores.create({
      id: 'store_empty',
      name: '빈 매장',
      naverPlaceUrl: null,
      naverPlaceId: null,
      category: null,
      address: null,
      phone: null,
      description: null,
      metadata: {},
      createdAt: '2026-06-13T00:00:00.000Z',
      updatedAt: '2026-06-13T00:00:00.000Z'
    });

    await expect(
      runBlogFormulaV2ProviderComparison({
        connection,
        storeId: 'store_empty',
        openAIClient: null
      })
    ).rejects.toThrow(/owner_blog_post/);
  });
});
