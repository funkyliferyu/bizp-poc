import {
  BLOG_TOPIC_BRIEF_SET_V2_CALL_ID,
  BLOG_TOPIC_BRIEF_SET_V2_PROMPT_SCHEMA_VERSION
} from '../topicBriefSetPrompt.js';
import { buildHeuristicTopicBriefSets } from '../topicBriefSetHeuristic.js';
import type {
  TopicBriefSetProvider,
  TopicBriefSetProviderProvenance
} from './topicBriefSetProvider.js';

const SAFE_MOCK_MODEL = 'safe-mock-topic-brief-set-v2';

function provenance(): TopicBriefSetProviderProvenance {
  return {
    name: 'safeMockTopicBriefSetProvider',
    mode: 'safe_mock',
    model: SAFE_MOCK_MODEL,
    callId: BLOG_TOPIC_BRIEF_SET_V2_CALL_ID,
    promptShapeVersion: BLOG_TOPIC_BRIEF_SET_V2_PROMPT_SCHEMA_VERSION,
    noExternalCalls: true
  };
}

export function createSafeMockTopicBriefSetProvider(): TopicBriefSetProvider {
  return {
    name: 'safeMockTopicBriefSetProvider',
    mode: 'safe_mock',
    model: SAFE_MOCK_MODEL,
    async extractTopicBriefSets(input) {
      return { sets: buildHeuristicTopicBriefSets(input.store, input.posts), provider: provenance() };
    }
  };
}
