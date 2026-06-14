import {
  createOpenAITopicBriefSetProvider,
  type OpenAITopicBriefSetParseClient
} from './openAITopicBriefSetProvider.js';
import { createSafeMockTopicBriefSetProvider } from './safeMockTopicBriefSetProvider.js';
import type {
  TopicBriefSetExtractProviderMode,
  TopicBriefSetProvider
} from './topicBriefSetProvider.js';

export type TopicBriefSetProviderFactoryEnv = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

export type TopicBriefSetProviderFactoryOptions = {
  env?: TopicBriefSetProviderFactoryEnv;
  openAIClient?: OpenAITopicBriefSetParseClient | null;
  model?: string;
};

function createOpenAIProvider(options: TopicBriefSetProviderFactoryOptions) {
  const env = options.env ?? process.env;
  const providerOptions: Parameters<typeof createOpenAITopicBriefSetProvider>[0] = {
    model: options.model ?? env.OPENAI_MODEL
  };
  if ('openAIClient' in options) {
    providerOptions.client = options.openAIClient;
  }
  return createOpenAITopicBriefSetProvider(providerOptions);
}

export function createTopicBriefSetProviderForMode(
  mode: TopicBriefSetExtractProviderMode | undefined,
  options: TopicBriefSetProviderFactoryOptions = {}
): TopicBriefSetProvider | null {
  if (!mode || mode === 'deterministic') return null;
  if (mode === 'safe_mock') return createSafeMockTopicBriefSetProvider();
  if (mode === 'openai') return createOpenAIProvider(options);

  const env = options.env ?? process.env;
  if (env.OPENAI_API_KEY) return createOpenAIProvider(options);
  return createSafeMockTopicBriefSetProvider();
}
