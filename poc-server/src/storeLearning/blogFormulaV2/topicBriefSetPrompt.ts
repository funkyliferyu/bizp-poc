import type { OwnerBlogPostV2 } from './sourcePosts.js';

export const BLOG_TOPIC_BRIEF_SET_V2_PROMPT_SCHEMA_VERSION = 'blog_topic_brief_set_v2_extraction_input.v1';
export const BLOG_TOPIC_BRIEF_SET_V2_RESPONSE_FORMAT_NAME = 'store_learning_blog_topic_brief_set_v2';
export const BLOG_TOPIC_BRIEF_SET_V2_CALL_ID = 'SL-F2';
export const TOPIC_BRIEF_SET_BATCH_SIZE = 10;

const MAX_BODY_CHARS_PER_POST = 2000;

const topicBriefSetInstructions = [
  'For each provided owner Blog post, produce exactly one reusable Topic Brief set.',
  'Echo the provided post id in the "id" field so each set maps back to its post.',
  'Infer topic and mainKeyword from the title and recurring keywords; list other notable keywords as secondaryKeywords.',
  'Infer targetReader, coreConcern, mainAngle, mustInclude, mustAvoid, and ctaDirection from how the post is written.',
  'Keep phrasing medical-ad-safe: no treatment-outcome guarantees, rankings, or no-side-effect claims.',
  'Use null for any interpretive field you cannot infer; never invent facts not supported by the post.'
] as const;

const topicBriefSetConstraints = [
  'Return one item per provided post and no extra items.',
  'Each "id" must match one of the provided post ids.',
  'Return Korean topic, keywords, and interpretive text.'
] as const;

export type TopicBriefSetPromptStore = {
  id: string;
  name: string | null;
  category: string | null;
  representativeKeywords: string[];
};

export type TopicBriefSetV2PromptInput = {
  task: 'Extract one reusable Topic Brief set per owner Blog post.';
  schemaVersion: typeof BLOG_TOPIC_BRIEF_SET_V2_PROMPT_SCHEMA_VERSION;
  instructions: typeof topicBriefSetInstructions;
  constraints: typeof topicBriefSetConstraints;
  storeProfile: TopicBriefSetPromptStore;
  posts: Array<{ id: string; title: string | null; bodyText: string }>;
};

export type BuildTopicBriefSetV2PromptInputInput = {
  store: TopicBriefSetPromptStore;
  posts: OwnerBlogPostV2[];
};

export function buildTopicBriefSetV2PromptInput(input: BuildTopicBriefSetV2PromptInputInput) {
  const posts = input.posts.map((post) => ({
    id: post.collectionItemId,
    title: post.title,
    bodyText: post.bodyText.slice(0, MAX_BODY_CHARS_PER_POST)
  }));

  const promptInput: TopicBriefSetV2PromptInput = {
    task: 'Extract one reusable Topic Brief set per owner Blog post.',
    schemaVersion: BLOG_TOPIC_BRIEF_SET_V2_PROMPT_SCHEMA_VERSION,
    instructions: topicBriefSetInstructions,
    constraints: topicBriefSetConstraints,
    storeProfile: input.store,
    posts
  };

  return { promptInput, sourcePostIds: posts.map((post) => post.id) };
}
