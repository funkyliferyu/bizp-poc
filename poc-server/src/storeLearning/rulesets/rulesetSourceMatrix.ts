export type RulesetSourceTier = 'place_direct' | 'manual_only' | 'blog_parser' | 'place_then_ai' | 'ai_processing';

export type RulesetAutomationStatus = 'available_now' | 'parser_ready' | 'ai_processing' | 'deferred';

export type RulesetSourceMatrixRow = {
  fieldKey: string;
  label: string;
  section:
    | 'store'
    | 'brand'
    | 'write_common'
    | 'write_blog';
  valueKind: 'text' | 'list' | 'tags' | 'colors' | 'policy';
  sourceTier: RulesetSourceTier;
  currentImplementation: string;
  inputSources: string[];
  requiresAi: boolean;
  automationStatus: RulesetAutomationStatus;
  futureSuggestion: string;
  notes: string;
};

export type AnalyzerRulesetFieldContract = Pick<
  RulesetSourceMatrixRow,
  'fieldKey' | 'label' | 'section' | 'valueKind' | 'sourceTier' | 'inputSources'
> & {
  expectedOutput: string;
  evidenceGuidance: string;
  allowedEvidenceItemIds?: string[];
};

export type RulesetEvidenceSourceMode = 'blog' | 'review' | 'mixed';

function row(input: RulesetSourceMatrixRow): RulesetSourceMatrixRow {
  return input;
}

const DIRECT_SOURCE_MATRIX = [
  row({
    fieldKey: 'name',
    label: '상호명',
    section: 'store',
    valueKind: 'text',
    sourceTier: 'place_direct',
    currentImplementation: 'Returned from stores.name in the ruleset payload store object.',
    inputSources: ['stores.name', 'Naver Place import', 'manual store profile save'],
    requiresAi: false,
    automationStatus: 'available_now',
    futureSuggestion: 'Keep direct Place/manual precedence and show freshness when Place import timestamps are exposed.',
    notes: 'Not saved as an editable ruleset field.'
  }),
  row({
    fieldKey: 'category',
    label: '카테고리',
    section: 'store',
    valueKind: 'text',
    sourceTier: 'place_direct',
    currentImplementation: 'Returned from stores.category in the ruleset payload store object.',
    inputSources: ['stores.category', 'metadata.naverPlaceParsed.category'],
    requiresAi: false,
    automationStatus: 'available_now',
    futureSuggestion: 'Add a category normalization layer before using this in ranking prompts.',
    notes: 'Can be edited in store registration, not in the ruleset field table.'
  }),
  row({
    fieldKey: 'address',
    label: '주소',
    section: 'store',
    valueKind: 'text',
    sourceTier: 'place_direct',
    currentImplementation: 'Returned from stores.address in the ruleset payload store object.',
    inputSources: ['stores.address', 'metadata.naverPlaceParsed.address'],
    requiresAi: false,
    automationStatus: 'available_now',
    futureSuggestion: 'Expose district/neighborhood derivation separately for local SEO prompts.',
    notes: 'Direct Place/manual value.'
  }),
  row({
    fieldKey: 'phone',
    label: '연락처',
    section: 'store',
    valueKind: 'text',
    sourceTier: 'place_direct',
    currentImplementation: 'Stored on stores.phone, but not yet rendered in the ruleset store tab.',
    inputSources: ['stores.phone', 'metadata.naverPlaceParsed.phone'],
    requiresAi: false,
    automationStatus: 'available_now',
    futureSuggestion: 'Render from the API in the next ruleset UI replacement milestone.',
    notes: 'No AI inference needed.'
  }),
  row({
    fieldKey: 'businessNumber',
    label: '사업자번호',
    section: 'store',
    valueKind: 'text',
    sourceTier: 'manual_only',
    currentImplementation: 'Optional manual registration field; not available from Place or Blog.',
    inputSources: ['store registration manual field'],
    requiresAi: false,
    automationStatus: 'available_now',
    futureSuggestion: 'Keep optional and avoid using it in content-generation prompts.',
    notes: 'Milestone 02 made this non-required.'
  }),
  row({
    fieldKey: 'operatingHours',
    label: '운영시간',
    section: 'store',
    valueKind: 'text',
    sourceTier: 'place_direct',
    currentImplementation: 'Static ruleset UI row today; Place metadata already exists in store registration flows.',
    inputSources: ['metadata.naverPlaceParsed.weeklyBusinessHours', 'metadata.naverPlaceParsed.openTime', 'metadata.naverPlaceParsed.closeTime'],
    requiresAi: false,
    automationStatus: 'available_now',
    futureSuggestion: 'Render weekly Place rows directly, then allow user lock when edited.',
    notes: 'Use weekly rows before scalar open/close fallback.'
  }),
  row({
    fieldKey: 'closedDays',
    label: '휴무일',
    section: 'store',
    valueKind: 'text',
    sourceTier: 'place_direct',
    currentImplementation: 'Static ruleset UI row today; closed-day metadata is available from Place import.',
    inputSources: ['metadata.naverPlaceParsed.weeklyBusinessHours.closed', 'metadata.naverPlaceParsed.closedDays'],
    requiresAi: false,
    automationStatus: 'available_now',
    futureSuggestion: 'Render direct Place closed-day labels and mark user edits as locked.',
    notes: 'No AI inference needed.'
  }),
  row({
    fieldKey: 'parking',
    label: '주차',
    section: 'store',
    valueKind: 'text',
    sourceTier: 'place_direct',
    currentImplementation: 'Available in Place metadata, but not yet rendered by the ruleset API UI contract.',
    inputSources: ['metadata.naverPlaceParsed.parking', 'metadata.naverPlaceParsed.parkingNote', 'metadata.naverPlaceParsed.facilities'],
    requiresAi: false,
    automationStatus: 'available_now',
    futureSuggestion: 'Use direct value for facts; let AI only turn it into copy guidance when needed.',
    notes: 'Do not infer free parking unless Place metadata says so.'
  }),
  row({
    fieldKey: 'storeIntro',
    label: '매장 소개',
    section: 'store',
    valueKind: 'text',
    sourceTier: 'place_then_ai',
    currentImplementation: 'Store description and Place intro are available; strategy summary still comes from analyzer fields.',
    inputSources: ['stores.description', 'metadata.naverPlaceParsed.placeIntro', 'metadata.naverPlaceParsed.aiSummary'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Show direct intro in store tab and use AI only for shorter positioning copy.',
    notes: 'Preserve owner-written intro before AI summary.'
  }),
  row({
    fieldKey: 'representativeTreatmentSubjects',
    label: '대표 진료과목',
    section: 'brand',
    valueKind: 'list',
    sourceTier: 'ai_processing',
    currentImplementation: 'Shown as a healthcare-specific brand analysis row; evidence display is scoped to Blog body items.',
    inputSources: [
      'Blog body items'
    ],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Use healthcare Blog content to identify promoted treatment subjects while keeping Place subjects as fallback facts only.',
    notes: 'Healthcare-specific replacement for representativeMenu in the brand analysis tab.'
  })
] as const;

const AI_SOURCE_MATRIX = [
  row({
    fieldKey: 'storePositioning',
    label: '포지셔닝',
    section: 'brand',
    valueKind: 'text',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer as storePositioning from selected Blog evidence; older seed field positioning aliases here.',
    inputSources: ['Blog body items'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Use Blog language as the primary positioning source and expose the exact supporting quote.',
    notes: 'Primary brand strategy summary.'
  }),
  row({
    fieldKey: 'keyStrengths',
    label: '업체 주장 강점',
    section: 'brand',
    valueKind: 'list',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer from selected Blog evidence.',
    inputSources: ['Blog body items'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Keep owner-claimed strengths separate from customer-observed review strengths.',
    notes: 'Do not use reviewStrength evidence for this field.'
  }),
  row({
    fieldKey: 'representativeMenu',
    label: '대표 메뉴',
    section: 'brand',
    valueKind: 'list',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer from selected Blog evidence.',
    inputSources: ['Blog body items'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Use Blog body mentions to identify promoted menu/treatment subjects and expose the supporting quote.',
    notes: 'Direct Place menu can remain a fallback fact outside the evidence modal.'
  }),
  row({
    fieldKey: 'targetCustomers',
    label: '주 타겟층',
    section: 'brand',
    valueKind: 'list',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer from selected evidence.',
    inputSources: ['Blog body items'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Use customer-intent phrases from Blog body text and expose the supporting quote.',
    notes: 'Avoid demographic claims unsupported by evidence.'
  }),
  row({
    fieldKey: 'contentKeywords',
    label: '콘텐츠 소재 키워드',
    section: 'brand',
    valueKind: 'tags',
    sourceTier: 'ai_processing',
    currentImplementation: 'Ruleset UI has this row and can alias to seoKeywords.',
    inputSources: ['Blog titles/body'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Keep content topic keywords distinct from SEO title keywords and cite Blog phrases.',
    notes: 'Generated as a ruleset field for UI compatibility.'
  }),
  row({
    fieldKey: 'keywordMap',
    label: '소재-키워드 맵',
    section: 'write_blog',
    valueKind: 'policy',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer from Blog topic phrases, SEO keywords, hashtags, and computed style observations.',
    inputSources: ['Blog titles/body', 'computedAggregates.hashtagCandidates', 'storeProfile.facts'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Store as structured JSON after the ruleset field storage model supports typed values.',
    notes: 'PoC stores a compact Korean mapping string: topic, SEO keywords, hashtags, and search intent.'
  }),
  row({
    fieldKey: 'reviewStrength',
    label: '리뷰 강점',
    section: 'brand',
    valueKind: 'list',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static UI row could alias keyStrengths; this milestone adds its own field key.',
    inputSources: ['Place review items'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Extract repeated praise themes from Place reviews only.',
    notes: 'Use collected review text only.'
  }),
  row({
    fieldKey: 'reviewWeakness',
    label: '리뷰 약점',
    section: 'brand',
    valueKind: 'list',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer; legacy rulesets are backfilled from collected review evidence.',
    inputSources: ['Place review items'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Use Place review raw data to detect repeat issues, then keep them out of public copy unless asked.',
    notes: 'Strategy-only field; generated posts should not directly amplify weaknesses.'
  }),
  row({
    fieldKey: 'toneAndManner',
    label: '톤',
    section: 'write_common',
    valueKind: 'text',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer.',
    inputSources: ['Blog body items', 'owner replies', 'Place profile'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Use owner replies as tone examples when present.',
    notes: 'Applies across channels unless channel-specific fields override it.'
  }),
  row({
    fieldKey: 'catchphrase',
    label: '브랜드 표현 후보',
    section: 'write_common',
    valueKind: 'list',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static edited UI sample today; this milestone adds analyzer field key support.',
    inputSources: ['storePositioning', 'keyStrengths', 'Blog body items'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Generate 2-3 conservative candidates and require user approval before locking.',
    notes: 'Avoid unsupported superlatives.'
  }),
  row({
    fieldKey: 'industryCommonRules',
    label: '업종공통규칙',
    section: 'write_common',
    valueKind: 'policy',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer and refined by industry/category UI defaults.',
    inputSources: ['store category', 'policy defaults', 'owner-provided required copy'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Keep medical-law disclaimer requirements separate from brand tone and CTA fields.',
    notes: 'Healthcare UI shows the medical footer rule by default; generic stores do not receive it.'
  }),
  row({
    fieldKey: 'blogRequiredIntroCopy',
    label: '필수 인트로 문구',
    section: 'write_common',
    valueKind: 'text',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer and editable in the writing-style common tab.',
    inputSources: ['Blog intro patterns', 'store profile', 'owner-provided credentials'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Feed this into blog generation as deterministic intro copy before topic-specific content.',
    notes: 'Used for repeated doctor/profile/brand trust copy when approved.'
  }),
  row({
    fieldKey: 'blogRequiredFooterCopy',
    label: '필수 푸터 문구',
    section: 'write_common',
    valueKind: 'policy',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer and editable in the writing-style common tab.',
    inputSources: ['industry policy defaults', 'owner-provided footer copy', 'store contact and hours'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Append approved footer copy deterministically in the blog generator.',
    notes: 'Healthcare UI defaults this to the provided medical-law disclaimer text.'
  }),
  row({
    fieldKey: 'negativeExpressions',
    label: '피할 문구',
    section: 'write_common',
    valueKind: 'policy',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer.',
    inputSources: ['policy defaults', 'selected evidence tone'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Split legal/policy forbidden claims from brand-tone avoid words.',
    notes: 'Used by blog generation guardrails.'
  }),
  row({
    fieldKey: 'humorLevel',
    label: '개그 레벨',
    section: 'write_common',
    valueKind: 'text',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static UI sample today; this milestone adds analyzer field key support.',
    inputSources: ['Blog body items', 'toneAndManner'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Keep low by default for local business informational content unless brand tone proves otherwise.',
    notes: 'Conservative mock value is low.'
  }),
  row({
    fieldKey: 'trendSensitivity',
    label: '트렌드 민감도',
    section: 'write_common',
    valueKind: 'text',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static UI sample today; this milestone adds analyzer field key support.',
    inputSources: ['Blog body items', 'seasonal keyword settings'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Connect to seasonal/holiday keyword configuration later.',
    notes: 'Do not chase trends without store fit.'
  }),
  row({
    fieldKey: 'blogPurpose',
    label: '글의 목적',
    section: 'write_blog',
    valueKind: 'text',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static Blog tab row today; analyzer key is added by this milestone.',
    inputSources: ['seoKeywords', 'Blog body items', 'Place profile'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Choose between search acquisition, reservation guidance, and brand storytelling per topic.',
    notes: 'Current mock defaults to search plus detailed explanation.'
  }),
  row({
    fieldKey: 'titlePatterns',
    label: '제목 패턴',
    section: 'write_blog',
    valueKind: 'list',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer from Blog titles and store facts.',
    inputSources: ['Blog titles/body', 'storeProfile.facts', 'computedAggregates'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Keep template variables explicit once Blog topic planning has structured topic inputs.',
    notes: 'Used by Blog generation to keep titles consistent without keyword stuffing.'
  }),
  row({
    fieldKey: 'introPattern',
    label: '도입부 패턴',
    section: 'write_blog',
    valueKind: 'policy',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer from Blog opening paragraphs and question/CTA observations.',
    inputSources: ['Blog body items', 'blogPosts.content.styleMetrics', 'computedAggregates.ctaCandidates'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Parse first paragraph blocks separately when Blog parser exposes article block roles.',
    notes: 'Typical shape: customer situation, frequent question, then article preview.'
  }),
  row({
    fieldKey: 'bodyOutlinePattern',
    label: '본문 전개 구조',
    section: 'write_blog',
    valueKind: 'list',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer from Blog body flow and computed block observations.',
    inputSources: ['Blog body items', 'blogPosts.content.blocks', 'computedAggregates'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Learn separate outline patterns by Blog purpose after topic planning is productized.',
    notes: 'Used by Blog generation to keep article structure stable across drafts.'
  }),
  row({
    fieldKey: 'headingPattern',
    label: '소제목 패턴',
    section: 'write_blog',
    valueKind: 'policy',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer from heading-like lines and Blog readability observations.',
    inputSources: ['blogPosts.content.blocks', 'blogPosts.content.styleMetrics'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Use real parsed heading tags when rendered Blog extraction exposes block types.',
    notes: 'Controls count range and question/guide style for mobile readability.'
  }),
  row({
    fieldKey: 'blogWritingStyle',
    label: '문장 스타일',
    section: 'write_blog',
    valueKind: 'text',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer.',
    inputSources: ['Blog body items', 'toneAndManner', 'reviewStrength'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Use only owner-approved or owner-written Blog samples as strong style evidence.',
    notes: 'Feeds blog generation.'
  }),
  row({
    fieldKey: 'blogPreferredLength',
    label: '선호 길이',
    section: 'write_blog',
    valueKind: 'text',
    sourceTier: 'blog_parser',
    currentImplementation: 'Computed from selected Blog body character counts before the analyzer prompt is built.',
    inputSources: ['blogPosts.content.styleMetrics', 'computedAggregates.lengthPolicy'],
    requiresAi: false,
    automationStatus: 'parser_ready',
    futureSuggestion: 'Refine by approved/published post performance after publishing workflow exists.',
    notes: 'Server-computed length policy should not be invented by the analyzer.'
  }),
  row({
    fieldKey: 'blogHashtags',
    label: '해시태그',
    section: 'write_blog',
    valueKind: 'tags',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer from local/category/topic keywords.',
    inputSources: ['seoKeywords', 'contentKeywords', 'Place address/category', 'Blog body items'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Separate local/category hashtags from topic hashtags per generated post.',
    notes: 'First-class Blog writing-style control shown in the common writing surface.'
  }),
  row({
    fieldKey: 'blogEmojiPolicy',
    label: '기호/이모지 정책',
    section: 'write_blog',
    valueKind: 'policy',
    sourceTier: 'blog_parser',
    currentImplementation: 'Computed from selected Blog body symbols and emoji frequency before the analyzer prompt is built.',
    inputSources: ['blogPosts.content.styleMetrics', 'computedAggregates.symbolPolicy'],
    requiresAi: false,
    automationStatus: 'parser_ready',
    futureSuggestion: 'Let users override symbol rules after generated drafts are reviewed.',
    notes: 'Server-computed symbol policy should stay compact and conservative.'
  }),
  row({
    fieldKey: 'seoKeywords',
    label: 'SEO 키워드',
    section: 'write_blog',
    valueKind: 'tags',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer.',
    inputSources: ['Place address/category/menu', 'Blog titles/body', 'review keywords'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Split primary, secondary, and avoid keywords for prompt control.',
    notes: 'Used by blog generation and learning-status summaries.'
  }),
  row({
    fieldKey: 'seoPlacementPolicy',
    label: '키워드 배치 정책',
    section: 'write_blog',
    valueKind: 'policy',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer from Blog titles/body and computed keyword placement observations.',
    inputSources: ['Blog titles/body', 'contentKeywords', 'seoKeywords', 'computedAggregates'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Add deterministic keyword-position checks to SEO scoring once generated drafts are persisted.',
    notes: 'Avoid meaningless repetition and unrelated hot keywords; this is not a ranking guarantee.'
  }),
  row({
    fieldKey: 'ctaStyle',
    label: 'CTA',
    section: 'write_blog',
    valueKind: 'text',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer.',
    inputSources: ['Place booking URL', 'phone', 'operating hours', 'Blog body items'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Use direct booking/phone availability to choose reservation or visit CTA.',
    notes: 'Avoid promising availability.'
  }),
] as const;

export const RULESET_SOURCE_MATRIX: RulesetSourceMatrixRow[] = [...DIRECT_SOURCE_MATRIX, ...AI_SOURCE_MATRIX];

export const REQUIRED_ANALYZER_RULESET_FIELD_KEYS = AI_SOURCE_MATRIX.map((item) => item.fieldKey);

const FIELD_ALIASES: Record<string, string> = {
  positioning: 'storePositioning'
};

const BLOG_EVIDENCE_FIELD_KEYS = new Set([
  'storePositioning',
  'positioning',
  'keyStrengths',
  'representativeMenu',
  'representativeTreatmentSubjects',
  'targetCustomers',
  'contentKeywords',
  'seoKeywords'
]);

const REVIEW_EVIDENCE_FIELD_KEYS = new Set([
  'reviewStrength',
  'reviewWeakness'
]);

const MATRIX_BY_FIELD_KEY = new Map(RULESET_SOURCE_MATRIX.map((item) => [item.fieldKey, item]));

export function canonicalRulesetFieldKey(fieldKey: string) {
  return FIELD_ALIASES[fieldKey] ?? fieldKey;
}

export function rulesetEvidenceSourceModeForFieldKey(fieldKey: string): RulesetEvidenceSourceMode {
  const canonicalFieldKey = canonicalRulesetFieldKey(fieldKey);
  if (REVIEW_EVIDENCE_FIELD_KEYS.has(fieldKey) || REVIEW_EVIDENCE_FIELD_KEYS.has(canonicalFieldKey)) return 'review';
  if (BLOG_EVIDENCE_FIELD_KEYS.has(fieldKey) || BLOG_EVIDENCE_FIELD_KEYS.has(canonicalFieldKey)) return 'blog';
  return 'mixed';
}

export function sourceMatrixForFieldKey(fieldKey: string) {
  return MATRIX_BY_FIELD_KEY.get(canonicalRulesetFieldKey(fieldKey)) ?? null;
}

export function serializeRulesetSourceMatrix() {
  return RULESET_SOURCE_MATRIX.map((item) => ({ ...item }));
}

function expectedOutputForAnalyzerField(row: RulesetSourceMatrixRow) {
  const valueShape =
    row.valueKind === 'list' || row.valueKind === 'tags' || row.valueKind === 'colors'
      ? 'Korean comma-separated list'
      : row.valueKind === 'policy'
        ? 'Korean policy'
        : 'Korean text';
  return `${row.label}: ${valueShape} for direct ruleset UI use.`;
}

function evidenceGuidanceForAnalyzerField(row: RulesetSourceMatrixRow) {
  const baseGuidance = 'Use provided evidence item IDs only; do not invent facts.';
  const evidenceSourceMode = rulesetEvidenceSourceModeForFieldKey(row.fieldKey);
  const sourceGuidance =
    evidenceSourceMode === 'blog'
      ? ' Use Blog post evidence item IDs for this field; do not use Place reviews or Place profile items as field evidence.'
      : evidenceSourceMode === 'review'
        ? ' Use Place review evidence item IDs for this field; do not use Blog posts or Place profile items as field evidence.'
        : '';
  const placeGuidance =
    row.sourceTier === 'place_then_ai'
      ? ' Start from canonical store facts, then use scoped evidence for priority or copy guidance.'
      : '';
  const strategyOnlyGuidance =
    row.fieldKey === 'reviewWeakness'
      ? ' strategy-only; do not turn weaknesses into public claims.'
      : '';
  return `${baseGuidance}${sourceGuidance}${placeGuidance}${strategyOnlyGuidance}`;
}

export function serializeAnalyzerRulesetFieldContract(
  fieldKeys: readonly string[] = REQUIRED_ANALYZER_RULESET_FIELD_KEYS
): AnalyzerRulesetFieldContract[] {
  const requestedFieldKeys = new Set(fieldKeys);
  return AI_SOURCE_MATRIX.filter((item) => requestedFieldKeys.has(item.fieldKey)).map((item) => ({
    fieldKey: item.fieldKey,
    label: item.label,
    section: item.section,
    valueKind: item.valueKind,
    sourceTier: item.sourceTier,
    inputSources: [...item.inputSources],
    expectedOutput: expectedOutputForAnalyzerField(item),
    evidenceGuidance: evidenceGuidanceForAnalyzerField(item)
  }));
}
