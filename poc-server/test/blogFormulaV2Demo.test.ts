import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDatabaseConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { runBlogFormulaV2Demo } from '../src/demoBlogFormulaV2.js';
import { BLOG_FORMULA_V2_STORE_ID, seedBlogFormulaV2Fixture } from './helpers/blogFormulaV2Fixtures.js';

describe('Blog Formula V2 demo script', () => {
  const futureCombinedMode = ['hybrid', 'v1', 'v2'].join('_');

  it('is exposed as a mock-safe npm script', () => {
    const packageJson = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts['demo:blog-formula-v2']).toContain('tsx src/demoBlogFormulaV2.ts');
  });

  it('runs extraction, retrieval, draft generation, and validation without OpenAI or hybrid mode', async () => {
    const connection = createDatabaseConnection({ filename: ':memory:' });
    try {
      migrateDatabase(connection);
      seedBlogFormulaV2Fixture(connection);

      const report = await runBlogFormulaV2Demo({
        connection,
        storeId: BLOG_FORMULA_V2_STORE_ID,
        closeConnection: false
      });

      expect(report).toMatchObject({
        storeId: BLOG_FORMULA_V2_STORE_ID,
        mode: 'v2_formula',
        model: 'deterministic-blog-formula-v2',
        sourcePostCount: 4,
        retrievedSampleCount: 3,
        validationStatus: expect.stringMatching(/pass|needs_human_review/)
      });
      expect(report.selectedTitle).toContain('리팟레이저 부작용');
      expect(JSON.stringify(report)).not.toContain('OPENAI_API_KEY');
      expect(JSON.stringify(report)).not.toContain(futureCombinedMode);
    } finally {
      connection.close();
    }
  });
});
