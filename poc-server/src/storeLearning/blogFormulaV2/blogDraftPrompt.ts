import type { BlogFormulaV2PromptInputStore } from './blogFormulaPrompt.js';
import type { BlogFormulaSetV2, BlogRetrievedSampleV2, BlogTopicBriefInput } from './types.js';

export const BLOG_FORMULA_V2_DRAFT_PROMPT_SCHEMA_VERSION = 'blog_formula_v2_draft_input.v1';
export const BLOG_FORMULA_V2_DRAFT_RESPONSE_FORMAT_NAME = 'store_learning_blog_formula_v2_draft';
export const BLOG_FORMULA_V2_DRAFT_CALL_ID = 'SL-G1';

const DEFAULT_MAX_SAMPLES = 3;
const DEFAULT_MAX_SAMPLE_BODY_CHARS = 2500;
const DEFAULT_SAMPLE_BODY_CHARACTER_BUDGET = 7500;
const DEFAULT_PROMPT_CHARACTER_BUDGET = 30000;

const requestedOutputBlocks = [
  'titleCandidates',
  'selectedTitle',
  'blogDraft',
  'styleComplianceReport',
  'safetyCheck',
  'seoCheck'
] as const;

const productIntent = [
  'Write a NEW Korean Naver Blog draft for the store by applying the provided Blog Formula V2 writing formula.',
  'The formula describes how this store already writes (title slots, intro/body/footer move sequences, heading style, tone habits, soft CTA, footer/disclaimer, medical safety). Reproduce that writing style for the new topic.',
  'The retrieved owner Blog samples Top 1~3 are style references only. Do not copy their sentences; mirror their structure and tone for the new Topic Brief.'
] as const;

const generationInstructions = [
  'Fill the slot-based titleFormula patterns with the Topic Brief to produce titleCandidates, then pick the strongest as selectedTitle.',
  'Open blogDraft with one of formula.introFormula.selfIntroductionPatterns, if that list is non-empty: take a pattern\'s template, replace {storeName} with storeProfile.name and {directorName} with the pattern\'s own directorName, and use the filled line verbatim as the first sentence. Choose a pattern with probability roughly proportional to its usageRatio (the highest-usageRatio pattern is this store\'s most common opener and should be used most often). Never invent a different self-introduction phrase (e.g. generic staff titles such as "의료진입니다"). If selfIntroductionPatterns is empty, write a natural greeting using storeProfile.name.',
  'Follow the introFormula and bodyFormula move sequences and the headingFormula style when composing blogDraft.',
  'Apply toneAndMannerFormula sentence habits (persona, preferred phrases, endings, empathy patterns, emoji policy).',
  'Close with a soft decision-guide CTA from ctaFormula, not a hard reservation push, unless hardReservationAllowed is true.',
  'Include the medicalSafetyFormula.requiredDisclosures naturally and never use any medicalSafetyFormula.bannedClaims or any Topic Brief mustAvoid phrase.',
  'Place the mainKeyword in the title and the first paragraph; weave secondaryKeywords in naturally without keyword stuffing.',
  'Do not hardcode operating hours or invent treatment outcomes, rankings, or guarantees.'
] as const;

const qualityRequirements = [
  'blogDraft must be a complete, publish-shaped Korean draft, not an outline.',
  'styleComplianceReport.appliedBlocks must list the formula blocks you actually applied.',
  'safetyCheck.requiredDisclosures must echo the disclosures you included; set bannedPhrasesAvoided to true only if you used none of the banned claims.',
  'seoCheck must honestly report whether the mainKeyword is in the title and intro and which secondaryKeywords you used.'
] as const;

const constraints = [
  'Use only the provided formula, Topic Brief, and style samples as input.',
  'Do not copy long passages from the style samples.',
  'Return Korean title candidates and draft text.',
  'Keep the draft approval-pending; do not include publishing instructions.'
] as const;

export type BlogFormulaV2DraftPromptStyleSample = {
  rank: number;
  collectionItemId: string;
  title: string | null;
  sourceUrl: string | null;
  whySelected: string;
  charCount: number;
  includedCharCount: number;
  isTruncated: boolean;
  bodyText: string;
};

export type BlogFormulaV2DraftPromptBudgetReason =
  | 'within_budget'
  | 'sample_limit_exceeded'
  | 'sample_body_truncated_to_budget'
  | 'prompt_character_budget_exceeded';

export type BlogFormulaV2DraftPromptBudgetMetadata = {
  schemaVersion: typeof BLOG_FORMULA_V2_DRAFT_PROMPT_SCHEMA_VERSION;
  sampleCount: number;
  promptSampleCount: number;
  sampleCollectionItemIds: string[];
  omittedSampleCollectionItemIds: string[];
  promptCharacterCount: number;
  promptCharacterBudget: number;
  sampleBodyCharacterBudget: number;
  promptBudgetReason: BlogFormulaV2DraftPromptBudgetReason;
};

export type BlogFormulaV2DraftPromptInput = {
  task: 'Write a new Korean Naver Blog draft by applying the Blog Formula V2.';
  schemaVersion: typeof BLOG_FORMULA_V2_DRAFT_PROMPT_SCHEMA_VERSION;
  outputSchemaRef: typeof BLOG_FORMULA_V2_DRAFT_RESPONSE_FORMAT_NAME;
  constraints: typeof constraints;
  productIntent: typeof productIntent;
  generationInstructions: typeof generationInstructions;
  qualityRequirements: typeof qualityRequirements;
  storeProfile: BlogFormulaV2PromptInputStore;
  formula: BlogFormulaSetV2;
  topicBrief: BlogTopicBriefInput;
  styleSamples: BlogFormulaV2DraftPromptStyleSample[];
  requestedOutputBlocks: typeof requestedOutputBlocks;
};

type BuildBlogFormulaV2DraftPromptOptions = {
  maxSamples?: number;
  maxSampleBodyChars?: number;
  sampleBodyCharacterBudget?: number;
  promptCharacterBudget?: number;
};

type BuildBlogFormulaV2DraftPromptInput = {
  store: BlogFormulaV2PromptInputStore;
  formula: BlogFormulaSetV2;
  topicBrief: BlogTopicBriefInput;
  samples: BlogRetrievedSampleV2[];
  options?: BuildBlogFormulaV2DraftPromptOptions;
};

function truncateText(value: string, maxChars: number) {
  if (value.length <= maxChars) return { text: value, truncated: false };
  return { text: value.slice(0, Math.max(0, maxChars)), truncated: true };
}

function buildPromptInput(
  store: BlogFormulaV2PromptInputStore,
  formula: BlogFormulaSetV2,
  topicBrief: BlogTopicBriefInput,
  styleSamples: BlogFormulaV2DraftPromptStyleSample[]
): BlogFormulaV2DraftPromptInput {
  return {
    task: 'Write a new Korean Naver Blog draft by applying the Blog Formula V2.',
    schemaVersion: BLOG_FORMULA_V2_DRAFT_PROMPT_SCHEMA_VERSION,
    outputSchemaRef: BLOG_FORMULA_V2_DRAFT_RESPONSE_FORMAT_NAME,
    constraints,
    productIntent,
    generationInstructions,
    qualityRequirements,
    storeProfile: store,
    formula,
    topicBrief,
    styleSamples,
    requestedOutputBlocks
  };
}

function serializedCharacterCount(promptInput: BlogFormulaV2DraftPromptInput) {
  return JSON.stringify(promptInput).length;
}

export function buildBlogFormulaV2DraftPromptInput(input: BuildBlogFormulaV2DraftPromptInput) {
  const maxSamples = input.options?.maxSamples ?? DEFAULT_MAX_SAMPLES;
  const maxSampleBodyChars = input.options?.maxSampleBodyChars ?? DEFAULT_MAX_SAMPLE_BODY_CHARS;
  const sampleBodyCharacterBudget = input.options?.sampleBodyCharacterBudget ?? DEFAULT_SAMPLE_BODY_CHARACTER_BUDGET;
  const promptCharacterBudget = input.options?.promptCharacterBudget ?? DEFAULT_PROMPT_CHARACTER_BUDGET;

  const rankedSamples = [...input.samples].sort((left, right) => left.rank - right.rank);
  const selectedSamples = rankedSamples.slice(0, maxSamples);
  const omittedSampleCollectionItemIds = rankedSamples.slice(maxSamples).map((sample) => sample.collectionItemId);

  let remainingBodyBudget = sampleBodyCharacterBudget;
  let bodyWasTruncated = false;

  const styleSamples: BlogFormulaV2DraftPromptStyleSample[] = selectedSamples.map((sample) => {
    const perSampleLimit = Math.min(maxSampleBodyChars, remainingBodyBudget);
    const truncated = truncateText(sample.bodyText, perSampleLimit);
    remainingBodyBudget = Math.max(0, remainingBodyBudget - truncated.text.length);
    const isTruncated = truncated.truncated || truncated.text.length < sample.bodyText.length;
    bodyWasTruncated ||= isTruncated;
    return {
      rank: sample.rank,
      collectionItemId: sample.collectionItemId,
      title: sample.title,
      sourceUrl: sample.sourceUrl,
      whySelected: sample.whySelected,
      charCount: sample.bodyText.length,
      includedCharCount: truncated.text.length,
      isTruncated,
      bodyText: truncated.text
    };
  });

  let promptInput = buildPromptInput(input.store, input.formula, input.topicBrief, styleSamples);
  let promptWasTrimmed = false;

  while (serializedCharacterCount(promptInput) > promptCharacterBudget && promptInput.styleSamples.length > 0) {
    promptWasTrimmed = true;
    const lastSample = promptInput.styleSamples[promptInput.styleSamples.length - 1];
    omittedSampleCollectionItemIds.unshift(lastSample.collectionItemId);
    promptInput = buildPromptInput(input.store, input.formula, input.topicBrief, promptInput.styleSamples.slice(0, -1));
  }

  const promptBudgetReason: BlogFormulaV2DraftPromptBudgetReason = promptWasTrimmed
    ? 'prompt_character_budget_exceeded'
    : omittedSampleCollectionItemIds.length > 0
      ? 'sample_limit_exceeded'
      : bodyWasTruncated
        ? 'sample_body_truncated_to_budget'
        : 'within_budget';

  const metadata: BlogFormulaV2DraftPromptBudgetMetadata = {
    schemaVersion: BLOG_FORMULA_V2_DRAFT_PROMPT_SCHEMA_VERSION,
    sampleCount: input.samples.length,
    promptSampleCount: promptInput.styleSamples.length,
    sampleCollectionItemIds: input.samples.map((sample) => sample.collectionItemId),
    omittedSampleCollectionItemIds,
    promptCharacterCount: serializedCharacterCount(promptInput),
    promptCharacterBudget,
    sampleBodyCharacterBudget,
    promptBudgetReason
  };

  return { promptInput, metadata };
}
