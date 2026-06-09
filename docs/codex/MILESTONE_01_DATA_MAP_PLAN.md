# Milestone 01 Data Map Audit Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the source-of-truth map for replacing Store Learning mock UI data with persisted Naver Place, collected Naver Blog, and AI analysis outputs.

**Architecture:** This milestone is documentation-only. It reads the current browser pages, `poc-server` API routes, repository models, and recent Naver provider PR scope, then records the dependency order for future implementation PRs.

**Tech Stack:** Static HTML/JavaScript in `web/`, Express API routes in `poc-server/src/storeLearning/routes`, SQLite repositories in `poc-server/src/repositories`, Store Learning docs under `docs/product` and `docs/codex`.

---

## Scope

Included:

- Current Store Learning browser flow screens only.
- Naver Place parsed/snapshot fields introduced through recent provider work.
- Naver Blog collection fields available from rendered/page providers.
- Existing analyzer, learning snapshot, ruleset, blog generation, RAW viewer, and learning status API contracts.
- Mock/static data inventory and replacement priority.

Excluded:

- Runtime code changes.
- UI redesign.
- Provider fallback implementation.
- Analyzer schema changes.
- `admin/`, `pc-web/`, and old Event-to-Operation files.

## Task 1: Confirm Baseline

**Files:**

- Read: `AGENTS.md`
- Read: `docs/codex/CURRENT_TASK.md`
- Read: `docs/codex/GIT_WORKFLOW.md`
- Read: `docs/codex/HANDOFF.md`
- Read: `docs/codex/VALIDATION.md`

- [x] Step 1: Confirm current directory, branch, and working tree state.

Run:

```bash
pwd
git branch --show-current
git status --short --branch
```

Expected:

- Repository root is `/Users/1004182/Documents/bizplanet-work/bizp-store-learning-poc`.
- Work starts from a feature branch based on `origin/develop`.
- Any unrelated `.DS_Store` change remains unstaged and out of this milestone.

- [x] Step 2: Confirm recent product PR scope.

Run:

```bash
gh pr view 18 --repo funkyliferyu/bizp-poc --json number,title,files
gh pr view 19 --repo funkyliferyu/bizp-poc --json number,title,files
gh pr view 20 --repo funkyliferyu/bizp-poc --json number,title,files
gh pr view 21 --repo funkyliferyu/bizp-poc --json number,title,files
gh pr view 23 --repo funkyliferyu/bizp-poc --json number,title,files
```

Expected:

- PR #18 contributes owner source routing metadata.
- PR #19 contributes rendered Naver Place profile import.
- PR #20 contributes rendered Naver Place visitor review collection.
- PR #21 contributes rendered/page Naver Blog body collection.
- PR #23 contributes provider hardening, Place metadata UI, RAW viewer, RAG document UI, and business-hours sync.

## Task 2: Inventory Screens

**Files:**

- Read: `web/soho_store_register.html`
- Read: `web/soho_store_register.js`
- Read: `web/03_AI학습_온보딩.html`
- Read: `web/training_settings.js`
- Read: `web/04_AI학습_수집중.html`
- Read: `web/collection_progress.js`
- Read: `web/05_AI학습_콘텐츠선택.html`
- Read: `web/content_selection.js`
- Read: `web/06_AI학습_현황.html`
- Read: `web/learning_status.js`
- Read: `web/07_마케팅전략룰셋.html`
- Read: `web/ruleset_editor.js`
- Read: `web/02_블로그관리.html`
- Read: `web/blog_posts.js`
- Read: `web/09_AI콘텐츠생성_상세.html`
- Read: `web/content_detail.js`
- Read: `web/soho_dashboard.html`

- [x] Step 1: Find API-backed screen behavior.

Run:

```bash
rg -n "fetch\\(|/api/|data-store-field|data-ruleset-field|RAW|raw|store_raw_data" web/*.html web/*.js
```

Expected:

- Store registration, training settings, collection progress, content selection, learning status, ruleset, blog management, and content detail call `poc-server` APIs.
- Dashboard and some state-variant/reference screens retain static sample data.

- [x] Step 2: Find visible static sample data.

Run:

```bash
rg -n "분당|케이크|2026\\.05|홍길동|맛있는 떡볶이|48개|127개|84점" web/*.html web/*.js
```

Expected:

- Identify sample rows/counters/text that should be replaced by persisted Store Learning data in later milestones.

## Task 3: Inventory Data Sources

**Files:**

- Read: `poc-server/src/storeLearning/providers/naverPlaceRenderedProvider.ts`
- Read: `poc-server/src/storeLearning/collection/naverPlaceRenderedCollectionProvider.ts`
- Read: `poc-server/src/storeLearning/collection/naverBlogRenderedCollectionProvider.ts`
- Read: `poc-server/src/storeLearning/analysis/analyzer.ts`
- Read: `poc-server/src/storeLearning/analysis/analysisExecutionService.ts`
- Read: `poc-server/src/storeLearning/learning/learningStatusService.ts`
- Read: `poc-server/src/storeLearning/rulesets/rulesetService.ts`
- Read: `poc-server/src/storeLearning/blog/blogGenerator.ts`
- Read: `poc-server/src/storeLearning/rag/storeInfoRagBuilder.ts`

- [x] Step 1: Find persisted Place fields.

Run:

```bash
rg -n "naverPlaceParsed|naverPlaceSnapshot|reviewStats|menuItems|menuImageUrls|placeImageUrls|weeklyBusinessHours|placeIntro|aiSummary" poc-server/src poc-server/test web/*.js
```

Expected:

- Confirm field names and current consumers for Place profile metadata.

- [x] Step 2: Find collected Blog and Place item contracts.

Run:

```bash
rg -n "bodyAvailability|owner_blog_post|place_visitor_review|rendered_blog_full_body|rendered_place_visitor_review|sourceKind" poc-server/src poc-server/test
```

Expected:

- Confirm collection item metadata used by analysis, RAW views, and future UI replacement work.

- [x] Step 3: Find learning and ruleset output contracts.

Run:

```bash
rg -n "learningSnapshot|rulesetFields|storePositioning|keyStrengths|targetCustomers|toneAndManner|blogWritingStyle|seoKeywords|ctaStyle|imageDirection|negativeExpressions" poc-server/src poc-server/test web/*.js web/*.html
```

Expected:

- Confirm current analyzer output fields and UI field hooks.

## Task 4: Write Audit Output

**Files:**

- Create: `docs/product/STORE_LEARNING_DATA_MAP.md`

- [x] Step 1: Write recent PR capability summary.
- [x] Step 2: Write source type taxonomy: Place immediate, Blog parser, AI processing, and deferred.
- [x] Step 3: Write screen-by-screen current state and replacement priority.
- [x] Step 4: Write milestone dependency order for future PRs.

Expected:

- The document gives future milestone workers a stable input/output map before touching runtime code.

## Task 5: Update Operating Docs

**Files:**

- Modify: `docs/codex/HANDOFF.md`
- Modify: `docs/codex/VALIDATION.md`

- [x] Step 1: Add Milestone 01 scope and handoff note.
- [x] Step 2: Add Milestone 01 validation commands and result checklist.

Expected:

- Future sessions can see that the first milestone is a documentation/data-map baseline, not a runtime behavior change.

## Task 6: Validate

**Files:**

- Read: `docs/codex/MILESTONE_01_DATA_MAP_PLAN.md`
- Read: `docs/product/STORE_LEARNING_DATA_MAP.md`
- Read: `docs/codex/HANDOFF.md`
- Read: `docs/codex/VALIDATION.md`

- [x] Step 1: Check markdown files exist.

Run:

```bash
test -f docs/codex/MILESTONE_01_DATA_MAP_PLAN.md
test -f docs/product/STORE_LEARNING_DATA_MAP.md
```

Expected: exit code `0`.

- [x] Step 2: Check expected headings and terms.

Run:

```bash
rg -n "Place Immediate|Blog Parser|AI Processing|Milestone 01|사업자번호|RAW data|룰셋" docs/codex/MILESTONE_01_DATA_MAP_PLAN.md docs/product/STORE_LEARNING_DATA_MAP.md docs/codex/HANDOFF.md docs/codex/VALIDATION.md
```

Expected: matching lines in the new plan, product audit, handoff, and validation docs.

- [x] Step 3: Check whitespace.

Run:

```bash
git diff --check
```

Expected: no output and exit code `0`.

- [x] Step 4: Confirm no forbidden areas changed.

Run:

```bash
git status --short
```

Expected:

- milestone docs appear as modified or untracked;
- no `admin/`, `pc-web/`, `poc-server/`, or `web/` files appear as milestone changes;
- existing unrelated `.DS_Store` may appear because it existed before this milestone and must not be staged.
