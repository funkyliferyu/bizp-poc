export type RulesetSourceTier = 'place_direct' | 'manual_only' | 'blog_parser' | 'place_then_ai' | 'ai_processing';

export type RulesetAutomationStatus = 'available_now' | 'parser_ready' | 'ai_processing' | 'deferred';

export type RulesetSourceMatrixRow = {
  fieldKey: string;
  label: string;
  section:
    | 'store'
    | 'brand'
    | 'write_common'
    | 'write_instagram'
    | 'write_blog'
    | 'image_common'
    | 'image_instagram'
    | 'image_blog';
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
};

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
    sourceTier: 'place_direct',
    currentImplementation: 'Returned from healthcare Place/store metadata before generic representativeMenu ruleset values.',
    inputSources: [
      'metadata.naverPlaceParsed.hospitalInfo.subjects',
      'metadata.hospitalInfo.subjects',
      'metadata.naverPlaceParsed.representativeTreatmentSubjects'
    ],
    requiresAi: false,
    automationStatus: 'available_now',
    futureSuggestion: 'Keep healthcare treatment subjects as direct facts and use AI only for prioritization copy.',
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
    currentImplementation: 'Generated by analyzer as storePositioning; older seed field positioning aliases here.',
    inputSources: ['Place profile item', 'Place review items', 'Blog body items'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Blend Place facts with selected Blog and review evidence, then expose confidence and evidence.',
    notes: 'Primary brand strategy summary.'
  }),
  row({
    fieldKey: 'keyStrengths',
    label: '업체 주장 강점',
    section: 'brand',
    valueKind: 'list',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer from selected review and Blog evidence.',
    inputSources: ['Place profile item', 'Place review items', 'Blog body items'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Separate owner-claimed strengths from customer-observed strengths when enough evidence exists.',
    notes: 'May overlap with reviewStrength until the UI replacement separates rows.'
  }),
  row({
    fieldKey: 'representativeMenu',
    label: '대표 메뉴',
    section: 'brand',
    valueKind: 'list',
    sourceTier: 'place_then_ai',
    currentImplementation: 'Static UI sample today; this milestone adds analyzer field key support.',
    inputSources: ['metadata.naverPlaceParsed.menuItems', 'Blog body items', 'Place review items'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Start from Place menu list, then rank with Blog/review frequency and margin policy when available.',
    notes: 'Direct menu display can happen before ranking.'
  }),
  row({
    fieldKey: 'targetCustomers',
    label: '주 타겟층',
    section: 'brand',
    valueKind: 'list',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer from selected evidence.',
    inputSources: ['Blog body items', 'Place review items', 'Place category/address'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Use customer-intent clusters from Blog and review text once enough rows exist.',
    notes: 'Avoid demographic claims unsupported by evidence.'
  }),
  row({
    fieldKey: 'contentKeywords',
    label: '콘텐츠 소재 키워드',
    section: 'brand',
    valueKind: 'tags',
    sourceTier: 'ai_processing',
    currentImplementation: 'Ruleset UI has this row and can alias to seoKeywords.',
    inputSources: ['Blog titles/body', 'Place menu/profile', 'review keyword summaries'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Keep content topic keywords distinct from SEO title keywords.',
    notes: 'Generated as a ruleset field for UI compatibility.'
  }),
  row({
    fieldKey: 'reviewStrength',
    label: '리뷰 강점',
    section: 'brand',
    valueKind: 'list',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static UI row could alias keyStrengths; this milestone adds its own field key.',
    inputSources: ['Place review items', 'owner replies', 'Blog body items'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Extract repeated praise themes from Place reviews and Blog mentions separately.',
    notes: 'Use collected review text only.'
  }),
  row({
    fieldKey: 'reviewWeakness',
    label: '리뷰 약점',
    section: 'brand',
    valueKind: 'list',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer; legacy rulesets are backfilled from collected review evidence.',
    inputSources: ['Place review items', 'Blog body items', 'provider metadata failure notes'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Use Place review raw data and Blog body signals to detect repeat issues, then keep them out of public copy unless asked.',
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
    label: '캐치프레이즈',
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
    fieldKey: 'instagramPurpose',
    label: '글의 목적',
    section: 'write_instagram',
    valueKind: 'text',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static Instagram tab row today; analyzer key is added by this milestone.',
    inputSources: ['imageDirection', 'contentKeywords', 'store category'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Activate after Instagram provider scope exists.',
    notes: 'Provider is still placeholder/mock-only.'
  }),
  row({
    fieldKey: 'instagramWritingStyle',
    label: '문장 스타일',
    section: 'write_instagram',
    valueKind: 'text',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static Instagram tab row today; analyzer key is added by this milestone.',
    inputSources: ['toneAndManner', 'Blog style examples'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Generate only when Instagram publishing flow is in scope.',
    notes: 'Not used by current blog generation.'
  }),
  row({
    fieldKey: 'instagramPreferredLength',
    label: '선호 길이',
    section: 'write_instagram',
    valueKind: 'text',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static Instagram tab row today; analyzer key is added by this milestone.',
    inputSources: ['channel default policy', 'toneAndManner'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Keep as channel policy until Instagram content generation exists.',
    notes: 'Mock default remains short caption plus hashtags.'
  }),
  row({
    fieldKey: 'instagramHashtags',
    label: '해시태그',
    section: 'write_instagram',
    valueKind: 'tags',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static Instagram tab row today; analyzer key is added by this milestone.',
    inputSources: ['seoKeywords', 'contentKeywords', 'Place address/category'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Derive local/category tags from normalized address and menu categories.',
    notes: 'Avoid banned or unrelated tags.'
  }),
  row({
    fieldKey: 'instagramEmojiPolicy',
    label: '이모지 사용',
    section: 'write_instagram',
    valueKind: 'policy',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static Instagram tab row today; analyzer key is added by this milestone.',
    inputSources: ['toneAndManner', 'channel default policy'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Use channel defaults unless owner voice evidence says otherwise.',
    notes: 'Not used by current blog generation.'
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
    sourceTier: 'ai_processing',
    currentImplementation: 'Static Blog tab row today; analyzer key is added by this milestone.',
    inputSources: ['Blog body items', 'channel default policy'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Infer from successful owner-approved articles after publish workflow exists.',
    notes: 'Mock default is 700-1,000 Korean characters.'
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
    label: '이모지 사용',
    section: 'write_blog',
    valueKind: 'policy',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static Blog tab row today; analyzer key is added by this milestone.',
    inputSources: ['Blog body items', 'toneAndManner'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Keep disabled by default for search-oriented Naver Blog copy.',
    notes: 'Mock default is no emoji.'
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
  row({
    fieldKey: 'primaryColors',
    label: '주 사용 색상',
    section: 'image_common',
    valueKind: 'colors',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static image style row today; analyzer key is added by this milestone.',
    inputSources: ['Place image URLs metadata', 'menu image metadata', 'Blog image metadata'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Extract colors from actual image assets once image download/analysis is scoped.',
    notes: 'Mock uses pastel pink and white.'
  }),
  row({
    fieldKey: 'accentColors',
    label: '강조 색상',
    section: 'image_common',
    valueKind: 'colors',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static image style row today; analyzer key is added by this milestone.',
    inputSources: ['Place image URLs metadata', 'menu image metadata', 'Blog image metadata'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Extract from image samples or owner brand assets later.',
    notes: 'Mock uses rose pink.'
  }),
  row({
    fieldKey: 'imageDirection',
    label: '이미지 무드',
    section: 'image_common',
    valueKind: 'text',
    sourceTier: 'ai_processing',
    currentImplementation: 'Generated by analyzer.',
    inputSources: ['Place images', 'menu images', 'review image hints', 'Blog body items'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Use real image analysis only after provider/storage scope is defined.',
    notes: 'Feeds image prompt generation.'
  }),
  row({
    fieldKey: 'imageStyle',
    label: '주 사용 스타일',
    section: 'image_common',
    valueKind: 'text',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static image style row today; analyzer key is added by this milestone.',
    inputSources: ['Place image URLs metadata', 'menu images', 'imageDirection'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Rank by available actual product/place image composition.',
    notes: 'Mock defaults to emotional minimal close-up.'
  }),
  row({
    fieldKey: 'imageAvoidStyle',
    label: '피할 스타일',
    section: 'image_common',
    valueKind: 'policy',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static image style row today; analyzer key is added by this milestone.',
    inputSources: ['imageDirection', 'policy defaults'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Add channel safety defaults for text overlay, dark filters, and unrelated stock imagery.',
    notes: 'Useful for prompt guardrails.'
  }),
  row({
    fieldKey: 'instagramImageFormat',
    label: '비율·포맷',
    section: 'image_instagram',
    valueKind: 'text',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static Instagram image row today; analyzer key is added by this milestone.',
    inputSources: ['channel default policy', 'imageDirection'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Keep 1:1 or 4:5 until Instagram generation is implemented.',
    notes: 'Provider is placeholder/mock-only.'
  }),
  row({
    fieldKey: 'instagramImageStyle',
    label: '주 사용 스타일',
    section: 'image_instagram',
    valueKind: 'text',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static Instagram image row today; analyzer key is added by this milestone.',
    inputSources: ['imageStyle', 'imageDirection'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Derive from approved Instagram content after provider exists.',
    notes: 'Not used by current blog generation.'
  }),
  row({
    fieldKey: 'instagramOverlayPolicy',
    label: '텍스트 오버레이',
    section: 'image_instagram',
    valueKind: 'policy',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static Instagram image row today; analyzer key is added by this milestone.',
    inputSources: ['channel default policy', 'brand assets'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Keep optional until card-news generation is in scope.',
    notes: 'Do not invent logos or watermarks.'
  }),
  row({
    fieldKey: 'blogImageFormat',
    label: '비율·포맷',
    section: 'image_blog',
    valueKind: 'text',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static Blog image row today; analyzer key is added by this milestone.',
    inputSources: ['Naver Blog defaults', 'imageDirection', 'Place/menu image metadata'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Use Place and Blog image evidence to choose image count and aspect guidance.',
    notes: 'Mock default is horizontal 3:2 and at least 8 images.'
  }),
  row({
    fieldKey: 'blogImageStyle',
    label: '주 사용 스타일',
    section: 'image_blog',
    valueKind: 'text',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static Blog image row today; analyzer key is added by this milestone.',
    inputSources: ['imageStyle', 'Place image metadata', 'menu image metadata'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Use actual store/menu image set to combine wide, detail, and space shots.',
    notes: 'Relevant for blog detail image prompt generation.'
  }),
  row({
    fieldKey: 'blogOverlayPolicy',
    label: '텍스트 오버레이',
    section: 'image_blog',
    valueKind: 'policy',
    sourceTier: 'ai_processing',
    currentImplementation: 'Static Blog image row today; analyzer key is added by this milestone.',
    inputSources: ['Naver Blog SEO defaults', 'imageAvoidStyle'],
    requiresAi: true,
    automationStatus: 'ai_processing',
    futureSuggestion: 'Keep minimal overlay unless owner-provided images already include text.',
    notes: 'Mock default minimizes image text.'
  })
] as const;

export const RULESET_SOURCE_MATRIX: RulesetSourceMatrixRow[] = [...DIRECT_SOURCE_MATRIX, ...AI_SOURCE_MATRIX];

export const REQUIRED_ANALYZER_RULESET_FIELD_KEYS = AI_SOURCE_MATRIX.map((item) => item.fieldKey);

const FIELD_ALIASES: Record<string, string> = {
  positioning: 'storePositioning'
};

const MATRIX_BY_FIELD_KEY = new Map(RULESET_SOURCE_MATRIX.map((item) => [item.fieldKey, item]));

export function canonicalRulesetFieldKey(fieldKey: string) {
  return FIELD_ALIASES[fieldKey] ?? fieldKey;
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
  const baseGuidance = 'Use selected collection item IDs only; do not invent facts.';
  const placeGuidance =
    row.sourceTier === 'place_then_ai'
      ? ' Start from direct Place facts, then use Blog/review evidence for priority or copy guidance.'
      : '';
  const strategyOnlyGuidance =
    row.fieldKey === 'reviewWeakness'
      ? ' strategy-only; do not turn weaknesses into public claims.'
      : '';
  return `${baseGuidance}${placeGuidance}${strategyOnlyGuidance}`;
}

export function serializeAnalyzerRulesetFieldContract(): AnalyzerRulesetFieldContract[] {
  return AI_SOURCE_MATRIX.map((item) => ({
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
