import { createOpenAIBlogDraftV2Provider, type OpenAIBlogDraftParseClient } from './openAIBlogDraftProvider.js';
import { createSafeMockBlogDraftV2Provider } from './safeMockBlogDraftProvider.js';
import type {
  BlogDraftV2GenerateProviderMode,
  BlogDraftV2Provider
} from './blogDraftV2Provider.js';

export type BlogDraftV2ProviderFactoryEnv = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

export type BlogDraftV2ProviderFactoryOptions = {
  env?: BlogDraftV2ProviderFactoryEnv;
  openAIClient?: OpenAIBlogDraftParseClient | null;
  model?: string;
};

function createOpenAIProvider(options: BlogDraftV2ProviderFactoryOptions) {
  const env = options.env ?? process.env;
  const providerOptions: Parameters<typeof createOpenAIBlogDraftV2Provider>[0] = {
    model: options.model ?? env.OPENAI_MODEL
  };
  if ('openAIClient' in options) {
    providerOptions.client = options.openAIClient;
  }
  return createOpenAIBlogDraftV2Provider(providerOptions);
}

export function createBlogDraftV2ProviderForMode(
  providerMode: BlogDraftV2GenerateProviderMode | undefined,
  options: BlogDraftV2ProviderFactoryOptions = {}
): BlogDraftV2Provider | null {
  if (!providerMode || providerMode === 'deterministic') return null;
  if (providerMode === 'safe_mock') return createSafeMockBlogDraftV2Provider();
  if (providerMode === 'openai') return createOpenAIProvider(options);

  const env = options.env ?? process.env;
  if (env.OPENAI_API_KEY) return createOpenAIProvider(options);
  return createSafeMockBlogDraftV2Provider();
}
