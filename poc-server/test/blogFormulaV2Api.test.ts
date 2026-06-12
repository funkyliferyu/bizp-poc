import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { createBlogFormulaV2Routes } from '../src/storeLearning/routes/blogFormulaV2.js';
import { BlogFormulaSetV2Schema } from '../src/storeLearning/blogFormulaV2/types.js';
import { generationReadyFormulaFixture } from './fixtures/blogFormulaV2Fixtures.js';
import { BLOG_FORMULA_V2_STORE_ID, seedBlogFormulaV2Fixture } from './helpers/blogFormulaV2Fixtures.js';

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function countRows(connection: DbConnection, tableName: string) {
  return (connection.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get() as { count: number }).count;
}

function formulaOutput(sourcePostIds = [
  'collection_item_v2_owner_1',
  'collection_item_v2_owner_2',
  'collection_item_v2_owner_3',
  'collection_item_v2_owner_4'
]) {
  const evidence = { sourcePostIds, confidence: 0.84, status: 'confirmed' as const };

  return BlogFormulaSetV2Schema.parse({
    ...generationReadyFormulaFixture,
    titleFormula: generationReadyFormulaFixture.titleFormula.map((title) => ({ ...title, ...evidence })),
    introFormula: { ...generationReadyFormulaFixture.introFormula, ...evidence },
    bodyFormula: { ...generationReadyFormulaFixture.bodyFormula, ...evidence },
    headingFormula: { ...generationReadyFormulaFixture.headingFormula, ...evidence },
    toneAndMannerFormula: { ...generationReadyFormulaFixture.toneAndMannerFormula, ...evidence },
    ctaFormula: { ...generationReadyFormulaFixture.ctaFormula, ...evidence },
    footerFormula: { ...generationReadyFormulaFixture.footerFormula, ...evidence },
    medicalSafetyFormula: { ...generationReadyFormulaFixture.medicalSafetyFormula, ...evidence }
  });
}

describe('Blog Formula V2 API', () => {
  const futureCombinedMode = ['hybrid', 'v1', 'v2'].join('_');
  let connection: DbConnection;
  let server: ReturnType<express.Express['listen']>;
  let baseUrl: string;

  function startServer(routeOptions: Record<string, unknown> = {}) {
    const app = express();
    app.use(express.json());
    app.use('/api/stores/:storeId/v2/blog-formula', createBlogFormulaV2Routes({ connection, ...routeOptions }));
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    });
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  async function restartServer(routeOptions: Record<string, unknown>) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    startServer(routeOptions);
  }

  beforeEach(() => {
    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    seedBlogFormulaV2Fixture(connection);
    startServer();
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
      version: 'formula_v2.1',
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

  it('keeps missing providerMode on the deterministic extraction path', async () => {
    const response = await fetch(`${baseUrl}/api/stores/${BLOG_FORMULA_V2_STORE_ID}/v2/blog-formula/extract`, {
      method: 'POST'
    });
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.formulaSet).toMatchObject({
      model: 'deterministic-blog-formula-v2'
    });
    expect(body.provider).toBeUndefined();
    expect(countRows(connection, 'llm_audit_logs')).toBe(0);
  });

  it('extracts through providerMode=safe_mock without external calls or LLM audit rows', async () => {
    const response = await fetch(`${baseUrl}/api/stores/${BLOG_FORMULA_V2_STORE_ID}/v2/blog-formula/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerMode: 'safe_mock' })
    });
    const body = await readJson(response);
    const repos = createStoreLearningRepositories(connection);
    const run = repos.v2BlogFormulaRuns.findById(body.run.id);

    expect(response.status).toBe(200);
    expect(body.formulaSet).toMatchObject({
      model: 'safe-mock-blog-formula-v2'
    });
    expect(body.provider).toMatchObject({
      mode: 'safe_mock',
      noExternalCalls: true
    });
    expect(run?.input).toMatchObject({
      provider: expect.objectContaining({
        mode: 'safe_mock'
      })
    });
    expect(countRows(connection, 'llm_audit_logs')).toBe(0);
    expect(countRows(connection, 'marketing_rulesets')).toBe(0);
    expect(countRows(connection, 'ruleset_fields')).toBe(0);
  });

  it('extracts through providerMode=openai using the server-side OpenAI provider and records SL-F1 audit', async () => {
    let parseCallCount = 0;
    await restartServer({
      providerFactoryOptions: {
        env: { OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'gpt-test-formula' },
        openAIClient: {
          beta: {
            chat: {
              completions: {
                parse: async () => {
                  parseCallCount += 1;
                  return { choices: [{ message: { parsed: formulaOutput() } }] };
                }
              }
            }
          }
        }
      }
    });

    const response = await fetch(`${baseUrl}/api/stores/${BLOG_FORMULA_V2_STORE_ID}/v2/blog-formula/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerMode: 'openai' })
    });
    const body = await readJson(response);
    const repos = createStoreLearningRepositories(connection);
    const auditRows = repos.llmAuditLogs.latest();

    expect(response.status).toBe(200);
    expect(parseCallCount).toBe(1);
    expect(body.formulaSet).toMatchObject({
      model: 'gpt-test-formula'
    });
    expect(body.provider).toMatchObject({
      name: 'openAIBlogFormulaV2Provider',
      mode: 'openai',
      callId: 'SL-F1',
      noExternalCalls: false
    });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      storeId: BLOG_FORMULA_V2_STORE_ID,
      relatedEntityType: 'v2_blog_formula_run',
      relatedEntityId: body.run.id,
      action: 'blog_formula_v2_extract',
      status: 'completed',
      model: 'gpt-test-formula'
    });
    expect(auditRows[0].promptInputJson).toMatchObject({
      schemaVersion: 'blog_formula_v2_extraction_input.v2'
    });
    expect(auditRows[0].rawRequestedJson).toEqual(expect.any(Object));
    expect(auditRows[0].rawParsedOutputJson).toEqual(formulaOutput());
    expect(auditRows[0].normalizedOutputJson).toEqual(formulaOutput());
  });

  it('uses safe_mock for providerMode=auto when no OpenAI key is configured', async () => {
    await restartServer({
      providerFactoryOptions: {
        env: {}
      }
    });

    const response = await fetch(`${baseUrl}/api/stores/${BLOG_FORMULA_V2_STORE_ID}/v2/blog-formula/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerMode: 'auto' })
    });
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.provider).toMatchObject({
      mode: 'safe_mock',
      noExternalCalls: true
    });
    expect(body.formulaSet).toMatchObject({
      model: 'safe-mock-blog-formula-v2'
    });
    expect(countRows(connection, 'llm_audit_logs')).toBe(0);
  });

  it('uses OpenAI for providerMode=auto when a server-side OpenAI key is configured', async () => {
    let parseCallCount = 0;
    await restartServer({
      providerFactoryOptions: {
        env: { OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'gpt-test-formula' },
        openAIClient: {
          beta: {
            chat: {
              completions: {
                parse: async () => {
                  parseCallCount += 1;
                  return { choices: [{ message: { parsed: formulaOutput() } }] };
                }
              }
            }
          }
        }
      }
    });

    const response = await fetch(`${baseUrl}/api/stores/${BLOG_FORMULA_V2_STORE_ID}/v2/blog-formula/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerMode: 'auto' })
    });
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(parseCallCount).toBe(1);
    expect(body.provider).toMatchObject({
      mode: 'openai',
      model: 'gpt-test-formula'
    });
    expect(countRows(connection, 'llm_audit_logs')).toBe(1);
  });

  it('rejects invalid OpenAI formula output without creating a formula set', async () => {
    await restartServer({
      providerFactoryOptions: {
        env: { OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'gpt-test-formula' },
        openAIClient: {
          beta: {
            chat: {
              completions: {
                parse: async () => ({ choices: [{ message: { parsed: { schemaVersion: 'wrong' } } }] })
              }
            }
          }
        }
      }
    });

    const response = await fetch(`${baseUrl}/api/stores/${BLOG_FORMULA_V2_STORE_ID}/v2/blog-formula/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerMode: 'openai' })
    });
    const body = await readJson(response);
    const repos = createStoreLearningRepositories(connection);
    const failedRun = repos.v2BlogFormulaRuns.listByStoreId(BLOG_FORMULA_V2_STORE_ID).at(-1);
    const auditRow = repos.llmAuditLogs.latest()[0];

    expect(response.status).toBe(400);
    expect(body.error).toContain('schemaVersion');
    expect(repos.v2BlogFormulaSets.listByStoreId(BLOG_FORMULA_V2_STORE_ID)).toHaveLength(0);
    expect(failedRun).toMatchObject({
      formulaSetId: null,
      status: 'failed',
      model: 'gpt-test-formula'
    });
    expect(auditRow).toMatchObject({
      relatedEntityType: 'v2_blog_formula_run',
      relatedEntityId: failedRun?.id,
      action: 'blog_formula_v2_extract',
      status: 'failed'
    });
    expect(auditRow.rawParsedOutputJson).toEqual({ schemaVersion: 'wrong' });
    expect(auditRow.normalizedOutputJson).toBeNull();
  });

  it('fails explicit providerMode=openai without mock fallback and does not create a formula set', async () => {
    await restartServer({
      providerFactoryOptions: {
        env: {}
      }
    });

    const response = await fetch(`${baseUrl}/api/stores/${BLOG_FORMULA_V2_STORE_ID}/v2/blog-formula/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerMode: 'openai' })
    });
    const body = await readJson(response);
    const repos = createStoreLearningRepositories(connection);
    const runs = repos.v2BlogFormulaRuns.listByStoreId(BLOG_FORMULA_V2_STORE_ID);
    const failedRun = runs.at(-1);

    expect(response.status).toBe(400);
    expect(body.error).toContain('OpenAI client is unavailable');
    expect(repos.v2BlogFormulaSets.listByStoreId(BLOG_FORMULA_V2_STORE_ID)).toHaveLength(0);
    expect(failedRun).toMatchObject({
      formulaSetId: null,
      status: 'failed'
    });
    expect(failedRun?.validation).toMatchObject({
      status: 'failed',
      provider: expect.objectContaining({
        mode: 'openai'
      })
    });
    expect(repos.llmAuditLogs.latest()[0]).toMatchObject({
      relatedEntityType: 'v2_blog_formula_run',
      relatedEntityId: failedRun?.id,
      action: 'blog_formula_v2_extract',
      status: 'failed'
    });
  });
});
