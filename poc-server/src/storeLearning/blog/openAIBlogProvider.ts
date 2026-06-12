import { zodResponseFormat } from 'openai/helpers/zod';
import { getOpenAIClient } from '../../ai/openaiClient.js';
import {
  durationMs,
  nowIso,
  sanitizedProviderError,
  summarizeResponseFormat,
  toJsonValue,
  type LlmCallAuditMetadata
} from '../llmAudit/llmAuditMetadata.js';
import type { ProviderEnv } from '../providers/placeImportTypes.js';
import {
  buildBlogDraftPromptInput,
  buildBlogSeoPromptInput,
  type BlogPromptBudgetMetadata
} from './blogPromptBudget.js';
import {
  BlogProviderDraftOutputSchema,
  SeoScoreOutputSchema,
  type BlogContentProvider
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
const blogContextTooLargeMessage =
  '블로그 생성 입력이 커서 AI 처리 한도를 초과했습니다. 룰셋 또는 기존 글 내용을 줄인 뒤 다시 시도해주세요.';

function isContextLengthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /maximum context length|context length|context_length|too many tokens|tokens/i.test(message);
}

async function parseWithSanitizedProviderError(
  client: OpenAIBlogParseClient,
  params: unknown
): Promise<{ choices: Array<{ message: { parsed: unknown } }> }> {
  try {
    return await client.beta.chat.completions.parse(params);
  } catch (error) {
    if (isContextLengthError(error)) {
      throw new Error(blogContextTooLargeMessage);
    }
    throw error;
  }
}

export function createOpenAIBlogProvider(options: OpenAIBlogProviderOptions = {}): BlogContentProvider {
  const model = options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  let lastRunMetadata: BlogPromptBudgetMetadata | null = null;
  let lastAuditMetadata: LlmCallAuditMetadata | null = null;

  return {
    name: 'openAIBlogProvider',
    mode: 'openai',
    model,
    getLastRunMetadata: () => lastRunMetadata,
    getLastAuditMetadata: () => lastAuditMetadata,
    async generateDraft(input) {
      const client = 'client' in options ? options.client : getOpenAIClient();
      if (!client) {
        throw new Error('OpenAI client is unavailable');
      }
      const prompt = buildBlogDraftPromptInput(input);
      lastRunMetadata = prompt.metadata;
      lastAuditMetadata = null;
      const responseFormat = zodResponseFormat(BlogProviderDraftOutputSchema, 'store_learning_blog_draft');
      const requestPayload = {
        model,
        messages: [
          {
            role: 'system' as const,
            content:
              'You are a Korean local-store blog content strategist. Return validated structured blog draft data only. ' +
              'Follow the ruleset, keep claims evidence-safe, and produce image prompts instead of image assets.'
          },
          {
            role: 'user' as const,
            content: JSON.stringify(prompt.promptInput, null, 2)
          }
        ],
        response_format: responseFormat
      };
      const requestStartedAt = nowIso();
      let parsedOutput: unknown = null;

      try {
        const completion = await parseWithSanitizedProviderError(client as OpenAIBlogParseClient, requestPayload);

        parsedOutput = completion.choices[0]?.message.parsed ?? null;
        const output = BlogProviderDraftOutputSchema.parse(parsedOutput);
        const responseCompletedAt = nowIso();
        lastAuditMetadata = {
          requestStartedAt,
          responseCompletedAt,
          durationMs: durationMs(requestStartedAt, responseCompletedAt),
          inputBudget: toJsonValue(prompt.metadata),
          promptInputJson: toJsonValue(prompt.promptInput),
          responseFormatJson: summarizeResponseFormat(responseFormat, 'store_learning_blog_draft'),
          rawRequestedJson: toJsonValue(requestPayload),
          rawParsedOutputJson: toJsonValue(parsedOutput),
          normalizedOutputJson: toJsonValue(output),
          parsedOutputJson: toJsonValue(output),
          errorJson: null
        };
        return output;
      } catch (error) {
        const responseCompletedAt = nowIso();
        lastAuditMetadata = {
          requestStartedAt,
          responseCompletedAt,
          durationMs: durationMs(requestStartedAt, responseCompletedAt),
          inputBudget: toJsonValue(prompt.metadata),
          promptInputJson: toJsonValue(prompt.promptInput),
          responseFormatJson: summarizeResponseFormat(responseFormat, 'store_learning_blog_draft'),
          rawRequestedJson: toJsonValue(requestPayload),
          rawParsedOutputJson: toJsonValue(parsedOutput),
          normalizedOutputJson: null,
          parsedOutputJson: toJsonValue(parsedOutput),
          errorJson: sanitizedProviderError(error)
        };
        throw error;
      }
    },
    async scoreSeo(input) {
      const client = 'client' in options ? options.client : getOpenAIClient();
      if (!client) {
        throw new Error('OpenAI client is unavailable');
      }
      const prompt = buildBlogSeoPromptInput(input);
      lastRunMetadata = prompt.metadata;
      lastAuditMetadata = null;
      const responseFormat = zodResponseFormat(SeoScoreOutputSchema, 'store_learning_blog_seo_score');
      const requestPayload = {
        model,
        messages: [
          {
            role: 'system' as const,
            content:
              'You are a Korean Naver Blog SEO reviewer. Return strict structured SEO scoring only. ' +
              'Use the rubric fields exactly and do not rewrite the article.'
          },
          {
            role: 'user' as const,
            content: JSON.stringify(prompt.promptInput, null, 2)
          }
        ],
        response_format: responseFormat
      };
      const requestStartedAt = nowIso();
      let parsedOutput: unknown = null;

      try {
        const completion = await parseWithSanitizedProviderError(client as OpenAIBlogParseClient, requestPayload);

        parsedOutput = completion.choices[0]?.message.parsed ?? null;
        const output = SeoScoreOutputSchema.parse(parsedOutput);
        const responseCompletedAt = nowIso();
        lastAuditMetadata = {
          requestStartedAt,
          responseCompletedAt,
          durationMs: durationMs(requestStartedAt, responseCompletedAt),
          inputBudget: toJsonValue(prompt.metadata),
          promptInputJson: toJsonValue(prompt.promptInput),
          responseFormatJson: summarizeResponseFormat(responseFormat, 'store_learning_blog_seo_score'),
          rawRequestedJson: toJsonValue(requestPayload),
          rawParsedOutputJson: toJsonValue(parsedOutput),
          normalizedOutputJson: toJsonValue(output),
          parsedOutputJson: toJsonValue(output),
          errorJson: null
        };
        return output;
      } catch (error) {
        const responseCompletedAt = nowIso();
        lastAuditMetadata = {
          requestStartedAt,
          responseCompletedAt,
          durationMs: durationMs(requestStartedAt, responseCompletedAt),
          inputBudget: toJsonValue(prompt.metadata),
          promptInputJson: toJsonValue(prompt.promptInput),
          responseFormatJson: summarizeResponseFormat(responseFormat, 'store_learning_blog_seo_score'),
          rawRequestedJson: toJsonValue(requestPayload),
          rawParsedOutputJson: toJsonValue(parsedOutput),
          normalizedOutputJson: null,
          parsedOutputJson: toJsonValue(parsedOutput),
          errorJson: sanitizedProviderError(error)
        };
        throw error;
      }
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
