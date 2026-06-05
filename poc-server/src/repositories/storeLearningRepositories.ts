import type { DbConnection } from '../db/connection.js';
import { createAnalysisEvidenceRepository } from './analysis_evidence.js';
import { createAnalysisRunsRepository } from './analysis_runs.js';
import { createAuditEventsRepository } from './audit_events.js';
import { createBlogPostsRepository } from './blog_posts.js';
import { createCollectionItemsRepository } from './collection_items.js';
import { createCollectionRunsRepository } from './collection_runs.js';
import { createContentGenerationsRepository } from './content_generations.js';
import { createLearningSnapshotsRepository } from './learning_snapshots.js';
import { createMarketingRulesetsRepository } from './marketing_rulesets.js';
import { createMediaAssetsRepository } from './media_assets.js';
import { createRulesetFieldsRepository } from './ruleset_fields.js';
import { createSeoScoresRepository } from './seo_scores.js';
import { createStoreChannelsRepository } from './store_channels.js';
import { createStoresRepository } from './stores.js';
import { createTrainingSettingsRepository } from './training_settings.js';

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
    marketingRulesets: createMarketingRulesetsRepository(connection),
    rulesetFields: createRulesetFieldsRepository(connection),
    contentGenerations: createContentGenerationsRepository(connection),
    blogPosts: createBlogPostsRepository(connection),
    mediaAssets: createMediaAssetsRepository(connection),
    seoScores: createSeoScoresRepository(connection),
    auditEvents: createAuditEventsRepository(connection)
  };
}
