import { z } from 'zod';

export const BLOG_FORMULA_V2_MODEL = 'deterministic-blog-formula-v2';
export const BLOG_FORMULA_V2_VERSION = 'formula_v2.0';

export const BlogGenerationModeV2Schema = z.literal('v2_formula');

export const BlogTopicBriefInputSchema = z.object({
  topic: z.string().trim().min(1),
  mainKeyword: z.string().trim().min(1),
  secondaryKeywords: z.array(z.string().trim().min(1)).default([]),
  targetReader: z.string().trim().nullable().optional(),
  coreConcern: z.string().trim().nullable().optional(),
  mainAngle: z.string().trim().nullable().optional(),
  mustInclude: z.array(z.string().trim().min(1)).default([]),
  mustAvoid: z.array(z.string().trim().min(1)).default([]),
  ctaDirection: z.string().trim().nullable().optional()
});

export type BlogTopicBriefInput = z.infer<typeof BlogTopicBriefInputSchema>;

const FormulaBlockSchema = z.object({
  name: z.string(),
  description: z.string(),
  pattern: z.string(),
  sourcePostIds: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  status: z.enum(['confirmed', 'candidate', 'weak'])
});

export const BlogFormulaSetV2Schema = z.object({
  schemaVersion: z.literal('blog_formula_v2.0'),
  titleFormula: FormulaBlockSchema,
  introFormula: FormulaBlockSchema,
  bodyFormula: FormulaBlockSchema,
  headingFormula: FormulaBlockSchema,
  toneAndMannerFormula: FormulaBlockSchema,
  ctaFormula: FormulaBlockSchema,
  footerFormula: FormulaBlockSchema,
  medicalSafetyFormula: FormulaBlockSchema.extend({
    requiredDisclosures: z.array(z.string())
  })
});

export const BlogRetrievedSampleV2Schema = z.object({
  collectionItemId: z.string(),
  title: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  sourceKind: z.literal('owner_blog_post'),
  rank: z.number().int().min(1),
  totalScore: z.number().min(0),
  scoring: z.object({
    treatmentMatch: z.number().min(0).max(1),
    concernMatch: z.number().min(0).max(1),
    titleMatch: z.number().min(0).max(1),
    bodyKeywordOverlap: z.number().min(0).max(1)
  }),
  whySelected: z.string(),
  bodyText: z.string()
});

export const BlogDraftOutputV2Schema = z.object({
  titleCandidates: z.array(z.string()).min(1),
  selectedTitle: z.string(),
  blogDraft: z.string(),
  styleComplianceReport: z.object({
    formulaSetId: z.string(),
    sourcePostIds: z.array(z.string()),
    appliedBlocks: z.array(z.string())
  }),
  safetyCheck: z.object({
    requiredDisclosures: z.array(z.string()),
    bannedPhrasesAvoided: z.boolean()
  }),
  seoCheck: z.object({
    mainKeywordInTitle: z.boolean(),
    mainKeywordInIntro: z.boolean(),
    secondaryKeywordsUsed: z.array(z.string())
  })
});

export const BlogDraftValidationIssueV2Schema = z.object({
  code: z.string(),
  severity: z.enum(['info', 'warning', 'error']),
  message: z.string(),
  evidence: z.string().optional()
});

export const BlogDraftValidationResultV2Schema = z.object({
  status: z.enum(['pass', 'needs_human_review', 'failed']),
  riskLevel: z.enum(['low', 'medium', 'high']),
  issues: z.array(BlogDraftValidationIssueV2Schema),
  summary: z.string()
});

export type BlogFormulaSetV2 = z.infer<typeof BlogFormulaSetV2Schema>;
export type BlogRetrievedSampleV2 = z.infer<typeof BlogRetrievedSampleV2Schema>;
export type BlogDraftOutputV2 = z.infer<typeof BlogDraftOutputV2Schema>;
export type BlogDraftValidationResultV2 = z.infer<typeof BlogDraftValidationResultV2Schema>;
