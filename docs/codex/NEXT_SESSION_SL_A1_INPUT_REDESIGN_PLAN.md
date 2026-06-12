# SL-A1 LLM Input Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:executing-plans and superpowers:test-driven-development to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking. Start from latest `develop` and do not stage `.DS_Store`.

**Goal:** Redesign the Store Learning SL-A1 analysis prompt input so OpenAI
receives canonical store facts, full-enough Blog evidence, and only fields
that can be supported by available input data.

**Architecture:** Keep every OpenAI call server-side in `poc-server`. Change
only the SL-A1 analysis path: prompt-budget builder, OpenAI response schema,
analysis contract validation, audit-log payload, and reviewer-facing docs.
Blog/SEO calls (`SL-B1`, `SL-B2`, `SL-S1`) stay unchanged.

**Tech Stack:** Express/TypeScript in `poc-server`, Zod structured outputs,
SQLite repositories, Vitest, static docs in `docs/codex/` and
`web/llm호출.html`.

---

## Start-Of-Session Checklist

- [ ] Confirm workspace:
  `cd /Users/1004182/Documents/bizplanet-work/bizp-store-learning-poc`
- [ ] Read required context:
  `AGENTS.md`, `poc-server/AGENTS.md`,
  `docs/codex/GIT_WORKFLOW.md`, `docs/codex/PLAN.md`,
  `docs/codex/LLM_CALL_STRUCTURES.md`,
  `docs/codex/NEXT_SESSION_SL_A1_INPUT_REDESIGN_PLAN.md`.
- [ ] Confirm PR #45 is merged to `develop`:
  `gh pr view 45 --json state,mergedAt,mergeCommit,baseRefName,headRefName`.
- [ ] Start from latest `develop`:
  `git fetch origin --prune && git switch develop && git pull --ff-only origin develop`.
- [ ] Create or use branch:
  `git switch -c codex/sl-a1-input-redesign` if it does not already exist.
- [ ] Confirm only allowed pre-existing local dirt is `.DS_Store`:
  `git status --short --branch`.

Forbidden areas:

- `admin/`
- `pc-web/`
- `README_POC.md`
- `web/event_operation_poc.html`
- old Event-to-Operation files
- browser-side Naver/OpenAI calls
- `.DS_Store`, runtime SQLite DBs, `.env`, secrets

## Task 1: Lock The SL-A1 Prompt V2 Contract With Failing Tests

**Files:**

- Modify tests: `poc-server/test/analysisPromptBudget.test.ts`
- Later production target: `poc-server/src/storeLearning/analysis/analysisPromptBudget.ts`

- [ ] Add/adjust tests proving the prompt input has the v2 shape:
  - includes `schemaVersion: "sl_a1_blog_sop_input.v1"`
  - includes `outputSchemaRef: "store_learning_analysis.v2"`
  - includes `storeProfile`, `evidenceItemIds`, `blogPosts`, `reviews`,
    `unavailableData`, `requestedRulesetFieldKeys`, `blockedFields`,
    `industryPolicy`
  - does not include `store`, `selectedItemIds`, `promptItemIds`,
    `requiredRulesetFieldKeys`, or `requiredRulesetFields`
- [ ] Add tests proving store facts are canonicalized once under
  `storeProfile.facts`.
  Include `name`, `category`, `address`, `phone`, `businessHours`,
  `closedDays`, `parking`, and `representativeTreatmentSubjects`.
  Assert duplicated `metadata.profileFacts.businessHours` does not appear in
  prompt item metadata.
- [ ] Run:

```bash
cd poc-server
npm test -- --run test/analysisPromptBudget.test.ts
```

Expected now: FAIL because the current prompt still uses the legacy shape.

## Task 2: Implement Prompt V2 Store, Evidence, Blog, And Review Inputs

**Files:**

- Modify: `poc-server/src/storeLearning/analysis/analysisPromptBudget.ts`
- Test: `poc-server/test/analysisPromptBudget.test.ts`

- [ ] Replace the legacy `AnalysisPromptInput` shape with:
  - `task`
  - `schemaVersion`
  - `outputSchemaRef`
  - `constraints`
  - `storeProfile`
  - `evidenceItemIds`
  - `blogPosts`
  - `reviews`
  - `unavailableData`
  - `requestedRulesetFieldKeys`
  - `blockedFields`
  - `industryPolicy`
- [ ] Keep `analysis_runs.result.selectedItemIds` behavior untouched. Only the
  LLM prompt should drop `selectedItemIds`/`promptItemIds` and use
  `evidenceItemIds`.
- [ ] For Blog posts:
  - keep the existing maximum 3 Blog items
  - remove the fixed 1,200-character per-blog cap
  - fit Blog body text against the aggregate body budget
  - write `content.bodyTextFull`
  - write `content.charCount`, `content.includedCharCount`,
    `content.isTruncated`, `content.bodyCompleteness`,
    `content.truncationReason`, and `content.contentHash`
  - preserve original `bodyAvailability` separately from prompt-level
    completeness
- [ ] For reviews:
  - keep the existing maximum 10 Place reviews
  - include only collected reviews with usable `bodyText`
  - if no usable review text exists, mark `unavailableData.reviews = true`
- [ ] Add computed Blog helpers:
  - `hasHashtags`
  - `questionSentenceCount`
  - `ctaCandidates`
- [ ] Add medical policy context when category/name includes healthcare
  signals such as `병원`, `의원`, `클리닉`, `정형외과`, `피부과`, `치과`.
- [ ] Run:

```bash
cd poc-server
npm test -- --run test/analysisPromptBudget.test.ts
```

Expected after implementation: PASS.

## Task 3: Block Unsupported Ruleset Fields From The OpenAI Request

**Files:**

- Modify: `poc-server/src/storeLearning/analysis/analysisPromptBudget.ts`
- Modify: `poc-server/src/storeLearning/rulesets/rulesetSourceMatrix.ts`
- Test: `poc-server/test/analysisPromptBudget.test.ts`

- [ ] Add a field planning helper that returns:
  - `requestedRulesetFieldKeys`
  - `blockedFields`
- [ ] Always block Instagram fields for this SL-A1 Blog SOP pass:
  - all rows with `section === "write_instagram"`
  - all rows with `section === "image_instagram"`
- [ ] Block image fields when no usable image metadata analysis exists:
  - `primaryColors`
  - `accentColors`
  - `imageDirection`
  - `imageStyle`
  - `imageAvoidStyle`
  - `blogImageFormat`
  - `blogImageStyle`
  - `blogOverlayPolicy`
- [ ] Block review fields when no usable review text exists:
  - `reviewStrength`
  - `reviewWeakness`
- [ ] Each blocked field must include:
  - `fieldKey`
  - `label`
  - `section`
  - `reason`
  - `source: "input_blocked"`
- [ ] Keep `requestedRulesetFieldKeys + blockedFields.fieldKey` equal to
  `REQUIRED_ANALYZER_RULESET_FIELD_KEYS` with no missing, duplicate, or unknown
  keys.
- [ ] Run:

```bash
cd poc-server
npm test -- --run test/analysisPromptBudget.test.ts
```

Expected: PASS.

## Task 4: Make OpenAI Response Schema Dynamic

**Files:**

- Modify: `poc-server/src/storeLearning/analysis/openAIAnalysisProvider.ts`
- Modify: `poc-server/src/storeLearning/analysis/analysisExecutionService.ts`
- Test: `poc-server/test/analysisExecutionApi.test.ts`

- [ ] Change schema creation to:
  `createOpenAIAnalyzerOutputSchema(evidenceItemIds, requestedRulesetFieldKeys)`.
- [ ] Make `rulesetFieldsByKey` require only `requestedRulesetFieldKeys`.
- [ ] Normalize OpenAI output to `rulesetFields[]` for requested fields only,
  with `source: "openai_analysis"`.
- [ ] In analysis execution, append server-created blocked fields as
  `rulesetFields[]` with:
  - `source: "input_blocked"`
  - `locked: false`
  - `confidence: null`
  - `evidenceItemIds: []`
  - a Korean `finalValue` explaining why the field was not inferred
- [ ] Update contract validation:
  - requested OpenAI fields must be present exactly once
  - blocked fields must be present exactly once as `input_blocked`
  - requested + blocked must cover all analyzer field keys
  - OpenAI mode must not accept non-`openai_analysis` source for requested
    fields
  - unknown/duplicate fields remain contract failures
- [ ] Run:

```bash
cd poc-server
npm test -- --run test/analysisExecutionApi.test.ts -t "OpenAI"
```

Expected after implementation: PASS.

## Task 5: Add Execution And Audit Tests For Prompt V2

**Files:**

- Modify: `poc-server/test/analysisExecutionApi.test.ts`

- [ ] Update the OpenAI parse payload test:
  - assert `promptInput.schemaVersion === "sl_a1_blog_sop_input.v1"`
  - assert `promptInput.outputSchemaRef === "store_learning_analysis.v2"`
  - assert `promptInput.evidenceItemIds` replaces `promptItemIds`
  - assert `promptInput.blockedFields` contains unavailable review/image/Instagram
    fields
  - assert blocked field keys do not appear in `response_format` required keys
- [ ] Assert persisted ruleset fields include both:
  - requested fields from OpenAI with `source: "openai_analysis"`
  - blocked fields from server with `source: "input_blocked"`
- [ ] Assert `llm_audit_logs.promptInputJson` stores the v2 shape and excludes:
  - raw provider payloads
  - API keys
  - raw HTML snapshots
  - large image URL arrays
- [ ] Run:

```bash
cd poc-server
npm test -- --run test/analysisExecutionApi.test.ts
```

Expected: PASS.

## Task 6: Update Reviewer Documentation

**Files:**

- Modify: `docs/codex/LLM_CALL_STRUCTURES.md`
- Modify: `web/llm호출.html`
- Optional ledger update: `docs/codex/PLAN.md`

- [ ] Update the SL-A1 user prompt section to describe prompt v2:
  `storeProfile`, `evidenceItemIds`, `blogPosts`, `reviews`,
  `unavailableData`, `requestedRulesetFieldKeys`, `blockedFields`,
  `industryPolicy`.
- [ ] Document that unsupported review/image/Instagram fields are blocked
  server-side instead of inferred by OpenAI.
- [ ] Document that `prompt_input_json` in `llm_audit_logs` stores the v2
  budgeted input and may include Blog body text after server-side budgeting.
- [ ] Keep `web/llm호출.html` as a temporary reviewer page. Do not add
  browser-side OpenAI/Naver calls.

## Validation

Run all required checks before completion:

```bash
node --check web/llm호출.html
cd poc-server && npm run typecheck
cd poc-server && npm test
git diff --check
```

If `node --check web/llm호출.html` is invalid because HTML is not JavaScript,
skip it and report that it is not applicable; do not force a JS parser over an
HTML document. If any JS files are changed, run `node --check` on each changed
JS file.

Optional browser smoke:

```bash
cd poc-server && PORT=5178 npm run dev
```

Open `http://localhost:5178/llm%ED%98%B8%EC%B6%9C.html` and verify the SL-A1
row renders the v2 prompt structure.

## Completion Checklist

- [ ] `git status --short` shows only intended files plus pre-existing
  `.DS_Store`.
- [ ] No forbidden files are changed.
- [ ] No browser-side Naver/OpenAI calls were added.
- [ ] `.DS_Store` is not staged.
- [ ] PR target is `develop`.
