# Blog SOP Ruleset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt the Blog SOP consulting recommendations to the current Store Learning PoC without breaking the existing SL-A1/SL-B1/SL-B2/SL-S1 call split.

**Architecture:** Keep browser pages calling `poc-server` APIs only. Keep SL-A1 as the ruleset/SOP analysis call, SL-B1/SL-B2 as Blog draft generation calls, and SL-S1 as SEO scoring; do not add browser-side Naver/OpenAI calls. Add deterministic server preprocessing before SL-A1, promote only the Blog-generation-critical SOP fields into ruleset fields, and treat the current ruleset preview endpoint as a mock/local preview until a later approved LLM preview provider task.

**Tech Stack:** Static HTML/CSS/JS in `web/`, Express/TypeScript in `poc-server`, SQLite repositories, Zod validation, Vitest tests, local mock mode.

---

## Execution Status

Status as of 2026-06-12 on branch `codex/blog-sop-ruleset-contract`:

- Implemented deterministic Blog SOP metrics and SL-A1 prompt input
  `schemaVersion = "sl_a1_blog_sop_input.v2"`.
- Added first-class Blog SOP ruleset fields:
  `keywordMap`, `titlePatterns`, `introPattern`, `bodyOutlinePattern`,
  `headingPattern`, and `seoPlacementPolicy`.
- Added `sourceStatus` API serialization without a DB migration.
- Updated the marketing ruleset writing UI with the new SOP rows, `브랜드 표현
  후보`, and `기호/이모지 정책`.
- Fed the new SOP fields into SL-B1/SL-B2 prompt inputs and the deterministic
  mock Blog generator.
- Kept ruleset preview deterministic/local and did not add browser-side
  Naver/OpenAI calls.
- Local validation passed: focused SOP tests, `npm run typecheck`, full
  `npm test` (`40 passed | 3 skipped`, `269 passed | 6 skipped`),
  `node --check web/ruleset_editor.js`, `node --check web/learning_status.js`,
  `git diff --check`, and a Playwright smoke on
  `07_마케팅전략룰셋.html?storeId=store_demo_cake` using a temporary SQLite DB.

Next step: review the branch, open/merge a PR to `develop`, then run the
develop integration validation.

---

## Consulting Review Against Current Structure

The consulting direction is correct, but it needs to be narrowed for the current PoC.

- Already implemented:
  - SL-A1 analysis is server-side and audited in `llm_audit_logs`.
  - Browser pages call `poc-server` APIs only.
  - Blog sources are capped to 3 and Place review sources to 10 in `analysisPromptBudget.ts`.
  - Reviews are blocked when usable review text is unavailable.
  - Image/Instagram fields are blocked or example-only where real provider data is absent.
  - Blog generation and SEO scoring already run as separate Store Learning LLM paths when OpenAI is configured.
- Current gaps:
  - Blog SOP fields such as title patterns, intro pattern, body outline, heading pattern, keyword placement, and topic-to-keyword mapping are not first-class ruleset fields.
  - `blogPreferredLength`, hashtag usage, emoji/symbol usage, paragraph counts, and heading counts are currently treated too much like AI-inferred text instead of deterministic metrics.
  - Blog generation receives generic ruleset fields, but not a structured Blog SOP contract.
  - The writing-style preview endpoint is currently deterministic mock output; it is not an OpenAI call and should not be silently converted inside this first pass.
  - SEO wording must avoid implying Naver top-ranking guarantees. It should be framed as quality/search-intent guidance.

## Scope

In scope:

- Add server-computed Blog style metrics from collected Blog bodies.
- Add Core Blog SOP ruleset fields:
  - `keywordMap`
  - `titlePatterns`
  - `introPattern`
  - `bodyOutlinePattern`
  - `headingPattern`
  - `seoPlacementPolicy`
- Reframe existing fields:
  - `catchphrase` visible label becomes "브랜드 표현 후보" while preserving the field key for compatibility.
  - `blogPreferredLength` becomes server-computed length policy.
  - `blogEmojiPolicy` becomes a compact symbol/emoji policy.
- Expose source status in ruleset API serialization using existing field/source data:
  - `direct_fact`
  - `inferred_from_pattern`
  - `computed`
  - `default_policy`
  - `insufficient_evidence`
- Feed the new SOP fields into Blog draft generation prompts and the mock generator.
- Update reviewer docs and tests.

Out of scope for this pass:

- Direct browser calls to Naver, OpenAI, scraping providers, or SEO tools.
- Real Naver ranking claims or "상위노출 보장" copy.
- Real image analysis or Instagram provider activation.
- OpenAI-powered ruleset preview generation.
- DB schema migration unless tests prove existing `ruleset_fields` string columns are insufficient.
- `admin/`, `pc-web/`, `README_POC.md`, `web/event_operation_poc.html`, and old Event-to-Operation files.

## File Map

- Modify: `docs/codex/PLAN.md`
  - Mark the pushed SL-A1 redesign work as integrated, then add this Blog SOP ruleset task as the next planned todo if the user approves execution.
- Modify: `docs/codex/LLM_CALL_STRUCTURES.md`
  - Document the SL-A1 prompt shape update and clarify that ruleset preview is still not an OpenAI path.
- Create: `poc-server/src/storeLearning/analysis/blogSopMetrics.ts`
  - Compute deterministic Blog body metrics and aggregates before LLM analysis.
- Modify: `poc-server/src/storeLearning/analysis/analysisPromptBudget.ts`
  - Add `blogPosts[].content.blocks`, `blogPosts[].content.styleMetrics`, and `computedAggregates`.
- Modify: `poc-server/src/storeLearning/rulesets/rulesetSourceMatrix.ts`
  - Add Core Blog SOP field rows and adjust source tiers for computed fields.
- Modify: `poc-server/src/storeLearning/analysis/analyzer.ts`
  - Extend mock analyzer output for new LLM-generated SOP fields.
- Modify: `poc-server/src/storeLearning/analysis/openAIAnalysisProvider.ts`
  - Ensure `rulesetFieldsByKey` strict schema includes only requested LLM fields.
- Modify: `poc-server/src/storeLearning/analysis/analysisExecutionService.ts`
  - Append server-computed ruleset fields after analyzer output where appropriate.
- Modify: `poc-server/src/storeLearning/rulesets/rulesetService.ts`
  - Serialize `sourceStatus` and include new fields in writing-style insights.
- Modify: `poc-server/src/storeLearning/blog/blogPromptBudget.ts`
  - Allowlist the new Blog SOP fields into SL-B1/SL-B2 prompts.
- Modify: `poc-server/src/storeLearning/blog/blogGenerator.ts`
  - Make mock generation consume the SOP fields.
- Modify: `web/07_마케팅전략룰셋.html`
  - Add compact Blog SOP rows in the writing tab using existing row layout.
- Modify: `web/ruleset_editor.js`
  - Hydrate/edit/reset the new fields using existing ruleset APIs.
- Tests:
  - `poc-server/test/analysisPromptBudget.test.ts`
  - `poc-server/test/analysisExecutionApi.test.ts`
  - `poc-server/test/rulesetApi.test.ts`
  - `poc-server/test/rulesetPage.test.ts`
  - `poc-server/test/blogGenerationApi.test.ts`
  - Add `poc-server/test/blogSopMetrics.test.ts`

## Task 0: Branch And Ledger Prep

**Files:**
- Modify: `docs/codex/PLAN.md`

- [ ] Confirm repository state.

Run:

```bash
pwd
git branch --show-current
git status --short --branch
git log --oneline --decorate -3
```

Expected:

```text
/Users/1004182/Documents/bizplanet-work/bizp-store-learning-poc
develop
## develop...origin/develop
 M .DS_Store
84f1684 (HEAD -> develop, origin/develop) feat: redesign SL-A1 ruleset evidence flow
```

- [ ] Create the implementation branch from `develop`.

Run:

```bash
git switch -c codex/blog-sop-ruleset-contract
```

- [ ] Update `docs/codex/PLAN.md` so the current next todo is this Blog SOP ruleset contract, not the already-pushed SL-A1 input redesign.

Implementation note:

```text
13b SL-A1 LLM 입력 구조 재설계 -> Validated on develop / commit 84f1684
13c Blog SOP 룰셋 계약 적용 -> Planned / this plan
```

- [ ] Run:

```bash
git diff --check
```

Expected: no whitespace errors. `.DS_Store` remains unstaged.

## Task 1: Add Deterministic Blog SOP Metrics

**Files:**
- Create: `poc-server/src/storeLearning/analysis/blogSopMetrics.ts`
- Test: `poc-server/test/blogSopMetrics.test.ts`

- [ ] Write RED tests for deterministic metrics.

Test cases:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildBlogSopMetrics,
  buildBlogSopAggregates
} from '../src/storeLearning/analysis/blogSopMetrics.js';

describe('blog SOP metrics', () => {
  it('computes body length, paragraphs, headings, hashtags, emoji, questions, and CTA candidates', () => {
    const metrics = buildBlogSopMetrics({
      title: '분당 레터링 케이크 예약 안내',
      bodyText: [
        '분당 레터링 케이크 찾고 계신가요?',
        '',
        '예약 전에는 픽업 시간과 문구를 먼저 확인해 주세요.',
        '#분당케이크 #레터링케이크 😊'
      ].join('\n')
    });

    expect(metrics.charCount).toBeGreaterThan(0);
    expect(metrics.paragraphCount).toBe(3);
    expect(metrics.hashtags).toEqual(['#분당케이크', '#레터링케이크']);
    expect(metrics.emojiCount).toBe(1);
    expect(metrics.questionSentenceCount).toBe(1);
    expect(metrics.ctaCandidates.join(' ')).toContain('예약');
  });

  it('builds aggregate length and symbol policies without LLM inference', () => {
    const aggregate = buildBlogSopAggregates([
      buildBlogSopMetrics({ title: 'A', bodyText: '첫 문단\n\n예약 문의 주세요. #분당케이크' }),
      buildBlogSopMetrics({ title: 'B', bodyText: '첫 문단\n\n둘째 문단\n\n전화 상담 가능합니다.' })
    ]);

    expect(aggregate.lengthPolicy.source).toBe('computed');
    expect(aggregate.lengthPolicy.medianCharCount).toBeGreaterThan(0);
    expect(aggregate.symbolPolicy.source).toBe('computed');
    expect(aggregate.hashtagCandidates).toContain('#분당케이크');
  });
});
```

- [ ] Run RED command.

```bash
cd poc-server
npm test -- --run test/blogSopMetrics.test.ts
```

Expected: fail because `blogSopMetrics.ts` does not exist.

- [ ] Implement `blogSopMetrics.ts`.

Required exported functions:

```ts
export function buildBlogSopMetrics(input: { title: string | null; bodyText: string | null }) { ... }
export function buildBlogSopAggregates(metrics: BlogSopMetrics[]) { ... }
```

Required behavior:

- Normalize whitespace without losing paragraph boundaries.
- Compute `charCount`, `paragraphCount`, `headingLikeLineCount`, `averageParagraphCharCount`, `hashtags`, `emojiCount`, `questionSentenceCount`, and `ctaCandidates`.
- Build aggregate `lengthPolicy`, `symbolPolicy`, `hashtagCandidates`, and `ctaCandidates`.
- Return `source: "computed"` on computed policy objects.

- [ ] Run GREEN command.

```bash
cd poc-server
npm test -- --run test/blogSopMetrics.test.ts
```

Expected: pass.

## Task 2: Extend SL-A1 Prompt Input With Precomputed Observations

**Files:**
- Modify: `poc-server/src/storeLearning/analysis/analysisPromptBudget.ts`
- Test: `poc-server/test/analysisPromptBudget.test.ts`

- [ ] Add RED expectations to existing prompt-budget tests.

Expected prompt additions:

```ts
expect(promptInput.schemaVersion).toBe('sl_a1_blog_sop_input.v2');
expect(promptInput.blogPosts[0].content.styleMetrics).toEqual(expect.objectContaining({
  charCount: expect.any(Number),
  paragraphCount: expect.any(Number),
  headingLikeLineCount: expect.any(Number),
  averageParagraphCharCount: expect.any(Number),
  hashtags: expect.any(Array),
  emojiCount: expect.any(Number),
  questionSentenceCount: expect.any(Number),
  ctaCandidates: expect.any(Array)
}));
expect(promptInput.computedAggregates).toEqual(expect.objectContaining({
  lengthPolicy: expect.objectContaining({ source: 'computed' }),
  symbolPolicy: expect.objectContaining({ source: 'computed' })
}));
```

- [ ] Run RED command.

```bash
cd poc-server
npm test -- --run test/analysisPromptBudget.test.ts -t "removes large provider metadata"
```

Expected: fail because prompt input is still `sl_a1_blog_sop_input.v1` and lacks computed aggregates.

- [ ] Update the prompt builder.

Implementation requirements:

- Import `buildBlogSopMetrics` and `buildBlogSopAggregates`.
- Add `styleMetrics` to each Blog prompt item.
- Add `computedAggregates` at the prompt root.
- Keep raw provider payloads, raw HTML, image URLs, and Place profile body text out of the prompt.
- Keep prompt budget metadata intact.

- [ ] Run GREEN command.

```bash
cd poc-server
npm test -- --run test/analysisPromptBudget.test.ts
```

Expected: pass.

## Task 3: Add Core Blog SOP Ruleset Fields

**Files:**
- Modify: `poc-server/src/storeLearning/rulesets/rulesetSourceMatrix.ts`
- Modify: `poc-server/src/storeLearning/analysis/analyzer.ts`
- Modify: `poc-server/src/storeLearning/analysis/openAIAnalysisProvider.ts`
- Modify: `poc-server/src/storeLearning/analysis/analysisExecutionService.ts`
- Test: `poc-server/test/analysisExecutionApi.test.ts`

- [ ] Add RED tests proving the strict OpenAI response schema includes the new LLM-generated fields.

Expected new LLM-generated keys:

```ts
[
  'keywordMap',
  'titlePatterns',
  'introPattern',
  'bodyOutlinePattern',
  'headingPattern',
  'seoPlacementPolicy'
]
```

Expected computed/server-created keys:

```ts
[
  'blogPreferredLength',
  'blogEmojiPolicy'
]
```

The strict `rulesetFieldsByKey` schema should require the LLM-generated keys, but computed fields may be appended server-side and should not require OpenAI generation if the implementation separates them.

- [ ] Run RED command.

```bash
cd poc-server
npm test -- --run test/analysisExecutionApi.test.ts -t "OpenAI analyzer output"
```

Expected: fail because new SOP keys are absent.

- [ ] Update `rulesetSourceMatrix.ts`.

Required rows:

```text
keywordMap: 소재-SEO-해시태그-검색의도 매핑
titlePatterns: 제목 패턴
introPattern: 도입부 패턴
bodyOutlinePattern: 본문 전개 구조
headingPattern: 소제목 패턴
seoPlacementPolicy: 키워드 배치 정책
```

Also update existing rows:

```text
catchphrase label -> 브랜드 표현 후보
blogPreferredLength sourceTier -> blog_parser, sourceStatus computed
blogEmojiPolicy label -> 기호/이모지 정책
```

- [ ] Update mock analyzer values for the new LLM-generated SOP fields.

Use conservative Korean examples, for example:

```text
titlePatterns: {지역키워드} {대표서비스} 예약 안내, {상황}에 맞는 {대표서비스} 선택 기준
introPattern: 고객 상황 제시 -> 자주 묻는 질문 -> 글에서 안내할 내용 예고
bodyOutlinePattern: 고객 상황, 선택 기준, 예약/상담 정보, 주의사항, CTA
headingPattern: 3~5개, 질문형 또는 안내형
seoPlacementPolicy: 제목/도입 300자/소제목/본문에 자연스럽게 분산, 무의미한 반복 금지
keywordMap: 지역+주제+해시태그+검색의도 묶음
```

- [ ] Update analyzer contract validation so server-computed fields do not create OpenAI contract failures.

Implementation options:

- Preferred: introduce separate key lists:
  - `ANALYZER_GENERATED_RULESET_FIELD_KEYS`
  - `SERVER_COMPUTED_RULESET_FIELD_KEYS`
  - `REQUIRED_RULESET_FIELD_KEYS`
- Acceptable for PoC: keep `REQUIRED_ANALYZER_RULESET_FIELD_KEYS` name but do not include computed-only fields in `requestedRulesetFieldKeys`; append computed fields before persistence.

- [ ] Run GREEN command.

```bash
cd poc-server
npm test -- --run test/analysisExecutionApi.test.ts -t "OpenAI analyzer output"
```

Expected: pass, and persisted ruleset fields include all new Core Blog SOP fields.

## Task 4: Persist And Serialize Source Status

**Files:**
- Modify: `poc-server/src/storeLearning/analysis/analysisExecutionService.ts`
- Modify: `poc-server/src/storeLearning/rulesets/rulesetService.ts`
- Test: `poc-server/test/rulesetApi.test.ts`

- [ ] Add RED API tests.

Expected serialized field contract:

```ts
expect(body.fields.find((field) => field.fieldKey === 'blogPreferredLength')).toEqual(
  expect.objectContaining({
    sourceStatus: 'computed',
    confidence: expect.anything()
  })
);
expect(body.fields.find((field) => field.fieldKey === 'reviewWeakness')?.sourceStatus).not.toBe('inferred_from_pattern');
```

- [ ] Run RED command.

```bash
cd poc-server
npm test -- --run test/rulesetApi.test.ts -t "sourceStatus|Blog SOP"
```

Expected: fail because `sourceStatus` is absent.

- [ ] Implement `sourceStatus` serialization without a DB migration.

Mapping:

```text
source in ["computed", "analysis_computed"] -> computed
source == "input_blocked" -> insufficient_evidence
source == "openai_analysis" -> inferred_from_pattern
source == "analysis_backfill" -> inferred_from_pattern
source == "mock_analyzer" -> inferred_from_pattern
source == "user_edited" -> preserve original derived status if possible, otherwise inferred_from_pattern
direct store facts -> direct_fact
policy defaults -> default_policy
```

- [ ] Run GREEN command.

```bash
cd poc-server
npm test -- --run test/rulesetApi.test.ts
```

Expected: pass.

## Task 5: Update Ruleset Writing UI For Core SOP Fields

**Files:**
- Modify: `web/07_마케팅전략룰셋.html`
- Modify: `web/ruleset_editor.js`
- Test: `poc-server/test/rulesetPage.test.ts`

- [ ] Add RED static/page tests.

Expected rows in the writing tab:

```text
브랜드 표현 후보
제목 패턴
도입부 패턴
본문 전개 구조
소제목 패턴
키워드 배치 정책
소재-키워드 맵
기호/이모지 정책
```

Expected absent wording:

```text
상위노출 보장
네이버 알고리즘 보장
```

- [ ] Run RED command.

```bash
cd poc-server
npm test -- --run test/rulesetPage.test.ts -t "writing-style|Blog SOP"
```

Expected: fail because the new rows are absent.

- [ ] Update the static HTML writing tab.

Use existing `.writing-style-row` structure and `data-ruleset-field` attributes. Do not redesign the full page.

- [ ] Update `ruleset_editor.js`.

Requirements:

- Hydrate new rows through existing `GET /api/stores/:storeId/strategy-ruleset`.
- Preserve save/reset behavior.
- Do not add `근거 보기` buttons to writing-style rows unless a later task changes that policy.
- Show computed/source-status language only if it already comes from API; do not hardcode provider assumptions in the browser.

- [ ] Run GREEN command.

```bash
cd poc-server
npm test -- --run test/rulesetPage.test.ts
node --check web/ruleset_editor.js
```

Expected: pass.

## Task 6: Feed Blog SOP Fields Into Blog Generation

**Files:**
- Modify: `poc-server/src/storeLearning/blog/blogPromptBudget.ts`
- Modify: `poc-server/src/storeLearning/blog/blogGenerator.ts`
- Test: `poc-server/test/blogGenerationApi.test.ts`

- [ ] Add RED tests proving SL-B1 prompt input includes the Core Blog SOP fields.

Expected:

```ts
expect(promptInput.rulesetFields.map((field) => field.fieldKey)).toEqual(
  expect.arrayContaining([
    'keywordMap',
    'titlePatterns',
    'introPattern',
    'bodyOutlinePattern',
    'headingPattern',
    'seoPlacementPolicy'
  ])
);
```

- [ ] Run RED command.

```bash
cd poc-server
npm test -- --run test/blogGenerationApi.test.ts -t "OpenAI blog provider"
```

Expected: fail because new fields are not in `BLOG_PROMPT_RULESET_FIELD_KEYS`.

- [ ] Update prompt allowlists and mock generation.

Requirements:

- Add new SOP field keys to `BLOG_PROMPT_RULESET_FIELD_KEYS`.
- Add system/user prompt constraints:
  - Follow title patterns when natural.
  - Use intro and body outline patterns.
  - Place keywords naturally; avoid meaningless repetition.
  - Do not imply Naver top-ranking guarantees.
- Update `buildDraft()` to use `titlePatterns`, `bodyOutlinePattern`, and `seoPlacementPolicy` for deterministic mock output.

- [ ] Run GREEN command.

```bash
cd poc-server
npm test -- --run test/blogGenerationApi.test.ts
```

Expected: pass.

## Task 7: Documentation And Reviewer Surfaces

**Files:**
- Modify: `docs/codex/LLM_CALL_STRUCTURES.md`
- Modify: `web/llm호출.html`
- Modify: `docs/codex/HANDOFF.md`
- Modify: `docs/codex/VALIDATION.md`

- [ ] Update SL-A1 documentation.

Document:

```text
schemaVersion: sl_a1_blog_sop_input.v2
computedAggregates
blogPosts[].content.styleMetrics
Core Blog SOP ruleset fields
server-computed sourceStatus
```

- [ ] Clarify SEO language.

Use wording equivalent to:

```text
SEO guidance follows public quality/search-intent principles and internal checks; it does not guarantee Naver ranking.
```

- [ ] Keep the preview note accurate.

Document that `POST /api/stores/:storeId/strategy-ruleset/regenerate-preview` remains deterministic mock/local output in this pass and does not create an OpenAI audit log.

- [ ] Run:

```bash
git diff --check
```

Expected: pass.

## Task 8: Final Validation

**Files:**
- No new files beyond implementation and docs.

- [ ] Run focused tests.

```bash
cd poc-server
npm test -- --run test/blogSopMetrics.test.ts
npm test -- --run test/analysisPromptBudget.test.ts
npm test -- --run test/analysisExecutionApi.test.ts -t "OpenAI analyzer output"
npm test -- --run test/rulesetApi.test.ts
npm test -- --run test/rulesetPage.test.ts
npm test -- --run test/blogGenerationApi.test.ts
```

- [ ] Run full validation.

```bash
cd poc-server
npm run typecheck
npm test
cd ..
node --check web/ruleset_editor.js
git diff --check
```

- [ ] Optional local smoke if server is needed.

```bash
cd poc-server
STORE_LEARNING_MOCK_MODE=true npm run dev
```

Open:

```text
http://localhost:5177/07_%EB%A7%88%EC%BC%80%ED%8C%85%EC%A0%84%EB%9E%B5%EB%A3%B0%EC%85%8B.html
http://localhost:5177/llm%ED%98%B8%EC%B6%9C.html
```

Expected:

- Writing tab shows the new Core Blog SOP rows.
- No browser console errors.
- Browser requests stay under `/api/*`.
- `.DS_Store` remains unstaged and uncommitted.

## Follow-Up: Separate LLM Preview Provider

The consulting note recommends a separate preview call. That is architecturally sound, but it should be a later, explicit task because current repo documentation says ruleset preview regeneration is not an OpenAI call.

Follow-up plan:

- Add a `RulesetPreviewProvider` interface.
- Keep deterministic mock preview as default in no-key mode.
- Add optional OpenAI preview provider only server-side.
- Record preview audit logs if OpenAI is used.
- Add tests proving preview does not mutate rulesets and does not run in the browser.

Do this only after the Core Blog SOP ruleset contract is validated.
