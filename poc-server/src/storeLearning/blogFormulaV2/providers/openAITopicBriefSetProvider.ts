import { zodResponseFormat } from 'openai/helpers/zod';
import { getOpenAIClient } from '../../../ai/openaiClient.js';
import {
  BLOG_TOPIC_BRIEF_SET_V2_CALL_ID,
  BLOG_TOPIC_BRIEF_SET_V2_PROMPT_SCHEMA_VERSION,
  BLOG_TOPIC_BRIEF_SET_V2_RESPONSE_FORMAT_NAME,
  buildTopicBriefSetV2PromptInput
} from '../topicBriefSetPrompt.js';
import { TopicBriefSetV2ResponseFormatSchema, type TopicBriefSetCandidate } from '../types.js';
import type {
  TopicBriefSetProvider,
  TopicBriefSetProviderProvenance
} from './topicBriefSetProvider.js';

export type OpenAITopicBriefSetParseClient = {
  beta: {
    chat: {
      completions: {
        parse: (params: unknown) => Promise<{ choices: Array<{ message: { parsed: unknown } }> }>;
      };
    };
  };
};

type OpenAITopicBriefSetProviderOptions = {
  client?: OpenAITopicBriefSetParseClient | null;
  model?: string;
};

const DEFAULT_MODEL = 'gpt-4o-mini';
const systemPrompt =
  'You are a Korean local-store blog topic analyst. ' +
  'For each provided owner Blog post, extract one reusable Topic Brief set: ' +
  'topic, main keyword, secondary keywords, target reader, core concern, main angle, ' +
  'must-include points, must-avoid expressions, and a soft CTA direction. ' +
  'Echo the provided post id in each item. Use only the provided post as evidence, ' +
  'keep medical, legal, and guarantee claims conservative, and use null for fields you cannot infer.';

function provenance(model: string): TopicBriefSetProviderProvenance {
  return {
    name: 'openAITopicBriefSetProvider',
    mode: 'openai',
    model,
    callId: BLOG_TOPIC_BRIEF_SET_V2_CALL_ID,
    promptShapeVersion: BLOG_TOPIC_BRIEF_SET_V2_PROMPT_SCHEMA_VERSION,
    noExternalCalls: false
  };
}

export function createOpenAITopicBriefSetProvider(
  options: OpenAITopicBriefSetProviderOptions = {}
): TopicBriefSetProvider {
  const model = options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;

  return {
    name: 'openAITopicBriefSetProvider',
    mode: 'openai',
    model,
    async extractTopicBriefSets(input) {
      const client = 'client' in options ? options.client : getOpenAIClient();
      if (!client) {
        throw new Error('OpenAI client is unavailable');
      }

      const { promptInput } = buildTopicBriefSetV2PromptInput(input);
      const responseFormat = zodResponseFormat(
        TopicBriefSetV2ResponseFormatSchema,
        BLOG_TOPIC_BRIEF_SET_V2_RESPONSE_FORMAT_NAME
      );
      const completion = await client.beta.chat.completions.parse({
        model,
        messages: [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: JSON.stringify(promptInput, null, 2) }
        ],
        response_format: responseFormat
      });
      const parsed = TopicBriefSetV2ResponseFormatSchema.parse(completion.choices[0]?.message.parsed ?? null);
      const postIds = new Set(input.posts.map((post) => post.collectionItemId));
      const sets: TopicBriefSetCandidate[] = parsed.topicBriefSets
        .filter((item) => postIds.has(item.id))
        .map((item) => ({
          sourcePostIds: [item.id],
          confidence: 0.7,
          status: 'candidate' as const,
          topic: item.topic,
          mainKeyword: item.mainKeyword,
          secondaryKeywords: item.secondaryKeywords,
          targetReader: item.targetReader,
          coreConcern: item.coreConcern,
          mainAngle: item.mainAngle,
          mustInclude: item.mustInclude,
          mustAvoid: item.mustAvoid,
          ctaDirection: item.ctaDirection
        }));

      return { sets, provider: provenance(model) };
    }
  };
}
