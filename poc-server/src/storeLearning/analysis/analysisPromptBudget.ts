import { REQUIRED_ANALYZER_RULESET_FIELD_KEYS } from '../rulesets/rulesetSourceMatrix.js';
import type { AnalyzerInput } from './analyzer.js';

type AnalysisPromptBudgetOptions = {
  promptCharacterBudget?: number;
  bodyCharacterBudget?: number;
  blogItemLimit?: number;
};

type CompactAnalysisItem = {
  id: string;
  channel: string;
  sourceType: string;
  title: string | null;
  bodyText: string | null;
  sourceUrl: string | null;
  metadata: Record<string, unknown>;
};

export type AnalysisPromptBudgetMetadata = {
  selectedItemCount: number;
  promptItemCount: number;
  omittedItemCount: number;
  blogItemLimit: number;
  selectedBlogItemCount: number;
  promptBlogItemCount: number;
  omittedBlogItemCount: number;
  promptCharacterCount: number;
  promptCharacterBudget: number;
  bodyCharacterBudget: number;
  promptBudgetReason:
    | 'blog_item_limit_exceeded'
    | 'body_truncated_to_budget'
    | 'prompt_character_budget_exceeded'
    | null;
};

export type AnalysisPromptInput = {
  task: string;
  constraints: string[];
  store: {
    id: string;
    name: string;
    category: string | null;
    address: string | null;
    description: string | null;
    metadata: Record<string, unknown>;
  };
  selectedItemIds: string[];
  selectedItems: CompactAnalysisItem[];
  requiredRulesetFieldKeys: readonly string[];
};

const DEFAULT_PROMPT_CHARACTER_BUDGET = 60000;
const DEFAULT_BODY_CHARACTER_BUDGET = 32000;
const DEFAULT_BLOG_ITEM_LIMIT = 10;
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
  const record = asRecord(item.metadata);
  const summary = pickKeys(record, ITEM_METADATA_KEYS);
  if (item.sourceType === 'profile') {
    const profileFacts = storeMetadataSummary(record);
    if (Object.keys(profileFacts).length > 0) summary.profileFacts = profileFacts;
  }
  return summary;
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

function blogItemLimitValue(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_BLOG_ITEM_LIMIT;
  return Math.max(0, Math.floor(value));
}

function limitBlogItems(items: AnalyzerInput['selectedItems'], blogItemLimit: number) {
  let selectedBlogItemCount = 0;
  let promptBlogItemCount = 0;
  let omittedBlogItemCount = 0;
  const limitedItems = items.filter((item) => {
    if (!isBlogInputItem(item)) return true;
    selectedBlogItemCount += 1;
    if (promptBlogItemCount >= blogItemLimit) {
      omittedBlogItemCount += 1;
      return false;
    }
    promptBlogItemCount += 1;
    return true;
  });

  return {
    limitedItems,
    selectedBlogItemCount,
    omittedBlogItemCount
  };
}

function bodyLimitForItem(item: AnalyzerInput['selectedItems'][number]) {
  if (item.sourceType === 'profile') return 0;
  if (item.sourceType === 'review') return 500;
  if (item.channel === 'blog') return 1200;
  return 800;
}

function compactItem(
  item: AnalyzerInput['selectedItems'][number],
  bodyBudget: { remaining: number; truncated: boolean }
): CompactAnalysisItem {
  const limit = bodyLimitForItem(item);
  const normalizedBody = item.bodyText ? item.bodyText.replace(/\s+/g, ' ').trim() : '';
  const allowedLength = Math.min(limit, bodyBudget.remaining);
  const bodyText = allowedLength > 0 && normalizedBody ? normalizedBody.slice(0, allowedLength) : null;
  if (bodyText) bodyBudget.remaining -= bodyText.length;
  if (normalizedBody.length > allowedLength) bodyBudget.truncated = true;

  return {
    id: item.id,
    channel: item.channel,
    sourceType: item.sourceType,
    title: item.title,
    bodyText,
    sourceUrl: item.sourceUrl,
    metadata: itemMetadataSummary(item)
  };
}

function buildPrompt(input: AnalyzerInput, selectedItems: CompactAnalysisItem[]): AnalysisPromptInput {
  return {
    task: 'Analyze selected collected content for Store Learning & Blog Content Automation PoC.',
    constraints: [
      'Return Korean marketing strategy analysis only.',
      'Every evidence.collectionItemId must be one of the provided selected item IDs.',
      'Every rulesetFields[].evidenceItemIds entry must be one of the provided selected item IDs.',
      'Do not invent customer reviews or collection items.',
      'Keep claims conservative and evidence-linked.',
      'Use source=openai_analysis for generated ruleset fields.'
    ],
    store: {
      id: input.store.id,
      name: input.store.name,
      category: input.store.category,
      address: input.store.address,
      description: input.store.description,
      metadata: storeMetadataSummary(input.store.metadata)
    },
    selectedItemIds: selectedItems.map((item) => item.id),
    selectedItems,
    requiredRulesetFieldKeys: REQUIRED_ANALYZER_RULESET_FIELD_KEYS
  };
}

function promptCharacterCount(promptInput: AnalysisPromptInput) {
  return JSON.stringify(promptInput, null, 2).length;
}

function isBlogPromptItem(item: CompactAnalysisItem) {
  return item.channel === 'blog' || item.sourceType === 'post';
}

function lastRemovableBlogIndex(items: CompactAnalysisItem[]) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (isBlogPromptItem(items[index])) return index;
  }
  return -1;
}

export function buildAnalysisPromptInput(input: AnalyzerInput, options: AnalysisPromptBudgetOptions = {}) {
  const promptCharacterBudget = options.promptCharacterBudget ?? DEFAULT_PROMPT_CHARACTER_BUDGET;
  const bodyCharacterBudget = options.bodyCharacterBudget ?? DEFAULT_BODY_CHARACTER_BUDGET;
  const blogItemLimit = blogItemLimitValue(options.blogItemLimit);
  const bodyBudget = { remaining: bodyCharacterBudget, truncated: false };
  const limitedInput = limitBlogItems(orderedSelectedItems(input.selectedItems), blogItemLimit);
  let selectedItems = limitedInput.limitedItems.map((item) => compactItem(item, bodyBudget));
  let promptInput = buildPrompt(input, selectedItems);
  let promptCharacterCountValue = promptCharacterCount(promptInput);
  let omittedItemCount = limitedInput.omittedBlogItemCount;
  let promptBudgetReason: AnalysisPromptBudgetMetadata['promptBudgetReason'] = bodyBudget.truncated
    ? 'body_truncated_to_budget'
    : null;
  if (limitedInput.omittedBlogItemCount > 0) {
    promptBudgetReason = 'blog_item_limit_exceeded';
  }

  while (promptCharacterCountValue > promptCharacterBudget) {
    const removableIndex = lastRemovableBlogIndex(selectedItems);
    if (removableIndex < 0) break;
    selectedItems = selectedItems.filter((_, index) => index !== removableIndex);
    omittedItemCount += 1;
    promptBudgetReason = 'prompt_character_budget_exceeded';
    promptInput = buildPrompt(input, selectedItems);
    promptCharacterCountValue = promptCharacterCount(promptInput);
  }

  const promptBlogItemCount = selectedItems.filter((item) => isBlogPromptItem(item)).length;

  return {
    promptInput,
    metadata: {
      selectedItemCount: input.selectedItems.length,
      promptItemCount: selectedItems.length,
      omittedItemCount,
      blogItemLimit,
      selectedBlogItemCount: limitedInput.selectedBlogItemCount,
      promptBlogItemCount,
      omittedBlogItemCount: limitedInput.selectedBlogItemCount - promptBlogItemCount,
      promptCharacterCount: promptCharacterCountValue,
      promptCharacterBudget,
      bodyCharacterBudget,
      promptBudgetReason
    } satisfies AnalysisPromptBudgetMetadata
  };
}
