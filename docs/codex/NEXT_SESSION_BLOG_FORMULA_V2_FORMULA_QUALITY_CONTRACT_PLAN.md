# Blog Formula V2 Formula Quality Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

> **Important:** Do not restart the old V2 implementation plan. PR #48 already
> built deterministic V2, and PR #49 already implements the SL-F1 provider
> boundary (merged to `develop` as `c76c052`, develop-validated 2026-06-12).
> This task is a review/finalization pass focused on the Formula Quality
> Contract and develop validation.

**Goal:** Make SL-F1 extract a generation-ready Blog Writing Formula Set
(slot-based titles, sequence-based intro/body/footer, reusable tone habits,
soft CTA, banned-claims-vs-disclosures safety rules) that the existing
deterministic V2 draft generator actually consumes, proven by a round-trip
compatibility test.

**Architecture:** Upgrade `BlogFormulaSetV2Schema` to a `blog_formula_v2.1`
generation-ready shape with a legacy-upgrade parser so stored v2.0 rows keep
working. Embed the Product Intent / Formula Quality Contract into the SL-F1
prompt builder and OpenAI system prompt. Replace the placeholder-quality mock
formula with one shared generation-ready builder used by both deterministic
extraction and `safe_mock`. Wire the deterministic draft generator to load and
apply the stored formula blocks. Everything stays V2-only (`v2_` tables,
`/api/stores/:storeId/v2/blog-formula`, `web/blog_formula_v2.js`).

**Tech Stack:** Express/TypeScript in `poc-server`, Zod +
`zodResponseFormat` strict structured outputs, Vitest, SQLite repositories,
static HTML/JS in `web/`.

---

## Gap Analysis (verified against current code, 2026-06-12)

| Contract requirement | Current state | Gap |
|---|---|---|
| Product Intent in prompt | `blogFormulaPrompt.ts` constraints are evidence-boundary only; system prompt in `openAIBlogFormulaProvider.ts` is 3 generic sentences | Missing "generation-ready, not marketing summary", "how to write not what to say", slot/sequence/tone-habit instructions |
| Slot-based `titleFormula` array | Schema has a single `FormulaBlockSchema` with one `pattern: string` per block | Schema cannot express multiple slot patterns |
| Sequence-based intro/body/footer | Single `pattern` string like `'고객의 핵심 걱정 → 오늘 확인할 기준 예고'` | No `sequence: string[]` |
| Tone as reusable habits | `pattern: '차분함, 구체적 안내, 과장 회피'` (generic adjectives — exactly the banned output) | No persona/preferredPhrases/endingStyle/emojiPolicy |
| CTA soft vs hard distinction | Single pattern string | No `primaryStyle`/`softPatterns`/`hardReservationAllowed` |
| Footer hours policy | Not present | No `hoursPolicy` |
| Safety banned vs required | Only `requiredDisclosures` | No `bannedClaims`, no `reviewUsagePolicy` |
| Per-block evidence | `sourcePostIds`/`confidence`/`status` exist | OK — preserve |
| Downstream consumer contract | **`generateBlogFormulaV2Draft` → `buildDraftOutput(formulaSet.id, ...)` uses only the ID; formula blocks are never read** | Draft generator must consume the formula |
| Round-trip test | No test covers extract→save→retrieve→draft→validate as one flow | Add `test/blogFormulaV2RoundTrip.test.ts` |
| Vague-rule rejection | Nothing enforces it | Add deterministic quality evaluator |

## Boundaries (unchanged from PR #48/#49)

- Branch from latest `develop`; PR back to `develop`.
- V2 writes only to `v2_` tables; never `marketing_rulesets`/`ruleset_fields`.
- No OpenAI V2 draft generation; draft generation stays deterministic.
- No Hybrid/combined V1+V2 generation.
- No Naver calls; no browser-side Naver/OpenAI/provider calls; browser keeps
  calling only `poc-server` APIs.
- Do not reimplement the existing V2 retrieval/draft/validation lane — only
  compatibility adapters, V2-only.
- Keep `.DS_Store` and `docs/.BLOG_FORMULA_V2_HANDOFF.md.swp` unstaged.
- Keep `admin/`, `pc-web/`, `README_POC.md`, `web/event_operation_poc.html`,
  old Event-to-Operation files untouched.
- OpenAI structured-output strict mode: no `.default()`, no `.min()`/`.max()`
  on arrays, optional fields must be `.nullable()`. Enforce quality via the
  quality evaluator (Task 2), not via unsupported JSON Schema keywords.

## Product Intent (verbatim — embed in prompt builder and docs)

```text
The purpose of SL-F1 is not to produce a generic marketing summary.
The extracted Formula Set must be a generation-ready writing formula that can
be directly consumed by the existing V2 deterministic draft generator together
with:
- a Topic Brief
- retrieved owner Blog style examples Top 1~3

The Formula Set must preserve how the store's existing Naver Blog posts are
written: title construction, intro moves, body development, heading style,
tone and sentence rhythm, soft CTA pattern, footer/disclaimer pattern, and
medical safety constraints.
```

---

### Task 0: Branch and ledger registration

**Files:**
- Modify: `docs/codex/PLAN.md` (Milestone Ledger table + Next Todo section)

- [ ] **Step 1: Confirm clean develop and create branch**

```bash
cd /Users/1004182/Documents/bizplanet-work/bizp-store-learning-poc
git status --short --branch   # only .DS_Store (M) and docs/.BLOG_FORMULA_V2_HANDOFF.md.swp (??) allowed
git checkout develop && git pull origin develop
git checkout -b codex/blog-formula-v2-quality-contract
```

- [ ] **Step 2: Register milestone 13f in `docs/codex/PLAN.md`**

Add a row to the Milestone Ledger table after row 13e:

```markdown
| 13f | Blog Formula V2 Formula Quality Contract | Planned | [plan](NEXT_SESSION_BLOG_FORMULA_V2_FORMULA_QUALITY_CONTRACT_PLAN.md) | Pending |
```

Update the `Current next todo as of 2026-06-12` list item 2 to read:

```markdown
2. The user approved a Blog Formula V2 quality-contract follow-up (13f)
   before milestone 14. The first not-validated milestone is 13f; milestone 14
   (final docs/validation cleanup or promotion prep) remains gated on explicit
   user publication approval.
```

- [ ] **Step 3: Commit**

```bash
git add docs/codex/PLAN.md docs/codex/NEXT_SESSION_BLOG_FORMULA_V2_FORMULA_QUALITY_CONTRACT_PLAN.md
git commit -m "docs: plan blog formula v2 quality contract follow-up"
```

---

### Task 1: Generation-ready Formula Set schema v2.1 with legacy upgrade

**Files:**
- Modify: `poc-server/src/storeLearning/blogFormulaV2/types.ts`
- Test: `poc-server/test/blogFormulaV2Schema.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `poc-server/test/blogFormulaV2Schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  BlogFormulaSetV2Schema,
  parseStoredBlogFormulaV2
} from '../src/storeLearning/blogFormulaV2/types.js';

const ids = ['item_1', 'item_2', 'item_3'];
const evidence = { sourcePostIds: ids, confidence: 0.8, status: 'confirmed' as const };

export const generationReadyFormulaFixture = {
  schemaVersion: 'blog_formula_v2.1',
  titleFormula: [
    {
      ...evidence,
      name: 'risk_avoidance_method',
      pattern:
        '{지역키워드}{시술명}, {부작용/실패/원하지 않는 결과} 없이 {효과/만족도}를 높이는 방법은 따로 있습니다'
    },
    {
      ...evidence,
      name: 'official_certification',
      pattern: '{시술명} 부작용 걱정 없이 하려면 [{시술명/장비} 공식 인증 피부과]'
    }
  ],
  introFormula: {
    ...evidence,
    name: '대표원장 신뢰 도입',
    description: '인사-소개-신뢰신호-걱정공감-예고로 이어지는 도입 무브 시퀀스',
    sequence: [
      '짧은 인사',
      '의원 또는 대표원장 소개',
      '공식 인증/전문성 신뢰 신호',
      '독자가 실제로 가질 법한 걱정 제시',
      '그 걱정이 타당하다고 공감',
      '오늘 다룰 내용 예고'
    ]
  },
  bodyFormula: {
    ...evidence,
    name: '고민-원리-판단기준 전개',
    description: '독자 고민에서 출발해 원리, 의료진 판단, 선택 기준으로 전개',
    sequence: [
      '독자의 고민/오해 제시',
      '왜 그런 고민이 생기는지 설명',
      '시술 원리 설명',
      '부작용 또는 실패 가능성이 생기는 이유 설명',
      '장비보다 의료진 판단/설계가 중요하다는 전환',
      '병원 선택 기준 2~3개 제시',
      'soft CTA',
      '병원 정보/의료 고지'
    ]
  },
  headingFormula: {
    ...evidence,
    name: '질문/기준형 소제목',
    description: '질문형, 리스크형, 원리형, 기준형 소제목을 혼용',
    patterns: ['{시술명} 부작용, 왜 생길까요?', '{시술명} 전 확인해야 하는 기준', '{장비} 원리 간단 정리']
  },
  toneAndMannerFormula: {
    ...evidence,
    persona: '대표원장이 직접 설명하는 듯한 1인칭 전문가 톤',
    style: ['친근함', '전문적', '조심스러움', '교육형'],
    preferredPhrases: ['많은 분들이 걱정하시는 부분이에요', '쉽게 설명해 드릴게요'],
    endingStyle: ['해요', '답니다', '좋겠습니다'],
    empathyPatterns: ['그 걱정은 자연스러운 반응입니다'],
    emojiPolicy: { allowed: ['^^', '😊'], usage: '소량 사용' }
  },
  ctaFormula: {
    ...evidence,
    primaryStyle: '강한 예약 유도보다 선택 기준 제시형 soft CTA',
    softPatterns: [
      '병원 방문 전 이 기준만큼은 확인해 보시길 권해드립니다.',
      '오늘 글이 고민 중이신 분들께 도움이 되었으면 좋겠습니다.'
    ],
    hardReservationAllowed: false
  },
  footerFormula: {
    ...evidence,
    sequence: ['감사 인사', '의원/대표원장 서명', '신뢰 신호', '위치/연락처', '의료 고지'],
    hoursPolicy: '운영시간 충돌 가능성이 있으면 구체적 시간을 하드코딩하지 않는다.'
  },
  medicalSafetyFormula: {
    ...evidence,
    bannedClaims: ['효과보장', '100% 효과', '완전 제거', '부작용 없음', '통증 없음', '무조건 개선', '최고/1위/유일', '타 병원보다 우수'],
    requiredDisclosures: ['개인차', '부작용 가능성', '의료진 상담'],
    reviewUsagePolicy: '방문자 리뷰를 공개 광고 문구나 치료 결과 주장으로 변환하지 않는다.'
  }
};

const legacyFormulaFixture = {
  schemaVersion: 'blog_formula_v2.0',
  titleFormula: { ...evidence, name: '걱정 해소형 제목', description: 'd', pattern: '{메인키워드} 걱정 없이 확인할 점' },
  introFormula: { ...evidence, name: 'n', description: 'd', pattern: '고객의 핵심 걱정 → 오늘 확인할 기준 예고' },
  bodyFormula: { ...evidence, name: 'n', description: 'd', pattern: '고민 배경 → 원리 설명 → 개인별 판단 기준 → CTA' },
  headingFormula: { ...evidence, name: 'n', description: 'd', pattern: '질문형 소제목 3-4개' },
  toneAndMannerFormula: { ...evidence, name: '차분한 의료 정보 안내', description: 'd', pattern: '차분함, 구체적 안내, 과장 회피' },
  ctaFormula: { ...evidence, name: 'n', description: '상담 확인형 CTA', pattern: '본인 상태 확인 → 의료진 상담 권유' },
  footerFormula: { ...evidence, name: 'n', description: 'd', pattern: '의료정보 제공 목적 + 개인차/부작용 가능성 + 의료진 상담' },
  medicalSafetyFormula: {
    ...evidence,
    name: 'n',
    description: 'd',
    pattern: '개인차 → 부작용 가능성 → 의료진 상담',
    requiredDisclosures: ['개인차', '부작용 가능성', '의료진 상담']
  }
};

describe('BlogFormulaSetV2Schema v2.1', () => {
  it('accepts a generation-ready formula set', () => {
    const parsed = BlogFormulaSetV2Schema.parse(generationReadyFormulaFixture);
    expect(parsed.titleFormula.length).toBeGreaterThanOrEqual(2);
    expect(parsed.introFormula.sequence.length).toBeGreaterThanOrEqual(4);
    expect(parsed.medicalSafetyFormula.bannedClaims).toContain('부작용 없음');
    expect(parsed.ctaFormula.hardReservationAllowed).toBe(false);
  });

  it('keeps per-block sourcePostIds, confidence, and status', () => {
    const parsed = BlogFormulaSetV2Schema.parse(generationReadyFormulaFixture);
    expect(parsed.titleFormula[0].sourcePostIds).toEqual(ids);
    expect(parsed.bodyFormula.status).toBe('confirmed');
    expect(parsed.toneAndMannerFormula.confidence).toBeCloseTo(0.8);
  });

  it('rejects a v2.0-shaped formula as the current schema', () => {
    expect(() => BlogFormulaSetV2Schema.parse(legacyFormulaFixture)).toThrow();
  });
});

describe('parseStoredBlogFormulaV2', () => {
  it('passes a stored v2.1 formula through unchanged', () => {
    const parsed = parseStoredBlogFormulaV2(generationReadyFormulaFixture);
    expect(parsed.schemaVersion).toBe('blog_formula_v2.1');
    expect(parsed.footerFormula.hoursPolicy).toContain('하드코딩');
  });

  it('upgrades a stored legacy v2.0 formula to v2.1 deterministically', () => {
    const parsed = parseStoredBlogFormulaV2(legacyFormulaFixture);
    expect(parsed.schemaVersion).toBe('blog_formula_v2.1');
    expect(parsed.titleFormula[0].pattern).toBe('{메인키워드} 걱정 없이 확인할 점');
    expect(parsed.introFormula.sequence).toEqual(['고객의 핵심 걱정', '오늘 확인할 기준 예고']);
    expect(parsed.medicalSafetyFormula.requiredDisclosures).toEqual(['개인차', '부작용 가능성', '의료진 상담']);
    expect(parsed.medicalSafetyFormula.bannedClaims).toContain('효과보장');
    expect(parsed.ctaFormula.softPatterns).toEqual(['본인 상태 확인 → 의료진 상담 권유']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd poc-server && npm test -- --run test/blogFormulaV2Schema.test.ts`
Expected: FAIL — `parseStoredBlogFormulaV2` is not exported; v2.1 shape rejected.

- [ ] **Step 3: Implement schema v2.1 in `types.ts`**

Replace `FormulaBlockSchema` and `BlogFormulaSetV2Schema` in
`poc-server/src/storeLearning/blogFormulaV2/types.ts` (keep everything else —
topic brief, retrieved sample, draft output, validation schemas — unchanged):

```ts
export const BLOG_FORMULA_V2_VERSION = 'formula_v2.1';

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
```

Note: no `.min()` on arrays — strict structured outputs reject `minItems`.
Array non-emptiness is enforced by the quality evaluator in Task 2.

- [ ] **Step 4: Implement the legacy parser in `types.ts`**

Add below the schema (legacy schema mirrors the pre-change shape exactly):

```ts
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
      hoursPolicy: '운영시간 충돌 가능성이 있으면 구체적 시간을 하드코딩하지 않는다.'
    },
    medicalSafetyFormula: {
      ...evidence(legacy.medicalSafetyFormula),
      bannedClaims: DEFAULT_BANNED_CLAIMS,
      requiredDisclosures: legacy.medicalSafetyFormula.requiredDisclosures,
      reviewUsagePolicy: '방문자 리뷰를 공개 광고 문구나 치료 결과 주장으로 변환하지 않는다.'
    }
  });
}

export function parseStoredBlogFormulaV2(stored: unknown): BlogFormulaSetV2 {
  const current = BlogFormulaSetV2Schema.safeParse(stored);
  if (current.success) return current.data;
  return upgradeLegacyFormula(BlogFormulaSetV2LegacySchema.parse(stored));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd poc-server && npm test -- --run test/blogFormulaV2Schema.test.ts`
Expected: PASS (typecheck of dependent files will still fail — that is fixed in
Tasks 3-6; do not run `npm run typecheck` yet).

- [ ] **Step 6: Commit**

```bash
git add poc-server/src/storeLearning/blogFormulaV2/types.ts poc-server/test/blogFormulaV2Schema.test.ts
git commit -m "feat: upgrade blog formula v2 schema to generation-ready v2.1"
```

---

### Task 2: Deterministic Formula Quality evaluator (vague-rule rejection)

**Files:**
- Create: `poc-server/src/storeLearning/blogFormulaV2/formulaQuality.ts`
- Test: `poc-server/test/blogFormulaV2Quality.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `poc-server/test/blogFormulaV2Quality.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { evaluateBlogFormulaV2Quality } from '../src/storeLearning/blogFormulaV2/formulaQuality.js';
import { generationReadyFormulaFixture } from './blogFormulaV2Schema.test.js';
import { BlogFormulaSetV2Schema } from '../src/storeLearning/blogFormulaV2/types.js';

const goodFormula = BlogFormulaSetV2Schema.parse(generationReadyFormulaFixture);

describe('evaluateBlogFormulaV2Quality', () => {
  it('returns no issues for a generation-ready formula set', () => {
    expect(evaluateBlogFormulaV2Quality(goodFormula)).toEqual([]);
  });

  it('flags non-slot title patterns', () => {
    const vague = {
      ...goodFormula,
      titleFormula: [{ ...goodFormula.titleFormula[0], pattern: '정보 제공형 제목' }]
    };
    const issues = evaluateBlogFormulaV2Quality(vague);
    expect(issues.some((issue) => issue.code === 'title_pattern_not_slot_based')).toBe(true);
  });

  it('flags empty title/sequence/safety blocks', () => {
    const empty = {
      ...goodFormula,
      titleFormula: [],
      introFormula: { ...goodFormula.introFormula, sequence: [] },
      medicalSafetyFormula: { ...goodFormula.medicalSafetyFormula, bannedClaims: [] }
    };
    const codes = evaluateBlogFormulaV2Quality(empty).map((issue) => issue.code);
    expect(codes).toContain('title_formula_empty');
    expect(codes).toContain('intro_sequence_too_short');
    expect(codes).toContain('banned_claims_empty');
  });

  it('flags generic-adjective-only tone', () => {
    const generic = {
      ...goodFormula,
      toneAndMannerFormula: {
        ...goodFormula.toneAndMannerFormula,
        preferredPhrases: [],
        endingStyle: []
      }
    };
    const codes = evaluateBlogFormulaV2Quality(generic).map((issue) => issue.code);
    expect(codes).toContain('tone_missing_sentence_habits');
  });

  it('flags vague stock phrases used as whole patterns', () => {
    const vague = {
      ...goodFormula,
      introFormula: { ...goodFormula.introFormula, sequence: ['정보 제공 중심', '친근한 톤'] }
    };
    const codes = evaluateBlogFormulaV2Quality(vague).map((issue) => issue.code);
    expect(codes).toContain('vague_rule_detected');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd poc-server && npm test -- --run test/blogFormulaV2Quality.test.ts`
Expected: FAIL — `formulaQuality.ts` does not exist.

- [ ] **Step 3: Implement the evaluator**

Create `poc-server/src/storeLearning/blogFormulaV2/formulaQuality.ts`:

```ts
import type { BlogFormulaSetV2 } from './types.js';

export type BlogFormulaV2QualityIssue = {
  code:
    | 'title_formula_empty'
    | 'title_pattern_not_slot_based'
    | 'intro_sequence_too_short'
    | 'body_sequence_too_short'
    | 'heading_patterns_empty'
    | 'tone_missing_sentence_habits'
    | 'cta_soft_patterns_empty'
    | 'footer_sequence_too_short'
    | 'banned_claims_empty'
    | 'required_disclosures_empty'
    | 'vague_rule_detected';
  block: string;
  message: string;
};

const VAGUE_STOCK_PHRASES = ['정보 제공 중심', '친근한 톤', '친근하고 전문적', '전문적인 문체', '정보 제공형 제목'];

function vagueIssues(block: string, values: string[]): BlogFormulaV2QualityIssue[] {
  return values
    .filter((value) => VAGUE_STOCK_PHRASES.some((phrase) => value.trim() === phrase))
    .map((value) => ({
      code: 'vague_rule_detected' as const,
      block,
      message: `추상 룰 금지: "${value}"는 생성 지침이 아닙니다.`
    }));
}

export function evaluateBlogFormulaV2Quality(formula: BlogFormulaSetV2): BlogFormulaV2QualityIssue[] {
  const issues: BlogFormulaV2QualityIssue[] = [];

  if (formula.titleFormula.length === 0) {
    issues.push({ code: 'title_formula_empty', block: 'titleFormula', message: '제목 공식이 비어 있습니다.' });
  }
  for (const title of formula.titleFormula) {
    if (!/\{[^}]+\}/u.test(title.pattern)) {
      issues.push({
        code: 'title_pattern_not_slot_based',
        block: 'titleFormula',
        message: `슬롯 기반 패턴이 아닙니다: "${title.pattern}"`
      });
    }
  }
  if (formula.introFormula.sequence.length < 3) {
    issues.push({ code: 'intro_sequence_too_short', block: 'introFormula', message: '도입부 무브 시퀀스가 3개 미만입니다.' });
  }
  if (formula.bodyFormula.sequence.length < 4) {
    issues.push({ code: 'body_sequence_too_short', block: 'bodyFormula', message: '본문 전개 시퀀스가 4개 미만입니다.' });
  }
  if (formula.headingFormula.patterns.length === 0) {
    issues.push({ code: 'heading_patterns_empty', block: 'headingFormula', message: '소제목 패턴이 비어 있습니다.' });
  }
  if (formula.toneAndMannerFormula.preferredPhrases.length === 0 && formula.toneAndMannerFormula.endingStyle.length === 0) {
    issues.push({
      code: 'tone_missing_sentence_habits',
      block: 'toneAndMannerFormula',
      message: '톤 공식에 재사용 가능한 문장 습관(선호 표현/어미)이 없습니다.'
    });
  }
  if (formula.ctaFormula.softPatterns.length === 0) {
    issues.push({ code: 'cta_soft_patterns_empty', block: 'ctaFormula', message: 'soft CTA 패턴이 비어 있습니다.' });
  }
  if (formula.footerFormula.sequence.length < 2) {
    issues.push({ code: 'footer_sequence_too_short', block: 'footerFormula', message: '푸터 시퀀스가 2개 미만입니다.' });
  }
  if (formula.medicalSafetyFormula.bannedClaims.length === 0) {
    issues.push({ code: 'banned_claims_empty', block: 'medicalSafetyFormula', message: '금지 클레임 목록이 비어 있습니다.' });
  }
  if (formula.medicalSafetyFormula.requiredDisclosures.length === 0) {
    issues.push({ code: 'required_disclosures_empty', block: 'medicalSafetyFormula', message: '필수 고지 목록이 비어 있습니다.' });
  }

  issues.push(...vagueIssues('titleFormula', formula.titleFormula.map((title) => title.pattern)));
  issues.push(...vagueIssues('introFormula', formula.introFormula.sequence));
  issues.push(...vagueIssues('bodyFormula', formula.bodyFormula.sequence));
  issues.push(...vagueIssues('toneAndMannerFormula', formula.toneAndMannerFormula.style));

  return issues;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd poc-server && npm test -- --run test/blogFormulaV2Quality.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add poc-server/src/storeLearning/blogFormulaV2/formulaQuality.ts poc-server/test/blogFormulaV2Quality.test.ts
git commit -m "feat: add deterministic blog formula v2 quality evaluator"
```

---

### Task 3: Product Intent and extraction instructions in the SL-F1 prompt builder

**Files:**
- Modify: `poc-server/src/storeLearning/blogFormulaV2/blogFormulaPrompt.ts`
- Test: `poc-server/test/blogFormulaV2Prompt.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Add to `poc-server/test/blogFormulaV2Prompt.test.ts` (inside the existing
describe block, reusing the file's existing store/posts fixtures):

```ts
it('embeds the product intent and downstream consumer contract', () => {
  const { promptInput } = buildBlogFormulaV2PromptInput({ store, ownerBlogPosts: posts });
  const intent = promptInput.productIntent.join(' ');
  expect(intent).toContain('not to produce a generic marketing summary');
  expect(intent).toContain('generation-ready writing formula');
  expect(intent).toContain('Topic Brief');
  expect(intent).toContain('Top 1~3');
});

it('embeds formula extraction instructions describing how to write, not what to say', () => {
  const { promptInput } = buildBlogFormulaV2PromptInput({ store, ownerBlogPosts: posts });
  const instructions = promptInput.formulaExtractionInstructions.join(' ');
  expect(instructions).toContain('how to write, not what to say');
  expect(instructions).toContain('slot-based title formulas');
  expect(instructions).toContain('sequence of writing moves');
  expect(instructions).toContain('reusable sentence habits');
  expect(instructions).toContain('soft decision-guide CTA');
  expect(instructions).toContain('Do not copy long source text');
  expect(instructions).toContain('confirmed');
});

it('embeds formula quality requirements banning vague rules', () => {
  const { promptInput } = buildBlogFormulaV2PromptInput({ store, ownerBlogPosts: posts });
  const quality = promptInput.formulaQualityRequirements.join(' ');
  expect(quality).toContain('정보 제공 중심');
  expect(quality).toContain('slot-based');
  expect(quality).toContain('sourcePostIds');
  expect(quality).toContain('confirmed | candidate | weak');
  expect(quality).toContain('without hardcoding stale business hours');
  expect(quality).toContain('banned claims from required risk disclosures');
});

it('updates the prompt schema version for the new instruction shape', () => {
  const { metadata } = buildBlogFormulaV2PromptInput({ store, ownerBlogPosts: posts });
  expect(metadata.schemaVersion).toBe('blog_formula_v2_extraction_input.v2');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd poc-server && npm test -- --run test/blogFormulaV2Prompt.test.ts`
Expected: FAIL — `productIntent`, `formulaExtractionInstructions`,
`formulaQualityRequirements` do not exist; schema version is `.v1`.

- [ ] **Step 3: Implement prompt additions**

In `blogFormulaPrompt.ts`:

1. Bump the version constant:

```ts
export const BLOG_FORMULA_V2_PROMPT_SCHEMA_VERSION = 'blog_formula_v2_extraction_input.v2';
```

2. Add the instruction constants above `buildPromptInput`:

```ts
const productIntent = [
  'The purpose of SL-F1 is not to produce a generic marketing summary.',
  'The extracted Formula Set must be a generation-ready writing formula that can be directly consumed by the existing V2 deterministic draft generator together with: a Topic Brief and retrieved owner Blog style examples Top 1~3.',
  'The Formula Set must preserve how the store\'s existing Naver Blog posts are written: title construction, intro moves, body development, heading style, tone and sentence rhythm, soft CTA pattern, footer/disclaimer pattern, and medical safety constraints.'
] as const;

const formulaExtractionInstructions = [
  'Extract writing formulas for future draft generation, not marketing summaries.',
  'Each formula block must describe how to write, not what to say.',
  'Preserve the store\'s existing Blog article structure.',
  'Derive slot-based title formulas from actual Blog titles, e.g. "{지역키워드}{시술명}, {부작용/실패} 없이 {효과}를 높이는 방법은 따로 있습니다".',
  'Derive intro/body/footer formulas from actual body flow as a sequence of writing moves.',
  'Extract tone as reusable sentence habits and phrasing (persona, preferred phrases, sentence endings, empathy patterns, emoji policy), not generic adjectives.',
  'Extract CTA as a reusable soft decision-guide CTA pattern, distinguished from hard reservation CTA.',
  'Extract medical safety rules as generation constraints, distinguishing banned claims from required risk disclosures.',
  'Do not copy long source text into formula blocks.',
  'Use sourcePostIds to show which posts support each formula block.',
  'If a pattern appears in only one post, mark it as candidate or weak. If a pattern appears repeatedly, mark it as confirmed.'
] as const;

const formulaQualityRequirements = [
  'Formula blocks must be concrete enough to guide draft generation.',
  'Do not output vague rules like "정보 제공 중심", "친근한 톤", "전문적인 문체".',
  'Title formulas must be slot-based patterns using {슬롯} placeholders.',
  'Intro formula must be a sequence of writing moves.',
  'Body formula must be a reusable article development sequence.',
  'Tone formula must include reusable sentence habits, preferred phrasing, endings, and emoji/symbol policy.',
  'CTA formula must distinguish soft decision-guide CTA from hard reservation CTA.',
  'Footer formula must include repeated credential/location/disclaimer patterns without hardcoding stale business hours.',
  'Safety formula must distinguish banned claims from required risk disclosures. The word "부작용" itself is not banned; "부작용 없음" is banned.',
  'Each formula block must include sourcePostIds, confidence, and status: confirmed | candidate | weak.'
] as const;
```

3. Extend the `BlogFormulaV2PromptInput` type with the three new fields
   (`productIntent`, `formulaExtractionInstructions`,
   `formulaQualityRequirements`, each `string[]` — use
   `typeof productIntent` etc.) and change `outputSchemaRef` to
   `'blog_formula_v2.1'`. Include all three arrays in the object returned by
   `buildPromptInput`, after `constraints`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd poc-server && npm test -- --run test/blogFormulaV2Prompt.test.ts`
Expected: PASS (including pre-existing budget tests — the new arrays add fixed
overhead; if a pre-existing character-budget assertion fails, raise that test's
`promptCharacterBudget` option, not the production defaults).

- [ ] **Step 5: Commit**

```bash
git add poc-server/src/storeLearning/blogFormulaV2/blogFormulaPrompt.ts poc-server/test/blogFormulaV2Prompt.test.ts
git commit -m "feat: embed product intent and quality contract in SL-F1 prompt"
```

---

### Task 4: OpenAI provider system prompt and v2.1 response format

**Files:**
- Modify: `poc-server/src/storeLearning/blogFormulaV2/providers/openAIBlogFormulaProvider.ts`
- Test: `poc-server/test/blogFormulaV2Provider.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Add to `poc-server/test/blogFormulaV2Provider.test.ts`, reusing the file's
existing fake-client pattern. The fake client must now return a v2.1-shaped
parsed output — import and reuse `generationReadyFormulaFixture` from
`./blogFormulaV2Schema.test.js` for the fake `message.parsed` value, and update
any existing fake v2.0 outputs in this file to the fixture.

```ts
it('sends a generation-ready system prompt to OpenAI', async () => {
  let captured: any = null;
  const fakeClient = {
    beta: { chat: { completions: { parse: async (params: unknown) => {
      captured = params;
      return { choices: [{ message: { parsed: generationReadyFormulaFixture } }] };
    } } } }
  };
  const provider = createOpenAIBlogFormulaV2Provider({ client: fakeClient });
  await provider.extractFormula({ store, ownerBlogPosts: posts });
  const systemMessage = captured.messages[0].content as string;
  expect(systemMessage).toContain('generation-ready');
  expect(systemMessage).toContain('not a generic marketing summary');
  expect(systemMessage).toContain('how to write, not what to say');
  expect(systemMessage).toContain('slot-based title');
  expect(systemMessage).toContain('soft decision-guide CTA');
});

it('requests the v2.1 formula response format', async () => {
  let captured: any = null;
  const fakeClient = {
    beta: { chat: { completions: { parse: async (params: unknown) => {
      captured = params;
      return { choices: [{ message: { parsed: generationReadyFormulaFixture } }] };
    } } } }
  };
  const provider = createOpenAIBlogFormulaV2Provider({ client: fakeClient });
  await provider.extractFormula({ store, ownerBlogPosts: posts });
  const schema = captured.response_format.json_schema.schema;
  expect(schema.properties.titleFormula.type).toBe('array');
  expect(schema.properties.introFormula.properties.sequence.type).toBe('array');
  expect(schema.properties.medicalSafetyFormula.properties.bannedClaims.type).toBe('array');
  expect(schema.properties.toneAndMannerFormula.properties.preferredPhrases.type).toBe('array');
});

it('rejects a legacy v2.0 parsed output', async () => {
  const legacyParsed = { schemaVersion: 'blog_formula_v2.0' };
  const fakeClient = {
    beta: { chat: { completions: { parse: async () => ({ choices: [{ message: { parsed: legacyParsed } }] }) } } }
  };
  const provider = createOpenAIBlogFormulaV2Provider({ client: fakeClient });
  await expect(provider.extractFormula({ store, ownerBlogPosts: posts })).rejects.toThrow();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd poc-server && npm test -- --run test/blogFormulaV2Provider.test.ts`
Expected: FAIL — system prompt lacks the new instructions; existing fake v2.0
outputs no longer parse.

- [ ] **Step 3: Implement the system prompt**

Replace `systemPrompt` in `openAIBlogFormulaProvider.ts`:

```ts
const systemPrompt =
  'You are a Korean local-store blog writing-formula analyst. ' +
  'Your output is a generation-ready writing formula, not a generic marketing summary. ' +
  'It will be consumed directly by a deterministic draft generator together with a Topic Brief and retrieved owner Blog style examples Top 1~3. ' +
  'Each formula block must describe how to write, not what to say. ' +
  'Produce slot-based title patterns from actual titles, intro/body/footer sequences of writing moves from actual body flow, ' +
  'tone as reusable sentence habits (persona, preferred phrases, endings, emoji policy), ' +
  'a soft decision-guide CTA pattern distinguished from hard reservation CTA, ' +
  'and medical safety constraints distinguishing banned claims from required risk disclosures. ' +
  'Use only the provided owner Blog posts as evidence, attach sourcePostIds per block, ' +
  'mark single-post patterns as candidate or weak and repeated patterns as confirmed, ' +
  'do not copy long source text, and keep medical, legal, and guarantee claims conservative.';
```

No other provider changes are needed: `zodResponseFormat(BlogFormulaSetV2Schema, ...)`
automatically picks up the v2.1 schema from Task 1, and
`BlogFormulaSetV2Schema.parse(parsedOutput)` already rejects legacy output.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd poc-server && npm test -- --run test/blogFormulaV2Provider.test.ts`
Expected: PASS (update remaining v2.0-shaped fake outputs in this file to the
fixture if any still fail).

- [ ] **Step 5: Commit**

```bash
git add poc-server/src/storeLearning/blogFormulaV2/providers/openAIBlogFormulaProvider.ts poc-server/test/blogFormulaV2Provider.test.ts
git commit -m "feat: generation-ready SL-F1 system prompt and v2.1 response format"
```

---

### Task 5: Shared generation-ready mock formula for deterministic and safe_mock paths

**Files:**
- Create: `poc-server/src/storeLearning/blogFormulaV2/mockFormulaBuilder.ts`
- Modify: `poc-server/src/storeLearning/blogFormulaV2/blogFormulaV2Service.ts` (delete `buildFormula`, use shared builder)
- Modify: `poc-server/src/storeLearning/blogFormulaV2/providers/safeMockBlogFormulaProvider.ts` (delete inline mock, use shared builder)
- Test: `poc-server/test/blogFormulaV2Services.test.ts`, `poc-server/test/blogFormulaV2Provider.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Add to `poc-server/test/blogFormulaV2Services.test.ts` (deterministic path) and
mirror the same assertions for the safe_mock provider in
`poc-server/test/blogFormulaV2Provider.test.ts`:

```ts
it('deterministic extraction produces a generation-ready v2.1 formula with no quality issues', () => {
  const { formulaSet } = extractBlogFormulaV2(repos, storeId);
  const formula = parseStoredBlogFormulaV2(formulaSet.formula);
  expect(formula.schemaVersion).toBe('blog_formula_v2.1');
  expect(formula.titleFormula.length).toBeGreaterThanOrEqual(2);
  expect(formula.titleFormula.every((title) => /\{[^}]+\}/u.test(title.pattern))).toBe(true);
  expect(formula.introFormula.sequence.length).toBeGreaterThanOrEqual(3);
  expect(formula.bodyFormula.sequence.length).toBeGreaterThanOrEqual(4);
  expect(formula.toneAndMannerFormula.preferredPhrases.length).toBeGreaterThan(0);
  expect(formula.ctaFormula.hardReservationAllowed).toBe(false);
  expect(formula.medicalSafetyFormula.bannedClaims).toContain('부작용 없음');
  expect(evaluateBlogFormulaV2Quality(formula)).toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd poc-server && npm test -- --run test/blogFormulaV2Services.test.ts test/blogFormulaV2Provider.test.ts`
Expected: FAIL — `buildFormula`/`buildSafeMockBlogFormulaV2` still emit v2.0.

- [ ] **Step 3: Implement the shared builder**

Create `poc-server/src/storeLearning/blogFormulaV2/mockFormulaBuilder.ts`:

```ts
import type { OwnerBlogPostV2 } from './sourcePosts.js';
import { BlogFormulaSetV2Schema, DEFAULT_BANNED_CLAIMS, type BlogFormulaSetV2 } from './types.js';

export function buildGenerationReadyMockFormula(posts: OwnerBlogPostV2[]): BlogFormulaSetV2 {
  const ids = posts.map((post) => post.collectionItemId);
  const evidence = {
    sourcePostIds: ids,
    confidence: posts.length >= 3 ? 0.88 : 0.62,
    status: posts.length >= 3 ? ('confirmed' as const) : ('candidate' as const)
  };

  return BlogFormulaSetV2Schema.parse({
    schemaVersion: 'blog_formula_v2.1',
    titleFormula: [
      {
        ...evidence,
        name: 'risk_avoidance_method',
        pattern: '{지역키워드}{시술명}, {부작용/실패} 없이 {효과/만족도}를 높이는 방법은 따로 있습니다'
      },
      {
        ...evidence,
        name: 'criteria_before_decision',
        pattern: '{시술명}{가격/샷수}, 그보다 먼저 확인해야 하는 {숫자}가지'
      }
    ],
    introFormula: {
      ...evidence,
      name: '걱정 공감형 도입',
      description: '인사-소개-걱정 제시-공감-예고 순서의 도입 무브',
      sequence: ['짧은 인사', '매장/대표자 소개', '독자가 실제로 가질 법한 걱정 제시', '그 걱정이 타당하다고 공감', '오늘 다룰 내용 예고']
    },
    bodyFormula: {
      ...evidence,
      name: '고민-원리-판단기준 전개',
      description: '독자 고민에서 원리, 판단 기준, soft CTA로 이어지는 전개',
      sequence: [
        '독자의 고민/오해 제시',
        '왜 그런 고민이 생기는지 설명',
        '시술/서비스 원리 설명',
        '부작용 또는 불만족이 생기는 이유 설명',
        '선택 기준 2~3개 제시',
        'soft CTA',
        '위치/연락처와 의료 고지'
      ]
    },
    headingFormula: {
      ...evidence,
      name: '질문/기준형 소제목',
      description: '질문형, 리스크형, 원리형, 기준형 소제목 혼용',
      patterns: ['{시술명} 부작용, 왜 생길까요?', '{시술명} 전 확인해야 하는 기준', '{시술명/장비} 원리 간단 정리']
    },
    toneAndMannerFormula: {
      ...evidence,
      persona: '담당자가 직접 설명하는 듯한 1인칭 전문가 톤',
      style: ['친근함', '전문적', '조심스러움', '교육형'],
      preferredPhrases: ['많은 분들이 걱정하시는 부분이에요', '쉽게 설명해 드릴게요', '꼼꼼히 확인하셨으면 좋겠습니다'],
      endingStyle: ['해요', '답니다', '좋겠습니다'],
      empathyPatterns: ['그런 걱정이 드는 것은 자연스럽습니다'],
      emojiPolicy: { allowed: ['^^', '😊'], usage: '소량 사용' }
    },
    ctaFormula: {
      ...evidence,
      primaryStyle: '강한 예약 유도보다 선택 기준 제시형 soft CTA',
      softPatterns: [
        '방문 전 이 기준만큼은 확인해 보시길 권해드립니다.',
        '오늘 글이 고민 중이신 분들께 도움이 되었으면 좋겠습니다.'
      ],
      hardReservationAllowed: false
    },
    footerFormula: {
      ...evidence,
      sequence: ['감사 인사', '매장/대표자 서명', '신뢰 신호', '위치/연락처', '의료 고지'],
      hoursPolicy: '운영시간 충돌 가능성이 있으면 구체적 시간을 하드코딩하지 않는다.'
    },
    medicalSafetyFormula: {
      ...evidence,
      bannedClaims: DEFAULT_BANNED_CLAIMS,
      requiredDisclosures: ['개인차', '부작용 가능성', '의료진 상담'],
      reviewUsagePolicy: '방문자 리뷰를 공개 광고 문구나 치료 결과 주장으로 변환하지 않는다.'
    }
  });
}
```

In `blogFormulaV2Service.ts`: delete the local `buildFormula` function and
replace its single call site (`extractBlogFormulaV2`) with
`buildGenerationReadyMockFormula(posts)` (add the import).

In `safeMockBlogFormulaProvider.ts`: delete `buildSafeMockBlogFormulaV2`'s
body and re-export it as a thin wrapper for backward test compatibility:

```ts
export function buildSafeMockBlogFormulaV2(input: BlogFormulaV2ExtractInput): BlogFormulaSetV2 {
  return buildGenerationReadyMockFormula(input.ownerBlogPosts);
}
```

Also record quality issues on extraction runs: in
`extractBlogFormulaV2` and `extractBlogFormulaV2WithProvider` in
`blogFormulaV2Service.ts`, after parsing the formula, compute
`const qualityIssues = evaluateBlogFormulaV2Quality(formula);` and merge it
into the run's `validation` JSON:

```ts
validation: toJsonValue({
  status: 'needs_human_review',
  reason: '...existing reason...',
  qualityIssues
  // keep existing provider field where present
})
```

- [ ] **Step 4: Run tests and fix remaining v2.0 expectations**

Run: `cd poc-server && npm test -- --run test/blogFormulaV2Services.test.ts test/blogFormulaV2Provider.test.ts test/blogFormulaV2Api.test.ts test/blogFormulaV2Repositories.test.ts test/blogFormulaV2Demo.test.ts`
Expected: PASS after updating any existing assertions that reference
`schemaVersion: 'blog_formula_v2.0'`, `formula_v2.0`, or single-block
`titleFormula.pattern` to the v2.1 equivalents
(`formulaSet.version === 'formula_v2.1'`, `titleFormula[0].pattern`).

- [ ] **Step 5: Run typecheck**

Run: `cd poc-server && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add poc-server/src/storeLearning/blogFormulaV2/ poc-server/test/
git commit -m "feat: shared generation-ready mock formula for deterministic and safe_mock"
```

---

### Task 6: Draft generator consumes the Formula Set (downstream consumer contract)

**Files:**
- Modify: `poc-server/src/storeLearning/blogFormulaV2/blogFormulaV2Service.ts`
  (`buildDraftOutput`, `generateBlogFormulaV2Draft`)
- Test: `poc-server/test/blogFormulaV2Services.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Add to `poc-server/test/blogFormulaV2Services.test.ts`:

```ts
it('draft generation consumes the stored formula set, not just its id', () => {
  const { formulaSet } = extractBlogFormulaV2(repos, storeId);
  const formula = parseStoredBlogFormulaV2(formulaSet.formula);
  const { topicBrief, retrievalRun } = retrieveBlogFormulaV2Samples(repos, storeId, {
    formulaSetId: formulaSet.id,
    topicBrief: {
      topic: '리팟레이저',
      mainKeyword: '리팟레이저 부작용',
      secondaryKeywords: [],
      mustInclude: ['개인차', '부작용 가능성', '의료진 상담'],
      mustAvoid: []
    }
  });
  const { output } = generateBlogFormulaV2Draft(repos, storeId, {
    formulaSetId: formulaSet.id,
    topicBriefId: topicBrief.id,
    retrievalRunId: retrievalRun.id
  });

  // Title candidates come from slot-filled title formula patterns.
  expect(output.titleCandidates.length).toBeGreaterThanOrEqual(formula.titleFormula.length);
  expect(output.titleCandidates[0]).not.toContain('{');
  expect(output.selectedTitle).toContain('리팟레이저');

  // Draft applies tone habits, soft CTA, and required disclosures from the formula.
  expect(formula.toneAndMannerFormula.preferredPhrases.some((phrase) => output.blogDraft.includes(phrase))).toBe(true);
  expect(formula.ctaFormula.softPatterns.some((pattern) => output.blogDraft.includes(pattern))).toBe(true);
  for (const disclosure of formula.medicalSafetyFormula.requiredDisclosures) {
    expect(output.blogDraft).toContain(disclosure);
  }

  // Compliance report names the actually applied blocks.
  expect(output.styleComplianceReport.appliedBlocks).toEqual(
    expect.arrayContaining(['titleFormula', 'introFormula', 'bodyFormula', 'toneAndMannerFormula', 'ctaFormula', 'footerFormula', 'medicalSafetyFormula'])
  );
  expect(output.safetyCheck.requiredDisclosures).toEqual(formula.medicalSafetyFormula.requiredDisclosures);
});

it('draft generation still works for a legacy v2.0 stored formula', () => {
  const { formulaSet } = extractBlogFormulaV2(repos, storeId);
  // Simulate a legacy stored row by overwriting the formula JSON.
  repos.v2BlogFormulaSets.update(formulaSet.id, {
    formula: legacyFormulaFixtureAsJson // import/copy the legacy fixture from blogFormulaV2Schema.test.ts
  });
  const { topicBrief, retrievalRun } = retrieveBlogFormulaV2Samples(repos, storeId, { formulaSetId: formulaSet.id });
  const { output } = generateBlogFormulaV2Draft(repos, storeId, {
    formulaSetId: formulaSet.id,
    topicBriefId: topicBrief.id,
    retrievalRunId: retrievalRun.id
  });
  expect(output.selectedTitle.length).toBeGreaterThan(0);
  expect(output.blogDraft.length).toBeGreaterThan(0);
});
```

Note: if `v2BlogFormulaSets` has no `update` method, instead create the legacy
row directly with `repos.v2BlogFormulaSets.create({...})` copying the fields
from the extracted set and substituting the legacy formula JSON.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd poc-server && npm test -- --run test/blogFormulaV2Services.test.ts`
Expected: FAIL — draft does not include preferred phrases/soft CTA patterns.

- [ ] **Step 3: Implement formula consumption**

In `blogFormulaV2Service.ts`:

1. Add a deterministic slot filler near `buildDraftOutput`:

```ts
const SLOT_FILL_MAP: Record<string, (brief: BlogTopicBriefInput) => string> = {
  '시술명': (brief) => brief.topic,
  '주제': (brief) => brief.topic,
  '메인키워드': (brief) => brief.mainKeyword
};

function fillTitleSlots(pattern: string, brief: BlogTopicBriefInput) {
  return pattern
    .replace(/\{([^}]+)\}/gu, (_, rawSlot: string) => {
      const slot = rawSlot.split('/')[0].trim();
      const fill = SLOT_FILL_MAP[slot];
      if (fill) return fill(brief);
      if (rawSlot.includes('부작용') || rawSlot.includes('실패')) return brief.coreConcern ?? '부작용 걱정';
      return brief.mainKeyword;
    })
    .replace(/\s{2,}/gu, ' ')
    .trim();
}
```

2. Change `buildDraftOutput` signature to
   `buildDraftOutput(formulaSetId: string, formula: BlogFormulaSetV2, topicBrief: BlogTopicBriefInput, samples: BlogRetrievedSampleV2[])`
   and inside it:
   - `titleCandidates`: slot-filled `formula.titleFormula` patterns first,
     then keep the existing two deterministic fallback candidates; dedupe.
   - `selectedTitle`: first candidate containing `topicBrief.mainKeyword` or
     `topicBrief.topic`; fall back to the existing
     `` `${topicBrief.mainKeyword} 걱정 없이 확인할 점` ``.
   - Insert `formula.toneAndMannerFormula.preferredPhrases[0]` (when present)
     into the second paragraph, e.g.
     `` `${preferredPhrase ? preferredPhrase + ' ' : ''}오늘은 ${angle}하는 방향으로 ...` ``.
   - Replace the final CTA paragraph with
     `formula.ctaFormula.softPatterns[0] ?? existing cta sentence`, keeping the
     existing `${cta}` sentence as the preceding sentence.
   - Build `disclosureLine` so it contains every entry of
     `formula.medicalSafetyFormula.requiredDisclosures` (keep the current
     sentence — it already contains 개인차/부작용 가능성/의료진 상담 — and
     append any missing disclosure terms).
   - `styleComplianceReport.appliedBlocks`: list the blocks actually applied:
     `['titleFormula', 'introFormula', 'bodyFormula', 'toneAndMannerFormula', 'ctaFormula', 'footerFormula', 'medicalSafetyFormula']`.
   - `safetyCheck.requiredDisclosures`: `formula.medicalSafetyFormula.requiredDisclosures`.
3. In `generateBlogFormulaV2Draft`, load the formula before building output:

```ts
const formula = parseStoredBlogFormulaV2(formulaSet.formula);
const output = buildDraftOutput(formulaSet.id, formula, topicBriefInput, samples);
```

Add `parseStoredBlogFormulaV2` to the `./types.js` import.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd poc-server && npm test -- --run test/blogFormulaV2Services.test.ts test/blogFormulaV2Api.test.ts`
Expected: PASS (the validator already checks the same disclosure terms, so
validation tests stay green).

- [ ] **Step 5: Commit**

```bash
git add poc-server/src/storeLearning/blogFormulaV2/blogFormulaV2Service.ts poc-server/test/blogFormulaV2Services.test.ts
git commit -m "feat: deterministic V2 draft generator consumes formula set blocks"
```

---

### Task 7: V2 tab renders v2.1 formula blocks

**Files:**
- Modify: `web/blog_formula_v2.js` (`renderFormulaCards` only)
- Test: `poc-server/test/blogFormulaV2Page.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Add to `poc-server/test/blogFormulaV2Page.test.ts` (following the file's
existing static-source assertions on the `web/blog_formula_v2.js` source text):

```ts
it('renders v2.1 formula blocks including arrays and sequences', () => {
  expect(blogFormulaScriptSource).toContain('titleFormula');
  expect(blogFormulaScriptSource).toContain('sequence');
  expect(blogFormulaScriptSource).toContain('softPatterns');
  expect(blogFormulaScriptSource).toContain('preferredPhrases');
  expect(blogFormulaScriptSource).toContain('bannedClaims');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd poc-server && npm test -- --run test/blogFormulaV2Page.test.ts`
Expected: FAIL — `renderFormulaCards` only reads `item.pattern`.

- [ ] **Step 3: Rewrite `renderFormulaCards` in `web/blog_formula_v2.js`**

Replace the body-detail line of each card with a generic detail resolver
(keep the surrounding card markup, escapeHtml usage, and labels):

```js
function formulaBlockDetail(item) {
  if (!item) return '';
  if (Array.isArray(item.sequence)) return item.sequence.join(' → ');
  if (Array.isArray(item.patterns)) return item.patterns.join(' / ');
  if (Array.isArray(item.softPatterns)) return `${item.primaryStyle || ''} · ${item.softPatterns.join(' / ')}`;
  if (Array.isArray(item.bannedClaims)) {
    return `금지: ${item.bannedClaims.join(', ')} · 필수 고지: ${(item.requiredDisclosures || []).join(', ')}`;
  }
  if (Array.isArray(item.preferredPhrases)) {
    return `${item.persona || ''} · 선호 표현: ${item.preferredPhrases.join(' / ')} · 어미: ${(item.endingStyle || []).join(', ')}`;
  }
  return item.pattern || item.description || '';
}
```

In the card loop, treat `titleFormula` specially: if `Array.isArray(item)`,
render one card per entry showing `entry.name` and `entry.pattern`. For all
blocks keep rendering the `status` badge when `item.status` exists (for
arrays, use each entry's own status).

- [ ] **Step 4: Run test and syntax checks**

```bash
cd poc-server && npm test -- --run test/blogFormulaV2Page.test.ts
cd .. && node --check web/blog_formula_v2.js
```
Expected: PASS / no syntax errors.

- [ ] **Step 5: Commit**

```bash
git add web/blog_formula_v2.js poc-server/test/blogFormulaV2Page.test.ts
git commit -m "feat: render generation-ready v2.1 formula blocks in V2 tab"
```

---

### Task 8: Round-trip compatibility test

**Files:**
- Test: `poc-server/test/blogFormulaV2RoundTrip.test.ts` (new)

- [ ] **Step 1: Write the test**

Create `poc-server/test/blogFormulaV2RoundTrip.test.ts`. Reuse the in-memory
repository + seeded owner Blog post setup pattern from the top of
`poc-server/test/blogFormulaV2Services.test.ts` (same `beforeEach` store/
collection-run/collection-item seeding — copy it, do not import test state).

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  extractBlogFormulaV2WithProvider,
  generateBlogFormulaV2Draft,
  retrieveBlogFormulaV2Samples,
  validateBlogFormulaV2Draft
} from '../src/storeLearning/blogFormulaV2/blogFormulaV2Service.js';
import { createSafeMockBlogFormulaV2Provider } from '../src/storeLearning/blogFormulaV2/providers/safeMockBlogFormulaProvider.js';
import { createOpenAIBlogFormulaV2Provider } from '../src/storeLearning/blogFormulaV2/providers/openAIBlogFormulaProvider.js';
import { generationReadyFormulaFixture } from './blogFormulaV2Schema.test.js';

// beforeEach: seed repos with a store and >= 3 owner_blog_post collection
// items PLUS one place_visitor_review collection item (copy the seeding
// helpers from blogFormulaV2Services.test.ts; the review item must use
// metadata.sourceKind = 'place_visitor_review').

const ripotTopicBrief = {
  topic: '리팟레이저',
  mainKeyword: '리팟레이저 부작용',
  secondaryKeywords: [],
  mustInclude: ['개인차', '부작용 가능성', '의료진 상담'],
  mustAvoid: []
};

async function runRoundTrip(repos: any, storeId: string, provider: any) {
  const { formulaSet } = await extractBlogFormulaV2WithProvider(repos, storeId, provider);
  expect(repos.v2BlogFormulaSets.findById(formulaSet.id)).not.toBeNull();

  const { topicBrief, retrievalRun, samples } = retrieveBlogFormulaV2Samples(repos, storeId, {
    formulaSetId: formulaSet.id,
    topicBrief: ripotTopicBrief,
    maxSamples: 3
  });
  expect(samples.length).toBeGreaterThanOrEqual(1);
  expect(samples.length).toBeLessThanOrEqual(3);
  expect(samples.every((sample: any) => sample.sourceKind === 'owner_blog_post')).toBe(true);

  const { draftGeneration, output } = generateBlogFormulaV2Draft(repos, storeId, {
    formulaSetId: formulaSet.id,
    topicBriefId: topicBrief.id,
    retrievalRunId: retrievalRun.id
  });
  expect(output.selectedTitle.length).toBeGreaterThan(0);
  expect(output.blogDraft.length).toBeGreaterThan(0);
  expect(output.styleComplianceReport).toBeDefined();
  expect(output.styleComplianceReport.formulaSetId).toBe(formulaSet.id);
  expect(output.safetyCheck).toBeDefined();

  const { validation } = validateBlogFormulaV2Draft(repos, storeId, {
    draftGenerationId: draftGeneration.id
  });
  expect(validation.status).not.toBe('failed');

  // No visitor review leaked into style examples.
  const styleExampleIds = output.styleComplianceReport.sourcePostIds;
  const reviewItemIds = repos.collectionItems
    .listByStoreId(storeId)
    .filter((item: any) => item.metadata?.sourceKind === 'place_visitor_review')
    .map((item: any) => item.id);
  expect(styleExampleIds.some((id: string) => reviewItemIds.includes(id))).toBe(false);
}

describe('Blog Formula V2 round-trip compatibility', () => {
  it('safe_mock formula set drives the existing deterministic draft path end to end', async () => {
    await runRoundTrip(repos, storeId, createSafeMockBlogFormulaV2Provider());
  });

  it('fake-openai formula set drives the existing deterministic draft path end to end', async () => {
    const fakeClient = {
      beta: { chat: { completions: { parse: async () => ({
        choices: [{ message: { parsed: generationReadyFormulaFixture } }]
      }) } } }
    };
    await runRoundTrip(repos, storeId, createOpenAIBlogFormulaV2Provider({ client: fakeClient }));
  });

  it('keeps all round-trip writes inside v2_ tables and llm audit logs', async () => {
    // Snapshot V1 tables before, assert unchanged after.
    const rulesetsBefore = JSON.stringify(repos.marketingRulesets.listByStoreId(storeId));
    await runRoundTrip(repos, storeId, createSafeMockBlogFormulaV2Provider());
    expect(JSON.stringify(repos.marketingRulesets.listByStoreId(storeId))).toBe(rulesetsBefore);
  });
});
```

Adjust repository accessor names (`collectionItems.listByStoreId`,
`marketingRulesets.listByStoreId`) to the actual repository API used in
`blogFormulaV2Services.test.ts` if they differ — assert through whatever
accessors that test file already uses. The fake-openai fixture's
`sourcePostIds` must be rewritten in `beforeEach` to the seeded collection
item IDs so they refer to real prompt sourcePostIds (build the fixture with a
helper that takes `ids: string[]`).

- [ ] **Step 2: Run the test**

Run: `cd poc-server && npm test -- --run test/blogFormulaV2RoundTrip.test.ts`
Expected: PASS (Tasks 1-6 already implemented the behavior; if this fails it
reveals a real compatibility gap — fix the gap in V2 code, not the test).

- [ ] **Step 3: Commit**

```bash
git add poc-server/test/blogFormulaV2RoundTrip.test.ts
git commit -m "test: add blog formula v2 extract-to-validation round-trip coverage"
```

---

### Task 9: Full validation, docs, and ledger update

**Files:**
- Modify: `docs/codex/LLM_CALL_STRUCTURES.md` (SL-F1 section)
- Modify: `docs/BLOG_FORMULA_V2_HANDOFF.md`
- Modify: `docs/codex/PLAN.md`, `docs/codex/HANDOFF.md`, `docs/codex/VALIDATION.md`

- [ ] **Step 1: Run the full validation set**

```bash
cd poc-server
npm test -- --run test/blogFormulaV2Schema.test.ts test/blogFormulaV2Quality.test.ts test/blogFormulaV2Prompt.test.ts test/blogFormulaV2Provider.test.ts test/blogFormulaV2Api.test.ts test/blogFormulaV2Services.test.ts test/blogFormulaV2Demo.test.ts test/blogFormulaV2Page.test.ts test/blogFormulaV2RoundTrip.test.ts test/blogFormulaV2Repositories.test.ts
npm run typecheck
STORE_LEARNING_DB_PATH=/tmp/bizp-blog-formula-v2-quality-contract.sqlite BLOG_FORMULA_V2_PROVIDER_MODE=safe_mock npm run demo:blog-formula-v2
npm test
cd ..
node --check web/blog_formula_v2.js
node --check web/ruleset_editor.js
git diff --check
```
Expected: all PASS; demo reports `providerMode = safe_mock` and a v2.1 formula
set; full suite has no new failures (3 live-provider files stay skipped).

- [ ] **Step 2: Update `docs/codex/LLM_CALL_STRUCTURES.md`**

In the SL-F1 section: bump the prompt schema version to
`blog_formula_v2_extraction_input.v2`, note the response contract is the
generation-ready `blog_formula_v2.1` `BlogFormulaSetV2Schema` (slot-based
title array, intro/body/footer sequences, tone habits, soft CTA, banned
claims vs required disclosures), and note that prompt input now carries
`productIntent`, `formulaExtractionInstructions`, and
`formulaQualityRequirements`.

- [ ] **Step 3: Update `docs/BLOG_FORMULA_V2_HANDOFF.md`**

Add a `## Formula Quality Contract` section recording: the Product Intent
text (from this plan's header section), the v2.1 block structure, the quality
evaluator and where issues are stored (`v2_blog_formula_runs.validation
.qualityIssues`), the draft generator now consuming formula blocks, the
legacy v2.0 upgrade path, and the round-trip test file name.

- [ ] **Step 4: Update ledger and handoff/validation docs**

- `docs/codex/PLAN.md`: set milestone 13f state to `Implementation PR open`
  (and later `Merged to develop` / `Validated on develop` as it moves).
- `docs/codex/HANDOFF.md`: add a top section `## TASK 13F BLOG FORMULA V2
  FORMULA QUALITY CONTRACT` following the format of the 13E section (branch,
  implemented list, validation commands, results, boundary notes).
- `docs/codex/VALIDATION.md`: add a top section `## Blog Formula V2 Formula
  Quality Contract Validation` with date, branch, scope, TDD evidence
  (RED/GREEN per task), validation commands, results, boundary checks
  (`.DS_Store`/`.swp` unstaged, V2-only tables, no OpenAI draft generation,
  no Hybrid lane, no browser provider calls).

- [ ] **Step 5: Commit docs**

```bash
git add docs/codex/LLM_CALL_STRUCTURES.md docs/BLOG_FORMULA_V2_HANDOFF.md docs/codex/PLAN.md docs/codex/HANDOFF.md docs/codex/VALIDATION.md
git commit -m "docs: record blog formula v2 quality contract state"
```

---

### Task 10: PR to develop and post-merge develop validation

- [ ] **Step 1: Pre-PR boundary check**

```bash
git status --short          # .DS_Store and docs/.BLOG_FORMULA_V2_HANDOFF.md.swp must remain unstaged
git diff develop --stat     # only poc-server/src/storeLearning/blogFormulaV2/, poc-server/test/, web/blog_formula_v2.js, docs/
```
Confirm no `admin/`, `pc-web/`, `README_POC.md`, `web/event_operation_poc.html`,
V1 analyzer/ruleset, or `.env`/SQLite files are touched.

- [ ] **Step 2: Open PR targeting `develop`**

```bash
git push -u origin codex/blog-formula-v2-quality-contract
gh pr create --base develop --title "feat: blog formula v2 formula quality contract" --body "<summary + test plan from Task 9 Step 1 commands>"
```

PR summary must state: Formula Quality Contract applied to SL-F1 (product
intent, slot/sequence/tone-habit schema v2.1, quality evaluator), draft
generator now consumes the formula set, round-trip test added; no OpenAI
draft generation, no Hybrid V1+V2 lane, V2-only tables.

- [ ] **Step 3: After merge — develop validation**

```bash
git checkout develop && git pull origin develop
```
Repeat the Task 9 Step 1 command block on `develop`. Then update
`docs/codex/PLAN.md` (13f → `Validated on develop`), `docs/codex/HANDOFF.md`,
and `docs/codex/VALIDATION.md` with the develop-validation record, and commit
as `docs: record blog formula v2 quality contract develop validation` directly
on `develop` (push to `origin develop`), matching how `977b624` recorded PR
#49 validation.

- [ ] **Step 4: Completion report**

Report to the user: PR number and branch; what the contract required vs. what
was already satisfied by PR #49 and what was added (schema v2.1, prompt
intent, quality evaluator, draft consumption, round-trip test); provider modes
verified (`deterministic`, `safe_mock`, `openai` via fake client, `auto`
untouched); audit behavior unchanged (`v2_blog_formula_run` /
`blog_formula_v2_extract`); V2-only table boundary verified; confirmation that
no OpenAI draft generation and no Hybrid/combined V1+V2 generation were added;
validation commands and results. Note that live OpenAI smoke remains optional
and user-approved only.

---

## Out of Scope (do not do)

- OpenAI V2 draft generation (`generate-draft` stays deterministic).
- Hybrid or combined V1+V2 generation.
- Naver calls or browser-side provider calls.
- V1 analyzer prompt, `marketing_rulesets`, `ruleset_fields` changes.
- `develop` → `main` promotion (separate, user-approved milestone 14).
- Rewriting V2 retrieval/draft/validation beyond the adapters above.
