import type { JsonValue } from '../../repositories/base.js';
import type { BlogPost } from '../../repositories/blog_posts.js';
import type { MediaAsset } from '../../repositories/media_assets.js';
import type { MarketingRuleset } from '../../repositories/marketing_rulesets.js';
import type { RulesetField } from '../../repositories/ruleset_fields.js';
import type { Store } from '../../repositories/stores.js';
import type { BlogDraftProviderInput, BlogSeoProviderInput } from './blogProvider.js';

type BlogPromptBudgetOptions = {
  promptCharacterBudget?: number;
  articleCharacterBudget?: number;
  sectionCharacterBudget?: number;
  rulesetFieldCharacterBudget?: number;
  mediaAssetLimit?: number;
};

type BlogPromptBuildLimits = {
  articleCharacterBudget: number;
  sectionCharacterBudget: number;
  rulesetFieldCharacterBudget: number;
  mediaAssetLimit: number;
  articleSectionLimit: number;
  seoKeywordLimit: number;
  imagePromptLimit: number;
};

export type BlogPromptBudgetMetadata = {
  action: 'generate_blog_post' | 'regenerate_text' | 'seo_rescore';
  promptCharacterCount: number;
  promptCharacterBudget: number;
  promptBudgetReason:
    | 'within_budget'
    | 'article_truncated_to_budget'
    | 'media_asset_limit_exceeded'
    | 'prompt_character_budget_exceeded';
  rulesetFieldCount: number;
  mediaAssetCount: number;
  promptMediaAssetCount: number;
  articleCharacterBudget: number;
};

const DEFAULT_PROMPT_CHARACTER_BUDGET = 30000;
const DEFAULT_ARTICLE_CHARACTER_BUDGET = 12000;
const DEFAULT_SECTION_CHARACTER_BUDGET = 1800;
const DEFAULT_RULESET_FIELD_CHARACTER_BUDGET = 800;
const DEFAULT_MEDIA_ASSET_LIMIT = 12;
const DEFAULT_ARTICLE_SECTION_LIMIT = 8;
const DEFAULT_SEO_KEYWORD_LIMIT = 12;
const DEFAULT_IMAGE_PROMPT_LIMIT = 8;

const STORE_METADATA_ALLOWLIST = [
  'category',
  'address',
  'phone',
  'businessHours',
  'closedDays',
  'parking',
  'intro',
  'description',
  'treatmentSubjects',
  'representativeTreatmentSubjects',
  'representativeMenu'
] as const;

const RULESET_SUMMARY_KEYS = [
  'positioning',
  'storePositioning',
  'toneAndManner',
  'blogWritingStyle',
  'keywordMap',
  'titlePatterns',
  'introPattern',
  'bodyOutlinePattern',
  'headingPattern',
  'seoKeywords',
  'seoPlacementPolicy',
  'contentKeywords',
  'ctaStyle',
  'negativeExpressions'
] as const;

const BLOG_PROMPT_RULESET_FIELD_KEYS = new Set([
  'storePositioning',
  'keyStrengths',
  'representativeMenu',
  'targetCustomers',
  'contentKeywords',
  'reviewStrength',
  'reviewWeakness',
  'toneAndManner',
  'catchphrase',
  'industryCommonRules',
  'blogRequiredIntroCopy',
  'blogRequiredFooterCopy',
  'negativeExpressions',
  'blogPurpose',
  'keywordMap',
  'titlePatterns',
  'introPattern',
  'bodyOutlinePattern',
  'headingPattern',
  'blogWritingStyle',
  'blogPreferredLength',
  'blogHashtags',
  'blogEmojiPolicy',
  'seoKeywords',
  'seoPlacementPolicy',
  'ctaStyle'
]);

function asRecord(value: JsonValue | unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 20)).trimEnd()}... [truncated]`;
}

function compactMetadata(metadata: JsonValue | unknown, keys: readonly string[]) {
  const record = asRecord(metadata);
  return Object.fromEntries(
    keys
      .filter((key) => record[key] !== undefined && record[key] !== null && record[key] !== '')
      .map((key) => [key, record[key] as JsonValue])
  );
}

function compactStore(store: Store) {
  return {
    id: store.id,
    name: store.name,
    category: store.category,
    address: store.address,
    phone: store.phone,
    description: store.description,
    metadata: compactMetadata(store.metadata, STORE_METADATA_ALLOWLIST)
  };
}

function compactRulesetField(field: RulesetField, valueCharacterBudget: number) {
  const finalValue = field.finalValue || field.fieldValue || field.aiValue;
  return {
    fieldKey: field.fieldKey,
    finalValue: truncate(finalValue, valueCharacterBudget),
    source: field.source,
    locked: Boolean(field.locked)
  };
}

function promptRulesetFields(fields: RulesetField[]) {
  return fields.filter((field) => BLOG_PROMPT_RULESET_FIELD_KEYS.has(field.fieldKey));
}

function compactRuleset(ruleset: MarketingRuleset | null, fields: RulesetField[], valueCharacterBudget: number) {
  if (!ruleset) {
    return null;
  }
  const rawRuleset = asRecord(ruleset.ruleset);
  return {
    id: ruleset.id,
    status: ruleset.status,
    version: ruleset.version,
    summary: compactMetadata(rawRuleset as JsonValue, RULESET_SUMMARY_KEYS),
    fields: promptRulesetFields(fields).map((field) => compactRulesetField(field, valueCharacterBudget))
  };
}

function compactArticle(articleInput: JsonValue | unknown, limits: BlogPromptBuildLimits) {
  const article = asRecord(articleInput);
  const rawSections = Array.isArray(article.bodySections) ? article.bodySections : [];
  const bodySections = rawSections
    .map((section) => {
      const record = asRecord(section);
      return {
        heading: truncate(asString(record.heading), 160),
        body: truncate(asString(record.body), limits.sectionCharacterBudget)
      };
    })
    .filter((section) => section.heading || section.body)
    .slice(0, limits.articleSectionLimit);
  const rawBlocks = Array.isArray(article.blocks) ? article.blocks : [];
  if (bodySections.length === 0 && rawBlocks.length > 0) {
    const blockText = rawBlocks
      .map((block) => asString(asRecord(block).text))
      .filter(Boolean)
      .join('\n');
    if (blockText) {
      bodySections.push({
        heading: truncate(asString(article.title) || '본문', 160),
        body: truncate(blockText, limits.sectionCharacterBudget)
      });
    }
  }
  const bodyText = bodySections.map((section) => `${section.heading}\n${section.body}`).join('\n\n');
  return {
    title: truncate(asString(article.title), 180),
    metaDescription: truncate(asString(article.metaDescription), 300),
    bodySections,
    bodyText: truncate(bodyText, limits.articleCharacterBudget),
    seoKeywords: Array.isArray(article.seoKeywords)
      ? article.seoKeywords.filter((item) => typeof item === 'string').slice(0, limits.seoKeywordLimit)
      : [],
    cta: truncate(asString(article.cta), 300),
    imagePrompts: Array.isArray(article.imagePrompts)
      ? article.imagePrompts
          .filter((item) => typeof item === 'string')
          .map((item) => truncate(item, 220))
          .slice(0, limits.imagePromptLimit)
      : []
  };
}

function compactCurrentPost(
  post: BlogPost | undefined,
  articleInput: JsonValue | undefined,
  limits: BlogPromptBuildLimits
) {
  if (!post) return null;
  return {
    id: post.id,
    status: post.status,
    title: post.title,
    article: compactArticle(articleInput ?? post.article, limits)
  };
}

function compactMediaAsset(asset: MediaAsset) {
  const metadata = asRecord(asset.metadata);
  const prompt = (asset.prompt ?? asString(metadata.prompt)) || null;
  return {
    id: asset.id,
    assetType: asset.assetType,
    status: asset.status,
    prompt,
    metadata: compactMetadata(asset.metadata, ['prompt', 'alt', 'placement', 'generator'])
  };
}

function initialReason(mediaAssetCount: number, promptMediaAssetCount: number): BlogPromptBudgetMetadata['promptBudgetReason'] {
  return mediaAssetCount > promptMediaAssetCount ? 'media_asset_limit_exceeded' : 'within_budget';
}

function measure(promptInput: unknown) {
  return JSON.stringify(promptInput).length;
}

function budgetOptions(options: BlogPromptBudgetOptions = {}) {
  return {
    promptCharacterBudget: options.promptCharacterBudget ?? DEFAULT_PROMPT_CHARACTER_BUDGET,
    articleCharacterBudget: options.articleCharacterBudget ?? DEFAULT_ARTICLE_CHARACTER_BUDGET,
    sectionCharacterBudget: options.sectionCharacterBudget ?? DEFAULT_SECTION_CHARACTER_BUDGET,
    rulesetFieldCharacterBudget: options.rulesetFieldCharacterBudget ?? DEFAULT_RULESET_FIELD_CHARACTER_BUDGET,
    mediaAssetLimit: options.mediaAssetLimit ?? DEFAULT_MEDIA_ASSET_LIMIT
  };
}

function initialLimits(budget: ReturnType<typeof budgetOptions>): BlogPromptBuildLimits {
  return {
    articleCharacterBudget: budget.articleCharacterBudget,
    sectionCharacterBudget: budget.sectionCharacterBudget,
    rulesetFieldCharacterBudget: budget.rulesetFieldCharacterBudget,
    mediaAssetLimit: budget.mediaAssetLimit,
    articleSectionLimit: DEFAULT_ARTICLE_SECTION_LIMIT,
    seoKeywordLimit: DEFAULT_SEO_KEYWORD_LIMIT,
    imagePromptLimit: DEFAULT_IMAGE_PROMPT_LIMIT
  };
}

function reduceLimits(limits: BlogPromptBuildLimits) {
  if (limits.mediaAssetLimit > 3) {
    limits.mediaAssetLimit = Math.max(3, Math.floor(limits.mediaAssetLimit * 0.6));
    return true;
  }
  if (limits.articleSectionLimit > 3) {
    limits.articleSectionLimit -= 1;
    return true;
  }
  if (limits.sectionCharacterBudget > 450) {
    limits.sectionCharacterBudget = Math.max(450, Math.floor(limits.sectionCharacterBudget * 0.7));
    return true;
  }
  if (limits.articleCharacterBudget > 1600) {
    limits.articleCharacterBudget = Math.max(1600, Math.floor(limits.articleCharacterBudget * 0.7));
    return true;
  }
  if (limits.rulesetFieldCharacterBudget > 120) {
    limits.rulesetFieldCharacterBudget = Math.max(120, Math.floor(limits.rulesetFieldCharacterBudget * 0.7));
    return true;
  }
  if (limits.mediaAssetLimit > 0) {
    limits.mediaAssetLimit -= 1;
    return true;
  }
  if (limits.articleSectionLimit > 1) {
    limits.articleSectionLimit -= 1;
    return true;
  }
  if (limits.sectionCharacterBudget > 180) {
    limits.sectionCharacterBudget = Math.max(180, Math.floor(limits.sectionCharacterBudget * 0.7));
    return true;
  }
  if (limits.articleCharacterBudget > 600) {
    limits.articleCharacterBudget = Math.max(600, Math.floor(limits.articleCharacterBudget * 0.7));
    return true;
  }
  if (limits.rulesetFieldCharacterBudget > 50) {
    limits.rulesetFieldCharacterBudget = Math.max(50, Math.floor(limits.rulesetFieldCharacterBudget * 0.7));
    return true;
  }
  return false;
}

function fitPromptToBudget<T extends Record<string, unknown>>(
  build: (limits: BlogPromptBuildLimits) => T,
  initial: BlogPromptBuildLimits,
  promptCharacterBudget: number
) {
  const limits = { ...initial };
  let promptInput = build(limits);
  let promptCharacterCount = measure(promptInput);
  let reducedForPromptBudget = false;

  while (promptCharacterCount > promptCharacterBudget) {
    if (!reduceLimits(limits)) break;
    reducedForPromptBudget = true;
    promptInput = build(limits);
    promptCharacterCount = measure(promptInput);
  }

  return {
    promptInput,
    promptCharacterCount,
    limits,
    reducedForPromptBudget
  };
}

function finalizePrompt<T extends Record<string, unknown>>(
  promptInput: T,
  metadata: Omit<BlogPromptBudgetMetadata, 'promptCharacterCount' | 'promptBudgetReason'>,
  reason: BlogPromptBudgetMetadata['promptBudgetReason'],
  promptCharacterCount = measure(promptInput)
) {
  return {
    promptInput,
    metadata: {
      ...metadata,
      promptCharacterCount,
      promptBudgetReason:
        promptCharacterCount > metadata.promptCharacterBudget ? 'prompt_character_budget_exceeded' : reason
    } satisfies BlogPromptBudgetMetadata
  };
}

export function buildBlogDraftPromptInput(input: BlogDraftProviderInput, options: BlogPromptBudgetOptions = {}) {
  const budget = budgetOptions(options);
  const fitted = fitPromptToBudget(
    (limits) => {
      const promptMediaAssets = input.mediaAssets?.slice(0, limits.mediaAssetLimit) ?? [];
      const rulesetFields = promptRulesetFields(input.rulesetFields).map((field) =>
        compactRulesetField(field, limits.rulesetFieldCharacterBudget)
      );
      const currentPost = compactCurrentPost(input.currentPost, input.currentArticle, limits);
      return {
        task:
          input.action === 'regenerate_text'
            ? 'Regenerate a Korean approval-pending Naver Blog article draft for the store.'
            : 'Generate a Korean approval-pending Naver Blog article draft for the store.',
        constraints: [
          'Return only structured data matching the requested schema.',
          'Use Korean copy suitable for a local-store Naver Blog post.',
          'Respect the current marketing ruleset and avoid forbidden or exaggerated expressions.',
          'Do not claim unsupported facts, discounts, guarantees, medical effects, or official rankings.',
          'Do not imply Naver top-ranking guarantees or claim algorithmic ranking outcomes.',
          'Image generation is out of scope; return image prompts only.',
          'Keep the draft approval-pending and do not include publishing instructions.'
        ],
        store: compactStore(input.store),
        ruleset: compactRuleset(input.ruleset, input.rulesetFields, limits.rulesetFieldCharacterBudget),
        rulesetFields,
        currentPost,
        mediaAssets: promptMediaAssets.map((asset) => compactMediaAsset(asset))
      };
    },
    initialLimits(budget),
    budget.promptCharacterBudget
  );
  const promptMediaAssetCount = input.mediaAssets?.slice(0, fitted.limits.mediaAssetLimit).length ?? 0;
  const currentPost = Boolean(input.currentPost);
  const reason = fitted.reducedForPromptBudget
    ? 'prompt_character_budget_exceeded'
    : currentPost
      ? 'article_truncated_to_budget'
      : initialReason(input.mediaAssets?.length ?? 0, promptMediaAssetCount);

  return finalizePrompt(
    fitted.promptInput,
    {
      action: input.action,
      promptCharacterBudget: budget.promptCharacterBudget,
      rulesetFieldCount: input.rulesetFields.length,
      mediaAssetCount: input.mediaAssets?.length ?? 0,
      promptMediaAssetCount,
      articleCharacterBudget: fitted.limits.articleCharacterBudget
    },
    reason,
    fitted.promptCharacterCount
  );
}

export function buildBlogSeoPromptInput(input: BlogSeoProviderInput, options: BlogPromptBudgetOptions = {}) {
  const budget = budgetOptions(options);
  const fitted = fitPromptToBudget(
    (limits) => {
      const promptMediaAssets = input.mediaAssets.slice(0, limits.mediaAssetLimit);
      const rulesetFields = promptRulesetFields(input.rulesetFields).map((field) =>
        compactRulesetField(field, limits.rulesetFieldCharacterBudget)
      );
      return {
        task: 'Score this Korean Naver Blog draft for SEO and approval readiness.',
        constraints: [
          'Return only structured SEO scores matching the requested schema.',
          'Score conservatively using the provided article, image prompts, and marketing ruleset.',
          'Do not reward or imply Naver top-ranking guarantees or algorithmic ranking outcomes.',
          'Do not rewrite the article in this response.'
        ],
        store: {
          id: input.store.id,
          name: input.store.name,
          category: input.store.category,
          address: input.store.address
        },
        ruleset: compactRuleset(input.ruleset, input.rulesetFields, limits.rulesetFieldCharacterBudget),
        rulesetFields,
        post: {
          id: input.post.id,
          status: input.post.status,
          title: input.post.title,
          article: compactArticle(input.article, limits)
        },
        mediaAssets: promptMediaAssets.map((asset) => compactMediaAsset(asset))
      };
    },
    initialLimits(budget),
    budget.promptCharacterBudget
  );
  const promptMediaAssetCount = input.mediaAssets.slice(0, fitted.limits.mediaAssetLimit).length;

  return finalizePrompt(
    fitted.promptInput,
    {
      action: 'seo_rescore',
      promptCharacterBudget: budget.promptCharacterBudget,
      rulesetFieldCount: input.rulesetFields.length,
      mediaAssetCount: input.mediaAssets.length,
      promptMediaAssetCount,
      articleCharacterBudget: fitted.limits.articleCharacterBudget
    },
    fitted.reducedForPromptBudget ? 'prompt_character_budget_exceeded' : 'article_truncated_to_budget',
    fitted.promptCharacterCount
  );
}
