# Validation

## Blog Formula V2 OpenAI Formula Provider Validation

Date: 2026-06-12

Branch:

- `codex/blog-formula-v2-openai-formula-provider`

PR:

- [#49](https://github.com/funkyliferyu/bizp-poc/pull/49), merged to
  `develop` as `c76c052` on 2026-06-12.

Develop integration:

- Fresh develop validation passed after PR #49 merge.

Scope:

- Added SL-F1 prompt input builder for bounded owner Blog post inputs.
- Added Blog Formula V2 provider boundary with `safe_mock` and `openai`
  extraction providers.
- Added optional `providerMode` to
  `POST /api/stores/:storeId/v2/blog-formula/extract`.
- Preserved missing/`deterministic` extraction behavior.
- Added explicit `openai` behavior with no mock fallback when the server-side
  OpenAI client is unavailable.
- Added `auto` behavior: OpenAI when `OPENAI_API_KEY` is configured
  server-side, otherwise `safe_mock`.
- Validated OpenAI output with `BlogFormulaSetV2Schema` and
  `zodResponseFormat(..., "store_learning_blog_formula_v2")`.
- Recorded OpenAI extraction audit rows with
  `related_entity_type = "v2_blog_formula_run"` and
  `action = "blog_formula_v2_extract"`.
- Stored failed OpenAI extraction as `v2_blog_formula_runs.status = "failed"`
  without creating a formula set.
- Added `BLOG_FORMULA_V2_PROVIDER_MODE=safe_mock|openai|auto` support to the
  V2 demo script.

TDD evidence:

- RED `npm test -- --run test/blogFormulaV2Prompt.test.ts`: failed because
  `blogFormulaPrompt.ts` did not exist.
- GREEN same command after adding the pure prompt builder.
- RED `npm test -- --run test/blogFormulaV2Provider.test.ts`: failed because
  provider files did not exist.
- GREEN same command after adding provider contract, `safe_mock`, and OpenAI
  provider with fake-client tests.
- RED
  `npm test -- --run test/blogFormulaV2Api.test.ts test/blogFormulaV2Services.test.ts -t "providerMode|provider path|SL-F1|safe mock provider"`:
  failed because the service function did not exist and `/extract` ignored
  `providerMode`.
- GREEN same focused API/service command after adding provider factory,
  provider-backed service extraction, route body schema, and audit recording.
- RED
  `npm test -- --run test/blogFormulaV2Demo.test.ts -t "safe_mock provider extraction"`:
  failed because the demo still used deterministic extraction only.
- GREEN same command after adding `BLOG_FORMULA_V2_PROVIDER_MODE` support.

Validation commands:

```bash
cd poc-server
npm test -- --run test/blogFormulaV2Prompt.test.ts test/blogFormulaV2Provider.test.ts test/blogFormulaV2Api.test.ts test/blogFormulaV2Services.test.ts test/blogFormulaV2Demo.test.ts test/blogFormulaV2Page.test.ts
npm run typecheck
STORE_LEARNING_DB_PATH=/tmp/bizp-blog-formula-v2-openai-provider.sqlite BLOG_FORMULA_V2_PROVIDER_MODE=safe_mock npm run demo:blog-formula-v2
npm test
cd ..
node --check web/blog_formula_v2.js
node --check web/ruleset_editor.js
```

Result:

- PASS, focused V2 suite: 6 files, 25 tests.
- PASS, TypeScript typecheck.
- PASS, safe-mock temp-DB demo produced `providerMode = safe_mock`,
  `model = safe-mock-blog-formula-v2`, 3 retrieved samples, and
  `validationStatus = needs_human_review`.
- PASS, full test suite: 49 files passed, 3 live-provider files skipped by
  default; 305 tests passed, 6 skipped.
- PASS, `node --check web/blog_formula_v2.js`.
- PASS, `node --check web/ruleset_editor.js`.
- PASS, post-merge develop validation repeated the focused V2 suite,
  TypeScript typecheck, safe-mock temp-DB demo, full test suite, browser JS
  syntax checks, and `git diff --check`.

Boundary checks:

- `.DS_Store` remains an out-of-scope local modification and was not staged.
- `docs/.BLOG_FORMULA_V2_HANDOFF.md.swp` remains unstaged.
- No `admin/`, `pc-web/`, `README_POC.md`, or
  `web/event_operation_poc.html` changes.
- Browser code was not changed and still calls only `poc-server` APIs.
- No Naver calls, browser-side OpenAI/provider calls, OpenAI V2 draft
  generation, or Hybrid/combined V1+V2 generation were added.
- V2 writes remain in `v2_` tables and do not write to `marketing_rulesets` or
  `ruleset_fields`.
- Live OpenAI smoke was skipped; provider tests use injected fake OpenAI
  clients.

## Blog Formula V2 Deterministic Lane Validation

Date: 2026-06-12

Branch:

- `codex/blog-formula-v2-experiment`

Develop integration:

- PR #48 merged to `develop` as `c8f1b52` on 2026-06-12.
- Fresh develop validation passed after merge.

Scope:

- Added V2-only SQLite tables and repositories.
- Added deterministic Blog Formula V2 extraction, lexical Top 3 retrieval,
  deterministic draft generation, and validation.
- Added separate V2 API namespace:
  `/api/stores/:storeId/v2/blog-formula`.
- Added a separate Marketing Ruleset UI tab:
  `블로그 작성 포뮬라`.
- Added mock-safe demo script:
  `npm run demo:blog-formula-v2`.
- Kept Store Learning V1 ruleset fields, analyzer prompt, and V1 Blog
  generation untouched.

TDD evidence:

- RED
  `npm test -- --run test/blogFormulaV2Repositories.test.ts test/blogFormulaV2Services.test.ts test/blogFormulaV2Api.test.ts test/blogFormulaV2Page.test.ts test/blogFormulaV2Demo.test.ts`:
  failed because the V2 schema, repositories, services, route, browser script,
  and demo script did not exist.
- GREEN same focused V2 command after implementation.

Validation commands:

```bash
cd poc-server
npm test -- --run test/blogFormulaV2Repositories.test.ts test/blogFormulaV2Services.test.ts test/blogFormulaV2Api.test.ts test/blogFormulaV2Page.test.ts test/blogFormulaV2Demo.test.ts
npm run typecheck
STORE_LEARNING_DB_PATH=/tmp/bizp-blog-formula-v2-demo.sqlite npm run demo:blog-formula-v2
npm test
cd ..
node --check web/blog_formula_v2.js
node --check web/ruleset_editor.js
```

Browser smoke:

```text
http://127.0.0.1:5180/07_마케팅전략룰셋.html?storeId=store_1020864025
```

Result:

- PASS, focused V2 suite: 5 files, 12 tests.
- PASS, TypeScript typecheck.
- PASS, temp-DB V2 demo script generated `mode = v2_formula`,
  `retrievedSampleCount = 3`, and `validationStatus = needs_human_review`.
- PASS, full test suite: 47 files passed, 3 live-provider files skipped by
  default; 290 tests passed, 6 skipped.
- PASS, `node --check web/blog_formula_v2.js`.
- PASS, `node --check web/ruleset_editor.js`.
- PASS, Playwright smoke loaded the V2 tab for `store_1020864025`, confirmed
  50 owner Blog sources, extracted a generated formula set, rendered 3
  retrieved samples, generated a V2 draft, rendered validation, and found no
  console/page errors.
- PASS, post-merge develop validation repeated the focused V2 suite,
  TypeScript typecheck, temp-DB V2 demo, browser JS syntax checks, full test
  suite, `git diff --check`, and Playwright V2 tab smoke.

Boundary checks:

- `.DS_Store` remains an out-of-scope local modification and was not staged.
- No `admin/`, `pc-web/`, `README_POC.md`,
  `web/event_operation_poc.html`, or old Event-to-Operation files changed.
- Browser changes call only `poc-server` V2 APIs.
- V2 writes do not touch `marketing_rulesets` or `ruleset_fields`.
- No browser-side Naver/OpenAI/provider calls were added.

## Task 13c Blog SOP Ruleset Contract Validation

Date: 2026-06-12

Branch:

- `codex/blog-sop-ruleset-contract`

Scope:

- Added deterministic Blog SOP metrics and aggregates before SL-A1.
- Upgraded SL-A1 prompt input to `sl_a1_blog_sop_input.v2` with Blog body
  blocks, style metrics, and `computedAggregates`.
- Added first-class Blog SOP ruleset fields:
  `keywordMap`, `titlePatterns`, `introPattern`, `bodyOutlinePattern`,
  `headingPattern`, and `seoPlacementPolicy`.
- Added ruleset field `sourceStatus` serialization without a DB migration.
- Updated marketing strategy ruleset writing UI rows and labels for Blog SOP,
  `브랜드 표현 후보`, and `기호/이모지 정책`.
- Fed Blog SOP fields into Blog generation/regeneration prompt inputs and the
  deterministic mock Blog generator.
- Added Blog/SEO constraints that avoid Naver top-ranking guarantee or
  algorithmic ranking outcome claims.
- Updated LLM call structure docs, reviewer HTML, plan ledger, and handoff.

TDD evidence:

- RED `npm test -- --run test/blogSopMetrics.test.ts`: failed because
  `blogSopMetrics.ts` did not exist.
- RED `npm test -- --run test/analysisPromptBudget.test.ts`: failed because
  SL-A1 prompt input was still v1 and lacked `styleMetrics` /
  `computedAggregates`.
- RED
  `npm test -- --run test/analysisExecutionApi.test.ts -t "OpenAI analyzer output"`:
  failed because the strict analyzer schema/prompt did not include Core Blog
  SOP fields.
- RED
  `npm test -- --run test/rulesetApi.test.ts -t "sourceStatus|field source matrix"`:
  failed because serialized ruleset fields lacked `sourceStatus`.
- RED
  `npm test -- --run test/rulesetPage.test.ts -t "writing style as editable"`:
  failed because the new Blog SOP UI rows/source status labels were absent.
- RED
  `npm test -- --run test/blogGenerationApi.test.ts -t "generates an approval-pending blog post"`:
  failed because Blog generation prompt inputs and mock drafts did not use the
  new SOP fields.
- GREEN same focused commands after implementation.

Validation commands:

```bash
cd poc-server
npm test -- --run test/blogSopMetrics.test.ts
npm test -- --run test/analysisPromptBudget.test.ts
npm test -- --run test/analysisExecutionApi.test.ts -t "OpenAI analyzer output"
npm test -- --run test/rulesetApi.test.ts
npm test -- --run test/rulesetPage.test.ts
npm test -- --run test/blogGenerationApi.test.ts
npm run typecheck
npm test
cd ..
node --check web/ruleset_editor.js
node --check web/learning_status.js
git diff --check
```

Browser smoke:

```bash
cd poc-server
rm -f /tmp/bizp-blog-sop-smoke.sqlite /tmp/bizp-blog-sop-smoke.sqlite-shm /tmp/bizp-blog-sop-smoke.sqlite-wal
STORE_LEARNING_DB_PATH=/tmp/bizp-blog-sop-smoke.sqlite npm run db:seed
PORT=5188 STORE_LEARNING_DB_PATH=/tmp/bizp-blog-sop-smoke.sqlite npm run dev
```

Then Playwright opened:

```text
http://127.0.0.1:5188/07_마케팅전략룰셋.html?storeId=store_demo_cake
```

Result:

- PASS, focused SOP metrics: 2 tests.
- PASS, focused analysis prompt budget: 7 tests.
- PASS, focused OpenAI analyzer output: 1 test, 16 skipped.
- PASS, ruleset API: 22 tests.
- PASS, ruleset page: 17 tests.
- PASS, Blog generation API: 5 tests.
- PASS, TypeScript typecheck.
- PASS, full test suite: 40 files passed, 3 live-provider files skipped by
  default; 269 tests passed, 6 skipped.
- PASS, `node --check web/ruleset_editor.js`.
- PASS, `node --check web/learning_status.js`.
- PASS, `git diff --check`.
- PASS, Playwright smoke found all new SOP labels, hydrated
  `titlePatterns` and `seoPlacementPolicy`, showed `blogPreferredLength` as
  `서버 산출`, and found no console errors, page errors, `상위노출 보장`, or
  `네이버 알고리즘 보장` copy.

Boundary checks:

- `.DS_Store` remains an out-of-scope local modification and was not edited or
  staged.
- No `admin/`, `pc-web/`, `README_POC.md`, or
  `web/event_operation_poc.html` changes.
- Browser changes use existing `poc-server` APIs only; no browser-side
  Naver/OpenAI/provider calls were added.
- Ruleset preview remains deterministic/local; no OpenAI preview provider was
  added.

## Task 6 Server-Side LLM Audit Logs Validation

Date: 2026-06-11

Branch:

- `codex/llm-audit-relearn-ruleset-restore`

Scope:

- Added server-side `llm_audit_logs` SQLite persistence behind a repository.
- Recorded completed and failed Store Learning OpenAI calls for:
  - SL-A1 analysis runs;
  - SL-B1 Blog draft generation;
  - SL-B2 Blog text regeneration;
  - SL-S1 Blog SEO rescoring.
- Stored compact/budgeted prompt input, prompt budget metadata, compact
  response format metadata, parsed structured output, timing, provider/action,
  related artifact IDs, and sanitized error metadata.
- Documented local SQLite inspection in `docs/codex/LLM_CALL_STRUCTURES.md`
  and `web/llm호출.html`.

TDD evidence:

- RED `npm test -- --run test/analysisExecutionApi.test.ts -t "LLM audit"`:
  failed because `repos.llmAuditLogs` did not exist.
- RED `npm test -- --run test/blogGenerationApi.test.ts -t "LLM audit"`:
  failed because Blog generation had no audit repository/log row.
- RED `npm test -- --run test/contentDetailApi.test.ts -t "LLM audit"`:
  failed because regenerate-text and SEO rescore had no audit repository/log
  row.
- GREEN same focused commands after adding `llm_audit_logs`, OpenAI provider
  audit metadata, and service/generator-side log recording.

Validation commands:

```bash
cd poc-server
npm test -- --run test/analysisExecutionApi.test.ts -t "LLM audit"
npm test -- --run test/blogGenerationApi.test.ts -t "LLM audit"
npm test -- --run test/contentDetailApi.test.ts -t "LLM audit"
npm run typecheck
npm test -- --run test/analysisExecutionApi.test.ts
npm test -- --run test/blogGenerationApi.test.ts
npm test -- --run test/contentDetailApi.test.ts
npm test -- --run test/storeLearningRepositories.test.ts
npm test
npm run demo:store-learning
git diff --check
```

Result:

- PASS, focused LLM audit tests: analysis 6 passed, Blog generation 2 passed,
  content detail 3 passed.
- PASS, related API/repository tests.
- PASS, TypeScript typecheck.
- PASS, full test suite: 39 files passed, 3 live-provider files skipped by
  default; 241 tests passed, 6 skipped.
- PASS, demo seed completed with `blogPostStatus=pending_approval` and
  `seoScore=86`.
- PASS, `git diff --check`.

Boundary checks:

- `.DS_Store` remained an existing local out-of-scope modification and was not
  staged or edited for this task.
- No `admin/`, `pc-web/`, `README_POC.md`, or
  `web/event_operation_poc.html` changes.
- Browser pages still call only `poc-server` APIs; no browser-side Naver or
  OpenAI calls were added.
- Audit rows are server-side SQLite data only and must not expose API keys,
  raw OpenAI HTTP headers, or raw SDK response objects.

## Task 7 Evidence-Threshold Ruleset Regeneration Gate Validation

Date: 2026-06-11

Branch:

- `codex/llm-audit-relearn-ruleset-restore`

Scope:

- Existing learned stores can run full SL-A1 ruleset regeneration only when an
  explicit meaningful-change collection contains at least 3 new Blog post
  assets and 10 new Place review assets.
- Below threshold, analysis run creation completes as a skipped reuse path with
  `skippedReason: "insufficient_new_evidence_for_ruleset_regeneration"`,
  required/new evidence counts, and reused artifact IDs.
- Below-threshold reuse does not call the analyzer and does not create
  `llm_audit_logs` rows.
- Learning status API/UI exposes `relearnEligibility` and dims `지금 재학습`.
- Content selection blocks `분석 실행` for existing learned stores below
  threshold with the same guidance copy, while preserving initial learning and
  no-change reuse behavior.

TDD evidence:

- RED
  `npm test -- --run test/analysisDecision.test.ts -t "insufficient new evidence"`:
  failed because existing learned stores with 1 new Blog post and 9 new reviews
  still returned `run_analyzer/new_selected_evidence`.
- RED
  `npm test -- --run test/analysisExecutionApi.test.ts -t "insufficient new evidence"`:
  failed because the API queued an analyzer run instead of completing skipped
  reuse.
- RED
  `npm test -- --run test/learningStatusApi.test.ts test/learningStatusPage.test.ts -t "relearn"`:
  failed because `relearnEligibility` and `applyRelearnEligibility` did not
  exist.
- RED
  `npm test -- --run test/selectionPage.test.ts -t "thresholds"`:
  failed because content selection did not compute selected new evidence or
  block below threshold.
- GREEN same focused commands after implementing the decision threshold,
  skipped metadata, API eligibility payloads, and browser gating.

Validation commands:

```bash
cd poc-server
npm test -- --run test/analysisDecision.test.ts -t "insufficient new evidence"
npm test -- --run test/analysisExecutionApi.test.ts -t "insufficient new evidence"
npm test -- --run test/learningStatusApi.test.ts test/learningStatusPage.test.ts -t "relearn"
npm test -- --run test/selectionPage.test.ts -t "thresholds|no-change"
npm test -- --run test/analysisDecision.test.ts
npm test -- --run test/analysisExecutionApi.test.ts
npm test -- --run test/learningStatusApi.test.ts test/learningStatusPage.test.ts test/selectionPage.test.ts test/selectionApi.test.ts
npm run typecheck
npm test
npm run demo:store-learning
cd ..
node --check web/content_selection.js
node --check web/learning_status.js
git diff --check
```

Result:

- PASS, focused RED/GREEN regressions for analysis decision, analysis
  execution, learning status, and content selection.
- PASS, related analysis/learning/selection API and static page tests.
- PASS, TypeScript typecheck.
- PASS, full test suite: 39 files passed, 3 live-provider files skipped by
  default; 248 tests passed, 6 skipped.
- PASS, Store Learning demo seed completed with
  `blogPostStatus=pending_approval` and `seoScore=86`.
- PASS, `node --check web/content_selection.js`.
- PASS, `node --check web/learning_status.js`.
- PASS, `git diff --check`.

Boundary checks:

- `.DS_Store` remains an out-of-scope local modification and was not edited or
  staged.
- No `admin/`, `pc-web/`, `README_POC.md`, or
  `web/event_operation_poc.html` changes.
- Browser changes use existing `poc-server` APIs only; no browser-side
  Naver/OpenAI calls were added.

## Task 8 Ruleset Version History And Restore Validation

Date: 2026-06-11

Branch:

- `codex/llm-audit-relearn-ruleset-restore`

Scope:

- Added first-class marketing strategy ruleset version list, historical
  version lookup, and restore-as-new-version APIs.
- Restore copies the selected historical ruleset and fields into a new `draft`
  version, preserving user-edited and locked field values.
- Restore records `restoredFromRulesetId`, `restoredFromVersion`,
  `restoredAt`, and `restoreSource` in `marketing_rulesets.ruleset`.
- Restore does not create analysis runs or LLM audit rows.
- Marketing strategy ruleset UI exposes current version, historical lookup,
  and restore controls through `poc-server` APIs only.
- Learning status ruleset summary reads the newest marketing ruleset version
  after restore.

TDD evidence:

- RED
  `npm test -- --run test/rulesetApi.test.ts -t "ruleset version|historical ruleset|restores a historical"`:
  failed because the version endpoints did not exist and Express returned an
  HTML 404 page.
- RED
  `npm test -- --run test/rulesetPage.test.ts -t "version"`:
  failed because `ruleset-version-panel` and version action wiring did not
  exist.
- RED
  `npm test -- --run test/learningStatusApi.test.ts -t "newest marketing ruleset version"`:
  failed because learning status still reported `marketing_ruleset_demo_v1`
  after a newer restored version existed.
- GREEN same focused commands after adding version APIs, restore service, UI
  wiring, and latest-version learning status lookup.

Validation commands:

```bash
cd poc-server
npm test -- --run test/rulesetApi.test.ts -t "ruleset version|historical ruleset|restores a historical"
npm test -- --run test/rulesetPage.test.ts -t "version"
npm test -- --run test/learningStatusApi.test.ts -t "newest marketing ruleset version"
npm test -- --run test/rulesetApi.test.ts test/rulesetPage.test.ts test/learningStatusApi.test.ts
npm run typecheck
npm test
npm run demo:store-learning
cd ..
node --check web/content_selection.js
node --check web/learning_status.js
node --check web/ruleset_editor.js
git diff --check
```

Result:

- PASS, focused ruleset version API regressions: 3 passed.
- PASS, focused ruleset version page wiring regression: 1 passed.
- PASS, focused learning status latest-version regression: 1 passed.
- PASS, related ruleset/learning status suite: 43 tests passed.
- PASS, TypeScript typecheck.
- PASS, full test suite: 39 files passed, 3 live-provider files skipped by
  default; 253 tests passed, 6 skipped.
- PASS, Store Learning demo seed completed with
  `blogPostStatus=pending_approval` and `seoScore=86`.
- PASS, `node --check web/content_selection.js`.
- PASS, `node --check web/learning_status.js`.
- PASS, `node --check web/ruleset_editor.js`.
- PASS, `git diff --check`.

Boundary checks:

- `.DS_Store` remains an out-of-scope local modification and was not edited or
  staged.
- No `admin/`, `pc-web/`, `README_POC.md`, or
  `web/event_operation_poc.html` changes.
- Browser changes use existing `poc-server` APIs only; no browser-side
  Naver/OpenAI calls were added.

## POST-PR43-LLM-CALL-AUDIT Follow-up Branch Validation

Branch `codex/llm-call-audit-post43` was created from latest `develop` after
PR #43 was squash-merged.

- PR #43 merge commit:
  `3c8bbb9676008863d0f0dfa1887b93b69e14b28c`
- Validation date: 2026-06-11
- Validation worktree:
  `/Users/1004182/Documents/bizplanet-work/bizp-store-learning-poc`

Scope:

- SL-B1 Blog generation API response provenance symmetry:
  `contentProvenance` and `seoScore.provenance`.
- Content detail provenance UI display for provider, model, action, and
  prompt input character budget.
- SL-A1 analysis rerun decision handling for no-meaningful-change collection
  runs, including latest-ruleset reuse and required-field backfill.
- SL-A1 analysis prompt budgeting with development caps of 3 Blog items and
  10 Place review items.
- SL-A1 OpenAI provider response hardening with `rulesetFieldsByKey` and
  `promptItemIds` evidence ID constraints.
- SL-A1 failed-run sanitize handling for OpenAI context-length errors and
  analyzer ruleset contract errors.
- SL-A1 failed-run diagnostics that identify the current analysis run in
  `/start` API failures and content-selection UI messages.
- Temporary LLM call audit docs/table refresh for the post-PR #43
  Blog/SEO prompt-budget state.

TDD evidence:

- RED `npm test -- --run test/contentDetailPage.test.ts`: failed because
  `web/content_detail.js` did not read `provenance.action` or
  `provenance.inputBudget`.
- GREEN same command: passed after expanding the compact provenance line.
- RED
  `npm test -- --run test/blogGenerationApi.test.ts -t "OpenAI blog provider"`:
  failed because SL-B1 generation responses did not expose
  `contentProvenance`.
- GREEN same command: passed after serializing SL-B1 generation responses with
  `contentProvenance` and separated `seoScore.provenance`.
- RED `npm test -- --run test/analysisExecutionApi.test.ts`: failed while
  OpenAI analyzer ruleset contract errors stored raw field-key details such as
  missing/duplicate/unknown field names.
- GREEN full suite passed after storing
  `errorType: "analysis_contract_invalid"` with safe `contractIssue` metadata
  and returning a Korean product message.
- RED
  `npm test -- --run test/analysisExecutionApi.test.ts -t "OpenAI analyzer output"`:
  failed because the provider still returned a loose `rulesetFields[]` array
  and could not normalize the desired `rulesetFieldsByKey` response shape.
- GREEN same command after OpenAI analysis output was normalized from
  `rulesetFieldsByKey` to internal `rulesetFields[]`.
- RED
  `npm test -- --run test/analysisPromptBudget.test.ts -t "limits blog sources"`:
  failed because the prompt did not expose a dedicated `promptItemIds` list.
- GREEN same command after the prompt contract exposed budgeted prompt item IDs
  separately from selected/audit IDs.
- GREEN
  `npm test -- --run test/analysisExecutionApi.test.ts -t "OpenAI analyzer output"`:
  confirmed the mocked OpenAI `parse()` request now carries strict
  `json_schema` response format with `rulesetFieldsByKey`, all 38 required
  ruleset keys, prompt item ID evidence enums, and no loose `rulesetFields`
  output slot.
- RED
  `npm test -- --run test/analysisExecutionApi.test.ts test/selectionPage.test.ts -t "current failed run diagnostics|current analysis run diagnostics"`:
  failed because `/api/analysis-runs/:id/start` returned only an error string
  and `web/content_selection.js` discarded response body diagnostics.
- GREEN same command after the start route returned safe current-run failure
  metadata and the browser error path preserved `details` for the visible
  message.

Commands:

```bash
cd poc-server
npm test -- --run test/analysisExecutionApi.test.ts -t "OpenAI analyzer output"
npm test -- --run test/analysisExecutionApi.test.ts test/selectionPage.test.ts -t "current failed run diagnostics|current analysis run diagnostics"
npm test -- --run test/analysisExecutionApi.test.ts test/selectionPage.test.ts
npm test -- --run test/blogGenerationApi.test.ts test/contentDetailApi.test.ts test/contentDetailPage.test.ts test/openAIBlogProviderBudget.test.ts
npm run typecheck
npm test
npm run demo:store-learning
cd ..
node --check web/content_detail.js
node --check web/content_selection.js
node --check web/learning_status.js
git diff --check
# searched poc-server/src, web, and docs for removed raw analyzer contract
# error strings; expected result is no matches.
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
  "http://localhost:5177/llm%ED%98%B8%EC%B6%9C.html"
curl -s http://localhost:5177/api/runtime
# in-app Browser smoke:
# - opened http://localhost:5177/
# - opened a temporary localhost harness that loads the real content_selection.js
#   and mocks only the API responses needed for a current-run /start failure
```

Result:

- PASS, SL-A1 OpenAI schema payload regression:
  `analysisExecutionApi.test.ts` targeted run passed 1 test and skipped 12
  unrelated tests in the file.
- PASS, SL-A1 failed-run diagnostics RED/GREEN:
  targeted run passed 2 tests and skipped 19 unrelated tests across
  `analysisExecutionApi.test.ts` and `selectionPage.test.ts`.
- PASS, focused analysis execution and selection-page regression suite:
  2 files, 21 tests.
- PASS, focused Blog/SEO provenance and budget suite: 4 files, 19 tests.
- PASS, TypeScript typecheck.
- PASS, full test suite after the latest SL-A1 diagnostics update: 39 files
  passed and 3 live-provider files skipped by default.
- PASS, 241 tests passed and 6 live-provider tests skipped by default.
- PASS, Store Learning demo seed completed:
  - store: `분당 케이크하우스`
  - channels: 3
  - collectionItems: 4
  - blogPostStatus: `pending_approval`
  - seoScore: 86
- PASS, `node --check web/content_detail.js`.
- PASS, `node --check web/content_selection.js`.
- PASS, `node --check web/learning_status.js`.
- PASS, `git diff --check`.
- PASS, raw analyzer contract error string search returned no matches in
  `poc-server/src`, `web`, or `docs`.
- PASS, localhost live OpenAI smoke for `store_36372611`
  (`남대문명동정형외과의원`):
  `analysis_run_store_36372611_1781139580900` completed, 38/38 ruleset fields
  saved from `openai_analysis`, selected item count 12, prompt item count 5,
  Blog prompt cap 3, and overlay step 2 took 137,983 ms.
- PASS, localhost learning status API for `store_36372611` returned
  `analysis.status=completed`, provider `openAIAnalysisProvider`, model
  `gpt-4o-mini`, and ruleset
  `marketing_ruleset_analysis_run_store_36372611_1781139580900_v1`.
- PASS, localhost reuse/backfill smoke for `store_1020864025`
  (`테라스의원`): `analysis_run_store_1020864025_1781139728971` completed
  immediately without analyzer execution, reused
  `analysis_run_store_1020864025_1781067108343`, and backfilled latest ruleset
  fields to 38 total.
- PASS, localhost smoke for the temporary LLM call audit page:
  `200 text/html; charset=UTF-8`.
- PASS, `/api/runtime` responded with OpenAI mode and model `gpt-4o-mini` on
  the already-running local server.
- PASS, in-app Browser smoke for current-run failure diagnostics:
  - `http://localhost:5177/` responded with title
    `BizPlanet — 마케팅 채널관리 시안`.
  - Temporary localhost harness loaded the real `content_selection.js`.
  - Clicking `분석 실행` rendered
    `현재 분석 실행(analysis_run_current_failure)에서 실패했습니다...`
    in `#selection-analysis-error`.
  - The failure overlay closed and browser console error/warn logs were empty.
- PASS, final branch review on 2026-06-11:
  - changed-file scan found no `admin/`, `pc-web/`, `README_POC.md`, or
    `web/event_operation_poc.html` changes;
  - touched browser scripts use relative `poc-server` API calls only;
  - `OPENAI_API_KEY` appears in `web/llm호출.html` as documentation text only,
    with no browser-side OpenAI/Naver credentials or provider API calls;
  - `.DS_Store` remains an unstaged out-of-scope local modification.

Rendered smoke:

- Browser plugin tooling was not callable in this session, so Playwright was
  used as fallback.
- The in-app Browser tab was later in a localhost crash-page state, so it was
  not used as pass/fail evidence for the SL-A1 live smoke. API and static HTTP
  checks on port `5177` were used instead.
- Target flow:
  `09_AI콘텐츠생성_상세.html?postId=blog_post_demo_pending_approval` -> page
  load -> SEO rescore -> compact provenance line update.
- Mock validation server:
  `PORT=5187 OPENAI_API_KEY= STORE_LEARNING_MOCK_MODE=true npm run dev`.
- PASS, page was not blank and rendered Blog detail content.
- PASS, compact provenance line rendered provider/action information before
  interaction and updated after SEO rescore.
- PASS, no browser console warnings or errors were captured.
- Screenshot evidence was saved outside the repo:
  `/tmp/bizp-content-detail-provenance.png` and
  `/tmp/bizp-content-detail-seo-provenance.png`.

Notes:

- The existing out-of-scope `.DS_Store` modification remains unstaged.
- The first interaction attempt against port `5177` was not used as pass/fail
  evidence because that server was in live OpenAI mode and the SEO action
  waited on the real provider path.

## PR #38 Develop Validation

PR #38, `[codex] Handle collection delta relearning follow-up`, was merged to
`develop` on 2026-06-10.

- PR: https://github.com/funkyliferyu/bizp-poc/pull/38
- Merge commit: `204f964`
- Validation worktree: `/tmp/bizp-pr38-develop-validate`
- Validation basis: `origin/develop` at merge commit `204f964`

Commands:

```bash
cd poc-server
npm ci
npm run typecheck
npm test
npm run demo:store-learning
cd ..
git diff --check
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
  "http://localhost:5177/llm%ED%98%B8%EC%B6%9C.html"
```

Result:

- PASS, `npm ci` installed 252 packages in the clean develop validation
  worktree.
- PASS, TypeScript typecheck.
- PASS, full test suite: 36 files passed and 3 live-provider files skipped by
  default.
- PASS, 216 tests passed and 6 live-provider tests skipped by default.
- PASS, Store Learning demo seed completed:
  - store: `분당 케이크하우스`
  - channels: 3
  - collectionItems: 3
  - blogPostStatus: `pending_approval`
  - seoScore: 86
- PASS, `git diff --check`.
- PASS, localhost smoke for the temporary LLM call audit page:
  `200 text/html; charset=UTF-8`.

Notes:

- The primary worktree still has the existing out-of-scope `.DS_Store`
  modification; it was not staged.
- The clean validation worktree created ignored local artifacts such as
  `node_modules` and `poc-server/data/store-learning.sqlite`.
- The next planned implementation is
  `docs/codex/NEXT_SESSION_LLM_CALL_AUDIT_PLAN.md`.

## MILESTONE-12-COLLECTION-DELTA-RELEARNING-CR Task 16 Final Validation

Task 16 fixes the 우리 매장 분석 `리뷰 약점` legacy fallback issue:
older rulesets that do not have a persisted `reviewWeakness` field now receive
a server-side backfilled field derived from collected review/blog evidence, not
the static browser fallback. Because it is returned as a normal ruleset field,
the row also gets `저장`, `초기화`, and `근거 보기`.

TDD evidence:

- RED
  `npm test -- --run test/rulesetApi.test.ts -t "review weakness|field source matrix"`:
  failed because `reviewWeakness` was absent from a legacy ruleset payload and
  the source-matrix text still described it as a static UI sample.
- GREEN same command: passed, 2 focused tests.

Commands:

```bash
cd poc-server
npm test -- --run test/rulesetApi.test.ts -t "review weakness|field source matrix"
npm test -- --run test/rulesetApi.test.ts test/rulesetPage.test.ts
npm run typecheck
npm test
npm run demo:store-learning
cd ..
node --check web/ruleset_editor.js
git diff --check
```

Result:

- PASS, focused Task 16 suite: 2 tests.
- PASS, ruleset API/page regression suite: 2 files and 30 tests.
- PASS, TypeScript typecheck.
- PASS, full test suite: 36 files passed and 3 live-provider files skipped by
  default.
- PASS, 214 tests passed and 6 live-provider tests skipped by default.
- PASS, demo seed completed:
  - store: `분당 케이크하우스`
  - channels: 3
  - collectionItems: 4
  - blogPostStatus: `pending_approval`
  - seoScore: 86
- PASS, `node --check web/ruleset_editor.js`.
- PASS, `git diff --check`.

Browser/API smoke:

- Localhost API check:
  `GET /api/stores/store_1020864025/strategy-ruleset`
  returned `reviewWeakness` as `analysis_backfill` with value
  `통증 걱정 완화 안내 필요, 사후관리/재발 기대치 안내 필요, 대기/혼잡 경험 관리 필요`.
- The same API response no longer used the static fallback
  `주차 공간 협소, 현금 결제 불가 언급`.
- `GET /api/stores/store_1020864025/strategy-ruleset/fields/reviewWeakness/evidence`
  returned collected review excerpts.
- Playwright smoke target:
  `http://localhost:5177/07_%EB%A7%88%EC%BC%80%ED%8C%85%EC%A0%84%EB%9E%B5%EB%A3%B0%EC%85%8B.html?storeId=store_1020864025`
- The `리뷰 약점` row showed the backfilled collected-review-derived value.
- The row rendered `저장`, `초기화`, and `근거 보기`.
- Clicking `근거 보기` opened `리뷰 약점 근거 보기` with collected review
  excerpts.

Boundaries:

- `.DS_Store` remains an existing local out-of-scope modification and was not
  staged.
- No `admin/`, `pc-web/`, `README_POC.md`, or
  `web/event_operation_poc.html` changes.
- Browser code continues to call only `poc-server` APIs for this flow.

## MILESTONE-12-COLLECTION-DELTA-RELEARNING-CR Task 15 Final Validation

Task 15 fixes the no-new-content collection state:
when existing Blog/Place content is already current and the Place profile is
unchanged, the progress screen says `새로 가져올 항목이 존재하지 않습니다.`
and the analysis selection CTA is disabled.

TDD evidence:

- RED
  `npm test -- --run test/collectionItemIdentity.test.ts test/naverPlaceRenderedCollectionProvider.test.ts test/selectionApi.test.ts test/collectionProgressPage.test.ts`:
  failed because review counters changed Place profile fingerprints, rendered
  Place review fallback created failed placeholders, no-change selectable items
  still returned a profile item, and the progress page did not expose the new
  no-new/disabled CTA contract.
- GREEN same command: passed, 24 tests.

Commands:

```bash
cd poc-server
npm test -- --run test/collectionItemIdentity.test.ts test/naverPlaceRenderedCollectionProvider.test.ts test/selectionApi.test.ts test/collectionProgressPage.test.ts
npm run typecheck
npm test
npm run demo:store-learning
cd ..
node --check web/collection_progress.js
git diff --check
```

Result:

- PASS, focused Task 15 suite: 4 files and 24 tests.
- PASS, TypeScript typecheck.
- PASS, full test suite: 36 files passed and 3 live-provider files skipped by
  default.
- PASS, 213 tests passed and 6 live-provider tests skipped by default.
- PASS, demo seed completed:
  - store: `분당 케이크하우스`
  - channels: 3
  - collectionItems: 4
  - blogPostStatus: `pending_approval`
  - seoScore: 86
- PASS, `node --check web/collection_progress.js`.
- PASS, `git diff --check`.

Browser/API smoke:

- Existing local server check: `http://localhost:5177/` returned HTTP 200.
- Server process check: `npm run dev` is running with
  `tsx watch src/index.ts`.
- Playwright smoke target:
  `http://localhost:5177/04_AI%ED%95%99%EC%8A%B5_%EC%88%98%EC%A7%91%EC%A4%91.html?storeId=store_demo_cake&runId=collection_run_smoke_no_new`
- The progress status showed `수집 완료` and `신규 수집 0개`.
- The guidance and ready-count text included
  `새로 가져올 항목이 존재하지 않습니다.`
- The analysis selection button was disabled and its title was
  `새로 분석할 콘텐츠가 없습니다.`
- `GET /api/collection-runs/collection_run_smoke_no_new/selectable-items`
  returned `items: []`.

Boundaries:

- `.DS_Store` remains an existing local out-of-scope modification and was not
  staged.
- No `admin/`, `pc-web/`, `README_POC.md`, or
  `web/event_operation_poc.html` changes.
- Browser code continues to call only `poc-server` APIs for this flow.

## MILESTONE-12-COLLECTION-DELTA-RELEARNING-CR Task 14 Final Validation

Task 14 implements the writing-style CR for marketing strategy rulesets:
server-derived `writingStyleInsights`, API-backed right-side AI suggestions,
save/reset on writing-style editable rows, no writing-tab `근거 보기` action,
and placeholder-style empty guidance that is not saved unless edited.

TDD evidence:

- RED `npm test -- --run test/rulesetPage.test.ts test/rulesetApi.test.ts`:
  failed because `writingStyleInsights` was absent and the browser script did
  not have writing-specific action/placeholder rendering.
- GREEN
  `npm test -- --run test/rulesetPage.test.ts test/rulesetApi.test.ts test/analysisExecutionApi.test.ts`:
  passed, 35 tests.
- Browser smoke initially caught a real `ruleset_editor.js` syntax regression.
  `node --check web/ruleset_editor.js` and a parseability assertion in
  `rulesetPage.test.ts` were added before final validation.

Commands:

```bash
cd poc-server
npm test -- --run test/rulesetPage.test.ts test/rulesetApi.test.ts test/analysisExecutionApi.test.ts
npm run typecheck
npm test
npm run demo:store-learning
cd ..
node --check web/ruleset_editor.js
git diff --check
```

Result:

- PASS, focused Task 14 suite: 3 files and 35 tests.
- PASS, TypeScript typecheck.
- PASS, full test suite: 36 files passed and 3 live-provider files skipped by
  default.
- PASS, 210 tests passed and 6 live-provider tests skipped by default.
- PASS, demo seed completed:
  - store: `분당 케이크하우스`
  - channels: 3
  - collectionItems: 4
  - blogPostStatus: `pending_approval`
  - seoScore: 86
- PASS, `node --check web/ruleset_editor.js`.
- PASS, `git diff --check`.

Browser smoke:

- URL:
  `http://localhost:5177/07_%EB%A7%88%EC%BC%80%ED%8C%85%EC%A0%84%EB%9E%B5%EB%A3%B0%EC%85%8B.html?storeId=store_12841526`
- `localhost:5177` was already running and served the ruleset HTML with HTTP
  200.
- Writing-style tab check:
  - visible rows had `저장` and `초기화` action buttons;
  - writing-tab `근거 보기` button count was `0`;
  - API-backed suggestion states included both `개선 제안` and `현행유지`;
  - placeholder/empty rows exposed `data-placeholder-value="true"`.
- Browser console contained older syntax errors from the failed pre-fix load,
  but after the fix the page rendered the updated action/suggestion DOM.

Boundaries:

- `.DS_Store` remains an existing local out-of-scope modification and was not
  staged.
- No `admin/`, `pc-web/`, `README_POC.md`, or `web/event_operation_poc.html`
  changes.
- Browser code continues to call only `poc-server` APIs for this flow.

## MILESTONE-12-COLLECTION-DELTA-RELEARNING-CR Collection Fingerprint Hotfix

Bug report: a no-new-content collection run could appear as `수집 실패` because
Place profile fingerprinting called `trim()` on non-string metadata and raised
`value?.trim is not a function`.

- RED `npm test -- collectionItemIdentity.test.ts naverPlaceRenderedCollectionProvider.test.ts -t "non-string|fingerprints Place profiles"`:
  failed with `value?.trim is not a function` and a rendered collection run
  status of `failed`.
- GREEN `npm test -- collectionItemIdentity.test.ts naverPlaceRenderedCollectionProvider.test.ts -t "non-string|fingerprints Place profiles"`:
  passed after making profile identity text normalization safe for strings,
  numbers, booleans, arrays, and objects.
- Focused regression
  `npm test -- collectionItemIdentity.test.ts naverPlaceRenderedCollectionProvider.test.ts collectionProgressApi.test.ts analysisExecutionApi.test.ts selectionApi.test.ts`:
  passed, 27 tests.
- Final regression:
  `npm run typecheck`, `npm test`, `npm run demo:store-learning`, and
  `git diff --check` passed. Full test count: 209 passed and 6 skipped
  live-provider tests across 39 files.

## MILESTONE-12-COLLECTION-DELTA-RELEARNING-CR Task 13 Commands

Run from `poc-server/`:

```bash
npm test -- rulesetPage.test.ts rulesetApi.test.ts analysisExecutionApi.test.ts
npm test -- rulesetApi.test.ts
npm run typecheck
npm test
npm run demo:store-learning
```

Run from repo root:

```bash
git diff --check
```

Playwright smoke target:

```text
http://localhost:5177/07_%EB%A7%88%EC%BC%80%ED%8C%85%EC%A0%84%EB%9E%B5%EB%A3%B0%EC%85%8B.html?storeId=store_12841526
```

## MILESTONE-12-COLLECTION-DELTA-RELEARNING-CR Task 13 TDD Evidence

- RED `npm test -- rulesetPage.test.ts rulesetApi.test.ts analysisExecutionApi.test.ts`:
  failed because the brand tab still had the visible source-matrix/diagnostic
  path, `AI 원값` copy, no `storeFacts.representativeTreatmentSubjects`, and
  analysis evidence metadata had no field-specific `fieldEvidence`.
- GREEN `npm test -- rulesetPage.test.ts rulesetApi.test.ts analysisExecutionApi.test.ts`:
  passed, 34 tests, after removing the brand diagnostic UI path, renaming reset
  copy to `초기화`, adding real healthcare treatment-subject facts, persisting
  field-specific evidence metadata, and adding a legacy evidence fallback.

## MILESTONE-12-COLLECTION-DELTA-RELEARNING-CR Task 13 Final Validation

Draft PR: https://github.com/funkyliferyu/bizp-poc/pull/38
PR #38 now includes the Task 13 our-store-analysis follow-up. Non-admin merge
remains blocked by the `develop` base branch policy, and repository auto-merge
is disabled.

- `npm test -- rulesetPage.test.ts rulesetApi.test.ts analysisExecutionApi.test.ts`:
  passed, 34 tests.
- `npm test -- rulesetApi.test.ts`: passed, 13 tests after legacy evidence
  fallback polish.
- `npm run typecheck`: passed.
- `npm test`: passed, 207 tests and 6 skipped live-provider tests across
  38 files.
- `npm run demo:store-learning`: passed and seeded Store Learning demo data at
  `poc-server/data/store-learning.sqlite`.
- `git diff --check`: passed.
- Playwright localhost smoke passed:
  - Ruleset brand tab has no visible brand source matrix.
  - Brand tab text does not include `자동 입력 기준`, `AI 처리`, `AI 판단`,
    `개선 제안`, or `AI 원값`.
  - Reset copy includes `초기화`.
  - Healthcare representative offering renders as `대표 진료과목` with real
    treatment subjects from the current store.
  - Positioning `근거 보기` opens with title `포지셔닝 근거 보기`, product copy,
    and field-specific evidence text.
- Expected milestone files:
  - `docs/codex/CURRENT_TASK.md`
  - `docs/codex/HANDOFF.md`
  - `docs/codex/MILESTONE_12_COLLECTION_DELTA_RELEARNING_PLAN.md`
  - `docs/codex/PLAN.md`
  - `docs/codex/VALIDATION.md`
  - `poc-server/src/seedStoreLearning.ts`
  - `poc-server/src/storeLearning/analysis/analysisExecutionService.ts`
  - `poc-server/src/storeLearning/rulesets/rulesetService.ts`
  - `poc-server/src/storeLearning/rulesets/rulesetSourceMatrix.ts`
  - `poc-server/test/analysisExecutionApi.test.ts`
  - `poc-server/test/rulesetApi.test.ts`
  - `poc-server/test/rulesetPage.test.ts`
  - `web/07_마케팅전략룰셋.html`
  - `web/ruleset_editor.js`
- Existing unrelated `.DS_Store` local modification remains unstaged and
  outside the milestone commit.

## MILESTONE-12-COLLECTION-DELTA-RELEARNING-CR Task 12 Commands

Run from `poc-server/`:

```bash
npm test -- rulesetPage.test.ts storeRegistrationPage.test.ts
npm test -- staticWebConnectivity.test.ts rulesetApi.test.ts storeRegistrationApi.test.ts
npm run typecheck
npm test
npm run demo:store-learning
```

Run from repo root:

```bash
git diff --check
```

In-app browser smoke targets:

```text
http://localhost:5177/07_%EB%A7%88%EC%BC%80%ED%8C%85%EC%A0%84%EB%9E%B5%EB%A3%B0%EC%85%8B.html
http://localhost:5177/soho_store_register.html?storeId=store_12841526&focus=parking
```

## MILESTONE-12-COLLECTION-DELTA-RELEARNING-CR Task 12 TDD Evidence

- RED `npm test -- rulesetPage.test.ts storeRegistrationPage.test.ts`: failed
  because the ruleset page still contained `주차 정보 수집 중`, had no
  parking manual-input action, and the store registration page did not read the
  `storeId` query parameter or handle `focus=parking`.
- GREEN `npm test -- rulesetPage.test.ts storeRegistrationPage.test.ts`:
  passed, 31 tests, after adding the missing-parking normalizer, the
  `수동입력 필요` parking state, the `매장정보에서 입력하기` action, query
  parameter store loading, and parking focus behavior.

## MILESTONE-12-COLLECTION-DELTA-RELEARNING-CR Task 12 Final Validation

Draft PR: https://github.com/funkyliferyu/bizp-poc/pull/38
PR #38 now includes the Task 12 parking manual-input CTA follow-up. Non-admin
merge remains blocked by the `develop` base branch policy, and repository
auto-merge is disabled.

- `npm test -- rulesetPage.test.ts storeRegistrationPage.test.ts`: passed,
  31 tests.
- `npm test -- staticWebConnectivity.test.ts rulesetApi.test.ts storeRegistrationApi.test.ts`:
  passed, 45 tests.
- `npm run typecheck`: passed.
- `npm test`: passed, 204 tests and 6 skipped live-provider tests across 38 files.
- `npm run demo:store-learning`: passed and seeded Store Learning demo data at
  `poc-server/data/store-learning.sqlite`.
- `git diff --check`: passed.
- In-app browser smoke passed:
  - Ruleset parking row exists with `data-manual-required-field="parking"`.
  - Parking text is `수동입력 필요`; `주차 정보 수집 중` is absent.
  - `매장정보에서 입력하기` action is visible with
    `data-store-registration-action="parking"`.
  - Clicking the action navigates to
    `http://localhost:5177/soho_store_register.html?storeId=store_12841526&focus=parking`.
  - Store registration loads with `focus=parking`, the parking group exists,
    and `#f-parking-note` is focused.
- Expected milestone files:
  - `docs/codex/CURRENT_TASK.md`
  - `docs/codex/HANDOFF.md`
  - `docs/codex/MILESTONE_12_COLLECTION_DELTA_RELEARNING_PLAN.md`
  - `docs/codex/PLAN.md`
  - `docs/codex/VALIDATION.md`
  - `poc-server/test/rulesetPage.test.ts`
  - `poc-server/test/storeRegistrationPage.test.ts`
  - `web/07_마케팅전략룰셋.html`
  - `web/ruleset_editor.js`
  - `web/soho_store_register.js`
- Existing unrelated `.DS_Store` local modification remains unstaged and
  outside the milestone commit.

## MILESTONE-12-COLLECTION-DELTA-RELEARNING-CR Task 10/11 Commands

Run from `poc-server/`:

```bash
npm test -- rulesetPage.test.ts
npm test -- staticWebConnectivity.test.ts rulesetPage.test.ts rulesetApi.test.ts
npm run typecheck
npm test
npm run demo:store-learning
```

Run from repo root:

```bash
git diff --check
```

In-app browser smoke target:

```text
http://localhost:5177/07_%EB%A7%88%EC%BC%80%ED%8C%85%EC%A0%84%EB%9E%B5%EB%A3%B0%EC%85%8B.html
```

## MILESTONE-12-COLLECTION-DELTA-RELEARNING-CR Task 10/11 TDD Evidence

- RED `npm test -- rulesetPage.test.ts`: failed because the image-style tab
  still rendered `이미지 스타일`, still exposed
  `data-source-matrix-section="image_common,image_instagram,image_blog"`, and
  the similar-comparison tab still rendered `유사업체비교`.
- GREEN `npm test -- rulesetPage.test.ts`: passed, 13 tests, after labeling
  image style as `(공통예시) 이미지 스타일`, moving `비율·포맷` and
  `텍스트 오버레이` into the top image common controls, removing the image
  source matrix container, suppressing image-style source notes, and labeling
  similar comparison as `(공통예시) 유사업체비교`.

## MILESTONE-12-COLLECTION-DELTA-RELEARNING-CR Task 10/11 Final Validation

Draft PR: https://github.com/funkyliferyu/bizp-poc/pull/38
PR #38 was marked ready for review. Non-admin `gh pr merge --merge`,
`gh pr merge --squash`, and `gh pr merge --merge --auto` attempts did not
merge it: the `develop` base branch policy blocks non-admin merge, and
repository auto-merge is disabled.
Later Task 12 parking manual-input CR validation supersedes this section for
the latest PR #38 state.

- `npm test -- rulesetPage.test.ts`: passed, 13 tests.
- `npm test -- staticWebConnectivity.test.ts rulesetPage.test.ts rulesetApi.test.ts`:
  passed, 52 tests.
- `npm run typecheck`: passed.
- `npm test`: passed, 202 tests and 6 skipped live-provider tests across 38 files.
- `npm run demo:store-learning`: passed and seeded Store Learning demo data at
  `poc-server/data/store-learning.sqlite`.
- `git diff --check`: passed.
- In-app browser smoke passed:
  - Image tab visible title: `(공통예시) 이미지 스타일`.
  - Image title color: `rgb(224, 49, 49)`.
  - Image common field order: `primaryColors`, `accentColors`,
    `imageDirection`, `imageStyle`, `imageAvoidStyle`, `blogImageFormat`,
    `blogOverlayPolicy`.
  - Image matrix absent and `.ruleset-source-note` count is `0`.
  - Similar-comparison visible title: `(공통예시) 유사업체비교`.
  - Similar-comparison title color: `rgb(224, 49, 49)`.
  - Existing comparison controls remained populated with 5 type buttons and 3
    company buttons.
- Expected milestone files:
  - `docs/codex/CURRENT_TASK.md`
  - `docs/codex/HANDOFF.md`
  - `docs/codex/MILESTONE_12_COLLECTION_DELTA_RELEARNING_PLAN.md`
  - `docs/codex/PLAN.md`
  - `docs/codex/VALIDATION.md`
  - `poc-server/test/rulesetPage.test.ts`
  - `web/07_마케팅전략룰셋.html`
  - `web/ruleset_editor.js`
- Existing unrelated `.DS_Store` local modification must remain unstaged and
  outside the milestone commit.

## MILESTONE-07-FOLLOWUP-RULESET-CONTRACT Commands

Run from `poc-server/`:

```bash
npm test -- rulesetApi.test.ts -t "canonical"
npm test -- rulesetPage.test.ts
npm test -- rulesetApi.test.ts -t "benchmark evidence"
npm test -- rulesetApi.test.ts -t "regenerates a writing preview"
npm test -- rulesetApi.test.ts -t "direct store facts"
npm test -- rulesetApi.test.ts rulesetPage.test.ts staticWebConnectivity.test.ts
npm run typecheck
npm test
npm run demo:store-learning
```

Run from repo root:

```bash
git diff --check
git status --short --branch
```

## MILESTONE-07-FOLLOWUP-RULESET-CONTRACT TDD Evidence

- RED `npm test -- rulesetApi.test.ts -t "canonical"`: failed because `/strategy-ruleset` returned HTML instead of the ruleset JSON payload.
- GREEN `npm test -- rulesetApi.test.ts -t "canonical"`: passed after adding canonical `/strategy-ruleset` routes and keeping legacy `/ruleset` aliases.
- RED `npm test -- rulesetPage.test.ts`: failed because browser code still fetched `/ruleset`.
- GREEN `npm test -- rulesetPage.test.ts`: passed after switching browser code to canonical `/strategy-ruleset` endpoints.
- RED `npm test -- rulesetApi.test.ts -t "benchmark evidence"`: failed because `/strategy-ruleset/benchmark-evidence` did not exist.
- GREEN `npm test -- rulesetApi.test.ts -t "benchmark evidence"`: passed after moving benchmark fixture access behind a server API.
- RED `npm test -- rulesetApi.test.ts -t "regenerates a writing preview"`: failed because `/strategy-ruleset/regenerate-preview` did not exist.
- GREEN `npm test -- rulesetApi.test.ts -t "regenerates a writing preview"`: passed after adding the deterministic server preview service and route.
- RED `npm test -- rulesetApi.test.ts -t "direct store facts"`: failed because `storeFacts` was missing from the ruleset payload.
- GREEN `npm test -- rulesetApi.test.ts -t "direct store facts"`: passed after adding `storeFacts` and `sourceMatrix[].currentValue`.
- RED `npm test -- rulesetPage.test.ts -t "direct store facts"`: failed because direct store fact rows still displayed `AI 수집`.
- GREEN `npm test -- rulesetPage.test.ts -t "direct store facts"`: passed after labeling direct store fact rows as `Place 수집`.

## MILESTONE-07-FOLLOWUP-RULESET-CONTRACT Final Validation

- `npm test -- rulesetApi.test.ts rulesetPage.test.ts staticWebConnectivity.test.ts`: passed, 41 tests.
- `npm run typecheck`: passed.
- `npm test`: passed, 164 tests and 6 skipped live-provider tests across 38 files.
- `npm run demo:store-learning`: passed and seeded Store Learning demo data at `poc-server/data/store-learning.sqlite`.
- Expected milestone files:
  - `docs/codex/MILESTONE_07_RULESET_FOLLOWUP_PLAN.md`
  - `docs/codex/HANDOFF.md`
  - `docs/codex/VALIDATION.md`
  - `poc-server/src/seedStoreLearning.ts`
  - `poc-server/src/storeLearning/routes/stores.ts`
  - `poc-server/src/storeLearning/rulesets/rulesetBenchmarkService.ts`
  - `poc-server/src/storeLearning/rulesets/rulesetPreviewService.ts`
  - `poc-server/src/storeLearning/rulesets/rulesetService.ts`
  - `poc-server/test/rulesetApi.test.ts`
  - `poc-server/test/rulesetPage.test.ts`
  - `poc-server/test/staticWebConnectivity.test.ts`
  - `web/07_마케팅전략룰셋.html`
  - `web/ruleset_editor.js`
- Existing unrelated `.DS_Store` local modification must remain unstaged and outside the milestone commit.

## MILESTONE-09-BLOG-MANAGEMENT-RESULTS Commands

Run from `poc-server/`:

```bash
npm test -- blogGenerationApi.test.ts -t "list summary"
npm test -- blogPostPages.test.ts -t "pending approval CTA"
npm test -- blogGenerationApi.test.ts blogPostPages.test.ts contentDetailPage.test.ts
npm test -- staticWebConnectivity.test.ts
npm run typecheck
```

Run from repo root:

```bash
git diff --check
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5177/02_%EB%B8%94%EB%A1%9C%EA%B7%B8%EA%B4%80%EB%A6%AC.html?storeId=store_demo_cake"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5177/08_AI%EC%BD%98%ED%85%90%EC%B8%A0%EC%83%9D%EC%84%B1_%EB%AA%A9%EB%A1%9D.html?storeId=store_demo_cake"
git status --short --branch
```

## MILESTONE-09-BLOG-MANAGEMENT-RESULTS TDD Evidence

- RED `npm test -- blogGenerationApi.test.ts -t "list summary"`: failed because `body.summary` was `undefined`.
- GREEN `npm test -- blogGenerationApi.test.ts -t "list summary"`: passed after adding blog list summary metadata and post `generationSource`.
- RED `npm test -- blogPostPages.test.ts -t "pending approval CTA"`: failed because `web/02_블로그관리.html` had no `blog-pending-alert`/`blog-pending-action` hooks and `web/blog_posts.js` had no summary/source renderer.
- GREEN `npm test -- blogPostPages.test.ts -t "pending approval CTA"`: passed after adding the pending approval CTA hook, source note hook, and generation source row rendering.

## MILESTONE-09-BLOG-MANAGEMENT-RESULTS Final Validation

- `npm test -- blogGenerationApi.test.ts blogPostPages.test.ts contentDetailPage.test.ts`: passed, 9 tests.
- `npm test -- staticWebConnectivity.test.ts`: passed, 28 tests.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5177/02_%EB%B8%94%EB%A1%9C%EA%B7%B8%EA%B4%80%EB%A6%AC.html?storeId=store_demo_cake"`: returned `200`.
- `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5177/08_AI%EC%BD%98%ED%85%90%EC%B8%A0%EC%83%9D%EC%84%B1_%EB%AA%A9%EB%A1%9D.html?storeId=store_demo_cake"`: returned `200`.
- Expected milestone files:
  - `docs/codex/MILESTONE_09_BLOG_MANAGEMENT_RESULTS_PLAN.md`
  - `docs/codex/HANDOFF.md`
  - `docs/codex/VALIDATION.md`
  - `poc-server/src/storeLearning/blog/blogGenerator.ts`
  - `poc-server/src/seedStoreLearning.ts`
  - `poc-server/test/blogGenerationApi.test.ts`
  - `poc-server/test/blogPostPages.test.ts`
  - `web/02_블로그관리.html`
  - `web/08_AI콘텐츠생성_목록.html`
  - `web/blog_posts.js`
- Existing unrelated `.DS_Store` local modification must remain unstaged and outside the milestone commit.

## MILESTONE-08-LEARNING-STATUS-RESULTS Commands

Run from `poc-server/`:

```bash
npm test -- learningStatusApi.test.ts -t "completion criteria"
npm test -- learningStatusPage.test.ts -t "completion result"
npm test -- learningStatusApi.test.ts learningStatusPage.test.ts
npm test -- staticWebConnectivity.test.ts
npm run typecheck
```

Run from repo root:

```bash
git diff --check
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5177/06_AI%ED%95%99%EC%8A%B5_%ED%98%84%ED%99%A9.html?storeId=store_demo_cake"
git status --short --branch
```

## MILESTONE-08-LEARNING-STATUS-RESULTS TDD Evidence

- RED `npm test -- learningStatusApi.test.ts -t "completion criteria"`: failed because `body.completion` was `undefined`.
- GREEN `npm test -- learningStatusApi.test.ts -t "completion criteria"`: passed after adding completion criteria derived from Blog collection, Place profile collection, latest analysis artifacts, and marketing ruleset fields.
- RED `npm test -- learningStatusPage.test.ts -t "completion result"`: failed because `web/06_AI학습_현황.html` had no `learning-completion-*` hooks and `web/learning_status.js` had no `renderCompletion`.
- GREEN `npm test -- learningStatusPage.test.ts -t "completion result"`: passed after adding the completion summary hooks and API-backed completion renderer.

## MILESTONE-08-LEARNING-STATUS-RESULTS Final Validation

- `npm test -- learningStatusApi.test.ts learningStatusPage.test.ts`: passed, 6 tests.
- `npm test -- staticWebConnectivity.test.ts`: passed, 28 tests.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5177/06_AI%ED%95%99%EC%8A%B5_%ED%98%84%ED%99%A9.html?storeId=store_demo_cake"`: returned `200`.
- Expected milestone files:
  - `docs/codex/MILESTONE_08_LEARNING_STATUS_RESULTS_PLAN.md`
  - `docs/codex/HANDOFF.md`
  - `docs/codex/VALIDATION.md`
  - `poc-server/src/storeLearning/learning/learningStatusService.ts`
  - `poc-server/test/learningStatusApi.test.ts`
  - `poc-server/test/learningStatusPage.test.ts`
  - `web/06_AI학습_현황.html`
  - `web/learning_status.js`
- Existing unrelated `.DS_Store` local modification must remain unstaged and outside the milestone commit.

## MILESTONE-07-RULESET-UI-SOURCE-MATRIX Commands

Run from `poc-server/`:

```bash
npm test -- rulesetPage.test.ts -t "source matrix containers"
npm test -- rulesetApi.test.ts -t "seeds ruleset fields"
npm test -- rulesetPage.test.ts rulesetApi.test.ts
npm test -- staticWebConnectivity.test.ts
npm run typecheck
```

Run from repo root:

```bash
git diff --check
git status --short
```

## MILESTONE-07-RULESET-UI-SOURCE-MATRIX TDD Evidence

- RED `npm test -- rulesetPage.test.ts -t "source matrix containers"`: failed because `web/07_마케팅전략룰셋.html` had no `data-source-matrix-section` hooks and `web/ruleset_editor.js` had no `renderSourceMatrix` implementation.
- RED `npm test -- rulesetApi.test.ts -t "seeds ruleset fields"`: failed because the demo seed only returned `positioning` and `contentKeywords`.
- GREEN `npm test -- rulesetPage.test.ts -t "source matrix containers"`: passed after adding source matrix containers, missing field hooks, and browser rendering logic.
- GREEN `npm test -- rulesetApi.test.ts -t "seeds ruleset fields"`: passed after adding expanded demo ruleset fields.

## MILESTONE-07-RULESET-UI-SOURCE-MATRIX Final Validation

- `npm test -- rulesetPage.test.ts rulesetApi.test.ts`: passed, 8 tests.
- `npm test -- staticWebConnectivity.test.ts`: passed, 28 tests.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5177/07_%EB%A7%88%EC%BC%80%ED%8C%85%EC%A0%84%EB%9E%B5%EB%A3%B0%EC%85%8B.html?storeId=store_demo_cake"`: returned `200`.
- Browser plugin was not exposed by tool discovery in this session; use local HTTP/static checks for smoke validation.
- Expected milestone files:
  - `docs/codex/MILESTONE_07_RULESET_UI_SOURCE_MATRIX_PLAN.md`
  - `docs/codex/HANDOFF.md`
  - `docs/codex/VALIDATION.md`
  - `poc-server/src/seedStoreLearning.ts`
  - `poc-server/test/rulesetApi.test.ts`
  - `poc-server/test/rulesetPage.test.ts`
  - `web/07_마케팅전략룰셋.html`
  - `web/ruleset_editor.js`
- Existing unrelated `.DS_Store` local modification must remain unstaged and outside the milestone commit.

## MILESTONE-06-RULESET-SOURCE-MATRIX Commands

Run from `poc-server/`:

```bash
npm test -- rulesetApi.test.ts -t "field source matrix"
npm test -- analysisExecutionApi.test.ts -t "generates a learning snapshot"
npm test -- analysisExecutionApi.test.ts -t "OpenAI analyzer output"
npm test -- rulesetApi.test.ts analysisExecutionApi.test.ts
npm test -- rulesetPage.test.ts
npm run typecheck
```

Run from repo root:

```bash
git diff --check
git status --short
```

## MILESTONE-06-RULESET-SOURCE-MATRIX TDD Evidence

- RED `npm test -- rulesetApi.test.ts -t "field source matrix"`: failed because `body.sourceMatrix` was `undefined` and serialized fields had no source matrix metadata.
- RED `npm test -- analysisExecutionApi.test.ts -t "generates a learning snapshot"`: failed because the mock analyzer only generated the original 9 ruleset field keys.
- RED `npm test -- analysisExecutionApi.test.ts -t "OpenAI analyzer output"`: failed because the OpenAI prompt did not include expanded field keys such as `reviewWeakness`, `blogImageFormat`, and `representativeMenu`.
- GREEN `npm test -- rulesetApi.test.ts analysisExecutionApi.test.ts`: passed after adding the source matrix module, ruleset payload metadata, expanded mock analyzer fields, and shared OpenAI prompt field-key list.

## MILESTONE-06-RULESET-SOURCE-MATRIX Final Validation

- `npm test -- rulesetApi.test.ts analysisExecutionApi.test.ts`: passed, 8 tests.
- `npm test -- rulesetPage.test.ts`: passed, 2 tests.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- Expected milestone files:
  - `docs/codex/MILESTONE_06_RULESET_SOURCE_MATRIX_PLAN.md`
  - `docs/codex/HANDOFF.md`
  - `docs/codex/VALIDATION.md`
  - `poc-server/src/storeLearning/rulesets/rulesetSourceMatrix.ts`
  - `poc-server/src/storeLearning/rulesets/rulesetService.ts`
  - `poc-server/src/storeLearning/analysis/analyzer.ts`
  - `poc-server/src/storeLearning/analysis/openAIAnalysisProvider.ts`
  - `poc-server/test/rulesetApi.test.ts`
  - `poc-server/test/analysisExecutionApi.test.ts`
- Existing unrelated `.DS_Store` local modification must remain unstaged and outside the milestone commit.

## MILESTONE-05-BLOG-RAW-VIEWER-EVIDENCE Commands

Run from `poc-server/`:

```bash
npm test -- collectionRawDataPage.test.ts collectionProgressPage.test.ts selectionPage.test.ts
npm test -- staticWebConnectivity.test.ts
npm test -- selectionApi.test.ts collectionProgressApi.test.ts
npm run typecheck
```

Run from repo root:

```bash
git diff --check
git status --short
```

## MILESTONE-05-BLOG-RAW-VIEWER-EVIDENCE TDD Evidence

- RED `npm test -- collectionRawDataPage.test.ts collectionProgressPage.test.ts selectionPage.test.ts`: failed because `collection_raw_data.html/js`, `collection-blog-raw-button`, `selection-blog-raw-button`, and `evidenceBadges` did not exist.
- GREEN `npm test -- collectionRawDataPage.test.ts collectionProgressPage.test.ts selectionPage.test.ts`: passed after adding the collection RAW viewer, RAW buttons, and Blog evidence badges.

## MILESTONE-05-BLOG-RAW-VIEWER-EVIDENCE Final Validation

- `npm test -- collectionRawDataPage.test.ts collectionProgressPage.test.ts selectionPage.test.ts`: passed, 6 tests.
- `npm test -- staticWebConnectivity.test.ts`: passed, 28 tests.
- `npm test -- selectionApi.test.ts collectionProgressApi.test.ts`: passed, 5 tests.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- Expected milestone files:
  - `docs/codex/MILESTONE_05_BLOG_RAW_VIEWER_EVIDENCE_PLAN.md`
  - `docs/codex/HANDOFF.md`
  - `docs/codex/VALIDATION.md`
  - `poc-server/test/collectionRawDataPage.test.ts`
  - `poc-server/test/collectionProgressPage.test.ts`
  - `poc-server/test/selectionPage.test.ts`
  - `web/04_AI학습_수집중.html`
  - `web/05_AI학습_콘텐츠선택.html`
  - `web/collection_progress.js`
  - `web/collection_raw_data.html`
  - `web/collection_raw_data.js`
  - `web/content_selection.js`
- Existing unrelated `.DS_Store` local modification must remain unstaged and outside the milestone commit.

## MILESTONE-04-BLOG-COLLECTION-RELIABILITY Commands

Run from `poc-server/`:

```bash
npm test -- naverBlogRenderedCollectionProvider.test.ts -t "RSS"
npm test -- naverBlogRenderedCollectionProvider.test.ts
npm test -- collectionProgressApi.test.ts
npm run typecheck
```

Run from repo root:

```bash
git diff --check
git status --short
```

## MILESTONE-04-BLOG-COLLECTION-RELIABILITY TDD Evidence

- RED `npm test -- naverBlogRenderedCollectionProvider.test.ts -t "RSS"`: failed because the provider did not request `https://rss.blog.naver.com/demo-cake.xml` when PostList had no post links, and restricted PostList still threw `Naver Blog rendered request was restricted by Naver.`
- GREEN `npm test -- naverBlogRenderedCollectionProvider.test.ts -t "RSS"`: passed after adding RSS URL building, RSS link extraction, PostList no-link fallback, PostList restriction fallback, and `metadata.blogSourceDiscovery`.

## MILESTONE-04-BLOG-COLLECTION-RELIABILITY Final Validation

- `npm test -- naverBlogRenderedCollectionProvider.test.ts -t "RSS"`: passed, 2 tests.
- `npm test -- naverBlogRenderedCollectionProvider.test.ts`: passed, 5 tests.
- `npm test -- collectionProgressApi.test.ts`: passed, 3 tests.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- Expected milestone files:
  - `docs/codex/MILESTONE_04_BLOG_COLLECTION_RELIABILITY_PLAN.md`
  - `docs/codex/HANDOFF.md`
  - `docs/codex/VALIDATION.md`
  - `poc-server/src/storeLearning/collection/naverBlogRenderedCollectionProvider.ts`
  - `poc-server/test/fixtures/naver-blog-rss.xml`
  - `poc-server/test/naverBlogRenderedCollectionProvider.test.ts`
- Existing unrelated `.DS_Store` local modification must remain unstaged and outside the milestone commit.

## MILESTONE-03-TRAINING-SETTINGS-CONTRACT Commands

Run from `poc-server/`:

```bash
npm test -- trainingSettingsApi.test.ts -t "source URLs"
npm test -- trainingSettingsApi.test.ts trainingSettingsPage.test.ts
npm test -- collectionProgressApi.test.ts
npm run typecheck
```

Run from repo root:

```bash
git diff --check
git status --short
```

## MILESTONE-03-TRAINING-SETTINGS-CONTRACT TDD Evidence

- RED `npm test -- trainingSettingsApi.test.ts -t "source URLs"`: failed because `run.collectionRun.summary.sourceUrls` was `undefined`.
- GREEN `npm test -- trainingSettingsApi.test.ts -t "source URLs"`: passed after `collectionPlanFromSettings` started recording channel source URLs in collection run summaries.

## MILESTONE-03-TRAINING-SETTINGS-CONTRACT Final Validation

- `npm test -- trainingSettingsApi.test.ts -t "source URLs"`: passed, 1 test.
- `npm test -- trainingSettingsApi.test.ts trainingSettingsPage.test.ts`: passed, 5 tests.
- `npm test -- collectionProgressApi.test.ts`: passed, 3 tests.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- Expected milestone files:
  - `docs/codex/MILESTONE_03_TRAINING_SETTINGS_CONTRACT_PLAN.md`
  - `docs/codex/HANDOFF.md`
  - `docs/codex/VALIDATION.md`
  - `poc-server/src/storeLearning/routes/stores.ts`
  - `poc-server/test/trainingSettingsApi.test.ts`
  - `poc-server/test/trainingSettingsPage.test.ts`
- Existing unrelated `.DS_Store` local modification must remain unstaged and outside the milestone commit.

## MILESTONE-02-STORE-REGISTRATION-CLEANUP Commands

Run from `poc-server/`:

```bash
npm test -- storeRegistrationPage.test.ts -t "business number"
npm test -- storeRegistrationPage.test.ts
npm run typecheck
```

Run from repo root:

```bash
git diff --check
git status --short
```

## MILESTONE-02-STORE-REGISTRATION-CLEANUP TDD Evidence

- RED `npm test -- storeRegistrationPage.test.ts -t "business number"`: failed because `web/soho_store_register.html` still rendered `<label>사업자번호 <span class="req">*</span></label>`.
- GREEN `npm test -- storeRegistrationPage.test.ts -t "business number"`: passed after removing `f-biz` from required browser validation while preserving optional `businessNumber` payload persistence.

## MILESTONE-02-STORE-REGISTRATION-CLEANUP Final Validation

- `npm test -- storeRegistrationPage.test.ts -t "business number"`: passed, 1 test.
- `npm test -- storeRegistrationPage.test.ts`: passed, 15 tests.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- Expected milestone files:
  - `docs/codex/MILESTONE_02_STORE_REGISTRATION_PLAN.md`
  - `docs/codex/HANDOFF.md`
  - `docs/codex/VALIDATION.md`
  - `poc-server/test/storeRegistrationPage.test.ts`
  - `web/soho_store_register.html`
  - `web/soho_store_register.js`
- Existing unrelated `.DS_Store` local modification must remain unstaged and outside the milestone commit.

## MILESTONE-01-DATA-MAP Commands

Run from repo root:

```bash
test -f docs/codex/MILESTONE_01_DATA_MAP_PLAN.md
test -f docs/product/STORE_LEARNING_DATA_MAP.md
rg -n "Place Immediate|Blog Parser|AI Processing|사업자번호|RAW data|룰셋" docs/codex/MILESTONE_01_DATA_MAP_PLAN.md docs/product/STORE_LEARNING_DATA_MAP.md docs/codex/HANDOFF.md docs/codex/VALIDATION.md
git diff --check
git status --short
```

## MILESTONE-01-DATA-MAP Final Validation

- Documentation-only milestone; full runtime test suite is not required.
- `test -f docs/codex/MILESTONE_01_DATA_MAP_PLAN.md`: passed.
- `test -f docs/product/STORE_LEARNING_DATA_MAP.md`: passed.
- `rg -n "Place Immediate|Blog Parser|AI Processing|사업자번호|RAW data|룰셋" ...`: passed and found the expected source-tier, optional business-number, RAW data, and ruleset references.
- `git diff --check`: passed.
- `git status --short`: passed for milestone scope; expected milestone files appeared:
  - `docs/codex/MILESTONE_01_DATA_MAP_PLAN.md`
  - `docs/product/STORE_LEARNING_DATA_MAP.md`
  - `docs/codex/HANDOFF.md`
  - `docs/codex/VALIDATION.md`
- Existing unrelated `.DS_Store` local modification must remain unstaged and outside the milestone commit.

## RAG-REVIEW-COLLECTION-002 Commands

Run from `poc-server/`:

```bash
npm test -- naverPlaceRenderedProvider.test.ts
npm test -- storeRegistrationPage.test.ts
npm test -- naverPlaceRenderedCollectionProvider.test.ts
npm run typecheck
npm test -- naverPlaceRenderedProvider.test.ts naverPlaceRenderedCollectionProvider.test.ts storeRegistrationPage.test.ts
npm test
npm run naver:verify
npm run demo:store-learning
npm run demo
```

Manual live RAG refresh check:

```bash
npx tsx -r dotenv/config -e "import { createDatabaseConnection } from './src/db/connection.js'; import { migrateDatabase } from './src/db/migrate.js'; import { generateRagDocuments } from './src/storeLearning/rag/ragDocumentService.js'; const connection = createDatabaseConnection(); try { migrateDatabase(connection); const manifest = await generateRagDocuments({ connection, env: process.env }, 'store_1824807602', { refreshReviews: true, reviewLimit: 100 }); console.log(JSON.stringify({ reviewCount: manifest.reviewCount, sourceCollectionRunId: manifest.sourceCollectionRunId, warnings: manifest.warnings }, null, 2)); } finally { connection.close(); }"
```

## RAG-REVIEW-COLLECTION-002 TDD Evidence

- RED `npm test -- naverPlaceRenderedProvider.test.ts`: failed because `shouldUseInteractiveNaverReviewRendering` did not exist.
- GREEN `npm test -- naverPlaceRenderedProvider.test.ts`: passed after visitor review URLs were marked for interactive rendering and Playwright review pages gained scroll/more expansion attempts.
- RED `npm test -- storeRegistrationPage.test.ts`: failed because the registration page did not expose separate review collection and document generation progress messages.
- GREEN `npm test -- storeRegistrationPage.test.ts`: passed after adding `네이버플레이스 리뷰를 가져오는 중입니다.` / `RAG 문서를 생성하는 중입니다.` status messages and manifest warning display.
- RED `npm test -- naverPlaceRenderedCollectionProvider.test.ts`: failed because a rendered snapshot with 10 reviews did not use GraphQL fallback and collected only 10 reviews.
- GREEN `npm test -- naverPlaceRenderedCollectionProvider.test.ts`: passed after adding a Naver Place visitor review GraphQL fallback that reuses the SSR Apollo input, requests `size<=50`, combines sort variants, and dedupes reviews.

## RAG-REVIEW-COLLECTION-002 Final Validation

- Root cause DB check: latest RAG refresh run for `store_1824807602` had `placeReviewLimit=100`, `placeReviews=10`, and 90 failed placeholders before the fix.
- Live Playwright root-cause check: Playwright review page rendering was restricted by Naver for the local IP, so direct mobile HTML fallback returned only the first SSR batch.
- Live GraphQL exploration: `size=50` returned 50 review bodies, while `size>=60` returned `visitorReviews=null`; combining default and `recent` variants increased accessible body-bearing review coverage.
- Manual live RAG refresh for `store_1824807602`: passed; regenerated `reviews_해화로in수산.docx` with `reviewCount=80` and warning `네이버플레이스 리뷰 100개 수집을 시도했지만 80개만 수집되어 해당 리뷰만 문서에 포함했습니다.`
- DOCX structural check confirmed `reviews_해화로in수산.docx` contains 80 `[리뷰 n]` headings and owner reply lines.
- `npm run typecheck`: passed.
- `npm test -- naverPlaceRenderedProvider.test.ts naverPlaceRenderedCollectionProvider.test.ts storeRegistrationPage.test.ts`: passed, 3 files / 27 tests.
- `npm test`: passed, 34 files / 141 tests plus 3 skipped live files / 6 skipped tests.
- `npm run naver:verify`: passed, 2 live files / 3 tests.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.

## RAG-INFO-METADATA-002 Commands

Run from `poc-server/`:

```bash
npm test -- ragDocumentBuilders.test.ts
npm run rag:export -- --storeId=store_1824807602
npm run typecheck
npm test
npm run demo:store-learning
npm run demo
```

## RAG-INFO-METADATA-002 TDD Evidence

- RED `npm test -- ragDocumentBuilders.test.ts`: failed because `storeInfoRagBuilder` ignored scalar Place metadata fields such as `openTime`, `closeTime`, `breakStart`, `breakEnd`, `placeImageUrls`, and `reviewStats.visitorTextReviewCount`, and would include noisy non-photo URLs if `placeImageUrls` contained old snapshots.
- GREEN `npm test -- ragDocumentBuilders.test.ts`: passed after adding scalar operating-hour fallbacks, break-time output, filtered Place photo summary output, and the correct text-review count field mapping.

## RAG-INFO-METADATA-002 Final Validation

- `npm test -- ragDocumentBuilders.test.ts`: passed, 1 file / 4 tests.
- `npm run rag:export -- --storeId=store_1824807602`: passed and regenerated `info_해화로in수산.docx` plus `reviews_해화로in수산.docx`.
- DOCX structural check confirmed the regenerated info document now includes `운영시간: 11:20 ~ 23:30`, `브레이크타임: 14:30 ~ 16:30`, `주차 가능 여부: 인근 유료 주차 가능`, `매장 사진 수: 100개`, menu image URLs, and `텍스트 리뷰 수: 1758`; `icon_default_profile` and `blog.naver.com` noise were absent.
- `npm run typecheck`: passed.
- `npm test`: passed, 34 files / 138 tests plus 3 skipped live files / 6 skipped tests.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.

## RAG-DOCS-001 Commands

Run from `poc-server/`:

```bash
npm test -- ragReviewSampler.test.ts ragDocumentBuilders.test.ts
npm test -- ragDocxWriter.test.ts ragDocumentApi.test.ts
npm test -- naverPlaceRenderedCollectionProvider.test.ts
npm run typecheck
npm test -- ragReviewSampler.test.ts ragDocumentBuilders.test.ts ragDocxWriter.test.ts ragDocumentApi.test.ts naverPlaceRenderedCollectionProvider.test.ts
npm test
npm audit --omit=dev --json
npm run db:migrate
npm run db:seed
npm run rag:export -- --storeId=store_demo_cake
npm run rag:export -- --storeId=store_1824807602
npm run demo:store-learning
npm run demo
```

DOCX visual QA from repo root:

```bash
/Users/1004182/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  /Users/1004182/.codex/plugins/cache/openai-primary-runtime/documents/26.601.10930/skills/documents/render_docx.py \
  poc-server/data/rag-documents/store_demo_cake/info_분당_케이크하우스.docx \
  --output_dir /tmp/rag-info-render

/Users/1004182/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  /Users/1004182/.codex/plugins/cache/openai-primary-runtime/documents/26.601.10930/skills/documents/render_docx.py \
  poc-server/data/rag-documents/store_demo_cake/reviews_분당_케이크하우스.docx \
  --output_dir /tmp/rag-reviews-render
```

## RAG-DOCS-001 TDD Evidence

- RED `npm test -- ragReviewSampler.test.ts ragDocumentBuilders.test.ts`: failed because `reviewSampler`, `storeInfoRagBuilder`, and `reviewRagBuilder` did not exist.
- GREEN `npm test -- ragReviewSampler.test.ts ragDocumentBuilders.test.ts`: passed after adding Zod document models, persisted Place metadata mapping, review sorting, owner reply mapping, deterministic review sampling, and nested-object-safe text extraction.
- RED `npm test -- ragDocxWriter.test.ts ragDocumentApi.test.ts`: failed because `docxWriter` and `ragDocuments` routes did not exist.
- GREEN `npm test -- ragDocxWriter.test.ts ragDocumentApi.test.ts`: passed after adding DOCX writer, document service, API routes, runtime manifest storage, and public API manifest shaping that hides server filesystem paths.
- RED `npm test -- ragDocumentApi.test.ts`: failed because `refreshReviews=true` was rejected instead of creating a RAG-specific review collection run.
- GREEN `npm test -- ragDocumentApi.test.ts`: passed after adding RAG review refresh that persists 100 mock Place reviews and generates DOCX files from that refreshed run.
- RED `npm test -- naverPlaceRenderedCollectionProvider.test.ts`: failed because rendered Place review collection stopped after the first rendered snapshot.
- GREEN `npm test -- naverPlaceRenderedCollectionProvider.test.ts`: passed after adding next-review batch discovery and collection until the requested limit is reached.

## RAG-DOCS-001 Final Validation

- `npm run typecheck`: passed.
- `npm test -- ragReviewSampler.test.ts ragDocumentBuilders.test.ts ragDocxWriter.test.ts ragDocumentApi.test.ts naverPlaceRenderedCollectionProvider.test.ts`: passed, 5 files / 15 tests.
- `npm test`: passed, 34 files / 136 tests plus 3 skipped live files / 6 skipped tests.
- `npm audit --omit=dev --json`: passed, 0 production vulnerabilities.
- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run rag:export -- --storeId=store_demo_cake`: passed and generated:
  - `poc-server/data/rag-documents/store_demo_cake/info_분당_케이크하우스.docx`
  - `poc-server/data/rag-documents/store_demo_cake/reviews_분당_케이크하우스.docx`
  - `poc-server/data/rag-documents/store_demo_cake/manifest.json`
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- DOCX structural check: `unzip -p ... word/document.xml` confirmed info title text and review/owner-reply text are inside the generated DOCX files.
- `npm run rag:export -- --storeId=store_1824807602`: passed for `해화로in수산`; the generated `info_해화로in수산.docx` did not contain `[object Object]`.
- DOCX visual render QA: rendered the generated info and reviews DOCX files to PNG pages. Checked info page 1, reviews page 1, reviews page 7, and reviews page 14; no text overlap, clipping, or blank-page issue was observed.

## PLACE-METADATA-UI-001 Commands

Run from `poc-server/`:

```bash
npm test -- storeRegistrationPage.test.ts
npm test -- storeRegistrationPage.test.ts staticWebConnectivity.test.ts
npm run typecheck
npm test
npm run naver:verify
npm run demo:store-learning
npm run demo
```

## PLACE-METADATA-UI-001 TDD Evidence

- RED `npm test -- storeRegistrationPage.test.ts`: failed because `store_raw_data.html` / `store_raw_data.js` did not exist, `soho_store_register.js` did not render saved Place metadata sections, and `soho_store_register.html` did not expose metadata/menu hooks.
- GREEN `npm test -- storeRegistrationPage.test.ts staticWebConnectivity.test.ts`: passed after adding the RAW viewer, RAW button, saved Place metadata section, menu section, menu toggle hooks, and server-API-only browser wiring.

## PLACE-METADATA-UI-001 Final Validation

- `npm run typecheck`: passed.
- `npm test`: passed, 30 files / 124 tests plus 3 skipped live files / 6 skipped tests.
- `npm run naver:verify`: passed, 2 files / 3 live tests.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- In-app Browser smoke on `http://localhost:5177/soho_store_register.html?qa=place-metadata`: saved Place metadata rendered without console errors; RAW data button opened `store_raw_data.html?storeId=store_1495790737&section=naverPlaceParsed`; RAW viewer displayed Parsed data / Snapshot / Full metadata tabs and formatted JSON.
- Playwright smoke on `http://localhost:5177/soho_store_register.html?qa=place-metadata-playwright` with `https://m.place.naver.com/place/1824807602/home`: imported `해화로in수산`, showed Instagram link, facilities, booking URL, review stats, broadcast info, keywords, menu count `55개`, 2 menu images, 5 menu rows by default, `메뉴 전체보기`, and after toggle 55 menu rows plus `접기`.
- Playwright RAW viewer smoke on `http://localhost:5177/store_raw_data.html?storeId=store_1824807602&section=naverPlaceParsed`: displayed `Store RAW data`, active `Parsed data`, no error state, and JSON containing saved Place data including booking metadata.

## PLACE-ENRICHMENT-001 Commands

Run from `poc-server/`:

```bash
npm test -- storeRegistrationApi.test.ts naverPlaceRenderedProvider.test.ts storeRegistrationPage.test.ts
npm run typecheck
npm test
npm run naver:verify
npm run demo:store-learning
npm run demo
```

## PLACE-ENRICHMENT-001 TDD Evidence

- RED `npm test -- naverPlaceRenderedProvider.test.ts`: failed after adding open/close time, break time, closed days, parking, homepage/social, menu, broadcast, keyword, booking, and parsed snapshot expectations.
- GREEN `npm test -- naverPlaceRenderedProvider.test.ts`: passed after adding normalized Place enrichment parsing and `naverPlaceSnapshot` / `naverPlaceParsed` metadata.
- RED `npm test -- storeRegistrationPage.test.ts`: failed after adding expected `naverPlaceParsed` field mappings and autofill group hooks.
- GREEN `npm test -- storeRegistrationPage.test.ts`: passed after wiring `soho_store_register.js` to saved parsed metadata and adding `data-autofill-group` hooks.
- GREEN `npm test -- storeRegistrationApi.test.ts naverPlaceRenderedProvider.test.ts storeRegistrationPage.test.ts`: passed and covered no-refetch reads after import.

## PLACE-ENRICHMENT-001 Final Validation

- `npm run typecheck`: passed.
- `npm test`: passed, 30 files / 121 tests plus 3 skipped live files / 6 skipped tests.
- `npm run naver:verify`: passed, 2 files / 3 live tests.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- Contract covered by test: `POST /api/stores/import-place` called the fake rendered provider once, then `GET /api/stores/store_1838952735` returned the stored SQLite record without another provider call.
- Manual API smoke on the running local server: `POST /api/stores/import-place` with `https://m.place.naver.com/place/1824807602/home` returned `store.name=해화로in수산`, phone `0507-1359-5863`, address `서울 광진구 광나루로 383 1,2층`, open/close `11:20~23:30`, break `14:30~16:30`, parking `near`, homepage `https://www.instagram.com/forebus_jubong`, menu/image metadata, review stats, broadcast info, keywords, booking URL, and saved `naverPlaceSnapshot` / `naverPlaceParsed` metadata.
- Manual browser smoke on `http://127.0.0.1:5177/soho_store_register.html`: entering `https://m.place.naver.com/place/1824807602/home` and clicking `불러오기` populated the existing form with name, category, phone, address, operating hours, break time, parking note, owner intro plus `(AI요약정보)`, and autofill visual states for imported fields.

## PLACE-INTRO-001 Commands

Run from `poc-server/`:

```bash
npm test -- naverPlaceRenderedProvider.test.ts
npm run typecheck
npm test
npm run naver:verify
npm run demo:store-learning
npm run demo
```

## PLACE-INTRO-001 TDD Evidence

- RED `npm test -- naverPlaceRenderedProvider.test.ts`: failed because the parser treated `microReviews` as the store description and did not expose `placeIntro`, `aiSummary`, or `descriptionSource`.
- GREEN `npm test -- naverPlaceRenderedProvider.test.ts`: passed after extracting Apollo `placeDetail(...).description(...)`, composing `소개 원문 + (AI요약정보) ...`, and persisting both raw values in metadata.
- RED `npm test -- naverPlaceRenderedProvider.test.ts`: failed after adding renderer-layer fallback coverage because `renderNaverPlacePageWithRenderers` did not exist yet.
- GREEN `npm test -- naverPlaceRenderedProvider.test.ts`: passed after adding renderer-layer fallback for restricted/empty/error snapshots.

## PLACE-INTRO-001 Final Validation

- Live root-cause check for `https://m.place.naver.com/place/1495790737/home`: Naver returned `PlaceDetailBase.microReviews[0]=신선함과 두툼함이 살아있는 회의 정석`, while the owner-written intro was found at `ROOT_QUERY.placeDetail(...).description({"source":["shopWindow"]})`.
- `npm run typecheck`: passed.
- `npm test`: passed, 30 files / 118 tests plus 3 skipped live files / 6 skipped tests.
- `npm run naver:verify`: passed, 2 files / 3 live tests.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- Direct provider smoke with `NAVER_OWNER_AUTHORIZED=true NAVER_PLACE_PROVIDER=rendered` and `https://m.place.naver.com/place/1495790737/home` returned:
  - `store.name=막내회집 본점`
  - `category=생선회`
  - `address=서울 중구 남대문시장2가길 2 2층`
  - `phone=02-755-5115`
  - `description=회전문점 막내횟집(본점)입니다...` followed by `(AI요약정보) 신선함과 두툼함이 살아있는 회의 정석`
  - metadata `descriptionSource=place_intro_with_ai_summary`, `visitorReviewCount=1173`, `blogReviewCount=746`
- Manual API smoke on `PORT=5177 npm run dev`: `POST /api/stores/import-place` with `https://m.place.naver.com/place/1495790737/home` returned the same composed description and metadata through the store registration API.
- Manual API smoke on `PORT=5177 npm run dev`: `POST /api/stores/import-place` with `https://m.place.naver.com/place/1824807602/home` returned `store.name=해화로in수산`, `descriptionSource=place_intro_with_ai_summary`, `visitorReviewCount=1852`, and `blogReviewCount=430`.

## TRAINING-SOURCE-001 Commands

Run from `poc-server/`:

```bash
npm test -- trainingSettingsApi.test.ts trainingSettingsPage.test.ts naverBlogRenderedCollectionProvider.test.ts
npm run typecheck
npm test
npm run naver:verify
npm run demo:store-learning
npm run demo
```

## TRAINING-SOURCE-001 TDD Evidence

- RED `npm test -- trainingSettingsApi.test.ts trainingSettingsPage.test.ts naverBlogRenderedCollectionProvider.test.ts`: failed because training settings did not preserve `sourceUrl`, did not create a `blog` store channel for newly imported stores, did not include Daangn settings in collection run summaries, and the onboarding page did not expose `최근 1개` / `최근 10개` options for all requested channels.
- GREEN `npm test -- trainingSettingsApi.test.ts trainingSettingsPage.test.ts naverBlogRenderedCollectionProvider.test.ts`: passed after syncing training source URLs into `store_channels`, adding Daangn settings persistence, and adding the requested small-count options.

## TRAINING-SOURCE-001 Final Validation

- Root cause confirmed in local DB: latest real collection run had `blog post failed=50` with metadata reason `store_missing_naver_blog_url`, while Place had collected visitor reviews.
- `npm run typecheck`: passed.
- `npm test`: passed, 30 files / 116 tests plus 3 skipped live files / 6 skipped tests.
- `npm run naver:verify`: passed, 2 files / 3 live tests.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- Manual API smoke on `PORT=5177 npm run dev`:
  - Saved `https://blog.naver.com/jasengblog/224253201649` through `PUT /api/stores/store_1824807602/training-settings`.
  - `GET /api/stores/store_1824807602` returned `store_channels.blog.sourceUrl=https://blog.naver.com/jasengblog/224253201649`.
  - Started a collection run with `blogPostLimit=1` and `placeReviewLimit=1`.
  - Final run status `completed`; collected counts `blogPosts=1`, `placeProfiles=1`, `placeReviews=1`.
  - Blog item title `어깨 통증 생기면 의심해봐야 할 질환 4가지`, body length `2952`.
- Browser smoke on `http://localhost:5177/03_AI학습_온보딩.html?storeId=store_1824807602`:
  - Page identity: `AI 학습 설정`.
  - Not blank: existing training settings form rendered.
  - Framework overlay: none detected.
  - Console errors/warnings: none detected.
  - Blog, Place, Instagram, and Daangn controls showed `최근 1개` and `최근 10개`.
  - Saved Blog URL and Place URL were reloaded into the page.

## STORE-PLACE-SHORTURL-001 Commands

Run from `poc-server/`:

```bash
npm test -- naverPlaceRenderedProvider.test.ts storeRegistrationPage.test.ts
npm run typecheck
npm test
npm run naver:verify
npm run demo:store-learning
npm run demo
```

## STORE-PLACE-SHORTURL-001 TDD Evidence

- RED `npm test -- naverPlaceRenderedProvider.test.ts storeRegistrationPage.test.ts`: failed because a `naver.me` URL that redirected to `m.map.naver.com/appLink.naver?...pinId=1824807602` was parsed as a non-Place shell instead of re-rendering the real Place detail URL, and the registration page did not expose button loading hooks.
- GREEN `npm test -- naverPlaceRenderedProvider.test.ts storeRegistrationPage.test.ts`: passed after resolving app-link IDs to mobile Place detail URLs, adding button-level loading state, and preserving imported categories that are not in the static industry list.

## STORE-PLACE-SHORTURL-001 Final Validation

- `npm run typecheck`: passed.
- `npm test`: passed, 30 files / 115 tests plus 3 skipped live files / 6 skipped tests.
- `npm run naver:verify`: passed, 2 files / 3 live tests.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- Manual API smoke on `PORT=5177 npm run dev`: `POST /api/stores/import-place` with `https://naver.me/xUwCQUxv` returned `provider.name=naverPlaceRenderedProvider`, `store.id=store_1824807602`, `store.name=해화로in수산`, category `생선회`, address `서울 광진구 광나루로 383 1,2층`, phone `0507-1359-5863`, and saved Place URL `https://m.place.naver.com/place/1824807602/home`.
- Browser smoke on `http://localhost:5177/soho_store_register.html`:
  - Page identity: `매장 정보 등록`.
  - Not blank: existing registration form rendered.
  - Framework overlay: none detected.
  - Console errors/warnings: none detected.
  - Interaction proof: entering `https://naver.me/xUwCQUxv` and clicking `불러오기` set the button to disabled with `aria-busy=true`, displayed a `.spinner` and `불러오는 중`, then restored `불러오기`.
  - Final field state: Place URL `https://m.place.naver.com/place/1824807602/home`, 업종 `불러온 업종: 생선회`, 매장명 `해화로in수산`, 연락처 `0507-1359-5863`, 주소 `서울 광진구 광나루로 383 1,2층`.

## LEARNING-CTA-001 Commands

Run from `poc-server/`:

```bash
npm test -- learningStatusPage.test.ts
npm run typecheck
npm test
```

## LEARNING-CTA-001 TDD Evidence

- RED `npm test -- learningStatusPage.test.ts`: failed because `06_AI학습_현황.html` did not expose `learning-ruleset-alert`, `learning-ruleset-alert-link`, or `learning-ruleset-card`, and `learning_status.js` did not route to `07_마케팅전략룰셋.html`.
- GREEN `npm test -- learningStatusPage.test.ts`: passed after adding the ruleset completion alert, clickable ruleset status card, and page-specific navigation wiring.

## LEARNING-CTA-001 Browser Smoke

- URL: `http://localhost:5177/06_AI학습_현황.html?storeId=store_demo_cake&analysisRunId=analysis_run_demo_store_learning`
- Page identity: loaded `06_AI학습_현황.html`.
- Not blank: `AI 학습 현황` was present.
- Framework overlay: none detected.
- Console errors/warnings: none detected.
- Alert CTA: `룰셋 생성이 완료되었습니다.` displayed, with `룰셋 보러가기` targeting `07_마케팅전략룰셋.html?storeId=store_demo_cake&analysisRunId=analysis_run_demo_store_learning`.
- Interaction proof:
  - Clicking `룰셋 보러가기` navigated to `07_마케팅전략룰셋.html`.
  - Clicking the `룰셋 상태 ✓ 생성 완료` KPI card also navigated to `07_마케팅전략룰셋.html`.
- Screenshot capture note: Browser CDP `Page.captureScreenshot` timed out in this session, so visual proof used DOM state plus interaction navigation.

## NAVER-LIVE-001 Commands

Run from `poc-server/`:

```bash
npm run typecheck
npm test -- naverPlaceRenderedProvider.test.ts naverPlaceRenderedCollectionProvider.test.ts naverBlogRenderedCollectionProvider.test.ts
npm run naver:verify
```

Before the fix, local live verification passed only by detecting Naver restriction/fallback states:

- Place profile: restriction-page handling verified, no successful live profile import.
- Place visitor reviews: restriction-page handling verified, no successful live review item collection.
- Blog body: `NAVER_LIVE_BLOG_URL` was unset, so live Blog body verification was skipped.

## NAVER-LIVE-001 TDD Evidence

- RED `npm test -- naverPlaceRenderedProvider.test.ts naverPlaceRenderedCollectionProvider.test.ts naverBlogRenderedCollectionProvider.test.ts`: failed after adding Apollo state and direct Blog body expectations because profile images and Blog body extraction did not yet support the live mobile HTML structure.
- GREEN `npm test -- naverPlaceRenderedProvider.test.ts naverPlaceRenderedCollectionProvider.test.ts naverBlogRenderedCollectionProvider.test.ts`: passed after adding Apollo state parsing, visible-text restriction detection, and nested Blog body extraction.
- GREEN direct provider smoke:
  - `importNaverPlaceUrl("https://m.place.naver.com/restaurant/1838952735/home")` returned `해방식당`, `한식`, road address, phone, rating, and review counts through `naverPlaceRenderedProvider`.
  - `createNaverBlogRenderedCollectionProvider()` collected the supplied Blog URL body with title `어깨 통증 생기면 의심해봐야 할 질환 4가지` and a body length over 2,900 characters.

## NAVER-LIVE-001 Final Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test -- naverPlaceRenderedProvider.test.ts naverPlaceRenderedCollectionProvider.test.ts naverBlogRenderedCollectionProvider.test.ts`: passed, 3 files / 12 tests.
- `npm run naver:verify`: passed, 2 files / 3 live tests.
  - Place live profile import succeeded through mobile HTML/Apollo state.
  - Place live visitor review collection succeeded through mobile HTML/Apollo state.
  - Blog live body collection used the supplied default URL and succeeded without requiring `NAVER_LIVE_BLOG_URL`.
- `npm test`: passed, 30 files / 113 tests plus 3 skipped live files / 6 skipped tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- Manual server smoke on `PORT=5177 npm run dev`: `POST /api/stores/import-place` with `https://m.place.naver.com/restaurant/1838952735/home` returned `provider.name=naverPlaceRenderedProvider`, `store.name=해방식당`, road address, phone, rating `4.69`, and visitor review count `1680`.

## NAVER-BLOG-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run naver:verify
npm run demo
npm run demo:store-learning
npm audit --omit=dev --json
```

## NAVER-BLOG-001 TDD Evidence

- RED `npm test -- naverBlogRenderedCollectionProvider.test.ts`: failed because `naverBlogRenderedCollectionProvider` did not exist.
- GREEN `npm test -- naverBlogRenderedCollectionProvider.test.ts providerReadinessApi.test.ts`: passed after adding rendered Blog URL parsing, full-body collection, collection provider selection, and readiness updates.
- GREEN `npm run typecheck && npm test -- collectionProgressApi.test.ts naverPlaceRenderedCollectionProvider.test.ts naverBlogRenderedCollectionProvider.test.ts providerReadinessApi.test.ts`: passed, 4 files / 14 tests.
- GREEN `npm test -- naverBlogLiveIntegration.test.ts naverBlogRenderedCollectionProvider.test.ts`: passed with the live Blog test skipped by default.
- GREEN `npm run naver:verify`: passed. Place live checks verified Naver restriction handling; Blog live check reported that `NAVER_LIVE_BLOG_URL` was not configured.

## NAVER-BLOG-001 Expected Live Verification

- `npm run naver:verify` now runs both Place and Blog live verification files.
- Set `NAVER_LIVE_BLOG_URL` to an owner-authorized Naver Blog URL to perform live Blog body verification.
- If Naver returns a restriction page, the command should pass by verifying restriction handling.
- If Naver allows the rendered request, the command expects:
  - Blog collection provider `naverBlogRenderedCollectionProvider`.
  - Blog post drafts with `sourceType=post`.
  - Blog metadata including `providerMode=real`.
  - Non-empty body text for collectible posts.

## NAVER-BLOG-001 Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 30 files / 111 tests plus 3 skipped live files / 6 skipped tests.
- `npm run naver:verify`: passed.
  - Place live checks verified current Naver restriction-page handling.
  - Blog live check reported that `NAVER_LIVE_BLOG_URL` was not configured.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- `npm audit --omit=dev --json`: passed with 0 vulnerabilities.

## NAVER-REVIEW-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run naver:verify
npm run demo
npm run demo:store-learning
npm audit --omit=dev --json
```

## NAVER-REVIEW-001 TDD Evidence

- RED `npm test -- naverPlaceRenderedCollectionProvider.test.ts`: failed because `naverPlaceRenderedCollectionProvider` did not exist.
- GREEN `npm test -- naverPlaceRenderedCollectionProvider.test.ts providerReadinessApi.test.ts`: passed after adding rendered visitor review parsing, collection provider selection, and readiness updates.
- GREEN `npm test -- naverPlaceLiveIntegration.test.ts naverPlaceRenderedCollectionProvider.test.ts`: passed with live tests skipped by default.
- GREEN `npm run typecheck`: passed.
- GREEN `npm test -- collectionProgressApi.test.ts providerReadinessApi.test.ts naverPlaceRenderedCollectionProvider.test.ts`: passed, 3 files / 10 tests.

## NAVER-REVIEW-001 Expected Live Verification

- `npm run naver:verify` is opt-in and may use Playwright.
- If Naver returns the current restriction page, the command should pass by verifying restriction handling.
- If Naver allows the rendered request, the command expects:
  - Place import provider `naverPlaceRenderedProvider`.
  - Visitor review collection provider `naverPlaceRenderedCollectionProvider`.
  - Review drafts with `sourceType=review`.
  - Review metadata including `providerMode=real`.

## NAVER-REVIEW-001 Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 29 files / 107 tests plus 2 skipped live files / 5 skipped tests.
- `npm run naver:verify`: passed.
  - Current environment result:
    - Naver returned restriction pages for both rendered Place profile and rendered visitor review requests.
    - The provider detected the restrictions and did not save restricted HTML as successful data.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- `npm audit --omit=dev --json`: passed with 0 vulnerabilities.

## NAVER-PLACE-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run naver:verify
npm run demo
npm run demo:store-learning
```

## NAVER-PLACE-001 TDD Evidence

- RED `npm test -- naverPlaceRenderedProvider.test.ts`: failed because `naverPlaceRenderedProvider` did not exist.
- GREEN `npm test -- naverPlaceRenderedProvider.test.ts`: passed after adding the rendered profile parser/provider and API route coverage.
- RED `npm test -- naverPlaceRenderedProvider.test.ts`: failed for the Naver restriction-page case because partial metadata was being accepted as a successful import.
- GREEN `npm test -- naverPlaceRenderedProvider.test.ts`: passed after restriction-page detection was added.
- GREEN `npm test -- providerReadinessApi.test.ts storeRegistrationApi.test.ts naverPlaceRenderedProvider.test.ts`: passed, 3 files / 11 tests.
- GREEN `npm run typecheck`: passed.

## NAVER-PLACE-001 Live Verification

- `npm run naver:verify`: passed.
- Current environment result:
  - Playwright reached the live Naver Place URL.
  - Naver returned a restriction page for the current IP/request pattern.
  - The provider detected the restriction and did not persist partial metadata as a successful import.

Expected command output includes:

```text
Naver Place live rendered request was restricted by Naver; restriction handling verified.
```

For a successful unrestricted live import, the same test expects:

```text
provider.name => naverPlaceRenderedProvider
store.name => non-empty and not parser fallback
store.address => non-empty
metadata.bodyAvailability => rendered_place_profile
metadata.sourceKind => place_profile
```

## NAVER-PLACE-001 Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 28 files / 104 tests plus 2 skipped live files / 4 skipped tests.
- `npm run naver:verify`: passed by verifying current Naver restriction-page handling.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.

## OWNER-SOURCE-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run demo
npm run demo:store-learning
```

## OWNER-SOURCE-001 TDD Evidence

- RED `npm test -- storeRegistrationApi.test.ts providerReadinessApi.test.ts collectionProgressApi.test.ts`: failed because:
  - explicit `NAVER_PLACE_PROVIDER=official_search` still returned `mockPlaceProvider`;
  - readiness did not expose `ownerSourcePolicy`;
  - collection run summaries did not include `sourcePolicy`.
- GREEN `npm test -- storeRegistrationApi.test.ts providerReadinessApi.test.ts collectionProgressApi.test.ts`: passed, 3 files / 11 tests.
- GREEN `npm run typecheck`: passed.

## OWNER-SOURCE-001 Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: first run failed in `trainingSettingsApi.test.ts` because the old assertion did not include the new `summary.sourcePolicy`.
- Minimal validation fix: updated that test to assert the default mock source policy.
- `npm test`: passed, 27 files / 100 tests plus 1 skipped live OpenAI file / 3 skipped tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.

## OWNER-SOURCE-001 Manual Smoke Notes

No frontend behavior changed in this step.

Expected readiness shape for future rendered/page adapters:

```text
NAVER_OWNER_AUTHORIZED=true
NAVER_PLACE_PROVIDER=rendered
NAVER_BLOG_PROVIDER=page

ownerSourcePolicy.ownerAuthorized => true
ownerSourcePolicy.placeProvider => rendered
ownerSourcePolicy.blogProvider => page
providers.placeImport.selectedProvider => naverPlaceRenderedProvider
providers.placeImport.status => ready
providers.collection.status => fallback_required
```

Expected collection item metadata after a mock owner-authorized run:

```text
metadata.ownerAuthorized => true
metadata.sourceKind => owner_blog_post | place_profile | place_visitor_review
metadata.sourceOwnership => owner_managed | user_generated
metadata.configuredPlaceProvider/configuredBlogProvider => selected env provider
metadata.bodyAvailability => mock_body | provider_body | metadata_only | unavailable
```

## OPS-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm run openai:verify
npm run typecheck
npm test
npm run demo
npm run demo:store-learning
```

Manual smoke:

```bash
PORT=5178 npm run dev
curl http://localhost:5178/api/store-learning/provider-readiness
```

## Expected Coverage

- `npm run db:migrate` keeps the Store Learning SQLite schema available.
- `npm run db:seed` keeps the demo store path available without external keys.
- `npm run openai:verify` performs opt-in live OpenAI verification when `poc-server/.env` has `OPENAI_API_KEY`.
- `npm run typecheck` verifies readiness types and route mounting.
- `npm test` runs existing Event-to-Operation tests plus Store Learning API/page tests.
- `npm run demo` verifies the old Event-to-Operation demo remains behaviorally unchanged.
- `npm run demo:store-learning` verifies the Store Learning demo still works in mock mode.

## TDD Evidence

- RED `npm test -- providerReadinessApi.test.ts`: failed because the readiness service and route did not exist.
- GREEN `npm test -- providerReadinessApi.test.ts`: passed, 1 file / 3 tests.
- GREEN `npm run typecheck`: passed.

## Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run openai:verify`: passed, 1 file / 3 live OpenAI tests.
- `npm run typecheck`: passed.
- `npm test`: passed, 27 files / 97 tests plus 1 skipped live OpenAI file / 3 skipped tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.

## OpenAI Live Integration Validation

- `npm test -- openaiLiveIntegration.test.ts` without live flag: passed with 3 skipped tests.
- `npm run openai:verify`: passed in about 30 seconds.
- Runtime probe: passed with `OpenAI model access verified`.
- Analysis provider: completed and persisted validated artifacts.
- Blog provider: generated an approval-pending post through `openAIBlogProvider`.
- SEO provider: rescored the generated post and returned the expected itemized rubric keys.
- Secrets were not printed.

## Manual Smoke Result

Smoke server:

```bash
PORT=5178 npm run dev
```

Observed API smoke in default mock mode:

```text
GET /api/store-learning/provider-readiness
  productFlow => Store Learning & Blog Content Automation PoC
  mode => mock
  openaiConfigured => false
  naverSearchConfigured => false
  placeImport => mockPlaceProvider
  collection => mockCollectionProvider
  analysis => mockDeterministicAnalyzer
  blogGeneration => mock_ruleset_blog_generator
  imageGenerationStatus => placeholder_only
  publishingStatus => local_status_only
  fallbackCapabilities => full_blog_body, place_reviews, full_place_body
```

Observed API smoke with local OpenAI key configured:

```text
GET /api/store-learning/provider-readiness
  mode => real_configured
  openaiConfigured => true
  naverSearchConfigured => false
  analysisProvider => openAIAnalysisProvider
  analysisStatus => ready
  blogProvider => openAIBlogProvider
  blogStatus => ready
  collectionProvider => mockCollectionProvider
  collectionStatus => mock_ready
  imageStatus => placeholder_only
  publishingStatus => local_status_only
```

## Manual Smoke Checklist

Default mock mode:

- `GET /api/store-learning/provider-readiness` should work without external keys.
- Response should include `productFlow = Store Learning & Blog Content Automation PoC`.
- Response should include `mode = mock`.
- Response should not include secret values.
- Provider entries should show mock/placeholder/local status only.

Credentialed readiness mode:

- Set `OPENAI_API_KEY`.
- Optionally set `OPENAI_MODEL`.
- Set `NAVER_CLIENT_ID` and `NAVER_CLIENT_SECRET`.
- Set `STORE_LEARNING_MOCK_MODE=false`.
- `GET /api/store-learning/provider-readiness` should report:
  - `naverLocalSearchProvider` ready for Place import.
  - `naverSearchCollectionProvider` partial_ready for official search collection.
  - `openAIAnalysisProvider` ready for analysis.
  - `openAIBlogProvider` ready for blog generation.
  - fallback_required for full blog body and Place reviews.

## Boundaries

- Browser pages still call poc-server APIs only.
- OpenAI/Naver credentials stay server-side.
- Mock mode still works without external keys.
- Readiness does not perform live provider calls.
- Image generation remains placeholder-only.
- Naver Blog publishing remains local status transition only.
- Naver full body/review limitations are explicitly surfaced.
- Existing Event-to-Operation workflows should remain behaviorally unchanged.
- `admin/` and `pc-web/` should remain unchanged.
- The generated local SQLite file is under ignored `poc-server/data/`.

## RAG Document UI Hook Validation

TDD evidence:

- RED `npm test -- storeRegistrationPage.test.ts`: failed because `soho_store_register.html` did not expose `rag-generate-button`, `rag-doc-status`, or RAG download links, and page JS did not call the RAG document APIs.
- GREEN `npm test -- storeRegistrationPage.test.ts`: passed, 1 file / 10 tests.
- GREEN `npm run typecheck`: passed.
- GREEN `npm test`: passed, 34 files / 136 tests, with 3 live integration files / 6 tests skipped by default.
- GREEN `npm run rag:export -- --storeId=store_demo_cake`: passed and generated info/reviews DOCX manifest.
- GREEN local server curl at `http://localhost:5177/soho_store_register.html`: page includes `rag-generate-button`, `rag-doc-status`, `rag-info-download`, and `rag-reviews-download`.
- GREEN local server curl at `GET /api/stores/store_demo_cake/rag-documents`: returned manifest download paths for info and reviews DOCX files.

Expected manual smoke:

- Open `http://localhost:5177/soho_store_register.html`.
- Load or import a Naver Place-backed store.
- In `네이버 플레이스 수집 정보`, click `RAG 문서 생성`.
- Confirm the button shows a loading state while the request is running.
- Confirm the status changes to generated and both DOCX download links appear.

## Upload Source Asset UI Validation

TDD evidence:

- RED `npm test -- storeRegistrationPage.test.ts`: failed because the upload section still contained `기존 자료 업로드` and did not expose Place image/RAG document upload-section hooks.
- GREEN `npm test -- storeRegistrationPage.test.ts`: passed, 1 file / 11 tests.
- GREEN `npm run typecheck`: passed.
- GREEN `npm test`: passed, 34 files / 137 tests, with 3 live integration files / 6 tests skipped by default.

Manual browser smoke at `http://localhost:5177/soho_store_register.html?qa=upload-assets-smoke`:

- Store loaded: `막내회집 본점`.
- Upload section title displayed: `자료 업로드`.
- Old title `기존 자료 업로드` was not visible.
- Place photo source panel displayed 4 images.
- Place menu image source panel displayed 4 images.
- RAG generated document links displayed:
  - `/api/stores/store_1495790737/rag-documents/info/download`
  - `/api/stores/store_1495790737/rag-documents/reviews/download`
- Browser automation could not complete a physical thumbnail click because the in-app browser action timed out on the offscreen thumbnail selector. Static tests cover the image viewer hook, and the rendered thumbnail/button count was verified.

## Place Photo Normalization Validation

Root cause:

- Saved `metadata.naverPlaceParsed.placeImageUrls` included non-store-photo URLs because the rendered Place provider collected image-like fields across the whole Apollo state.
- The stored list could include `icon_default_profile.png`, wrapped `search.pstatic.net/common?...src=...` duplicates, blog/cafe links, TV thumbnails, and panorama thumbnails.
- The upload source panel showed the first four URLs directly, so a default profile image appeared as an 업체 제공 사진.

Fix validation:

- RED `npm test -- naverPlaceRenderedProvider.test.ts storeRegistrationPage.test.ts`: failed because the provider still returned default/profile/noise images and the page had no `normalizePlaceImageUrls` filtering.
- GREEN `npm test -- naverPlaceRenderedProvider.test.ts storeRegistrationPage.test.ts`: passed, 2 files / 19 tests.
- GREEN `npm run typecheck`: passed.
- GREEN `npm test`: passed, 34 files / 137 tests, with 3 live integration files / 6 tests skipped by default.
- Browser smoke on `막내회집 본점`: `#place-photo-source-images img` returned 4 unique `ldb-phinf.pstatic.net` URLs and `hasDefaultProfile = false`.

## Store Registration Business Hours Validation

Runtime note:

- This PoC is not validly testable from static GitHub Pages alone.
- `soho_store_register.html` depends on `poc-server` APIs and local SQLite state.
- Use `cd poc-server && npm run dev`, then open `http://localhost:5177/soho_store_register.html`.

Root cause:

- The main registration form and the day-specific business-hours modal could drift.
- Main-form changes did not always update `weeklyBusinessHours`.
- Day-specific differences could be hidden by showing a single representative open/close time.

Fix validation:

- RED `npm test -- storeRegistrationPage.test.ts -t "keeps main business hour"`: failed because the page had no business-hours sync warning or sync helpers.
- GREEN `npm test -- storeRegistrationPage.test.ts -t "keeps main business hour"`: passed.
- GREEN `npm run typecheck`: passed.
- GREEN `npm test`: passed, 34 files / 145 tests, with 3 live integration files / 6 tests skipped by default.
- GREEN `npm run demo:store-learning`: passed.
- GREEN `npm run demo`: passed.

Manual browser smoke at `http://localhost:5177/soho_store_register.html?qa=business-hours-sync`:

- Store loaded: `남대문명동정형외과의원`.
- Imported weekly business-hours metadata included 7 weekday rows.
- Because weekday hours differ, the main operating-hours and break-time fields showed `요일별 상이`.
- The red `*요일별 운영시간 설정 필요` message was visible.
- After setting every weekday to the same hours in the modal and saving, the main form showed the single shared hours and the warning disappeared.
- After editing the main form hours, reopening the modal showed the edited hours applied to every open weekday row.

## Branch Workflow Bootstrap Validation

Purpose:

- Establish `main` as the public/stable branch.
- Establish `develop` as the integration branch.
- Document that GitHub Pages is static UI only and cannot validate the API-backed SQLite runtime.

Expected checks:

- `git diff --check`
- `cd poc-server && npm run typecheck`
- `cd poc-server && npm test`

Manual verification:

- Confirm `docs/codex/GIT_WORKFLOW.md` exists.
- Confirm `docs/codex/CURRENT_TASK.md` exists.
- Confirm `AGENTS.md` points future feature work to `develop`.
- Confirm GitHub Pages source is `main` after branch setup.

## Milestone 11 Real Store E2E Hardening Validation

Date: 2026-06-10

Branch:

- `codex/real-store-e2e-hardening`

Focused validation:

```bash
cd poc-server
npm test -- naverPlaceRenderedProvider.test.ts storeRegistrationApi.test.ts trainingSettingsApi.test.ts trainingSettingsPage.test.ts collectionProgressApi.test.ts collectionProgressPage.test.ts selectionApi.test.ts selectionPage.test.ts learningStatusApi.test.ts learningStatusPage.test.ts rulesetApi.test.ts rulesetPage.test.ts staticWebConnectivity.test.ts
npm run typecheck
```

Result:

- PASS, 13 files / 92 tests.
- PASS, TypeScript typecheck.

Full local validation:

```bash
cd poc-server
npm test
npm run demo:store-learning
```

Result:

- PASS, 35 test files passed and 3 live-provider integration files skipped by
  default.
- PASS, 180 tests passed and 6 live-provider tests skipped by default.
- PASS, demo seed completed:
  - store: `분당 케이크하우스`
  - channels: 3
  - collectionItems: 4
  - blogPostStatus: `pending_approval`
  - seoScore: 86

Manual browser smoke:

```bash
cd poc-server
PORT=5178 STORE_LEARNING_MOCK_MODE=false NAVER_PLACE_PROVIDER=rendered NAVER_BLOG_PROVIDER=mock npm run dev
```

Port note:

- `npm run dev` on 5177 was already occupied, so the smoke used 5178.

Flow result:

- Opened `http://localhost:5178/soho_store_register.html`.
- Imported `https://m.place.naver.com/place/1020864025/home`.
- Registration created and carried `storeId=store_1020864025` into the learning
  settings query string.
- Learning settings showed saved Blog/Place URLs and detected
  Instagram/YouTube provider-ready channels.
- Collection progress showed Blog limit 10 immediately and displayed collected
  content review with pagination controls.
- Content selection remained the actual analysis-selection step.
- `분석 실행` showed staged progress and server-side analysis completed for
  `analysis_run_store_1020864025_1781065381395`.
- Learning status Blog rows used source-open links; missing mock-provider view
  counts displayed as `-`.
- Learning status Place tab showed collected facts, hospital `진료과목`, photo
  sections, real review metadata, hidden empty news, and review pagination.
- Place review expand showed 20 rows and paging advanced to
  `21-40 / 130개 표시`.
- `지금 재학습` created a new collection run and navigated with both `storeId`
  and `runId`.
- A new store without a ruleset displayed a safe ruleset empty state and
  previewed direct Place facts.

Boundary checks:

- `git diff --check`: PASS.
- `git diff --cached --name-only`: empty, nothing staged.
- `.DS_Store` remained unstaged and out of scope.
- No `admin/` changes.
- No `pc-web/` changes.
- No `README_POC.md` or `web/event_operation_poc.html` changes.
- Browser code calls `poc-server` APIs only, except user-clicked external source
  links that open in a new tab.
- Benchmark and preview behavior remains mock/provider-ready.

Follow-up validation for Place review partial collection:

```bash
cd poc-server
npm test -- naverPlaceRenderedCollectionProvider.test.ts collectionProgressPage.test.ts collectionProgressApi.test.ts
npm run typecheck
```

Result:

- PASS, 3 files / 18 tests.
- PASS, TypeScript typecheck.

Live provider probe:

- Input: `https://naver.me/xzH6Cf4S`
- Plan: Place reviews up to 50, no Blog/Profile.
- Result after fix:
  - total review items returned: 45
  - collected: 45
  - failed: 0
- Before fix, the same Place yielded only 7 collected reviews and failed
  placeholders for the rest.

Source-exhausted count/completion validation:

```bash
cd poc-server
npm test -- naverBlogRenderedCollectionProvider.test.ts -t "persists rendered Blog full bodies"
npm test -- collectionProgressPage.test.ts -t "source-exhausted"
npm test -- collectionProgressPage.test.ts collectionProgressApi.test.ts naverBlogRenderedCollectionProvider.test.ts naverPlaceRenderedCollectionProvider.test.ts
npm run typecheck
npm test
git diff --check
```

Result:

- PASS, rendered Blog provider now completes when requested limit is larger than
  discovered Blog posts and records `summary.availableCounts.blogPosts`.
- PASS, collection progress page has source-exhausted dashboard labels:
  `전체 블로그 수집 완료`, `전체 리뷰 수집 완료`, and
  `가져올 수 있는 모든 항목이 수집되었습니다.`
- PASS, full test suite: 35 files passed, 3 live-provider files skipped by
  default; 185 tests passed, 6 skipped.
- PASS, TypeScript typecheck.
- PASS, `git diff --check`.

## Milestone 12 Collection Delta And Relearning Skip Validation

Date: 2026-06-10

Branch:

- `codex/collection-delta-plan`

Focused validation:

```bash
cd poc-server
npm test -- collectionProgressApi.test.ts -t "collection delta"
npm test -- analysisExecutionApi.test.ts -t "no meaningful changes"
npm test -- collectionProgressPage.test.ts selectionPage.test.ts -t "no-change|reuse"
npm test -- learningStatusApi.test.ts learningStatusPage.test.ts selectionPage.test.ts -t "publication date|publication dates|Place dynamic"
npm test -- collectionProgressApi.test.ts analysisExecutionApi.test.ts selectionApi.test.ts collectionProgressPage.test.ts selectionPage.test.ts learningStatusApi.test.ts learningStatusPage.test.ts
npm run typecheck
```

Result:

- PASS, collection delta RED/GREEN: repeated identical collection records
  duplicate Blog/review items, unchanged Place profile, no new current-run
  items, and a saved profile fingerprint.
- PASS, no-op analysis RED/GREEN: empty selected items are accepted only for
  no-meaningful-change collection runs, and latest completed
  analysis/snapshot/ruleset artifacts are reused.
- PASS, browser contract tests for no-change collection messages, no-change
  selection/reuse behavior, Blog publication-date metadata, and 5 collapsed
  Place reviews.
- PASS, focused related suite: 7 files / 39 tests.
- PASS, TypeScript typecheck.

Full validation:

```bash
cd poc-server
npm test
npm run demo:store-learning
```

Result:

- PASS, full test suite: 35 files passed and 3 live-provider files skipped by
  default.
- PASS, 194 tests passed and 6 live-provider tests skipped by default.
- PASS, demo seed completed:
  - store: `분당 케이크하우스`
  - channels: 3
  - collectionItems: 4
  - blogPostStatus: `pending_approval`
  - seoScore: 86

Boundary checks:

- `.DS_Store` remained an existing local out-of-scope modification and was not
  staged.
- No `admin/` changes.
- No `pc-web/` changes.
- No `README_POC.md` or `web/event_operation_poc.html` changes.
- Browser code continues to call only `poc-server` APIs, except user-clicked
  external source/photo links that open in a new tab.

Ruleset UI CR addendum validation:

```bash
cd poc-server
npm test -- rulesetPage.test.ts
npm test -- staticWebConnectivity.test.ts rulesetPage.test.ts rulesetApi.test.ts analysisExecutionApi.test.ts blogGenerationApi.test.ts
npm run typecheck
npm test
npm run demo:store-learning
git diff --check
```

Result:

- PASS, ruleset page RED/GREEN coverage: 11 tests, including the writing-style
  medical required-copy controls and current-style plus AI-suggestion layout.
- PASS, related static/API/generation regression coverage: 60 tests across
  `staticWebConnectivity.test.ts`, `rulesetPage.test.ts`, `rulesetApi.test.ts`,
  `analysisExecutionApi.test.ts`, and `blogGenerationApi.test.ts`.
- PASS, TypeScript typecheck.
- PASS, full test suite: 35 files passed and 3 live-provider files skipped by
  default.
- PASS, 200 tests passed and 6 live-provider tests skipped by default.
- PASS, demo seed completed:
  - store: `분당 케이크하우스`
  - channels: 3
  - collectionItems: 4
  - blogPostStatus: `pending_approval`
  - seoScore: 86
- PASS, `git diff --check`.

Browser UI validation:

- URL:
  `http://localhost:5177/07_마케팅전략룰셋.html`
- Page identity loaded with title:
  `localhost:5177/07_마케팅전략룰셋.html`
- Store tab check:
  - `#sec-store [data-source-matrix-section]` count: 0
  - store tab text did not include `자동 입력 기준`
- Our-store-analysis tab check after clicking the tab:
  - reference title: `(공통예시) 포지셔닝 참고`
  - reference title color: `rgb(224, 49, 49)`
  - current healthcare-category context label: `대표 진료과목`
  - current reference key: `treatmentSubject`
- Writing-style tab check after clicking the tab:
  - `#sec-write [data-source-matrix-section="write_common,write_instagram,write_blog"]`
    count: 0
  - `#sec-write .ruleset-source-note` count: 0
  - current/suggestion layout count: 1
  - AI suggestion panel count: 13
  - visible text includes `현행유지`, `개선 제안`, and the medical-law footer
    reference text when the current healthcare store context is active.
- Browser console note:
  - The browser log buffer included one older `MutationObserver` error from
    `http://localhost:5177/` before the direct ruleset-page check. The direct
    DOM state for the ruleset page was verified after reload.

Blog SOP contract trim validation:

```bash
cd poc-server
npm test -- analysisPromptBudget.test.ts learningStatusPage.test.ts rulesetPage.test.ts rulesetApi.test.ts analysisExecutionApi.test.ts staticWebConnectivity.test.ts openAIBlogProviderBudget.test.ts
npm run typecheck
npm test
node --check ../web/ruleset_editor.js
node --check ../web/learning_status.js
git diff --check
npm run demo:store-learning
```

Result:

- PASS, focused RED/GREEN regression coverage: 7 files passed, 105 tests
  passed.
- PASS, TypeScript typecheck.
- PASS, full test suite: 40 files passed and 3 live-provider files skipped by
  default.
- PASS, 270 tests passed and 6 live-provider tests skipped by default.
- PASS, `node --check` for `web/ruleset_editor.js` and
  `web/learning_status.js`.
- PASS, `git diff --check`.
- PASS, demo seed completed:
  - store: `분당 케이크하우스`
  - channels: 3
  - collectionItems: 5
  - blogPostStatus: `pending_approval`
  - seoScore: 86

Playwright smoke:

- Browser plugin tool was not available in this turn, so regular Playwright was
  used against `http://localhost:5180`.
- Ruleset page:
  - top tabs: `매장 정보`, `우리 매장 분석`, `글쓰기 스타일`, `유사업체비교`
  - writing sub-tabs: `블로그`
  - `#sec-img`: absent
  - `#write-insta`: absent
  - visible `이미지 스타일` / writing-tab `인스타그램`: absent
  - writing preview channel: `블로그`
- Learning status page:
  - `#learning-last-analyzed`: `2026.06.06 02:08:53`
  - timestamp matched `YYYY.MM.DD HH:mm:ss`.
- Console errors/warnings: none captured during the smoke run.
