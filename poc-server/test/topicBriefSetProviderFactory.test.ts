import { describe, expect, it } from 'vitest';
import { createTopicBriefSetProviderForMode } from '../src/storeLearning/blogFormulaV2/providers/topicBriefSetProviderFactory.js';

describe('createTopicBriefSetProviderForMode', () => {
  it('returns null for deterministic and undefined (heuristic runs inline)', () => {
    expect(createTopicBriefSetProviderForMode(undefined)).toBeNull();
    expect(createTopicBriefSetProviderForMode('deterministic')).toBeNull();
  });

  it('returns the safe_mock provider', () => {
    expect(createTopicBriefSetProviderForMode('safe_mock')?.mode).toBe('safe_mock');
  });

  it('returns the openai provider', () => {
    expect(createTopicBriefSetProviderForMode('openai', { openAIClient: null })?.mode).toBe('openai');
  });

  it('auto resolves to safe_mock without an api key and openai with one', () => {
    expect(createTopicBriefSetProviderForMode('auto', { env: {} })?.mode).toBe('safe_mock');
    expect(
      createTopicBriefSetProviderForMode('auto', { env: { OPENAI_API_KEY: 'sk-test' }, openAIClient: null })?.mode
    ).toBe('openai');
  });
});
