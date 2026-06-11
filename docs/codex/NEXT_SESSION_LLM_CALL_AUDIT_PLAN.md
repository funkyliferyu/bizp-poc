# LLM Call Audit And Analysis Budget Plan

> **For agentic workers:** Start or continue this plan only after confirming
> the current branch and latest LLM-audit PR status. Use `docs/codex/PLAN.md` as the ledger source of
> truth. Do not stage `.DS_Store`.

**Goal:** Make every Store Learning "AI/LLM" behavior auditable, prove which
paths actually call OpenAI, and keep analysis/blog/SEO prompt inputs within
safe server-side budgets.

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
gh pr view 43 --json number,state,mergedAt,mergeCommit,baseRefName,headRefName,url,mergeStateStatus
gh pr list --base develop --state open
```

Expected repository context:

- Worktree root:
  `/Users/1004182/Documents/bizplanet-work/bizp-store-learning-poc`
- Latest validated LLM-audit baseline:
  PR #43 from `codex/blog-seo-budget-tuning` to `develop`, squash merge
  commit `3c8bbb9676008863d0f0dfa1887b93b69e14b28c`.
- Current branch for new follow-up work:
  create a fresh `codex/*` branch from latest `develop`.
- Expected develop PR state:
  no open PR targeting `develop` before starting a new follow-up, unless the
  user explicitly chooses stacked work.
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

## Request Change: Blog/SEO Prompt Budget Status

Implementation status:

- Done: `SL-B1`, `SL-B2`, and `SL-S1` now use
  `poc-server/src/storeLearning/blog/blogPromptBudget.ts`.
- Done: Blog/SEO OpenAI prompts compact `store.metadata`, `ruleset.ruleset`,
  current article JSON, and media asset metadata before serialization.
- Done: content generation prompt metadata, content detail provenance, and SEO
  provenance expose `inputBudget` with provider/model/action metadata.
- Done: Blog/SEO context-length provider errors are sanitized to a Korean
  product message instead of exposing raw token-count errors.
- Done: oversized Blog/SEO prompts now run through a progressive fit loop that
  reduces media asset count, article section/body length, and ruleset field
  value length to stay under the configured prompt character budget where
  possible.
- Done: post-PR #43 audit tightened SL-B1 response symmetry so blog generation
  responses expose `contentProvenance` and `seoScore.provenance`, matching
  content detail and SEO rescore responses.
- Done: content detail provenance UI now renders provider, model, action, and
  prompt input character budget for Blog/SEO outputs.

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
- Current development prompt item caps:
  - Blog post: newest/date-ordered maximum 3 items
  - Place review: newest/date-ordered maximum 10 items
- Add aggregate guard:
  - If prompt JSON exceeds a conservative character budget, reduce selected
    Blog items by newest/date order and keep profile/review evidence first.
  - Persist or return `omittedItemCount`, Blog/review limit/counts, and
    `promptBudgetReason`.

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
message rather than a raw API/contract error.

Implementation requirements:

- Detect OpenAI context-length errors by message pattern.
- Detect SL-A1 ruleset field contract failures after structured parsing.
- Store a sanitized error shape:
  - `errorType: "analysis_context_too_large"`
  - `errorType: "analysis_contract_invalid"` with `contractIssue` for
    missing/duplicate/unknown/source contract issues
  - original provider name/mode/model
  - selected item count
  - prompt budget summary if available
- Do not store or return raw fieldKey lists such as missing ruleset field names
  in `analysis_runs.error`.
- Browser message:
  - `선택한 콘텐츠가 많아 분석 입력 한도를 초과했습니다. 일부 콘텐츠를 제외하거나 다시 수집 후 실행해주세요.`
  - `AI 분석 결과 형식이 맞지 않아 저장하지 못했습니다. 다시 실행해주세요.`
- Do not leak API keys or raw provider payloads.

Implementation status:

- Done: SL-A1 context-length failures are stored as
  `analysis_context_too_large` with a product-safe Korean message.
- Done: SL-A1 ruleset field contract failures are stored as
  `analysis_contract_invalid` with safe `contractIssue` metadata; raw
  missing/duplicate/unknown field-key lists are not stored or returned.
- Done: SL-A1 OpenAI response format now uses `rulesetFieldsByKey` instead of
  a loose array, and evidence references are constrained to `promptItemIds`
  from the budgeted prompt payload.
- Done: regression coverage now inspects the actual OpenAI `response_format`
  payload sent by SL-A1, including strict `rulesetFieldsByKey`, all required
  ruleset keys, and evidence ID enums derived from `promptItemIds`.
- Done: failed SL-A1 start responses now return current-run diagnostics
  (`analysisRunId`, failed `analysisRun`, and safe `analysisFailure` metadata),
  and the content-selection UI includes that current run ID in the visible
  failure message so stale failed runs are easier to distinguish.
- Done: in-app Browser smoke used the real `content_selection.js` with a local
  failure harness and confirmed the visible inline failure message includes
  the current `analysisRunId`.
- Done: localhost live smoke completed first learning for
  `store_36372611` (`남대문명동정형외과의원`) with 38/38 OpenAI ruleset
  fields; overlay step 2 took about 138 seconds.
- Done: localhost smoke for `store_1020864025` (`테라스의원`) confirmed the
  profile-only rerun reuses/backfills the latest learning artifacts instead of
  calling the analyzer.

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

Implementation status:

- Done: `web/llm호출.html` reflects the post-PR #43 Blog/SEO provenance
  response shape, SL-A1 3 Blog / 10 review development prompt caps, and
  sanitized context/contract failure handling.

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

For the current follow-up branch:

1. Commit only relevant files from `codex/llm-call-audit-post43`.
2. Do not stage `.DS_Store`.
3. Push the branch and open a draft PR targeting `develop`.
4. Use the PR summary/test plan from `docs/codex/HANDOFF.md`.
5. Ask an authorized reviewer/admin to satisfy the `develop` base branch
   policy and merge.
6. After merge, switch to `develop`, pull latest, run validation, and record it
   in `docs/codex/VALIDATION.md` and `docs/codex/HANDOFF.md`.
