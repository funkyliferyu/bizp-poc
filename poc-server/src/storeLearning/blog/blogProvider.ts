import { z } from 'zod';
import type { JsonValue } from '../../repositories/base.js';
import type { BlogPost } from '../../repositories/blog_posts.js';
import type { MediaAsset } from '../../repositories/media_assets.js';
import type { MarketingRuleset } from '../../repositories/marketing_rulesets.js';
import type { RulesetField } from '../../repositories/ruleset_fields.js';
import type { Store } from '../../repositories/stores.js';

export const BlogDraftSectionSchema = z.object({
  heading: z.string().min(1),
  body: z.string().min(1)
});

export const SeoScoreItemSchema = z.object({
  label: z.string().min(1),
  score: z.number().int().min(0),
  maxScore: z.number().int().min(1),
  feedback: z.string().min(1)
});

export const SeoScoreRubricSchema = z.object({
  titleKeyword: SeoScoreItemSchema,
  bodyKeyword: SeoScoreItemSchema,
  metaDescription: SeoScoreItemSchema,
  readability: SeoScoreItemSchema,
  imageAltPrompt: SeoScoreItemSchema,
  cta: SeoScoreItemSchema
});

export const SeoScoreOutputSchema = z.object({
  totalScore: z.number().int().min(0).max(100),
  rubric: SeoScoreRubricSchema
});

export const BlogProviderDraftOutputSchema = z.object({
  title: z.string().min(1),
  metaDescription: z.string().min(1),
  bodySections: z.array(BlogDraftSectionSchema).min(3),
  seoKeywords: z.array(z.string().min(1)).min(1),
  cta: z.string().min(1),
  imagePrompts: z.array(z.string().min(1)).min(1),
  seoScore: SeoScoreOutputSchema.nullable()
});

export type BlogProviderDraftOutput = z.infer<typeof BlogProviderDraftOutputSchema>;
export type SeoScoreOutput = z.infer<typeof SeoScoreOutputSchema>;

export type BlogDraftProviderAction = 'generate_blog_post' | 'regenerate_text';

export type BlogDraftProviderInput = {
  action: BlogDraftProviderAction;
  store: Store;
  ruleset: MarketingRuleset;
  rulesetFields: RulesetField[];
  currentPost?: BlogPost;
  currentArticle?: JsonValue;
  mediaAssets?: MediaAsset[];
};

export type BlogSeoProviderInput = {
  store: Store;
  ruleset: MarketingRuleset | null;
  rulesetFields: RulesetField[];
  post: BlogPost;
  article: JsonValue;
  mediaAssets: MediaAsset[];
};

export type BlogContentProvider = {
  name: string;
  mode: 'openai';
  model?: string | null;
  generateDraft(input: BlogDraftProviderInput): Promise<unknown>;
  scoreSeo(input: BlogSeoProviderInput): Promise<unknown>;
};
