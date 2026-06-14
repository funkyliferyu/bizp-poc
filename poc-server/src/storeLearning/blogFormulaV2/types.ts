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

export const FormulaEvidenceSchema = z.object({
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

// A repeating self-introduction/greeting opener discovered from the store's
// own owner_blog_post history (see selfIntroductionPatterns.ts). `directorName`
// is only set for `store_director_greeting`. `usageRatio` is this pattern's
// share among posts that have a detectable opening greeting.
export const SelfIntroductionPatternV2Schema = FormulaEvidenceSchema.extend({
  id: z.enum(['store_director_greeting', 'store_name_greeting']),
  template: z.string(),
  directorName: z.string().nullable(),
  example: z.string(),
  usageCount: z.number().int().min(0),
  usageRatio: z.number().min(0).max(1)
});

// A reusable Topic Brief mined from one owner_blog_post (1 post = 1 set), see
// topicBriefSetHeuristic.ts / SL-F2. sourcePostIds always holds exactly the one
// post the set was derived from. Same fields as BlogTopicBriefInput plus
// FormulaEvidence so the library carries provenance like other formula blocks.
export const TopicBriefSetV2Schema = FormulaEvidenceSchema.extend({
  id: z.string(),
  topic: z.string(),
  mainKeyword: z.string(),
  secondaryKeywords: z.array(z.string()),
  targetReader: z.string().nullable(),
  coreConcern: z.string().nullable(),
  mainAngle: z.string().nullable(),
  mustInclude: z.array(z.string()),
  mustAvoid: z.array(z.string()),
  ctaDirection: z.string().nullable()
});

// One item the SL-F2 model returns per provided post; `id` echoes the post id so
// the server can attach sourcePostIds. Server-only fields (confidence, status)
// are filled afterwards, so they are omitted here for OpenAI structured outputs.
export const TopicBriefSetV2ResponseItemSchema = z.object({
  id: z.string(),
  topic: z.string(),
  mainKeyword: z.string(),
  secondaryKeywords: z.array(z.string()),
  targetReader: z.string().nullable(),
  coreConcern: z.string().nullable(),
  mainAngle: z.string().nullable(),
  mustInclude: z.array(z.string()),
  mustAvoid: z.array(z.string()),
  ctaDirection: z.string().nullable()
});

export const TopicBriefSetV2ResponseFormatSchema = z.object({
  topicBriefSets: z.array(TopicBriefSetV2ResponseItemSchema)
});

// selfIntroductionPatterns is computed server-side from the store's own post
// history (see selfIntroductionPatterns.ts), never requested from a model.
// `.default([])` lets `.optional()`/legacy-upgraded formulas parse cleanly,
// but OpenAI structured outputs reject optional/defaulted fields - so the
// OpenAI response_format schema uses IntroFormulaResponseFormatSchema
// (without this field) instead.
const IntroFormulaResponseFormatSchema = SequenceFormulaSchema;

const IntroFormulaSchema = SequenceFormulaSchema.extend({
  selfIntroductionPatterns: z.array(SelfIntroductionPatternV2Schema).default([])
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
  introFormula: IntroFormulaSchema,
  bodyFormula: SequenceFormulaSchema,
  headingFormula: HeadingFormulaSchema,
  toneAndMannerFormula: ToneFormulaSchema,
  ctaFormula: CtaFormulaSchema,
  footerFormula: FooterFormulaSchema,
  medicalSafetyFormula: MedicalSafetyFormulaSchema
});

// For OpenAI structured-output response_format only (SL-F1). Omits
// introFormula.selfIntroductionPatterns, which OpenAI's API rejects as an
// optional/defaulted field and which the server computes itself afterwards.
export const BlogFormulaSetV2ResponseFormatSchema = BlogFormulaSetV2Schema.extend({
  introFormula: IntroFormulaResponseFormatSchema
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

export type SelfIntroductionPatternV2 = z.infer<typeof SelfIntroductionPatternV2Schema>;
export type TopicBriefSetV2 = z.infer<typeof TopicBriefSetV2Schema>;
// A topic brief set before it is persisted (the DB row id is assigned on insert).
export type TopicBriefSetCandidate = Omit<TopicBriefSetV2, 'id'>;
export type TopicBriefSetV2ResponseItem = z.infer<typeof TopicBriefSetV2ResponseItemSchema>;
export type BlogFormulaSetV2 = z.infer<typeof BlogFormulaSetV2Schema>;
export type BlogRetrievedSampleV2 = z.infer<typeof BlogRetrievedSampleV2Schema>;
export type BlogDraftOutputV2 = z.infer<typeof BlogDraftOutputV2Schema>;
export type ModelReportedComplianceV2 = z.infer<typeof ModelReportedComplianceV2Schema>;
export type BlogDraftModelResponseV2 = z.infer<typeof BlogDraftModelResponseV2Schema>;
export type BlogDraftValidationResultV2 = z.infer<typeof BlogDraftValidationResultV2Schema>;
