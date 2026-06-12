import { createHash } from 'node:crypto';
import {
  REQUIRED_ANALYZER_RULESET_FIELD_KEYS,
  serializeAnalyzerRulesetFieldContract,
  sourceMatrixForFieldKey,
  type AnalyzerRulesetFieldContract,
  type RulesetSourceMatrixRow
} from '../rulesets/rulesetSourceMatrix.js';
import type { AnalyzerInput } from './analyzer.js';

type AnalysisPromptBudgetOptions = {
  promptCharacterBudget?: number;
  bodyCharacterBudget?: number;
  blogItemLimit?: number;
  reviewItemLimit?: number;
};

type PromptContentCompleteness = 'complete' | 'truncated' | 'empty';
type BlockedRulesetFieldReason =
  | 'instagram_not_in_scope'
  | 'image_metadata_unavailable'
  | 'review_text_unavailable';

export type BlockedAnalyzerRulesetField = Pick<RulesetSourceMatrixRow, 'fieldKey' | 'label' | 'section'> & {
  reason: BlockedRulesetFieldReason;
  source: 'input_blocked';
};

type StoreProfileFacts = {
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  description: string | null;
  [key: string]: unknown;
};

type PromptBodyContent = {
  charCount: number;
  includedCharCount: number;
  isTruncated: boolean;
  bodyCompleteness: PromptContentCompleteness;
  truncationReason: 'body_budget' | null;
  contentHash: string | null;
  bodyAvailability: string | null;
};

type BlogPromptItem = {
  id: string;
  title: string | null;
  sourceUrl: string | null;
  metadata: Record<string, unknown>;
  content: PromptBodyContent & {
    bodyTextFull: string;
    hasHashtags: boolean;
    questionSentenceCount: number;
    ctaCandidates: string[];
  };
};

type ReviewPromptItem = {
  id: string;
  title: string | null;
  sourceUrl: string | null;
  metadata: Record<string, unknown>;
  content: PromptBodyContent & {
    bodyText: string;
  };
};

export type AnalysisPromptBudgetMetadata = {
  selectedItemCount: number;
  promptItemCount: number;
  omittedItemCount: number;
  blogItemLimit: number;
  selectedBlogItemCount: number;
  promptBlogItemCount: number;
  omittedBlogItemCount: number;
  reviewItemLimit: number;
  selectedReviewItemCount: number;
  promptReviewItemCount: number;
  omittedReviewItemCount: number;
  promptCharacterCount: number;
  promptCharacterBudget: number;
  bodyCharacterBudget: number;
  promptBudgetReason:
    | 'item_limit_exceeded'
    | 'blog_item_limit_exceeded'
    | 'review_item_limit_exceeded'
    | 'body_truncated_to_budget'
    | 'prompt_character_budget_exceeded'
    | null;
  evidenceItemIds: string[];
  requestedRulesetFieldKeys: string[];
  blockedFields: BlockedAnalyzerRulesetField[];
};

export type AnalysisPromptInput = {
  task: string;
  schemaVersion: 'sl_a1_blog_sop_input.v1';
  outputSchemaRef: 'store_learning_analysis.v2';
  constraints: string[];
  storeProfile: {
    id: string;
    sourceItemIds: string[];
    facts: StoreProfileFacts;
  };
  evidenceItemIds: string[];
  blogPosts: BlogPromptItem[];
  reviews: ReviewPromptItem[];
  unavailableData: {
    reviews: boolean;
    images: boolean;
  };
  requestedRulesetFieldKeys: string[];
  requestedRulesetFields: AnalyzerRulesetFieldContract[];
  blockedFields: BlockedAnalyzerRulesetField[];
  industryPolicy: {
    isHealthcare: boolean;
    signals: string[];
    requiredRules: string[];
  };
};

const DEFAULT_PROMPT_CHARACTER_BUDGET = 60000;
const DEFAULT_BODY_CHARACTER_BUDGET = 32000;
const DEFAULT_BLOG_ITEM_LIMIT = 3;
const DEFAULT_REVIEW_ITEM_LIMIT = 10;
const STORE_METADATA_CONTAINERS = [
  'storeMetadata',
  'profile',
  'placeProfile',
  'naverPlace',
  'naverPlaceParsed',
  'place'
] as const;
const STORE_FACT_KEYS = [
  'category',
  'address',
  'phone',
  'businessHours',
  'business_hours',
  'openingHours',
  'closedDays',
  'parking',
  'intro',
  'description',
  'treatmentSubjects',
  'representativeTreatmentSubjects',
  'representativeMenu'
] as const;
const ITEM_METADATA_KEYS = [
  'publishedAt',
  'postDate',
  'postdate',
  'reviewDate',
  'rating',
  'reviewerName',
  'bodyAvailability',
  'sourceKind',
  'sourceOwnership',
  'blogId',
  'logNo',
  'tags'
] as const;
const HEALTHCARE_SIGNALS = ['병원', '의원', '클리닉', '정형외과', '피부과', '치과'] as const;
const IMAGE_FIELD_KEYS = new Set([
  'primaryColors',
  'accentColors',
  'imageDirection',
  'imageStyle',
  'imageAvoidStyle',
  'blogImageFormat',
  'blogImageStyle',
  'blogOverlayPolicy'
]);
const REVIEW_FIELD_KEYS = new Set(['reviewStrength', 'reviewWeakness']);
const CTA_KEYWORDS = ['예약', '문의', '상담', '전화', '방문', '카카오', '네이버예약', '확인'];

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function compactText(value: string, maxLength = 500) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function compactValue(value: unknown): unknown {
  if (typeof value === 'string') return compactText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const scalars = value
      .filter((item) => ['string', 'number', 'boolean'].includes(typeof item))
      .map((item) => (typeof item === 'string' ? compactText(item, 160) : item))
      .filter((item) => item !== null);
    return scalars.slice(0, 20);
  }
  const record = asRecord(value);
  const entries = Object.entries(record)
    .filter(([, item]) => ['string', 'number', 'boolean'].includes(typeof item))
    .slice(0, 12)
    .map(([key, item]) => [key, typeof item === 'string' ? compactText(item, 240) : item])
    .filter(([, item]) => item !== null);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function assignAllowedValue(target: Record<string, unknown>, key: string, value: unknown) {
  if (target[key] !== undefined) return;
  const compacted = compactValue(value);
  if (compacted === null || (Array.isArray(compacted) && compacted.length === 0)) return;
  target[key] = compacted;
}

function pickKeys(record: Record<string, unknown>, keys: readonly string[]) {
  const picked: Record<string, unknown> = {};
  for (const key of keys) {
    if (record[key] !== undefined) assignAllowedValue(picked, key, record[key]);
  }
  return picked;
}

function storeMetadataSummary(metadata: unknown) {
  const record = asRecord(metadata);
  const summary = pickKeys(record, STORE_FACT_KEYS);
  for (const containerKey of STORE_METADATA_CONTAINERS) {
    const container = asRecord(record[containerKey]);
    for (const [key, value] of Object.entries(pickKeys(container, STORE_FACT_KEYS))) {
      assignAllowedValue(summary, key, value);
    }
  }
  return summary;
}

function itemMetadataSummary(item: AnalyzerInput['selectedItems'][number]) {
  return pickKeys(asRecord(item.metadata), ITEM_METADATA_KEYS);
}

function itemPriority(item: AnalyzerInput['selectedItems'][number]) {
  if (item.sourceType === 'profile') return 0;
  if (item.sourceType === 'review') return 1;
  if (item.channel === 'place') return 2;
  return 3;
}

function metadataDateValue(item: AnalyzerInput['selectedItems'][number]) {
  const metadata = asRecord(item.metadata);
  const value = metadata.publishedAt ?? metadata.postDate ?? metadata.postdate ?? metadata.reviewDate ?? item.createdAt;
  const timestamp = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function orderedSelectedItems(items: AnalyzerInput['selectedItems']) {
  return [...items].sort((a, b) => {
    const priorityDelta = itemPriority(a) - itemPriority(b);
    if (priorityDelta !== 0) return priorityDelta;
    return metadataDateValue(b) - metadataDateValue(a);
  });
}

function isBlogInputItem(item: AnalyzerInput['selectedItems'][number]) {
  return item.channel === 'blog' || item.sourceType === 'post';
}

function isReviewInputItem(item: AnalyzerInput['selectedItems'][number]) {
  return item.sourceType === 'review';
}

function hasUsableBodyText(item: AnalyzerInput['selectedItems'][number]) {
  return Boolean(item.bodyText?.replace(/\s+/g, ' ').trim());
}

function itemLimitValue(value: number | undefined, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function limitItems(
  items: AnalyzerInput['selectedItems'],
  itemLimit: number,
  predicate: (item: AnalyzerInput['selectedItems'][number]) => boolean
) {
  let selectedItemCount = 0;
  let promptItemCount = 0;
  let omittedItemCount = 0;
  const limitedItems = items.filter((item) => {
    if (!predicate(item)) return true;
    selectedItemCount += 1;
    if (promptItemCount >= itemLimit) {
      omittedItemCount += 1;
      return false;
    }
    promptItemCount += 1;
    return true;
  });

  return {
    limitedItems,
    selectedItemCount,
    promptItemCount,
    omittedItemCount
  };
}

function normalizeBodyText(value: string | null) {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

function contentHash(value: string) {
  if (!value) return null;
  return createHash('sha256').update(value).digest('hex');
}

function originalBodyAvailability(item: AnalyzerInput['selectedItems'][number]) {
  const value = asRecord(item.metadata).bodyAvailability;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function compactBodyContent(
  item: AnalyzerInput['selectedItems'][number],
  bodyBudget: { remaining: number; truncated: boolean },
  itemLimit: number | null
) {
  const normalizedBody = normalizeBodyText(item.bodyText);
  const maxAllowedLength = itemLimit === null ? bodyBudget.remaining : Math.min(itemLimit, bodyBudget.remaining);
  const bodyText = maxAllowedLength > 0 && normalizedBody ? normalizedBody.slice(0, maxAllowedLength) : '';
  if (bodyText) bodyBudget.remaining -= bodyText.length;
  const isTruncated = normalizedBody.length > bodyText.length;
  if (isTruncated) bodyBudget.truncated = true;
  const bodyCompleteness: PromptContentCompleteness = !normalizedBody ? 'empty' : isTruncated ? 'truncated' : 'complete';

  return {
    charCount: normalizedBody.length,
    includedCharCount: bodyText.length,
    isTruncated,
    bodyCompleteness,
    truncationReason: isTruncated ? ('body_budget' as const) : null,
    contentHash: contentHash(normalizedBody),
    bodyAvailability: originalBodyAvailability(item),
    bodyText
  };
}

function splitSentences(value: string) {
  return value
    .split(/(?<=[.!?。！？])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function questionSentenceCount(value: string) {
  return splitSentences(value).filter((sentence) => /[?？]|\b궁금|까요|나요|습니까|세요\?/u.test(sentence)).length;
}

function ctaCandidates(value: string) {
  return splitSentences(value)
    .filter((sentence) => CTA_KEYWORDS.some((keyword) => sentence.includes(keyword)))
    .slice(0, 5);
}

function compactBlogPost(
  item: AnalyzerInput['selectedItems'][number],
  bodyBudget: { remaining: number; truncated: boolean }
): BlogPromptItem {
  const content = compactBodyContent(item, bodyBudget, null);
  return {
    id: item.id,
    title: item.title,
    sourceUrl: item.sourceUrl,
    metadata: itemMetadataSummary(item),
    content: {
      charCount: content.charCount,
      includedCharCount: content.includedCharCount,
      isTruncated: content.isTruncated,
      bodyCompleteness: content.bodyCompleteness,
      truncationReason: content.truncationReason,
      contentHash: content.contentHash,
      bodyAvailability: content.bodyAvailability,
      bodyTextFull: content.bodyText,
      hasHashtags: /#[\p{L}\p{N}_]+/u.test(content.bodyText),
      questionSentenceCount: questionSentenceCount(content.bodyText),
      ctaCandidates: ctaCandidates(content.bodyText)
    }
  };
}

function compactReview(
  item: AnalyzerInput['selectedItems'][number],
  bodyBudget: { remaining: number; truncated: boolean }
): ReviewPromptItem {
  const content = compactBodyContent(item, bodyBudget, 500);
  return {
    id: item.id,
    title: item.title,
    sourceUrl: item.sourceUrl,
    metadata: itemMetadataSummary(item),
    content: {
      charCount: content.charCount,
      includedCharCount: content.includedCharCount,
      isTruncated: content.isTruncated,
      bodyCompleteness: content.bodyCompleteness,
      truncationReason: content.truncationReason,
      contentHash: content.contentHash,
      bodyAvailability: content.bodyAvailability,
      bodyText: content.bodyText
    }
  };
}

function storeProfileSourceItemIds(items: AnalyzerInput['selectedItems']) {
  return items.filter((item) => item.sourceType === 'profile').map((item) => item.id);
}

function storeProfileFacts(input: AnalyzerInput, items: AnalyzerInput['selectedItems']): StoreProfileFacts {
  const facts: StoreProfileFacts = {
    name: input.store.name,
    category: input.store.category,
    address: input.store.address,
    phone: input.store.phone,
    description: input.store.description
  };

  for (const [key, value] of Object.entries(storeMetadataSummary(input.store.metadata))) {
    assignAllowedValue(facts, key, value);
  }

  for (const item of items.filter((candidate) => candidate.sourceType === 'profile')) {
    for (const [key, value] of Object.entries(storeMetadataSummary(item.metadata))) {
      assignAllowedValue(facts, key, value);
    }
  }

  return facts;
}

function hasUsableImageMetadataAnalysis(items: AnalyzerInput['selectedItems']) {
  return items.some((item) => {
    const metadata = asRecord(item.metadata);
    const imageAnalysis = asRecord(metadata.imageAnalysis ?? metadata.imageMetadataAnalysis ?? metadata.visualAnalysis);
    if (Object.keys(imageAnalysis).length === 0) return false;
    if (imageAnalysis.usable === false) return false;
    return Boolean(
      imageAnalysis.primaryColors ??
        imageAnalysis.accentColors ??
        imageAnalysis.dominantColors ??
        imageAnalysis.style ??
        imageAnalysis.mood
    );
  });
}

function healthcareSignals(input: AnalyzerInput) {
  const haystack = [input.store.name, input.store.category].filter(Boolean).join(' ');
  return HEALTHCARE_SIGNALS.filter((signal) => haystack.includes(signal));
}

function blockedField(fieldKey: string, reason: BlockedRulesetFieldReason): BlockedAnalyzerRulesetField {
  const row = sourceMatrixForFieldKey(fieldKey);
  if (!row) {
    throw new Error(`Unknown analyzer ruleset field: ${fieldKey}`);
  }
  return {
    fieldKey: row.fieldKey,
    label: row.label,
    section: row.section,
    reason,
    source: 'input_blocked'
  };
}

export function planAnalyzerRulesetFields(input: {
  hasUsableReviewText: boolean;
  hasUsableImageMetadataAnalysis: boolean;
}) {
  const blockedByKey = new Map<string, BlockedAnalyzerRulesetField>();

  for (const fieldKey of REQUIRED_ANALYZER_RULESET_FIELD_KEYS) {
    const row = sourceMatrixForFieldKey(fieldKey);
    if (!row) continue;
    if (row.section === 'write_instagram' || row.section === 'image_instagram') {
      blockedByKey.set(fieldKey, blockedField(fieldKey, 'instagram_not_in_scope'));
      continue;
    }
    if (!input.hasUsableImageMetadataAnalysis && IMAGE_FIELD_KEYS.has(fieldKey)) {
      blockedByKey.set(fieldKey, blockedField(fieldKey, 'image_metadata_unavailable'));
      continue;
    }
    if (!input.hasUsableReviewText && REVIEW_FIELD_KEYS.has(fieldKey)) {
      blockedByKey.set(fieldKey, blockedField(fieldKey, 'review_text_unavailable'));
    }
  }

  const blockedFields = Array.from(blockedByKey.values());
  const blockedFieldKeys = new Set(blockedFields.map((field) => field.fieldKey));
  const requestedRulesetFieldKeys = REQUIRED_ANALYZER_RULESET_FIELD_KEYS.filter((fieldKey) => !blockedFieldKeys.has(fieldKey));

  return {
    requestedRulesetFieldKeys,
    requestedRulesetFields: serializeAnalyzerRulesetFieldContract(requestedRulesetFieldKeys),
    blockedFields
  };
}

function buildPrompt(
  input: AnalyzerInput,
  selectedItems: AnalyzerInput['selectedItems'],
  bodyCharacterBudget: number
) {
  const bodyBudget = { remaining: bodyCharacterBudget, truncated: false };
  const reviews = selectedItems.filter(isReviewInputItem).map((item) => compactReview(item, bodyBudget));
  const blogPosts = selectedItems.filter(isBlogInputItem).map((item) => compactBlogPost(item, bodyBudget));
  const sourceItemIds = storeProfileSourceItemIds(selectedItems);
  const evidenceItemIds = [...sourceItemIds, ...reviews.map((item) => item.id), ...blogPosts.map((item) => item.id)];
  const hasReviewText = reviews.some((item) => item.content.includedCharCount > 0);
  const hasImageMetadata = hasUsableImageMetadataAnalysis(selectedItems);
  const fieldPlan = planAnalyzerRulesetFields({
    hasUsableReviewText: hasReviewText,
    hasUsableImageMetadataAnalysis: hasImageMetadata
  });
  const signals = healthcareSignals(input);

  return {
    promptInput: {
      task: 'Analyze selected collected content for Store Learning & Blog Content Automation PoC.',
      schemaVersion: 'sl_a1_blog_sop_input.v1',
      outputSchemaRef: 'store_learning_analysis.v2',
      constraints: [
        'Return Korean marketing strategy analysis only.',
        'Every evidence.collectionItemId must be one of the provided evidenceItemIds.',
        'Every requested ruleset field evidenceItemIds entry must be one of the provided evidenceItemIds.',
        'Do not invent customer reviews, image analysis, Instagram inputs, or collection items.',
        'Keep claims conservative and evidence-linked.',
        'Populate every requested ruleset field once; do not populate blocked fields.'
      ],
      storeProfile: {
        id: input.store.id,
        sourceItemIds,
        facts: storeProfileFacts(input, selectedItems)
      },
      evidenceItemIds,
      blogPosts,
      reviews,
      unavailableData: {
        reviews: !hasReviewText,
        images: !hasImageMetadata
      },
      requestedRulesetFieldKeys: fieldPlan.requestedRulesetFieldKeys,
      requestedRulesetFields: fieldPlan.requestedRulesetFields,
      blockedFields: fieldPlan.blockedFields,
      industryPolicy: {
        isHealthcare: signals.length > 0,
        signals,
        requiredRules:
          signals.length > 0
            ? [
                '블로그 하단에 반드시 의료법 관련 내용 포함',
                '의료 효과, 보장, 과장 표현을 피하고 개인차 및 상담 필요성을 고지'
              ]
            : []
      }
    } satisfies AnalysisPromptInput,
    bodyTruncated: bodyBudget.truncated
  };
}

function promptCharacterCount(promptInput: AnalysisPromptInput) {
  return JSON.stringify(promptInput, null, 2).length;
}

function promptBudgetReasonForLimits(
  blogOmittedItemCount: number,
  reviewOmittedItemCount: number,
  bodyTruncated: boolean
): AnalysisPromptBudgetMetadata['promptBudgetReason'] {
  if (blogOmittedItemCount > 0 && reviewOmittedItemCount > 0) return 'item_limit_exceeded';
  if (blogOmittedItemCount > 0) return 'blog_item_limit_exceeded';
  if (reviewOmittedItemCount > 0) return 'review_item_limit_exceeded';
  return bodyTruncated ? 'body_truncated_to_budget' : null;
}

function lastRemovableBlogIndex(items: AnalyzerInput['selectedItems']) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (isBlogInputItem(items[index])) return index;
  }
  return -1;
}

export function buildAnalysisPromptInput(input: AnalyzerInput, options: AnalysisPromptBudgetOptions = {}) {
  const promptCharacterBudget = options.promptCharacterBudget ?? DEFAULT_PROMPT_CHARACTER_BUDGET;
  const bodyCharacterBudget = options.bodyCharacterBudget ?? DEFAULT_BODY_CHARACTER_BUDGET;
  const blogItemLimit = itemLimitValue(options.blogItemLimit, DEFAULT_BLOG_ITEM_LIMIT);
  const reviewItemLimit = itemLimitValue(options.reviewItemLimit, DEFAULT_REVIEW_ITEM_LIMIT);
  const orderedItems = orderedSelectedItems(input.selectedItems);
  const selectedReviewItemCount = orderedItems.filter(isReviewInputItem).length;
  const blogLimitedInput = limitItems(orderedItems, blogItemLimit, isBlogInputItem);
  const reviewUsableItems = blogLimitedInput.limitedItems.filter((item) => !isReviewInputItem(item) || hasUsableBodyText(item));
  const reviewLimitedInput = limitItems(reviewUsableItems, reviewItemLimit, isReviewInputItem);
  let selectedItems = reviewLimitedInput.limitedItems;
  let built = buildPrompt(input, selectedItems, bodyCharacterBudget);
  let promptInput = built.promptInput;
  let promptCharacterCountValue = promptCharacterCount(promptInput);
  let promptBlogItemCount = promptInput.blogPosts.length;
  let promptReviewItemCount = promptInput.reviews.length;
  let omittedItemCount = input.selectedItems.length - promptInput.evidenceItemIds.length;
  let promptBudgetReason: AnalysisPromptBudgetMetadata['promptBudgetReason'] = promptBudgetReasonForLimits(
    blogLimitedInput.selectedItemCount - promptBlogItemCount,
    selectedReviewItemCount - promptReviewItemCount,
    built.bodyTruncated
  );

  while (promptCharacterCountValue > promptCharacterBudget) {
    const removableIndex = lastRemovableBlogIndex(selectedItems);
    if (removableIndex < 0) break;
    selectedItems = selectedItems.filter((_, index) => index !== removableIndex);
    built = buildPrompt(input, selectedItems, bodyCharacterBudget);
    promptInput = built.promptInput;
    promptCharacterCountValue = promptCharacterCount(promptInput);
    promptBlogItemCount = promptInput.blogPosts.length;
    promptReviewItemCount = promptInput.reviews.length;
    omittedItemCount = input.selectedItems.length - promptInput.evidenceItemIds.length;
    promptBudgetReason = 'prompt_character_budget_exceeded';
  }

  if (promptBudgetReason !== 'prompt_character_budget_exceeded') {
    promptBudgetReason = promptBudgetReasonForLimits(
      blogLimitedInput.selectedItemCount - promptBlogItemCount,
      selectedReviewItemCount - promptReviewItemCount,
      built.bodyTruncated
    );
  }

  return {
    promptInput,
    metadata: {
      selectedItemCount: input.selectedItems.length,
      promptItemCount: promptInput.evidenceItemIds.length,
      omittedItemCount,
      blogItemLimit,
      selectedBlogItemCount: blogLimitedInput.selectedItemCount,
      promptBlogItemCount,
      omittedBlogItemCount: blogLimitedInput.selectedItemCount - promptBlogItemCount,
      reviewItemLimit,
      selectedReviewItemCount,
      promptReviewItemCount,
      omittedReviewItemCount: selectedReviewItemCount - promptReviewItemCount,
      promptCharacterCount: promptCharacterCountValue,
      promptCharacterBudget,
      bodyCharacterBudget,
      promptBudgetReason,
      evidenceItemIds: promptInput.evidenceItemIds,
      requestedRulesetFieldKeys: promptInput.requestedRulesetFieldKeys,
      blockedFields: promptInput.blockedFields
    } satisfies AnalysisPromptBudgetMetadata
  };
}
