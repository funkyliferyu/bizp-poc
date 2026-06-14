import type { OwnerBlogPostV2 } from '../sourcePosts.js';
import type { TopicBriefSetCandidate } from '../types.js';
import type {
  BLOG_TOPIC_BRIEF_SET_V2_CALL_ID,
  BLOG_TOPIC_BRIEF_SET_V2_PROMPT_SCHEMA_VERSION,
  TopicBriefSetPromptStore
} from '../topicBriefSetPrompt.js';

export type TopicBriefSetProviderMode = 'deterministic' | 'safe_mock' | 'openai';
export type TopicBriefSetExtractProviderMode = TopicBriefSetProviderMode | 'auto';

export type TopicBriefSetProviderProvenance = {
  name: string;
  mode: TopicBriefSetProviderMode;
  model: string;
  callId: typeof BLOG_TOPIC_BRIEF_SET_V2_CALL_ID;
  promptShapeVersion: typeof BLOG_TOPIC_BRIEF_SET_V2_PROMPT_SCHEMA_VERSION;
  noExternalCalls: boolean;
};

export type TopicBriefSetExtractInput = {
  store: TopicBriefSetPromptStore;
  posts: OwnerBlogPostV2[];
};

export type TopicBriefSetProviderResult = {
  sets: TopicBriefSetCandidate[];
  provider: TopicBriefSetProviderProvenance;
};

export type TopicBriefSetProvider = {
  name: string;
  mode: TopicBriefSetProviderMode;
  model: string;
  extractTopicBriefSets(input: TopicBriefSetExtractInput): Promise<TopicBriefSetProviderResult>;
};
