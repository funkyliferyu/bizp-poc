import type { JsonValue } from '../../repositories/base.js';
import type { CollectionItem } from '../../repositories/collection_items.js';
import type { CollectionRun } from '../../repositories/collection_runs.js';
import type { RulesetField } from '../../repositories/ruleset_fields.js';
import type { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import {
  INSUFFICIENT_NEW_EVIDENCE_MESSAGE,
  REQUIRED_NEW_BLOG_POST_COUNT,
  REQUIRED_NEW_PLACE_REVIEW_COUNT,
  collectionHasMeaningfulChanges,
  hasSufficientNewEvidence,
  newEvidenceCounts
} from '../analysis/analysisDecision.js';
import { getLatestAnalysisArtifacts } from '../analysis/analysisExecutionService.js';
import { collectionItemIdentity } from '../collection/collectionItemIdentity.js';
import {
  placeMetadataForStatus,
  presentBlogItem,
  presentPlaceNews,
  presentPlacePhotos,
  presentPlaceProfile,
  presentPlaceReview
} from './learningStatusPresenters.js';
import { createRulesetEvidenceClassifier } from './rulesetEvidenceState.js';

type Repositories = ReturnType<typeof createStoreLearningRepositories>;

function asRecord(value: JsonValue | unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function splitCsv(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function latestByUpdatedAt<T extends { updatedAt: string }>(records: T[]) {
  return records.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1) ?? null;
}

function collectedItems(repos: Repositories, storeId: string) {
  const seenKeys = new Set<string>();
  return repos.collectionItems
    .listByStoreId(storeId)
    .filter((item) => item.status === 'collected')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((item) => {
      const key = collectionItemIdentity(item);
      if (!key) return true;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
}

function itemSummary(item: CollectionItem) {
  const text = item.bodyText?.trim();
  return {
    id: item.id,
    channel: item.channel,
    sourceType: item.sourceType,
    title: item.title,
    sourceUrl: item.sourceUrl,
    collectedAt: item.createdAt,
    selectedForAnalysis: item.selectedForAnalysis === 1,
    summary: text ? (text.length > 120 ? `${text.slice(0, 120)}...` : text) : null
  };
}

function selectedCount(items: CollectionItem[]) {
  return items.filter((item) => item.selectedForAnalysis === 1).length;
}

function fieldValue(fields: RulesetField[], key: string) {
  return fields.find((field) => field.fieldKey === key)?.finalValue ?? fields.find((field) => field.fieldKey === key)?.fieldValue;
}

function rulesetStatusLabel(status: string | null | undefined) {
  if (!status) return '미생성';
  if (status === 'draft') return '생성 완료';
  if (status === 'active') return '활성';
  return status;
}

function latestAnalysisRun(repos: Repositories, storeId: string) {
  return latestByUpdatedAt(repos.analysisRuns.listByStoreId(storeId));
}

function latestCollectionRun(repos: Repositories, storeId: string) {
  return latestByUpdatedAt(repos.collectionRuns.listByStoreId(storeId));
}

function channelStatus(collectedCount: number, analysisStatus: string | null, connected = true) {
  if (!connected) return 'not_connected';
  if (analysisStatus === 'completed' || analysisStatus === 'succeeded') return collectedCount > 0 ? 'analyzed' : 'empty';
  return collectedCount > 0 ? 'collected' : 'empty';
}

function latestArtifacts(repos: Repositories, storeId: string) {
  return getLatestAnalysisArtifacts(repos, storeId);
}

function latestMarketingRuleset(repos: Repositories, storeId: string) {
  return repos.marketingRulesets
    .listByStoreId(storeId)
    .sort((a, b) => {
      if (a.version !== b.version) return a.version - b.version;
      return a.updatedAt.localeCompare(b.updatedAt);
    })
    .at(-1) ?? null;
}

function hasPreviousLearningArtifacts(repos: Repositories, storeId: string) {
  const artifacts = latestArtifacts(repos, storeId);
  return Boolean(artifacts?.analysisRun && artifacts.learningSnapshot && artifacts.marketingRuleset);
}

function relearnCountsForRun(repos: Repositories, collectionRun: CollectionRun | null) {
  if (!collectionRun) {
    return {
      blogPosts: 0,
      placeReviews: 0,
      requiredBlogPosts: REQUIRED_NEW_BLOG_POST_COUNT,
      requiredPlaceReviews: REQUIRED_NEW_PLACE_REVIEW_COUNT
    };
  }
  const classifier = createRulesetEvidenceClassifier(repos, collectionRun.storeId);
  return newEvidenceCounts(repos.collectionItems.listByRunId(collectionRun.id).map((item) => classifier.withState(item)));
}

export function buildRelearnEligibility(repos: Repositories, storeId: string, collectionRun?: CollectionRun | null) {
  const latestRun = collectionRun === undefined ? latestCollectionRun(repos, storeId) : collectionRun;
  const counts = relearnCountsForRun(repos, latestRun);
  const hasPreviousLearning = hasPreviousLearningArtifacts(repos, storeId);
  const requiresNewEvidence = hasPreviousLearning && collectionHasMeaningfulChanges(latestRun?.summary) === true;
  const allowed = !requiresNewEvidence || hasSufficientNewEvidence(counts);

  return {
    allowed,
    reason: allowed
      ? requiresNewEvidence
        ? 'sufficient_new_evidence_for_ruleset_regeneration'
        : 'new_evidence_threshold_not_required'
      : 'insufficient_new_evidence_for_ruleset_regeneration',
    message: allowed ? null : INSUFFICIENT_NEW_EVIDENCE_MESSAGE,
    hasPreviousLearning,
    requiresNewEvidence,
    requiredNewBlogPostCount: counts.requiredBlogPosts,
    requiredNewPlaceReviewCount: counts.requiredPlaceReviews,
    newBlogPostCount: counts.blogPosts,
    newPlaceReviewCount: counts.placeReviews,
    latestCollectionRunId: latestRun?.id ?? null
  };
}

function snapshotPayload(repos: Repositories, storeId: string) {
  const artifacts = latestArtifacts(repos, storeId);
  const snapshot = artifacts?.learningSnapshot;
  return snapshot
    ? {
        id: snapshot.id,
        status: snapshot.status,
        data: snapshot.snapshot
      }
    : null;
}

function rulesetPayload(repos: Repositories, storeId: string) {
  const artifacts = latestArtifacts(repos, storeId);
  const ruleset = latestMarketingRuleset(repos, storeId) ?? artifacts?.marketingRuleset;
  if (!ruleset) return null;
  return {
    id: ruleset.id,
    status: ruleset.status,
    statusLabel: rulesetStatusLabel(ruleset.status),
    version: ruleset.version,
    updatedAt: ruleset.updatedAt
  };
}

function analysisPayload(repos: Repositories, storeId: string) {
  const artifacts = latestArtifacts(repos, storeId);
  const run = artifacts?.analysisRun;
  if (!run) return null;
  const result = asRecord(run.result);
  const error = asRecord(run.error);
  return {
    id: run.id,
    status: run.status,
    completedAt: run.completedAt,
    updatedAt: run.updatedAt,
    provenance: {
      provider: asString(result.analyzerProvider) ?? asString(error.analyzerProvider),
      mode: asString(result.analyzerMode) ?? asString(error.analyzerMode),
      model: asString(result.analyzerModel) ?? asString(error.analyzerModel),
      selectedItemCount: asNumber(result.selectedItemCount) ?? asNumber(error.selectedItemCount),
      promptItemCount: asNumber(result.promptItemCount) ?? asNumber(error.promptItemCount),
      omittedItemCount: asNumber(result.omittedItemCount) ?? asNumber(error.omittedItemCount),
      blogItemLimit: asNumber(result.blogItemLimit) ?? asNumber(error.blogItemLimit),
      selectedBlogItemCount: asNumber(result.selectedBlogItemCount) ?? asNumber(error.selectedBlogItemCount),
      promptBlogItemCount: asNumber(result.promptBlogItemCount) ?? asNumber(error.promptBlogItemCount),
      omittedBlogItemCount: asNumber(result.omittedBlogItemCount) ?? asNumber(error.omittedBlogItemCount),
      reviewItemLimit: asNumber(result.reviewItemLimit) ?? asNumber(error.reviewItemLimit),
      selectedReviewItemCount: asNumber(result.selectedReviewItemCount) ?? asNumber(error.selectedReviewItemCount),
      promptReviewItemCount: asNumber(result.promptReviewItemCount) ?? asNumber(error.promptReviewItemCount),
      omittedReviewItemCount: asNumber(result.omittedReviewItemCount) ?? asNumber(error.omittedReviewItemCount),
      promptBudgetReason: asString(result.promptBudgetReason) ?? asString(error.promptBudgetReason)
    }
  };
}

function completionStatusMessage(status: string) {
  if (status === 'completed') {
    return '블로그 수집, 플레이스 정보 최신화, AI 분석, 마케팅 전략 룰셋 생성이 완료되었습니다.';
  }
  if (status === 'needs_collection') {
    return '학습 완료를 위해 블로그 수집과 플레이스 기본 정보 수집이 먼저 필요합니다.';
  }
  if (status === 'needs_analysis') {
    return '수집 데이터가 준비되었습니다. AI 분석을 실행하면 마케팅 전략 룰셋을 생성할 수 있습니다.';
  }
  if (status === 'needs_ruleset') {
    return 'AI 분석은 완료되었지만 마케팅 전략 룰셋 결과가 아직 생성되지 않았습니다.';
  }
  if (status === 'analysis_failed') {
    return '수집 데이터는 있으나 AI 분석이 실패했습니다. 분석만 다시 실행할 수 있습니다.';
  }
  return '학습이 진행 중입니다. 수집과 분석 결과가 준비되면 완료 상태로 전환됩니다.';
}

function completionStatusLabel(status: string) {
  if (status === 'completed') return '학습 완료';
  if (status === 'analysis_failed') return '분석 실패';
  if (status === 'needs_collection') return '수집 필요';
  if (status === 'needs_analysis') return '분석 필요';
  if (status === 'needs_ruleset') return '룰셋 생성 필요';
  return '학습 진행 중';
}

function criterionStatus(done: boolean, failed = false) {
  if (done) return 'complete';
  if (failed) return 'failed';
  return 'waiting';
}

function completionPayload(repos: Repositories, storeId: string, items: CollectionItem[]) {
  const artifacts = latestArtifacts(repos, storeId);
  const run = artifacts?.analysisRun ?? latestAnalysisRun(repos, storeId);
  const ruleset = latestMarketingRuleset(repos, storeId) ?? artifacts?.marketingRuleset ?? null;
  const rulesetFields = ruleset ? repos.rulesetFields.listByRulesetId(ruleset.id) : artifacts?.rulesetFields ?? [];
  const blogItems = items.filter((item) => item.channel === 'blog' && item.sourceType === 'post');
  const placeProfiles = items.filter((item) => item.channel === 'place' && item.sourceType === 'profile');
  const latestPlaceProfile = latestByUpdatedAt([...placeProfiles]);
  const analysisComplete = Boolean(
    artifacts?.analysisRun && ['completed', 'succeeded'].includes(artifacts.analysisRun.status)
  );
  const analysisFailed = run?.status === 'failed' && !analysisComplete;
  const rulesetComplete = Boolean(ruleset && rulesetFields.length > 0);
  const blogComplete = blogItems.length > 0;
  const placeComplete = placeProfiles.length > 0;

  let status = 'in_progress';
  if (blogComplete && placeComplete && analysisComplete && rulesetComplete) {
    status = 'completed';
  } else if (analysisFailed) {
    status = 'analysis_failed';
  } else if (!blogComplete || !placeComplete) {
    status = 'needs_collection';
  } else if (!analysisComplete) {
    status = 'needs_analysis';
  } else if (!rulesetComplete) {
    status = 'needs_ruleset';
  }

  return {
    status,
    label: completionStatusLabel(status),
    message: completionStatusMessage(status),
    completedAt: status === 'completed' ? (artifacts?.analysisRun.completedAt ?? artifacts?.analysisRun.updatedAt ?? null) : null,
    criteria: {
      blogCollection: {
        status: criterionStatus(blogComplete),
        label: '블로그 수집',
        collectedCount: blogItems.length,
        selectedCount: selectedCount(blogItems)
      },
      placeProfile: {
        status: criterionStatus(placeComplete),
        label: '플레이스 정보 최신화',
        collectedCount: placeProfiles.length,
        latestItemId: latestPlaceProfile?.id ?? null
      },
      aiAnalysis: {
        status: criterionStatus(analysisComplete, analysisFailed),
        label: 'AI 분석',
        analysisRunId: run?.id ?? null,
        completedAt: analysisComplete ? (artifacts?.analysisRun.completedAt ?? artifacts?.analysisRun.updatedAt ?? null) : null
      },
      marketingRuleset: {
        status: criterionStatus(rulesetComplete),
        label: '마케팅 전략 룰셋',
        rulesetId: ruleset?.id ?? null,
        version: ruleset?.version ?? null
      }
    }
  };
}

function learningContext(repos: Repositories, storeId: string) {
  const artifacts = latestArtifacts(repos, storeId);
  const fields = artifacts?.rulesetFields ?? [];
  const snapshot = asRecord(artifacts?.learningSnapshot?.snapshot);
  const analysisResult = asRecord(artifacts?.analysisRun.result);

  return {
    artifacts,
    fields,
    snapshot,
    analysisResult
  };
}

export function buildLearningStatus(repos: Repositories, storeId: string) {
  const store = repos.stores.findById(storeId);
  if (!store) return null;

  const items = collectedItems(repos, store.id);
  const blogItems = items.filter((item) => item.channel === 'blog');
  const placeItems = items.filter((item) => item.channel === 'place');
  const instagramItems = items.filter((item) => item.channel === 'instagram');
  const instagramChannel = repos.storeChannels
    .listByStoreId(store.id)
    .find((channel) => channel.channel === 'instagram');
  const analysis = analysisPayload(repos, store.id);
  const ruleset = rulesetPayload(repos, store.id);
  const snapshot = snapshotPayload(repos, store.id);
  const instagramConnected = Boolean(instagramChannel?.sourceUrl) && instagramChannel?.status !== 'mock_only';

  return {
    storeId: store.id,
    storeName: store.name,
    lastAnalyzedAt: analysis?.completedAt ?? analysis?.updatedAt ?? null,
    nextCollectionAt: null,
    collectionCycle: '수동 실행',
    analysis,
    snapshot,
    ruleset,
    relearnEligibility: buildRelearnEligibility(repos, store.id),
    completion: completionPayload(repos, store.id, items),
    channels: {
      blog: {
        status: channelStatus(blogItems.length, analysis?.status ?? null),
        collectedCount: blogItems.length,
        selectedCount: selectedCount(blogItems)
      },
      place: {
        status: channelStatus(placeItems.length, analysis?.status ?? null),
        collectedCount: placeItems.length,
        selectedCount: selectedCount(placeItems)
      },
      instagram: {
        status: instagramConnected ? channelStatus(instagramItems.length, analysis?.status ?? null) : 'not_connected',
        collectedCount: instagramItems.length,
        selectedCount: selectedCount(instagramItems)
      }
    }
  };
}

export function buildBlogLearningStatus(repos: Repositories, storeId: string) {
  const status = buildLearningStatus(repos, storeId);
  if (!status) return null;
  const { fields, snapshot } = learningContext(repos, storeId);
  const seoKeywords = asStringArray(snapshot.seoKeywords);
  const fallbackKeywords = splitCsv(fieldValue(fields, 'seoKeywords') ?? fieldValue(fields, 'contentKeywords'));
  const items = collectedItems(repos, storeId)
    .filter((item) => item.channel === 'blog')
    .map((item) => presentBlogItem(item));

  return {
    storeId,
    status: status.channels.blog.status,
    collectedCount: status.channels.blog.collectedCount,
    selectedCount: status.channels.blog.selectedCount,
    lastAnalyzedAt: status.lastAnalyzedAt,
    rulesetStatus: status.ruleset?.status ?? null,
    seoKeywords: seoKeywords.length > 0 ? seoKeywords : fallbackKeywords,
    writingStyle: asRecord(snapshot).blogWritingStyle ?? fieldValue(fields, 'blogWritingStyle') ?? null,
    items
  };
}

export function buildPlaceLearningStatus(repos: Repositories, storeId: string) {
  const status = buildLearningStatus(repos, storeId);
  if (!status) return null;
  const store = repos.stores.findById(storeId);
  if (!store) return null;
  const { fields, snapshot, analysisResult } = learningContext(repos, storeId);
  const items = collectedItems(repos, storeId).filter((item) => item.channel === 'place');
  const profile = items.find((item) => item.sourceType === 'profile') ?? null;
  const reviews = items.filter((item) => item.sourceType === 'review');
  const profileMetadata = placeMetadataForStatus(store, profile);
  const strengths = asStringArray(snapshot.keyStrengths);
  const legacyStrengths = asStringArray(analysisResult.strengths);

  return {
    storeId,
    status: status.channels.place.status,
    collectedCount: status.channels.place.collectedCount,
    selectedCount: status.channels.place.selectedCount,
    lastAnalyzedAt: status.lastAnalyzedAt,
    rulesetStatus: status.ruleset?.status ?? null,
    profile: presentPlaceProfile(store, profile),
    reviews: reviews.map((item) => presentPlaceReview(item)),
    photos: presentPlacePhotos(store, items),
    newsItems: presentPlaceNews(profileMetadata),
    reviewKeywords: strengths.length > 0 ? strengths : legacyStrengths.length > 0 ? legacyStrengths : splitCsv(fieldValue(fields, 'keyStrengths'))
  };
}

export function buildInstagramLearningStatus(repos: Repositories, storeId: string) {
  const status = buildLearningStatus(repos, storeId);
  if (!status) return null;
  const items = collectedItems(repos, storeId)
    .filter((item) => item.channel === 'instagram')
    .map((item) => itemSummary(item));

  return {
    storeId,
    status: status.channels.instagram.status,
    collectedCount: status.channels.instagram.collectedCount,
    selectedCount: status.channels.instagram.selectedCount,
    lastAnalyzedAt: status.lastAnalyzedAt,
    rulesetStatus: status.ruleset?.status ?? null,
    items,
    message:
      status.channels.instagram.status === 'not_connected'
        ? '인스타그램 채널이 연결되지 않았습니다.'
        : items.length === 0
          ? '인스타그램 수집 콘텐츠가 없습니다.'
          : null
  };
}
