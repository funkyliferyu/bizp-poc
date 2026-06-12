import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { createBlogFormulaV2Routes } from '../src/storeLearning/routes/blogFormulaV2.js';
import { BLOG_FORMULA_V2_STORE_ID, seedBlogFormulaV2Fixture } from './helpers/blogFormulaV2Fixtures.js';

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function countRows(connection: DbConnection, tableName: string) {
  return (connection.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get() as { count: number }).count;
}

describe('Blog Formula V2 API', () => {
  const futureCombinedMode = ['hybrid', 'v1', 'v2'].join('_');
  let connection: DbConnection;
  let server: ReturnType<express.Express['listen']>;
  let baseUrl: string;

  beforeEach(() => {
    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    seedBlogFormulaV2Fixture(connection);

    const app = express();
    app.use(express.json());
    app.use('/api/stores/:storeId/v2/blog-formula', createBlogFormulaV2Routes({ connection }));
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    });
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    connection.close();
  });

  it('returns independent V2 state without requiring a V1 marketing ruleset', async () => {
    const response = await fetch(`${baseUrl}/api/stores/${BLOG_FORMULA_V2_STORE_ID}/v2/blog-formula`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      lane: 'blog_formula_v2',
      independentFromV1: true,
      formulaSet: null,
      latestDraftGeneration: null,
      latestValidation: null
    });
    expect(body.status.sourceOwnerBlogPostCount).toBe(4);
    expect(countRows(connection, 'marketing_rulesets')).toBe(0);
    expect(countRows(connection, 'ruleset_fields')).toBe(0);
    expect(JSON.stringify(body)).not.toContain(futureCombinedMode);
  });

  it('extracts formula, retrieves Top 3 samples, generates a v2 draft, and validates it through separate V2 endpoints', async () => {
    const extractResponse = await fetch(`${baseUrl}/api/stores/${BLOG_FORMULA_V2_STORE_ID}/v2/blog-formula/extract`, {
      method: 'POST'
    });
    const extracted = await readJson(extractResponse);
    expect(extractResponse.status).toBe(200);
    expect(extracted.formulaSet).toMatchObject({
      status: 'generated',
      version: 'formula_v2.0',
      model: 'deterministic-blog-formula-v2'
    });
    expect(extracted.sourcePosts.every((post: { sourceKind: string }) => post.sourceKind === 'owner_blog_post')).toBe(
      true
    );

    const retrieveResponse = await fetch(
      `${baseUrl}/api/stores/${BLOG_FORMULA_V2_STORE_ID}/v2/blog-formula/retrieve-samples`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formulaSetId: extracted.formulaSet.id,
          topicBrief: {
            topic: '리팟레이저',
            mainKeyword: '리팟레이저 부작용',
            secondaryKeywords: ['흑자 제거', '색소침착'],
            targetReader: '흑자 제거를 고민하지만 부작용, 재발, 착색이 걱정되는 고객',
            coreConcern: '부작용과 재발 우려',
            mainAngle: '원리와 의료진 상담 기준을 먼저 설명',
            mustInclude: ['개인차', '의료진 상담', '부작용 가능성'],
            mustAvoid: ['효과보장', '부작용 없음'],
            ctaDirection: '상담 예약'
          },
          maxSamples: 3
        })
      }
    );
    const retrieved = await readJson(retrieveResponse);
    expect(retrieveResponse.status).toBe(200);
    expect(retrieved.samples).toHaveLength(3);
    expect(retrieved.samples.every((sample: { sourceKind: string }) => sample.sourceKind === 'owner_blog_post')).toBe(
      true
    );

    const generateResponse = await fetch(
      `${baseUrl}/api/stores/${BLOG_FORMULA_V2_STORE_ID}/v2/blog-formula/generate-draft`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formulaSetId: extracted.formulaSet.id,
          topicBriefId: retrieved.topicBrief.id,
          retrievalRunId: retrieved.retrievalRun.id
        })
      }
    );
    const generated = await readJson(generateResponse);
    expect(generateResponse.status).toBe(200);
    expect(generated.draftGeneration).toMatchObject({
      generationMode: 'v2_formula',
      status: 'generated'
    });
    expect(generated.output.blogDraft).toContain('의료진 상담');
    expect(JSON.stringify(generated)).not.toContain(futureCombinedMode);

    const validateResponse = await fetch(
      `${baseUrl}/api/stores/${BLOG_FORMULA_V2_STORE_ID}/v2/blog-formula/validate-draft`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftGenerationId: generated.draftGeneration.id })
      }
    );
    const validated = await readJson(validateResponse);
    expect(validateResponse.status).toBe(200);
    expect(validated.validation).toMatchObject({
      status: expect.stringMatching(/pass|needs_human_review/),
      riskLevel: expect.stringMatching(/low|medium/)
    });

    const repos = createStoreLearningRepositories(connection);
    expect(repos.v2BlogFormulaSets.findById(extracted.formulaSet.id)).not.toBeNull();
    expect(repos.v2BlogDraftGenerations.findById(generated.draftGeneration.id)?.generationMode).toBe('v2_formula');
    expect(repos.v2BlogDraftValidations.listByDraftGenerationId(generated.draftGeneration.id)).toHaveLength(1);
    expect(countRows(connection, 'marketing_rulesets')).toBe(0);
    expect(countRows(connection, 'ruleset_fields')).toBe(0);
  });
});
