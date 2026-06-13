# Blog Formula V2 Provider Comparison Plan (13g)

Date: 2026-06-13
Branch: `codex/blog-formula-v2-provider-comparison` (from validated `develop`
at `820afb9 docs: record blog formula v2 quality contract develop validation`)

## Goal

Compare `deterministic`, `safe_mock`, and live `openai` SL-F1 formula
extraction outputs on real collected owner Blog posts, evaluated with the
13f Formula Quality Contract (`evaluateBlogFormulaV2Quality`), so the user
can judge whether the v2.1 contract produces meaningfully better
generation-ready formulas on real data.

This is the user-approved follow-up after 13f
([PR #50](https://github.com/funkyliferyu/bizp-poc/pull/50), merged
`1d929d1`). The user explicitly approved one live OpenAI SL-F1 extraction
(option "1번" on 2026-06-13).

## Real data targets

Local `poc-server/data/store-learning.sqlite` owner-post counts
(`metadata.sourceKind = 'owner_blog_post'`):

- `store_1020864025` 테라스의원 (피부과): 50 posts, ~164K chars — primary
  comparison store (same domain as the v2.1 fixtures and demo).
- `store_11630728` 테라스치과의원: 150 posts, ~247K chars — optional second
  run if the user wants a second domain.

Comparison runs use a **copy** of the real DB at a `/tmp` path via
`STORE_LEARNING_DB_PATH`; the real local DB is never mutated.

## Constraints (unchanged from 13f)

- No OpenAI V2 draft generation; `generate-draft` stays deterministic.
- No Hybrid/combined V1+V2 generation.
- No Naver calls, no browser-side provider calls.
- V2 writes only to `v2_` tables; never touch `marketing_rulesets` /
  `ruleset_fields`.
- `.DS_Store` and `docs/.BLOG_FORMULA_V2_HANDOFF.md.swp` stay unstaged.
- `admin/`, `pc-web/`, `README_POC.md`, `web/event_operation_poc.html`
  untouched.
- Live OpenAI usage limited to SL-F1 extraction on the comparison store
  (one call per run; explicitly user-approved for this task).

## Tasks

### Task 0: Branch and ledger registration

- [x] Branch `codex/blog-formula-v2-provider-comparison` from `develop`.
- [ ] Add this plan doc and register 13g in `docs/codex/PLAN.md` ledger as
  `Planned`.
- [ ] Commit `docs: plan blog formula v2 provider comparison`.

### Task 1: Pure comparison report builder (TDD)

**Files:**
- Create: `poc-server/src/storeLearning/blogFormulaV2/providerComparison.ts`
- Create: `poc-server/test/blogFormulaV2ProviderComparison.test.ts`

Pure function `buildBlogFormulaV2ProviderComparison(entries)` where each
entry is `{ mode, model, formulaSetId, formula (parsed BlogFormulaSetV2),
qualityIssues }` or `{ mode, skipped: true, reason }`. Returns a report:

- per-mode: model, formulaSetId, schemaVersion, title pattern list,
  per-block `{ status, confidence }`, quality issue codes + counts
- summary: per-mode quality issue totals, blocks whose status differs across
  modes, title slot-pattern presence per mode

TDD: RED first (file missing), then GREEN. No DB, no I/O in this module.

### Task 2: Comparison runner script

**Files:**
- Create: `poc-server/src/compareBlogFormulaV2Providers.ts`
- Modify: `poc-server/package.json` (add `compare:blog-formula-v2` script)

Runner (thin shell over existing service code, no new lane):

- Opens DB from `STORE_LEARNING_DB_PATH`; store from
  `BLOG_FORMULA_V2_STORE_ID` (default `store_1020864025`).
- Requires existing owner posts; does NOT seed mock posts (unlike the demo) —
  fails fast if the store has none, to keep the comparison honest.
- Runs extraction via existing `extractBlogFormulaV2` /
  `extractBlogFormulaV2WithProvider` for modes: `deterministic`, `safe_mock`,
  and `openai` (openai only when the server-side client is available;
  otherwise recorded as skipped with reason).
- Parses each stored formula with `parseStoredBlogFormulaV2`, evaluates with
  `evaluateBlogFormulaV2Quality`, feeds Task 1 builder.
- Prints the JSON report to stdout and writes a markdown report to
  `BLOG_FORMULA_V2_COMPARISON_OUT` (default
  `/tmp/blog-formula-v2-provider-comparison.md`).

Existing service behavior (runs, audit rows, quality issues in
`v2_blog_formula_runs.validation`) is reused as-is.

### Task 3: Run comparison on real store data

```bash
cp poc-server/data/store-learning.sqlite /tmp/bizp-blog-formula-v2-comparison.sqlite
cd poc-server
STORE_LEARNING_DB_PATH=/tmp/bizp-blog-formula-v2-comparison.sqlite \
BLOG_FORMULA_V2_STORE_ID=store_1020864025 \
npm run compare:blog-formula-v2
```

- Verify: deterministic + safe_mock produce v2.1 formula sets with zero
  quality issues (shared mock builder), and the live OpenAI output parses as
  v2.1, with its `qualityIssues` recorded.
- Verify the OpenAI run wrote an `llm_audit_logs` row
  (`action = 'blog_formula_v2_extract'`) in the temp DB.
- Capture the markdown report content for the docs.

### Task 4: Docs, full validation, and PR

- Record comparison results in `docs/BLOG_FORMULA_V2_HANDOFF.md`
  (`## Provider Comparison On Real Owner Posts` section) and
  `docs/codex/VALIDATION.md`; update `docs/codex/PLAN.md` (13g state) and
  `docs/codex/HANDOFF.md` (TASK 13G section).
- Full validation: focused V2 suite + new comparison test, `npm run
  typecheck`, `npm test`, `node --check web/blog_formula_v2.js`,
  `node --check web/ruleset_editor.js`, `git diff --check`.
- PR to `develop`, then post-merge develop validation recorded on `develop`
  (matching the `820afb9` pattern).

## Out of scope

- Any change to extraction/draft/validation service behavior.
- OpenAI V2 draft generation, Hybrid V1+V2 generation.
- UI changes.
- `develop` -> `main` promotion (milestone 14, user-gated).
