# LLM Call Audit And Analysis Budget Plan

> **For agentic workers:** Start this plan only after confirming the current
> branch and PR #38 status. Use `docs/codex/PLAN.md` as the ledger source of
> truth. Do not stage `.DS_Store`.

**Goal:** Make every Store Learning "AI/LLM" behavior auditable, prove which
paths actually call OpenAI, and fix the current analysis context overflow.

**Architecture:** Keep all OpenAI calls server-side in `poc-server`. Add
observable provider/mode/model/fallback metadata to generated artifacts and API
payloads, then introduce token-budgeted analysis prompt inputs so selected
Blog/Place content cannot exceed model context limits.

**Tech Stack:** Express/TypeScript in `poc-server`, SQLite repositories, Zod
structured outputs, static HTML/CSS/JS in `web/`, local validation with
`npm run typecheck`, `npm test`, and localhost smoke checks.

---

## Start-Of-Session Checklist

Run these before editing files:

```bash
pwd
git branch --show-current
git status --short --branch
git fetch origin --prune
git log --oneline --decorate -5
gh pr view 38 --json number,state,mergedAt,mergeCommit,baseRefName,headRefName,url
gh pr list --base develop --state open
```

Expected repository context:

- Worktree root:
  `/Users/1004182/Documents/bizplanet-work/bizp-store-learning-poc`
- Current branch for the existing CR work:
  `codex/collection-delta-plan`
- Existing PR:
  #38 from `codex/collection-delta-plan` to `develop`
- Known blocker:
  PR #38 merge is blocked by the `develop` base branch policy unless an
  authorized reviewer/admin satisfies the policy.
- Keep `.DS_Store` untracked/unstaged.

Forbidden areas remain unchanged:

- `admin/`
- `pc-web/`
- `README_POC.md`
- `web/event_operation_poc.html`
- old Event-to-Operation source-of-truth files
- browser-side Naver/OpenAI calls
- secrets, `.env`, runtime SQLite DBs, `.DS_Store`

## Current Findings To Carry Forward

The temporary verification document is available at:

```text
web/llm호출.html
http://localhost:5177/llm%ED%98%B8%EC%B6%9C.html
```

Current localhost runtime reported:

```json
{
  "mode": "openai",
  "openaiConfigured": true,
  "model": "gpt-4o-mini"
}
```

Confirmed Store Learning OpenAI call paths:

- AI learning analysis:
  `poc-server/src/storeLearning/analysis/openAIAnalysisProvider.ts`
- Blog draft generation and text regeneration:
  `poc-server/src/storeLearning/blog/openAIBlogProvider.ts`
- Blog SEO rescoring:
  `poc-server/src/storeLearning/blog/openAIBlogProvider.ts`

Confirmed local/mock paths that can look like AI in the UI:

- Ruleset writing-style AI suggestions:
  `poc-server/src/storeLearning/rulesets/rulesetService.ts`
- Ruleset preview regeneration:
  `poc-server/src/storeLearning/rulesets/rulesetPreviewService.ts`
- Similar-company comparison:
  `poc-server/src/storeLearning/rulesets/rulesetBenchmarkService.ts`
- Image regeneration:
  `poc-server/src/storeLearning/blog/blogGenerator.ts`
- Review weakness backfill:
  `poc-server/src/storeLearning/rulesets/rulesetService.ts`

Current analysis context-overflow root cause:

- `compactItem()` truncates `bodyText` to 1,200 characters, but sends
  `item.metadata` in full.
- The analysis prompt also sends `store.metadata` in full.
- For `store_1020864025`, failed run
  `analysis_run_store_1020864025_1781088995017` had 40 selected Blog posts.
  The selected items contained about 129,967 body characters plus 241,575
  metadata characters before JSON prompt overhead.
- The OpenAI error was:
  `This model's maximum context length is 128000 tokens... messages resulted in 179181 tokens`.

## Request Change: Harden SL-A1 Ruleset Field Contract

User clarification on 2026-06-10:

- Among the marketing ruleset fields, direct Place/manual facts should stay
  direct and should not be re-inferred by an LLM.
- The remaining fields that require interpretation should be produced through
  the Store Learning analysis route (`SL-A1`) unless a deliberately separate
  provider route is designed.
- `SL-A1` must explicitly ask for each required ruleset field, not only provide
  a loose list of field keys.

Current implementation direction:

- Direct facts are declared in `DIRECT_SOURCE_MATRIX` in
  `poc-server/src/storeLearning/rulesets/rulesetSourceMatrix.ts`.
  Examples: `name`, `category`, `address`, `phone`, `operatingHours`,
  `closedDays`, `parking`, `representativeTreatmentSubjects`, and manual-only
  `businessNumber`.
- AI/interpreted fields are declared in `AI_SOURCE_MATRIX`, and
  `REQUIRED_ANALYZER_RULESET_FIELD_KEYS` is derived from that list. Examples:
  `storePositioning`, `keyStrengths`, `representativeMenu`,
  `targetCustomers`, `contentKeywords`, `reviewStrength`, `reviewWeakness`,
  writing-style fields, SEO/CTA fields, and image-guidance fields.
- `SL-A1` prompt input should include structured `requiredRulesetFields`
  guidance for each AI field: `fieldKey`, `label`, `section`, `valueKind`,
  `sourceTier`, `inputSources`, `expectedOutput`, and `evidenceGuidance`.
- `reviewWeakness` has a local `analysis_backfill` route for legacy/missing
  fields, but that is a fallback and should not be treated as the primary
  route for new analysis.

Implementation status:

1. Done: add the `requiredRulesetFields` prompt contract to the budgeted SL-A1
   prompt builder.
2. Done: add server-side validation after Zod parsing:
   - every `REQUIRED_ANALYZER_RULESET_FIELD_KEYS` field is present exactly once;
   - no unknown ruleset field keys are accepted from SL-A1;
   - OpenAI provider outputs use `source=openai_analysis`;
   - evidence item references continue to be validated against selected items.
3. Done: update `docs/codex/LLM_CALL_STRUCTURES.md` and `web/llm호출.html` to
   document that SL-A1 is the primary route for AI-derived ruleset fields and
   that direct Place facts remain direct.

## Task 1: Add LLM Call Trace Contract

**Files:**

- Modify: `poc-server/src/storeLearning/analysis/openAIAnalysisProvider.ts`
- Modify: `poc-server/src/storeLearning/blog/openAIBlogProvider.ts`
- Modify: `poc-server/src/storeLearning/analysis/analysisExecutionService.ts`
- Modify: `poc-server/src/storeLearning/blog/blogGenerator.ts`
- Modify: repository payload tests under `poc-server/test/`

**Purpose:** Every generated artifact should show whether it came from OpenAI,
mock, deterministic local logic, or placeholder logic.

Implementation requirements:

- For analysis runs, persist:
  - `analyzerProvider`
  - `analyzerMode`
  - `model`
  - prompt item count
  - approximate prompt character count
  - fallback/reuse reason when applicable
- For content generations, persist:
  - `mode`
  - `provider`
  - `model`
  - `action`
  - whether provider SEO score was returned
- For local/mock-only features, make payloads explicit:
  - ruleset preview provider already says `mockRulesetPreviewProvider`
  - benchmark provider already says `mockRulesetBenchmarkProvider`
  - image regeneration should continue to say `mock_image_prompt_regenerator`
    and should not be described as real image generation

Suggested tests:

```bash
cd poc-server
npm test -- --run test/analysisExecutionApi.test.ts test/blogPostsApi.test.ts test/rulesetApi.test.ts
```

Assertions to add:

- Analysis result metadata includes provider/mode/model when OpenAI provider is
  injected in tests.
- Blog content generation prompt metadata includes provider/mode/model/action.
- Mock/local routes expose provider/mode names that cannot be confused with
  live LLM output.

## Task 2: Token-Budget Analysis Input

**Files:**

- Create: `poc-server/src/storeLearning/analysis/analysisPromptBudget.ts`
- Modify: `poc-server/src/storeLearning/analysis/openAIAnalysisProvider.ts`
- Test: `poc-server/test/analysisPromptBudget.test.ts`

**Purpose:** Prevent analysis from sending all selected metadata/body content
to OpenAI in one oversized prompt.

Implementation requirements:

- Replace direct `metadata: item.metadata` in `compactItem()` with an
  allowlisted metadata summary.
- Keep only fields useful for analysis:
  - `publishedAt`, `reviewDate`, `rating`, `reviewerName`
  - `bodyAvailability`, `sourceKind`, `sourceOwnership`
  - `blogId`, `logNo`, `tags`
  - Place profile facts such as category, address, phone, business hours,
    parking, intro, treatment subjects
- Exclude large fields:
  - image URL arrays
  - raw rendered HTML
  - nested GraphQL/store snapshots
  - full provider payloads
  - duplicate body copies
- Add per-item body budgets:
  - Blog post: first 1,200 characters until aggregate budget is reached
  - Place review: first 500 characters
  - Place profile: normalized facts only
- Add aggregate guard:
  - If prompt JSON exceeds a conservative character budget, reduce selected
    Blog items by newest/date order and keep profile/review evidence first.
  - Persist or return `omittedItemCount` and `promptBudgetReason`.

Suggested tests:

```bash
cd poc-server
npm test -- --run test/analysisPromptBudget.test.ts test/analysisExecutionApi.test.ts
```

Assertions to add:

- Large `metadata.imageUrls` arrays are excluded.
- Large nested metadata is excluded.
- Selected profile facts survive compaction.
- The generated prompt input stays under the configured budget.
- Omitted items are counted and surfaced in provider metadata.

## Task 3: UI And API Visibility For LLM Provenance

**Files:**

- Modify: `web/05_AI학습_콘텐츠선택.html`
- Modify: `web/content_selection.js`
- Modify: `web/06_AI학습_현황.html`
- Modify: `web/learning_status.js`
- Modify: `web/07_마케팅전략룰셋.html`
- Modify: `web/ruleset_editor.js`
- Test: page tests under `poc-server/test/`

**Purpose:** A reviewer should be able to tell whether the current screen is
showing live OpenAI output, reused previous learning, local deterministic
logic, or common example/mock content.

Implementation requirements:

- Analysis overlay:
  - Show provider/mode/model after the analysis run starts.
  - If prompt budget omitted items, show a neutral note such as
    `분석 입력 예산에 맞춰 일부 본문은 요약/제외되었습니다.`
- Ruleset editor:
  - Keep `(공통예시)` red labels for common examples.
  - Do not label local static suggestions as if they are newly generated by
    OpenAI.
  - For `writingStyleInsights`, expose text like `서버 산출 제안` or
    `분석 결과 기반 제안` depending on final product copy choice.
- Blog detail:
  - Show generation provider/mode for the current article and SEO score in a
    compact debug/provenance line only if the existing UI has a safe place for
    it.

Suggested tests:

```bash
cd poc-server
npm test -- --run test/selectionPage.test.ts test/learningStatusPage.test.ts test/rulesetPage.test.ts test/blogPostPage.test.ts
```

If a listed page test file does not exist, add the smallest focused test in
the nearest existing static-page test file.

## Task 4: Live Failure Handling For Context Overflow

**Files:**

- Modify: `poc-server/src/storeLearning/analysis/analysisExecutionService.ts`
- Modify: `web/content_selection.js`
- Test: `poc-server/test/analysisExecutionApi.test.ts`

**Purpose:** If OpenAI still rejects a prompt, the UI should show a product
message rather than a raw API error.

Implementation requirements:

- Detect OpenAI context-length errors by message pattern.
- Store a sanitized error shape:
  - `errorType: "analysis_context_too_large"`
  - original provider name/mode/model
  - selected item count
  - prompt budget summary if available
- Browser message:
  - `선택한 콘텐츠가 많아 분석 입력 한도를 초과했습니다. 일부 콘텐츠를 제외하거나 다시 수집 후 실행해주세요.`
- Do not leak API keys or raw provider payloads.

Suggested tests:

```bash
cd poc-server
npm test -- --run test/analysisExecutionApi.test.ts test/selectionPage.test.ts
```

## Task 5: Refresh The Temporary LLM Audit Page

**Files:**

- Modify: `web/llm호출.html`

**Purpose:** Keep the temporary reviewer document aligned after provenance and
budget changes.

Implementation requirements:

- Update rows for analysis, blog generation, SEO, image regeneration, ruleset
  suggestions, and benchmark examples.
- Add a short section describing the new prompt-budget rules.
- Add a short section showing how to verify live mode:

```bash
curl -s http://localhost:5177/api/runtime
curl -s http://localhost:5177/api/store-learning/provider-readiness
```

## Validation Commands

Run at minimum on the feature branch:

```bash
cd poc-server
npm run typecheck
npm test
npm run demo:store-learning
```

Run static/browser checks relevant to touched files:

```bash
node --check web/content_selection.js
node --check web/learning_status.js
node --check web/ruleset_editor.js
git diff --check
```

If the dev server is already running on 5177, smoke check:

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
  "http://localhost:5177/llm%ED%98%B8%EC%B6%9C.html"
curl -s http://localhost:5177/api/runtime
curl -s http://localhost:5177/api/store-learning/provider-readiness
```

Manual browser smoke:

- Open `http://localhost:5177/05_AI학습_콘텐츠선택.html?storeId=store_1020864025&runId=collection_run_store_1020864025_1781088116794`.
- Start analysis with many selected Blog items.
- Confirm the run no longer fails from context overflow.
- Confirm provenance/provider messaging is visible enough to verify the call
  path.

## PR And Merge Handoff

If this work continues on PR #38:

1. Commit only relevant files. Do not stage `.DS_Store`.
2. Push `codex/collection-delta-plan`.
3. Update PR #38 summary/test plan if new runtime behavior changes.
4. Ask an authorized reviewer/admin to satisfy the `develop` base branch
   policy and merge.
5. After merge, switch to `develop`, pull latest, run validation, and record it
   in `docs/codex/VALIDATION.md` and `docs/codex/HANDOFF.md`.

If PR #38 is already merged before the next session:

1. Switch to `develop`.
2. Pull latest.
3. Create a new branch from latest `develop`:

```bash
git switch develop
git pull --ff-only origin develop
git switch -c codex/llm-call-audit-budget
```

4. Implement this plan there.
