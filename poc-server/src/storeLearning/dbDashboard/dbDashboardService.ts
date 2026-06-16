import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DbConnection } from '../../db/connection.js';
import { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';

export type DbDashboardResetTarget =
  | 'all'
  | 'place'
  | 'blog'
  | 'ruleset_v1'
  | 'ruleset_v2'
  | 'rag_info'
  | 'rag_reviews'
  | 'generated_blog';

type CountRow = {
  count: number;
};

type DashboardRagManifest = {
  files: {
    info: { path: string };
    reviews: { path: string };
  };
};

const dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRagOutputRoot = path.resolve(dirname, '../../../data/rag-documents');

function safeFileName(value: string) {
  const cleaned = value
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .trim();
  return cleaned || 'store';
}

function ragStoreDir(outputRoot: string | undefined, storeId: string) {
  return path.join(outputRoot ?? defaultRagOutputRoot, safeFileName(storeId));
}

function readDashboardRagManifest(outputRoot: string | undefined, storeId: string): DashboardRagManifest | null {
  const storeDir = ragStoreDir(outputRoot, storeId);
  const filePath = path.join(storeDir, 'manifest.json');
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf8')) as DashboardRagManifest;
}

function count(connection: DbConnection, sql: string, ...params: Array<string | number>) {
  const row = connection.prepare(sql).get(...params) as CountRow | undefined;
  return Number(row?.count ?? 0);
}

function runDelete(connection: DbConnection, sql: string, ...params: Array<string | number>) {
  connection.prepare(sql).run(...params);
}

function deleteRagInfo(outputRoot: string | undefined, storeId: string) {
  const manifest = readDashboardRagManifest(outputRoot, storeId);
  if (manifest?.files.info.path) rmSync(manifest.files.info.path, { force: true });
}

function deleteRagReviews(outputRoot: string | undefined, storeId: string) {
  const manifest = readDashboardRagManifest(outputRoot, storeId);
  if (manifest?.files.reviews.path) rmSync(manifest.files.reviews.path, { force: true });
}

function deleteRagStoreDirectory(outputRoot: string | undefined, storeId: string) {
  const storeDir = ragStoreDir(outputRoot, storeId);
  if (storeDir) rmSync(storeDir, { recursive: true, force: true });
}

function ragPresence(outputRoot: string | undefined, storeId: string) {
  const manifest = readDashboardRagManifest(outputRoot, storeId);
  return {
    ragInfoExists: Boolean(manifest?.files.info.path && existsSync(manifest.files.info.path)),
    ragReviewsExists: Boolean(manifest?.files.reviews.path && existsSync(manifest.files.reviews.path))
  };
}

export function buildSqlDbDashboard(connection: DbConnection, options: { ragOutputRoot?: string } = {}) {
  const repos = createStoreLearningRepositories(connection);
  const stores = repos.stores.all().map((store) => ({
    storeId: store.id,
    storeName: store.name,
    learnedPlaceCount: count(
      connection,
      "SELECT COUNT(*) AS count FROM collection_items WHERE store_id = ? AND channel = 'place' AND status = 'collected'",
      store.id
    ),
    learnedBlogCount: count(
      connection,
      "SELECT COUNT(*) AS count FROM collection_items WHERE store_id = ? AND channel = 'blog' AND status = 'collected'",
      store.id
    ),
    rulesetV1Exists: count(connection, 'SELECT COUNT(*) AS count FROM marketing_rulesets WHERE store_id = ?', store.id) > 0,
    rulesetV2Exists: count(connection, 'SELECT COUNT(*) AS count FROM v2_blog_formula_sets WHERE store_id = ?', store.id) > 0,
    ...ragPresence(options.ragOutputRoot, store.id),
    generatedBlogPostCount: count(connection, 'SELECT COUNT(*) AS count FROM blog_posts WHERE store_id = ?', store.id)
  }));

  return {
    stores,
    generatedAt: new Date().toISOString()
  };
}

function resetPlace(connection: DbConnection, storeId: string) {
  runDelete(connection, "DELETE FROM collection_items WHERE store_id = ? AND channel = 'place'", storeId);
}

function resetRulesetV1(connection: DbConnection, storeId: string) {
  runDelete(
    connection,
    'UPDATE content_generations SET ruleset_id = NULL WHERE ruleset_id IN (SELECT id FROM marketing_rulesets WHERE store_id = ?)',
    storeId
  );
  runDelete(
    connection,
    'DELETE FROM ruleset_fields WHERE ruleset_id IN (SELECT id FROM marketing_rulesets WHERE store_id = ?)',
    storeId
  );
  runDelete(connection, 'DELETE FROM marketing_rulesets WHERE store_id = ?', storeId);
}

function resetBlogFormulaV2(connection: DbConnection, storeId: string) {
  runDelete(connection, 'DELETE FROM v2_blog_draft_validations WHERE store_id = ?', storeId);
  runDelete(connection, 'DELETE FROM v2_blog_draft_generations WHERE store_id = ?', storeId);
  runDelete(connection, 'DELETE FROM v2_blog_retrieved_samples WHERE store_id = ?', storeId);
  runDelete(connection, 'DELETE FROM v2_blog_retrieval_runs WHERE store_id = ?', storeId);
  runDelete(connection, 'DELETE FROM v2_blog_topic_brief_sets WHERE store_id = ?', storeId);
  runDelete(connection, 'DELETE FROM v2_blog_topic_briefs WHERE store_id = ?', storeId);
  runDelete(connection, 'DELETE FROM v2_blog_formula_source_posts WHERE store_id = ?', storeId);
  runDelete(connection, 'DELETE FROM v2_blog_formula_runs WHERE store_id = ?', storeId);
  runDelete(connection, 'DELETE FROM v2_blog_formula_sets WHERE store_id = ?', storeId);
}

function resetBlog(connection: DbConnection, storeId: string) {
  resetBlogFormulaV2(connection, storeId);
  runDelete(connection, "DELETE FROM collection_items WHERE store_id = ? AND channel = 'blog'", storeId);
}

function resetGeneratedBlog(connection: DbConnection, storeId: string) {
  runDelete(connection, 'DELETE FROM seo_scores WHERE blog_post_id IN (SELECT id FROM blog_posts WHERE store_id = ?)', storeId);
  runDelete(connection, 'DELETE FROM media_assets WHERE blog_post_id IN (SELECT id FROM blog_posts WHERE store_id = ?)', storeId);
  runDelete(connection, 'DELETE FROM blog_posts WHERE store_id = ?', storeId);
  runDelete(connection, "DELETE FROM content_generations WHERE store_id = ? AND content_type = 'blog_post'", storeId);
}

function resetAll(connection: DbConnection, storeId: string, ragOutputRoot?: string) {
  deleteRagStoreDirectory(ragOutputRoot, storeId);
  runDelete(connection, 'DELETE FROM audit_events WHERE store_id = ?', storeId);
  runDelete(connection, 'DELETE FROM llm_audit_logs WHERE store_id = ?', storeId);
  runDelete(connection, 'DELETE FROM stores WHERE id = ?', storeId);
}

export function resetSqlDbDashboardStore(
  connection: DbConnection,
  input: { storeId: string; target: DbDashboardResetTarget },
  options: { ragOutputRoot?: string } = {}
) {
  const repos = createStoreLearningRepositories(connection);
  const store = repos.stores.findById(input.storeId);
  if (!store) throw new Error(`Store not found: ${input.storeId}`);

  if (input.target === 'all') resetAll(connection, input.storeId, options.ragOutputRoot);
  if (input.target === 'place') resetPlace(connection, input.storeId);
  if (input.target === 'blog') resetBlog(connection, input.storeId);
  if (input.target === 'ruleset_v1') resetRulesetV1(connection, input.storeId);
  if (input.target === 'ruleset_v2') resetBlogFormulaV2(connection, input.storeId);
  if (input.target === 'rag_info') deleteRagInfo(options.ragOutputRoot, input.storeId);
  if (input.target === 'rag_reviews') deleteRagReviews(options.ragOutputRoot, input.storeId);
  if (input.target === 'generated_blog') resetGeneratedBlog(connection, input.storeId);

  return {
    storeId: input.storeId,
    target: input.target,
    storeRemoved: input.target === 'all',
    dashboard: buildSqlDbDashboard(connection, options)
  };
}
