import type { OwnerBlogPostV2 } from './sourcePosts.js';

export const BLOG_FORMULA_V2_PROMPT_SCHEMA_VERSION = 'blog_formula_v2_extraction_input.v1';
export const BLOG_FORMULA_V2_RESPONSE_FORMAT_NAME = 'store_learning_blog_formula_v2';
export const BLOG_FORMULA_V2_CALL_ID = 'SL-F1';

const DEFAULT_MAX_PROMPT_POSTS = 8;
const DEFAULT_MAX_BODY_CHARS_PER_POST = 3500;
const DEFAULT_BODY_CHARACTER_BUDGET = 18000;
const DEFAULT_PROMPT_CHARACTER_BUDGET = 30000;

const requestedFormulaBlocks = [
  'titleFormula',
  'introFormula',
  'bodyFormula',
  'headingFormula',
  'toneAndMannerFormula',
  'ctaFormula',
  'footerFormula',
  'medicalSafetyFormula'
] as const;

export type BlogFormulaV2PromptInputStore = {
  id: string;
  name: string | null;
  category: string | null;
  address: string | null;
};

export type BlogFormulaV2PromptBudgetReason =
  | 'within_budget'
  | 'source_post_limit_exceeded'
  | 'body_truncated_to_budget'
  | 'prompt_character_budget_exceeded';

export type BlogFormulaV2PromptBudgetMetadata = {
  schemaVersion: typeof BLOG_FORMULA_V2_PROMPT_SCHEMA_VERSION;
  sourcePostCount: number;
  promptSourcePostCount: number;
  sourcePostIds: string[];
  omittedSourcePostIds: string[];
  promptCharacterCount: number;
  promptCharacterBudget: number;
  bodyCharacterBudget: number;
  promptBudgetReason: BlogFormulaV2PromptBudgetReason;
};

export type BlogFormulaV2PromptInput = {
  task: 'Extract Blog Formula V2 from owner Blog posts.';
  schemaVersion: typeof BLOG_FORMULA_V2_PROMPT_SCHEMA_VERSION;
  outputSchemaRef: 'blog_formula_v2.0';
  constraints: string[];
  storeProfile: BlogFormulaV2PromptInputStore;
  sourcePostIds: string[];
  ownerBlogPosts: Array<{
    id: string;
    title: string | null;
    sourceUrl: string | null;
    publishedAt: string | null;
    charCount: number;
    includedCharCount: number;
    isTruncated: boolean;
    bodyText: string;
  }>;
  requestedFormulaBlocks: typeof requestedFormulaBlocks;
};

type BuildBlogFormulaV2PromptInputOptions = {
  maxPromptPosts?: number;
  maxBodyCharsPerPost?: number;
  bodyCharacterBudget?: number;
  promptCharacterBudget?: number;
};

type BuildBlogFormulaV2PromptInputInput = {
  store: BlogFormulaV2PromptInputStore;
  ownerBlogPosts: OwnerBlogPostV2[];
  options?: BuildBlogFormulaV2PromptInputOptions;
};

function latestTimestamp(post: OwnerBlogPostV2) {
  return post.publishedAt ?? post.createdAt;
}

function sortLatestPosts(posts: OwnerBlogPostV2[]) {
  return [...posts].sort((left, right) => latestTimestamp(right).localeCompare(latestTimestamp(left)));
}

function truncateText(value: string, maxChars: number) {
  if (value.length <= maxChars) return { text: value, truncated: false };
  return { text: value.slice(0, Math.max(0, maxChars)), truncated: true };
}

function serializedCharacterCount(promptInput: BlogFormulaV2PromptInput) {
  return JSON.stringify(promptInput).length;
}

function promptBudgetReason(input: {
  omittedSourcePostIds: string[];
  bodyWasTruncated: boolean;
  promptWasTrimmed: boolean;
}): BlogFormulaV2PromptBudgetReason {
  if (input.promptWasTrimmed) return 'prompt_character_budget_exceeded';
  if (input.omittedSourcePostIds.length > 0) return 'source_post_limit_exceeded';
  if (input.bodyWasTruncated) return 'body_truncated_to_budget';
  return 'within_budget';
}

function buildPromptInput(store: BlogFormulaV2PromptInputStore, ownerBlogPosts: BlogFormulaV2PromptInput['ownerBlogPosts']) {
  return {
    task: 'Extract Blog Formula V2 from owner Blog posts.',
    schemaVersion: BLOG_FORMULA_V2_PROMPT_SCHEMA_VERSION,
    outputSchemaRef: 'blog_formula_v2.0',
    constraints: [
      'Use only provided owner_blog_post sources.',
      'Each formula block sourcePostIds value must refer to provided sourcePostIds.',
      'Do not use place reviews, place profiles, Instagram, or V1 ruleset fields as evidence.',
      'Do not invent treatment outcomes, rankings, guarantees, or no-side-effect claims.',
      'If evidence is weak, set block status to candidate or weak and reduce confidence.',
      'Return Korean formula names, descriptions, and patterns.'
    ],
    storeProfile: store,
    sourcePostIds: ownerBlogPosts.map((post) => post.id),
    ownerBlogPosts,
    requestedFormulaBlocks
  } satisfies BlogFormulaV2PromptInput;
}

export function buildBlogFormulaV2PromptInput(input: BuildBlogFormulaV2PromptInputInput) {
  const maxPromptPosts = input.options?.maxPromptPosts ?? DEFAULT_MAX_PROMPT_POSTS;
  const maxBodyCharsPerPost = input.options?.maxBodyCharsPerPost ?? DEFAULT_MAX_BODY_CHARS_PER_POST;
  const bodyCharacterBudget = input.options?.bodyCharacterBudget ?? DEFAULT_BODY_CHARACTER_BUDGET;
  const promptCharacterBudget = input.options?.promptCharacterBudget ?? DEFAULT_PROMPT_CHARACTER_BUDGET;
  const latestPosts = sortLatestPosts(input.ownerBlogPosts);
  const selectedPosts = latestPosts.slice(0, maxPromptPosts);
  const omittedSourcePostIds = latestPosts.slice(maxPromptPosts).map((post) => post.collectionItemId);
  let remainingBodyBudget = bodyCharacterBudget;
  let bodyWasTruncated = false;

  const ownerBlogPosts = selectedPosts.map((post) => {
    const perPostLimit = Math.min(maxBodyCharsPerPost, remainingBodyBudget);
    const truncated = truncateText(post.bodyText, perPostLimit);
    remainingBodyBudget = Math.max(0, remainingBodyBudget - truncated.text.length);
    bodyWasTruncated ||= truncated.truncated || truncated.text.length < post.bodyText.length;
    return {
      id: post.collectionItemId,
      title: post.title,
      sourceUrl: post.sourceUrl,
      publishedAt: post.publishedAt,
      charCount: post.charCount,
      includedCharCount: truncated.text.length,
      isTruncated: post.isTruncated || truncated.truncated || truncated.text.length < post.bodyText.length,
      bodyText: truncated.text
    };
  });

  let promptInput = buildPromptInput(input.store, ownerBlogPosts);
  let promptWasTrimmed = false;

  while (serializedCharacterCount(promptInput) > promptCharacterBudget && promptInput.ownerBlogPosts.length > 0) {
    promptWasTrimmed = true;
    const lastPost = promptInput.ownerBlogPosts[promptInput.ownerBlogPosts.length - 1];
    omittedSourcePostIds.unshift(lastPost.id);
    promptInput = buildPromptInput(input.store, promptInput.ownerBlogPosts.slice(0, -1));
  }

  const metadata: BlogFormulaV2PromptBudgetMetadata = {
    schemaVersion: BLOG_FORMULA_V2_PROMPT_SCHEMA_VERSION,
    sourcePostCount: input.ownerBlogPosts.length,
    promptSourcePostCount: promptInput.ownerBlogPosts.length,
    sourcePostIds: input.ownerBlogPosts.map((post) => post.collectionItemId),
    omittedSourcePostIds,
    promptCharacterCount: serializedCharacterCount(promptInput),
    promptCharacterBudget,
    bodyCharacterBudget,
    promptBudgetReason: promptBudgetReason({
      omittedSourcePostIds,
      bodyWasTruncated,
      promptWasTrimmed
    })
  };

  return {
    promptInput,
    metadata
  };
}
