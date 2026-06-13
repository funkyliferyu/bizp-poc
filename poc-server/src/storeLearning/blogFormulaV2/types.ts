import { z } from 'zod';

export const BLOG_FORMULA_V2_MODEL = 'deterministic-blog-formula-v2';
export const BLOG_FORMULA_V2_VERSION = 'formula_v2.1';

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

const FormulaEvidenceSchema = z.object({
  sourcePostIds: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  status: z.enum(['confirmed', 'candidate', 'weak'])
});

const TitleFormulaPatternSchema = FormulaEvidenceSchema.extend({
  name: z.string(),
  pattern: z.string()
});

const SequenceFormulaSchema = FormulaEvidenceSchema.extend({
  name: z.string(),
  description: z.string(),
  sequence: z.array(z.string())
});

const HeadingFormulaSchema = FormulaEvidenceSchema.extend({
  name: z.string(),
  description: z.string(),
  patterns: z.array(z.string())
});

const ToneFormulaSchema = FormulaEvidenceSchema.extend({
  persona: z.string(),
  style: z.array(z.string()),
  preferredPhrases: z.array(z.string()),
  endingStyle: z.array(z.string()),
  empathyPatterns: z.array(z.string()),
  emojiPolicy: z.object({
    allowed: z.array(z.string()),
    usage: z.string()
  })
});

const CtaFormulaSchema = FormulaEvidenceSchema.extend({
  primaryStyle: z.string(),
  softPatterns: z.array(z.string()),
  hardReservationAllowed: z.boolean()
});

const FooterFormulaSchema = FormulaEvidenceSchema.extend({
  sequence: z.array(z.string()),
  hoursPolicy: z.string()
});

const MedicalSafetyFormulaSchema = FormulaEvidenceSchema.extend({
  bannedClaims: z.array(z.string()),
  requiredDisclosures: z.array(z.string()),
  reviewUsagePolicy: z.string()
});

export const BlogFormulaSetV2Schema = z.object({
  schemaVersion: z.literal('blog_formula_v2.1'),
  titleFormula: z.array(TitleFormulaPatternSchema),
  introFormula: SequenceFormulaSchema,
  bodyFormula: SequenceFormulaSchema,
  headingFormula: HeadingFormulaSchema,
  toneAndMannerFormula: ToneFormulaSchema,
  ctaFormula: CtaFormulaSchema,
  footerFormula: FooterFormulaSchema,
  medicalSafetyFormula: MedicalSafetyFormulaSchema
});

const LegacyFormulaBlockSchema = z.object({
  name: z.string(),
  description: z.string(),
  pattern: z.string(),
  sourcePostIds: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  status: z.enum(['confirmed', 'candidate', 'weak'])
});

export const BlogFormulaSetV2LegacySchema = z.object({
  schemaVersion: z.literal('blog_formula_v2.0'),
  titleFormula: LegacyFormulaBlockSchema,
  introFormula: LegacyFormulaBlockSchema,
  bodyFormula: LegacyFormulaBlockSchema,
  headingFormula: LegacyFormulaBlockSchema,
  toneAndMannerFormula: LegacyFormulaBlockSchema,
  ctaFormula: LegacyFormulaBlockSchema,
  footerFormula: LegacyFormulaBlockSchema,
  medicalSafetyFormula: LegacyFormulaBlockSchema.extend({
    requiredDisclosures: z.array(z.string())
  })
});

export const DEFAULT_HOURS_POLICY = '운영시간 충돌 가능성이 있으면 구체적 시간을 하드코딩하지 않는다.';

export const DEFAULT_REVIEW_USAGE_POLICY = '방문자 리뷰를 공개 광고 문구나 치료 결과 주장으로 변환하지 않는다.';

export const DEFAULT_BANNED_CLAIMS = [
  '효과보장',
  '100% 효과',
  '완전 제거',
  '부작용 없음',
  '통증 없음',
  '무조건 개선',
  '최고/1위/유일',
  '타 병원보다 우수'
];

function splitMoves(pattern: string) {
  return pattern
    .split(/→|\+/u)
    .map((move) => move.trim())
    .filter((move) => move.length > 0);
}

function upgradeLegacyFormula(legacy: z.infer<typeof BlogFormulaSetV2LegacySchema>): BlogFormulaSetV2 {
  const evidence = (block: { sourcePostIds: string[]; confidence: number; status: 'confirmed' | 'candidate' | 'weak' }) => ({
    sourcePostIds: block.sourcePostIds,
    confidence: block.confidence,
    status: block.status
  });

  return BlogFormulaSetV2Schema.parse({
    schemaVersion: 'blog_formula_v2.1',
    titleFormula: [{ ...evidence(legacy.titleFormula), name: legacy.titleFormula.name, pattern: legacy.titleFormula.pattern }],
    introFormula: {
      ...evidence(legacy.introFormula),
      name: legacy.introFormula.name,
      description: legacy.introFormula.description,
      sequence: splitMoves(legacy.introFormula.pattern)
    },
    bodyFormula: {
      ...evidence(legacy.bodyFormula),
      name: legacy.bodyFormula.name,
      description: legacy.bodyFormula.description,
      sequence: splitMoves(legacy.bodyFormula.pattern)
    },
    headingFormula: {
      ...evidence(legacy.headingFormula),
      name: legacy.headingFormula.name,
      description: legacy.headingFormula.description,
      patterns: [legacy.headingFormula.pattern]
    },
    toneAndMannerFormula: {
      ...evidence(legacy.toneAndMannerFormula),
      persona: legacy.toneAndMannerFormula.name,
      style: legacy.toneAndMannerFormula.pattern.split(',').map((item) => item.trim()).filter(Boolean),
      preferredPhrases: [],
      endingStyle: [],
      empathyPatterns: [],
      emojiPolicy: { allowed: [], usage: '소량 사용' }
    },
    ctaFormula: {
      ...evidence(legacy.ctaFormula),
      primaryStyle: legacy.ctaFormula.description,
      softPatterns: [legacy.ctaFormula.pattern],
      hardReservationAllowed: false
    },
    footerFormula: {
      ...evidence(legacy.footerFormula),
      sequence: splitMoves(legacy.footerFormula.pattern),
      hoursPolicy: DEFAULT_HOURS_POLICY
    },
    medicalSafetyFormula: {
      ...evidence(legacy.medicalSafetyFormula),
      bannedClaims: DEFAULT_BANNED_CLAIMS,
      requiredDisclosures: legacy.medicalSafetyFormula.requiredDisclosures,
      reviewUsagePolicy: DEFAULT_REVIEW_USAGE_POLICY
    }
  });
}

export function parseStoredBlogFormulaV2(stored: unknown): BlogFormulaSetV2 {
  const current = BlogFormulaSetV2Schema.safeParse(stored);
  if (current.success) return current.data;
  return upgradeLegacyFormula(BlogFormulaSetV2LegacySchema.parse(stored));
}

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

// The model's self-reported compliance: only what a model can meaningfully
// claim. Server-only facts (formulaSetId, sourcePostIds) are NOT requested
// from the model — the server fills those in the authoritative report.
export const ModelReportedComplianceV2Schema = z.object({
  styleComplianceReport: z.object({
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

// SL-G1 OpenAI response_format schema (what the model fills). Kept free of
// array min/max constraints so it stays compatible with OpenAI structured
// outputs. The model returns creative content plus its own compliance claims.
export const BlogDraftModelResponseV2Schema = ModelReportedComplianceV2Schema.extend({
  titleCandidates: z.array(z.string()),
  selectedTitle: z.string(),
  blogDraft: z.string()
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
  }),
  // Server-authoritative reports stay at the top level. The model's
  // self-reported versions are carried here for human comparison (null on the
  // deterministic path).
  modelReportedCompliance: ModelReportedComplianceV2Schema.nullable().optional()
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
export type ModelReportedComplianceV2 = z.infer<typeof ModelReportedComplianceV2Schema>;
export type BlogDraftModelResponseV2 = z.infer<typeof BlogDraftModelResponseV2Schema>;
export type BlogDraftValidationResultV2 = z.infer<typeof BlogDraftValidationResultV2Schema>;
