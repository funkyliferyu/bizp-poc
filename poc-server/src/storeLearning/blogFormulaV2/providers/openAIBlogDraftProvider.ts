import { zodResponseFormat } from 'openai/helpers/zod';
import { getOpenAIClient } from '../../../ai/openaiClient.js';
import {
  durationMs,
  nowIso,
  sanitizedProviderError,
  summarizeResponseFormat,
  toJsonValue,
  type LlmCallAuditMetadata
} from '../../llmAudit/llmAuditMetadata.js';
import {
  BLOG_FORMULA_V2_DRAFT_CALL_ID,
  BLOG_FORMULA_V2_DRAFT_PROMPT_SCHEMA_VERSION,
  BLOG_FORMULA_V2_DRAFT_RESPONSE_FORMAT_NAME,
  buildBlogFormulaV2DraftPromptInput
} from '../blogDraftPrompt.js';
import { BlogDraftModelResponseV2Schema } from '../types.js';
import type {
  BlogDraftV2GenerateInput,
  BlogDraftV2Provider,
  BlogDraftV2ProviderProvenance
} from './blogDraftV2Provider.js';

export type OpenAIBlogDraftParseClient = {
  beta: {
    chat: {
      completions: {
        parse: (params: unknown) => Promise<{ choices: Array<{ message: { parsed: unknown } }> }>;
      };
    };
  };
};

type OpenAIBlogDraftProviderOptions = {
  client?: OpenAIBlogDraftParseClient | null;
  model?: string;
};

const DEFAULT_MODEL = 'gpt-4o-mini';
const systemPrompt =
  'You are a Korean local-store blog content strategist. ' +
  'You write a NEW Naver Blog draft by applying the provided Blog Formula V2 writing formula, a Topic Brief, and retrieved owner Blog style examples Top 1~3. ' +
  'The formula tells you HOW this store writes (title slots, intro/body/footer move sequences, heading style, tone habits, soft CTA, footer/disclaimer, medical safety); reproduce that style for the new topic. ' +
  'Use the style examples for structure and tone only — never copy their sentences. ' +
  'Place the main keyword in the title and first paragraph, weave secondary keywords in naturally, include the required medical disclosures, and never use banned claims or the brief mustAvoid phrases. ' +
  'Do not hardcode operating hours or invent treatment outcomes, rankings, or guarantees. ' +
  'Return validated structured draft data only; keep the draft approval-pending.';

function provenance(model: string): BlogDraftV2ProviderProvenance {
  return {
    name: 'openAIBlogDraftV2Provider',
    mode: 'openai',
    model,
    callId: BLOG_FORMULA_V2_DRAFT_CALL_ID,
    promptShapeVersion: BLOG_FORMULA_V2_DRAFT_PROMPT_SCHEMA_VERSION,
    noExternalCalls: false
  };
}

export function createOpenAIBlogDraftV2Provider(
  options: OpenAIBlogDraftProviderOptions = {}
): BlogDraftV2Provider {
  const model = options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  let lastAuditMetadata: LlmCallAuditMetadata | null = null;

  return {
    name: 'openAIBlogDraftV2Provider',
    mode: 'openai',
    model,
    getLastAuditMetadata: () => lastAuditMetadata,
    async generateDraft(input: BlogDraftV2GenerateInput) {
      const client = 'client' in options ? options.client : getOpenAIClient();
      if (!client) {
        throw new Error('OpenAI client is unavailable');
      }

      const prompt = buildBlogFormulaV2DraftPromptInput({
        store: input.store,
        formula: input.formula,
        topicBrief: input.topicBrief,
        samples: input.samples
      });
      lastAuditMetadata = null;
      const responseFormat = zodResponseFormat(BlogDraftModelResponseV2Schema, BLOG_FORMULA_V2_DRAFT_RESPONSE_FORMAT_NAME);
      const provider = provenance(model);
      const requestPayload = {
        model,
        messages: [
          {
            role: 'system' as const,
            content: systemPrompt
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
        const completion = await client.beta.chat.completions.parse(requestPayload);
        parsedOutput = completion.choices[0]?.message.parsed ?? null;
        const modelResponse = BlogDraftModelResponseV2Schema.parse(parsedOutput);
        const creative = {
          titleCandidates: modelResponse.titleCandidates,
          selectedTitle: modelResponse.selectedTitle,
          blogDraft: modelResponse.blogDraft
        };
        const modelReportedCompliance = {
          styleComplianceReport: modelResponse.styleComplianceReport,
          safetyCheck: modelResponse.safetyCheck,
          seoCheck: modelResponse.seoCheck
        };
        const responseCompletedAt = nowIso();
        lastAuditMetadata = {
          requestStartedAt,
          responseCompletedAt,
          durationMs: durationMs(requestStartedAt, responseCompletedAt),
          inputBudget: toJsonValue(prompt.metadata),
          promptInputJson: toJsonValue(prompt.promptInput),
          responseFormatJson: summarizeResponseFormat(responseFormat, BLOG_FORMULA_V2_DRAFT_RESPONSE_FORMAT_NAME),
          rawRequestedJson: toJsonValue(requestPayload),
          rawParsedOutputJson: toJsonValue(parsedOutput),
          normalizedOutputJson: toJsonValue(modelResponse),
          parsedOutputJson: toJsonValue(modelResponse),
          errorJson: null,
          providerMetadataJson: toJsonValue(provider)
        };
        return {
          creative,
          modelReportedCompliance,
          provider,
          inputBudget: prompt.metadata,
          promptInput: prompt.promptInput
        };
      } catch (error) {
        const responseCompletedAt = nowIso();
        lastAuditMetadata = {
          requestStartedAt,
          responseCompletedAt,
          durationMs: durationMs(requestStartedAt, responseCompletedAt),
          inputBudget: toJsonValue(prompt.metadata),
          promptInputJson: toJsonValue(prompt.promptInput),
          responseFormatJson: summarizeResponseFormat(responseFormat, BLOG_FORMULA_V2_DRAFT_RESPONSE_FORMAT_NAME),
          rawRequestedJson: toJsonValue(requestPayload),
          rawParsedOutputJson: toJsonValue(parsedOutput),
          normalizedOutputJson: null,
          parsedOutputJson: toJsonValue(parsedOutput),
          errorJson: sanitizedProviderError(error),
          providerMetadataJson: toJsonValue(provider)
        };
        throw error;
      }
    }
  };
}
