import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import { probeOpenAIRuntime } from '../src/ai/runtimeHealth.js';
import { createDatabaseConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { seedDemoStore } from '../src/seedStoreLearning.js';
import { startAnalysisRun } from '../src/storeLearning/analysis/analysisExecutionService.js';
import { createOpenAIAnalysisProvider } from '../src/storeLearning/analysis/openAIAnalysisProvider.js';
import { generateApprovalPendingBlogPost, rescoreBlogPostSeo } from '../src/storeLearning/blog/blogGenerator.js';
import { createOpenAIBlogProvider } from '../src/storeLearning/blog/openAIBlogProvider.js';

const runLive = process.env.RUN_OPENAI_INTEGRATION === '1';
const describeLive = runLive ? describe : describe.skip;

describeLive('live OpenAI integration', () => {
  it(
    'verifies OpenAI runtime model access without exposing secrets',
    async () => {
      const result = await probeOpenAIRuntime();

      expect(result.ok).toBe(true);
      expect(result.mode).toBe('openai');
      expect(result.openaiConfigured).toBe(true);
      expect(JSON.stringify(result)).not.toContain(process.env.OPENAI_API_KEY ?? 'sk-');
    },
    30_000
  );

  it(
    'runs OpenAI analysis and persists validated artifacts',
    async () => {
      const connection = createDatabaseConnection({ filename: ':memory:' });
      try {
        migrateDatabase(connection);
        const seed = seedDemoStore(connection);
        const repos = createStoreLearningRepositories(connection);
        const analysisRunId = 'analysis_run_live_openai_validation';
        repos.analysisRuns.create({
          id: analysisRunId,
          storeId: seed.storeId,
          collectionRunId: seed.collectionRunId,
          status: 'queued',
          startedAt: null,
          completedAt: null,
          result: {
            selectedItemIds: [
              'collection_item_demo_blog',
              'collection_item_demo_place_profile',
              'collection_item_demo_place_review'
            ]
          },
          error: null
        });

        const artifacts = await startAnalysisRun(
          repos,
          analysisRunId,
          createOpenAIAnalysisProvider({ model: process.env.OPENAI_MODEL })
        );
        const run = repos.analysisRuns.findById(analysisRunId);

        expect(run?.status).toBe('completed');
        expect(run?.result).toEqual(
          expect.objectContaining({
            analyzerMode: 'openai',
            analyzerProvider: 'openAIAnalysisProvider'
          })
        );
        expect(artifacts?.learningSnapshot?.status).toBe('active');
        expect(artifacts?.marketingRuleset?.status).toBe('draft');
        expect(artifacts?.rulesetFields.length).toBeGreaterThanOrEqual(2);
        expect(artifacts?.analysisEvidence.length).toBeGreaterThanOrEqual(1);
      } finally {
        connection.close();
      }
    },
    120_000
  );

  it(
    'generates and scores a blog post through OpenAI with Zod-validated output',
    async () => {
      const connection = createDatabaseConnection({ filename: ':memory:' });
      try {
        migrateDatabase(connection);
        const seed = seedDemoStore(connection);
        const repos = createStoreLearningRepositories(connection);
        const provider = createOpenAIBlogProvider({ model: process.env.OPENAI_MODEL });
        const generated = await generateApprovalPendingBlogPost(repos, seed.storeId, provider);
        const rescored = await rescoreBlogPostSeo(repos, generated.blogPost?.id ?? '', provider);
        const article = generated.blogPost?.article ?? {};

        expect(generated.blogPost?.status).toBe('pending_approval');
        expect(generated.contentGeneration.prompt).toEqual(
          expect.objectContaining({
            mode: 'openai',
            provider: 'openAIBlogProvider'
          })
        );
        expect(Array.isArray(article.bodySections) ? article.bodySections.length : 0).toBeGreaterThanOrEqual(3);
        expect(Array.isArray(article.seoKeywords) ? article.seoKeywords.length : 0).toBeGreaterThanOrEqual(1);
        expect(rescored?.seoScore.totalScore).toBeGreaterThanOrEqual(0);
        expect(Object.keys(rescored?.seoScore.rubric ?? {})).toEqual([
          'titleKeyword',
          'bodyKeyword',
          'metaDescription',
          'readability',
          'imageAltPrompt',
          'cta'
        ]);
      } finally {
        connection.close();
      }
    },
    120_000
  );
});
