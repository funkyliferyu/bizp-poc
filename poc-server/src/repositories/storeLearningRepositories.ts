import type { DbConnection } from '../db/connection.js';
import { createAnalysisEvidenceRepository } from './analysis_evidence.js';
import { createAnalysisRunsRepository } from './analysis_runs.js';
import { createAuditEventsRepository } from './audit_events.js';
import { createBlogPostsRepository } from './blog_posts.js';
import { createCollectionItemsRepository } from './collection_items.js';
import { createCollectionRunsRepository } from './collection_runs.js';
import { createContentGenerationsRepository } from './content_generations.js';
import { createLearningSnapshotsRepository } from './learning_snapshots.js';
import { createLlmAuditLogsRepository } from './llm_audit_logs.js';
import { createMarketingRulesetsRepository } from './marketing_rulesets.js';
import { createMediaAssetsRepository } from './media_assets.js';
import { createRulesetFieldsRepository } from './ruleset_fields.js';
import { createSeoScoresRepository } from './seo_scores.js';
import { createStoreChannelsRepository } from './store_channels.js';
import { createStoresRepository } from './stores.js';
import { createTrainingSettingsRepository } from './training_settings.js';
import {
  createV2BlogDraftGenerationsRepository,
  createV2BlogDraftValidationsRepository,
  createV2BlogFormulaRunsRepository,
  createV2BlogFormulaSetsRepository,
  createV2BlogFormulaSourcePostsRepository,
  createV2BlogRetrievedSamplesRepository,
  createV2BlogRetrievalRunsRepository,
  createV2BlogTopicBriefsRepository
} from './v2_blog_formula.js';

export function createStoreLearningRepositories(connection: DbConnection) {
  return {
    stores: createStoresRepository(connection),
    storeChannels: createStoreChannelsRepository(connection),
    trainingSettings: createTrainingSettingsRepository(connection),
    collectionRuns: createCollectionRunsRepository(connection),
    collectionItems: createCollectionItemsRepository(connection),
    analysisRuns: createAnalysisRunsRepository(connection),
    analysisEvidence: createAnalysisEvidenceRepository(connection),
    learningSnapshots: createLearningSnapshotsRepository(connection),
    llmAuditLogs: createLlmAuditLogsRepository(connection),
    marketingRulesets: createMarketingRulesetsRepository(connection),
    rulesetFields: createRulesetFieldsRepository(connection),
    contentGenerations: createContentGenerationsRepository(connection),
    blogPosts: createBlogPostsRepository(connection),
    v2BlogFormulaSets: createV2BlogFormulaSetsRepository(connection),
    v2BlogFormulaRuns: createV2BlogFormulaRunsRepository(connection),
    v2BlogFormulaSourcePosts: createV2BlogFormulaSourcePostsRepository(connection),
    v2BlogTopicBriefs: createV2BlogTopicBriefsRepository(connection),
    v2BlogRetrievalRuns: createV2BlogRetrievalRunsRepository(connection),
    v2BlogRetrievedSamples: createV2BlogRetrievedSamplesRepository(connection),
    v2BlogDraftGenerations: createV2BlogDraftGenerationsRepository(connection),
    v2BlogDraftValidations: createV2BlogDraftValidationsRepository(connection),
    mediaAssets: createMediaAssetsRepository(connection),
    seoScores: createSeoScoresRepository(connection),
    auditEvents: createAuditEventsRepository(connection)
  };
}
