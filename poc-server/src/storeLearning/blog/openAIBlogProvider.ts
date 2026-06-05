import { zodResponseFormat } from 'openai/helpers/zod';
import { getOpenAIClient } from '../../ai/openaiClient.js';
import type { JsonValue } from '../../repositories/base.js';
import type { ProviderEnv } from '../providers/placeImportTypes.js';
import {
  BlogProviderDraftOutputSchema,
  SeoScoreOutputSchema,
  type BlogContentProvider,
  type BlogDraftProviderInput,
  type BlogSeoProviderInput
} from './blogProvider.js';

export type OpenAIBlogParseClient = {
  beta: {
    chat: {
      completions: {
        parse: (params: unknown) => Promise<{ choices: Array<{ message: { parsed: unknown } }> }>;
      };
    };
  };
};

type OpenAIBlogProviderOptions = {
  client?: OpenAIBlogParseClient | null;
  model?: string;
};

const DEFAULT_MODEL = 'gpt-4o-mini';

function asRecord(value: JsonValue | unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function compactRulesetField(field: BlogDraftProviderInput['rulesetFields'][number]) {
  return {
    fieldKey: field.fieldKey,
    finalValue: field.finalValue ?? field.fieldValue ?? field.aiValue,
    source: field.source,
    locked: Boolean(field.locked)
  };
}

function compactMediaAsset(asset: BlogSeoProviderInput['mediaAssets'][number]) {
  return {
    id: asset.id,
    assetType: asset.assetType,
    status: asset.status,
    prompt: asset.prompt ?? asRecord(asset.metadata).prompt ?? null,
    metadata: asset.metadata
  };
}

function draftPromptInput(input: BlogDraftProviderInput) {
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
      'Image generation is out of scope; return image prompts only.',
      'Keep the draft approval-pending and do not include publishing instructions.'
    ],
    store: {
      id: input.store.id,
      name: input.store.name,
      category: input.store.category,
      address: input.store.address,
      description: input.store.description,
      metadata: input.store.metadata
    },
    ruleset: input.ruleset.ruleset,
    rulesetFields: input.rulesetFields.map((field) => compactRulesetField(field)),
    currentPost: input.currentPost
      ? {
          id: input.currentPost.id,
          status: input.currentPost.status,
          title: input.currentPost.title,
          article: input.currentArticle ?? input.currentPost.article
        }
      : null,
    mediaAssets: input.mediaAssets?.map((asset) => compactMediaAsset(asset)) ?? []
  };
}

function seoPromptInput(input: BlogSeoProviderInput) {
  return {
    task: 'Score this Korean Naver Blog draft for SEO and approval readiness.',
    constraints: [
      'Return only structured SEO scores matching the requested schema.',
      'Score conservatively using the provided article, image prompts, and marketing ruleset.',
      'Do not rewrite the article in this response.'
    ],
    store: {
      id: input.store.id,
      name: input.store.name,
      category: input.store.category,
      address: input.store.address
    },
    ruleset: input.ruleset?.ruleset ?? null,
    rulesetFields: input.rulesetFields.map((field) => compactRulesetField(field)),
    post: {
      id: input.post.id,
      status: input.post.status,
      title: input.post.title,
      article: input.article
    },
    mediaAssets: input.mediaAssets.map((asset) => compactMediaAsset(asset))
  };
}

export function createOpenAIBlogProvider(options: OpenAIBlogProviderOptions = {}): BlogContentProvider {
  return {
    name: 'openAIBlogProvider',
    mode: 'openai',
    async generateDraft(input) {
      const client = 'client' in options ? options.client : getOpenAIClient();
      if (!client) {
        throw new Error('OpenAI client is unavailable');
      }

      const completion = await client.beta.chat.completions.parse({
        model: options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a Korean local-store blog content strategist. Return validated structured blog draft data only. ' +
              'Follow the ruleset, keep claims evidence-safe, and produce image prompts instead of image assets.'
          },
          {
            role: 'user',
            content: JSON.stringify(draftPromptInput(input), null, 2)
          }
        ],
        response_format: zodResponseFormat(BlogProviderDraftOutputSchema, 'store_learning_blog_draft')
      });

      return BlogProviderDraftOutputSchema.parse(completion.choices[0]?.message.parsed);
    },
    async scoreSeo(input) {
      const client = 'client' in options ? options.client : getOpenAIClient();
      if (!client) {
        throw new Error('OpenAI client is unavailable');
      }

      const completion = await client.beta.chat.completions.parse({
        model: options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a Korean Naver Blog SEO reviewer. Return strict structured SEO scoring only. ' +
              'Use the rubric fields exactly and do not rewrite the article.'
          },
          {
            role: 'user',
            content: JSON.stringify(seoPromptInput(input), null, 2)
          }
        ],
        response_format: zodResponseFormat(SeoScoreOutputSchema, 'store_learning_blog_seo_score')
      });

      return SeoScoreOutputSchema.parse(completion.choices[0]?.message.parsed);
    }
  };
}

export function createBlogContentProvider(
  env: ProviderEnv = process.env,
  options: OpenAIBlogProviderOptions = {}
): BlogContentProvider | null {
  if (env.OPENAI_API_KEY) {
    const providerOptions: OpenAIBlogProviderOptions = {
      model: options.model ?? env.OPENAI_MODEL
    };
    if ('client' in options) {
      providerOptions.client = options.client;
    }
    return createOpenAIBlogProvider(providerOptions);
  }
  return null;
}
