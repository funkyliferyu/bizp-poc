import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabaseConnection, type DbConnection } from './db/connection.js';
import { migrateDatabase } from './db/migrate.js';
import { createStoreLearningRepositories } from './repositories/storeLearningRepositories.js';
import {
  extractBlogFormulaV2,
  extractBlogFormulaV2WithProvider
} from './storeLearning/blogFormulaV2/blogFormulaV2Service.js';
import { evaluateBlogFormulaV2Quality } from './storeLearning/blogFormulaV2/formulaQuality.js';
import {
  buildBlogFormulaV2ProviderComparison,
  type BlogFormulaV2ComparisonInputEntry,
  type BlogFormulaV2ProviderComparisonReport
} from './storeLearning/blogFormulaV2/providerComparison.js';
import { createOpenAIBlogFormulaV2Provider } from './storeLearning/blogFormulaV2/providers/openAIBlogFormulaProvider.js';
import type { OpenAIBlogFormulaParseClient } from './storeLearning/blogFormulaV2/providers/openAIBlogFormulaProvider.js';
import { createSafeMockBlogFormulaV2Provider } from './storeLearning/blogFormulaV2/providers/safeMockBlogFormulaProvider.js';
import { listOwnerBlogPostsForFormulaV2 } from './storeLearning/blogFormulaV2/sourcePosts.js';
import { parseStoredBlogFormulaV2 } from './storeLearning/blogFormulaV2/types.js';

export type BlogFormulaV2CompareOptions = {
  connection?: DbConnection;
  databaseFilename?: string;
  storeId?: string;
  /** Injected OpenAI parse client; null means "unavailable" and undefined means "resolve from env". */
  openAIClient?: OpenAIBlogFormulaParseClient | null;
  markdownOutPath?: string | null;
  closeConnection?: boolean;
};

export type BlogFormulaV2CompareReport = {
  storeId: string;
  ownerPostCount: number;
  comparison: BlogFormulaV2ProviderComparisonReport;
  markdownOutPath: string | null;
};

const defaultStoreId = process.env.BLOG_FORMULA_V2_STORE_ID ?? 'store_1020864025';
const defaultMarkdownOutPath =
  process.env.BLOG_FORMULA_V2_COMPARISON_OUT ?? '/tmp/blog-formula-v2-provider-comparison.md';

type OpenAIProviderResolution =
  | { available: false }
  | { available: true; provider: ReturnType<typeof createOpenAIBlogFormulaV2Provider> };

function resolveOpenAIProvider(options: BlogFormulaV2CompareOptions): OpenAIProviderResolution {
  if ('openAIClient' in options) {
    if (!options.openAIClient) return { available: false };
    return { available: true, provider: createOpenAIBlogFormulaV2Provider({ client: options.openAIClient }) };
  }
  if (!process.env.OPENAI_API_KEY) return { available: false };
  // No injected client: let the provider resolve the real server-side client itself.
  return { available: true, provider: createOpenAIBlogFormulaV2Provider() };
}

export async function runBlogFormulaV2ProviderComparison(
  options: BlogFormulaV2CompareOptions = {}
): Promise<BlogFormulaV2CompareReport> {
  const connection =
    options.connection ??
    createDatabaseConnection(options.databaseFilename ? { filename: options.databaseFilename } : undefined);
  const shouldClose = options.closeConnection ?? !options.connection;
  const storeId = options.storeId ?? defaultStoreId;

  try {
    migrateDatabase(connection);
    const repos = createStoreLearningRepositories(connection);

    const ownerPosts = listOwnerBlogPostsForFormulaV2(repos, storeId);
    if (ownerPosts.length === 0) {
      throw new Error(
        `Store has no owner_blog_post content for comparison: ${storeId}. ` +
          'This runner does not seed mock posts; point STORE_LEARNING_DB_PATH at a DB with real collected posts.'
      );
    }

    const entries: BlogFormulaV2ComparisonInputEntry[] = [];

    const deterministic = extractBlogFormulaV2(repos, storeId);
    entries.push({
      mode: 'deterministic',
      model: deterministic.formulaSet.model ?? 'deterministic-blog-formula-v2',
      formulaSetId: deterministic.formulaSet.id,
      formula: parseStoredBlogFormulaV2(deterministic.formulaSet.formula),
      qualityIssues: evaluateBlogFormulaV2Quality(parseStoredBlogFormulaV2(deterministic.formulaSet.formula))
    });

    const safeMock = await extractBlogFormulaV2WithProvider(repos, storeId, createSafeMockBlogFormulaV2Provider());
    entries.push({
      mode: 'safe_mock',
      model: safeMock.formulaSet.model ?? 'safe-mock-blog-formula-v2',
      formulaSetId: safeMock.formulaSet.id,
      formula: parseStoredBlogFormulaV2(safeMock.formulaSet.formula),
      qualityIssues: evaluateBlogFormulaV2Quality(parseStoredBlogFormulaV2(safeMock.formulaSet.formula))
    });

    const openAIResolution = resolveOpenAIProvider(options);
    if (!openAIResolution.available) {
      entries.push({ mode: 'openai', skipped: true, reason: 'OpenAI client is unavailable (no server-side key)' });
    } else {
      try {
        const openai = await extractBlogFormulaV2WithProvider(repos, storeId, openAIResolution.provider);
        entries.push({
          mode: 'openai',
          model: openai.formulaSet.model ?? 'openai',
          formulaSetId: openai.formulaSet.id,
          formula: parseStoredBlogFormulaV2(openai.formulaSet.formula),
          qualityIssues: evaluateBlogFormulaV2Quality(parseStoredBlogFormulaV2(openai.formulaSet.formula))
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown OpenAI extraction error';
        entries.push({ mode: 'openai', skipped: true, reason: `OpenAI extraction failed: ${message}` });
      }
    }

    const comparison = buildBlogFormulaV2ProviderComparison(entries);

    let markdownOutPath: string | null = null;
    if (options.markdownOutPath !== null) {
      markdownOutPath = options.markdownOutPath ?? defaultMarkdownOutPath;
      writeFileSync(markdownOutPath, comparison.markdown, 'utf8');
    }

    return {
      storeId,
      ownerPostCount: ownerPosts.length,
      comparison,
      markdownOutPath
    };
  } finally {
    if (shouldClose) connection.close();
  }
}

function isCliInvocation() {
  return process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
}

if (isCliInvocation()) {
  runBlogFormulaV2ProviderComparison()
    .then((report) => {
      console.log(
        JSON.stringify(
          {
            storeId: report.storeId,
            ownerPostCount: report.ownerPostCount,
            summary: report.comparison.summary,
            modes: report.comparison.modes.map((row) =>
              row.skipped
                ? { mode: row.mode, skipped: true, reason: row.reason }
                : {
                    mode: row.mode,
                    model: row.model,
                    formulaSetId: row.formulaSetId,
                    schemaVersion: row.schemaVersion,
                    qualityIssueCount: row.qualityIssueCount,
                    qualityIssueCodes: row.qualityIssueCodes
                  }
            ),
            markdownOutPath: report.markdownOutPath
          },
          null,
          2
        )
      );
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(message);
      process.exitCode = 1;
    });
}
