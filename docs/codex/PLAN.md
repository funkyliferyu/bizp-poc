# Store Learning & Blog Content Automation PoC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Store Learning & Blog Content Automation PoC from static screens into an API-backed local demo without changing the current HTML design.

**Architecture:** Browser pages call `poc-server` APIs only. `poc-server` owns state, mock mode, provider adapters, server-side credentials, SQLite persistence through repositories, and Zod-validated LLM outputs.

**Tech Stack:** Static HTML/CSS/JS in `web/`, Express/TypeScript in `poc-server`, Zod schemas, SQLite local PoC database, repository interfaces, provider adapters, OpenAI server-side calls when real mode is enabled.

---

## Guardrails

- Do not use `README_POC.md` or `web/event_operation_poc.html` as product source of truth.
- Keep old Event-to-Operation files untouched.
- Do not modify `admin/` or `pc-web/`.
- Do not redesign existing HTML screens.
- Keep Naver/OpenAI credentials server-side.
- Mock mode must work without external keys.
- Real Naver collection must sit behind provider adapters.
- LLM outputs must be Zod-validated before save.

## Task 1: Establish New Server Domain Boundaries

**Files:**

- Create: `poc-server/src/store-learning/schemas/*.ts`
- Create: `poc-server/src/store-learning/repositories/*.ts`
- Create: `poc-server/src/store-learning/workflows/*.ts`
- Modify: `poc-server/src/index.ts`

- [ ] Add Store Learning route namespace under `/api`.
- [ ] Keep existing legacy routes available but separate from new Store Learning modules until retirement is approved.
- [ ] Add Zod schemas for store profile, learning settings, collection run, collected item, strategy ruleset, blog post, provider result, and LLM output envelope.
- [ ] Add repository interfaces before adding route handlers.

## Task 2: Add SQLite PoC Persistence

**Files:**

- Create: `poc-server/src/store-learning/db/sqlite.ts`
- Create: `poc-server/src/store-learning/db/migrations.ts`
- Create: `poc-server/src/store-learning/repositories/sqlite*.ts`
- Test: `poc-server/test/storeLearningRepositories.test.ts`

- [ ] Create SQLite schema matching `docs/architecture/data-model-v0.md`.
- [ ] Implement repositories behind interfaces.
- [ ] Add tests that create a temp SQLite DB, save records, read them back, and assert repository contract behavior.
- [ ] Keep route handlers free of SQL details.

## Task 3: Implement Mock Providers

**Files:**

- Create: `poc-server/src/store-learning/providers/providerTypes.ts`
- Create: `poc-server/src/store-learning/providers/mockNaverProvider.ts`
- Create: `poc-server/src/store-learning/providers/providerRegistry.ts`
- Test: `poc-server/test/storeLearningMockProviders.test.ts`

- [ ] Implement mock Place URL resolution.
- [ ] Implement mock Blog metadata/full-body collection.
- [ ] Implement mock Place profile and review summaries.
- [ ] Return capability status for unavailable provider features.
- [ ] Make mock mode run with no external keys.

## Task 4: Implement Store Registration And Learning Settings APIs

**Files:**

- Create: `poc-server/src/store-learning/routes/stores.ts`
- Create: `poc-server/src/store-learning/routes/learningSettings.ts`
- Modify: `poc-server/src/index.ts`
- Test: `poc-server/test/storeLearningApi.test.ts`

- [ ] Add `POST /api/stores/from-place-url`.
- [ ] Add `GET /api/stores/:storeId`.
- [ ] Add `PUT /api/stores/:storeId`.
- [ ] Add `GET /api/stores/:storeId/learning-settings`.
- [ ] Add `PUT /api/stores/:storeId/learning-settings`.
- [ ] Validate every request/response with Zod.

## Task 5: Implement Collection And Selection APIs

**Files:**

- Create: `poc-server/src/store-learning/routes/collectionRuns.ts`
- Create: `poc-server/src/store-learning/workflows/runCollection.ts`
- Test: `poc-server/test/storeLearningCollection.test.ts`

- [ ] Add `POST /api/stores/:storeId/collection-runs`.
- [ ] Add `GET /api/collection-runs/:runId`.
- [ ] Add `POST /api/collection-runs/:runId/retry`.
- [ ] Add `GET /api/collection-runs/:runId/items`.
- [ ] Add `PUT /api/collection-runs/:runId/selections`.
- [ ] Add `POST /api/collection-runs/:runId/analyze`.
- [ ] Preserve body availability and provider capability states.

## Task 6: Implement Learning Status And Ruleset APIs

**Files:**

- Create: `poc-server/src/store-learning/routes/learningStatus.ts`
- Create: `poc-server/src/store-learning/routes/strategyRuleset.ts`
- Create: `poc-server/src/store-learning/workflows/analyzeSelectedContent.ts`
- Test: `poc-server/test/storeLearningRuleset.test.ts`

- [ ] Add `GET /api/stores/:storeId/learning-status`.
- [ ] Add `GET /api/stores/:storeId/learning-sources`.
- [ ] Add `GET /api/analysis-jobs/:jobId`.
- [ ] Add `POST /api/analysis-jobs/:jobId/retry`.
- [ ] Add `GET /api/stores/:storeId/strategy-ruleset`.
- [ ] Add `PUT /api/stores/:storeId/strategy-ruleset`.
- [ ] Add preview regeneration and benchmark evidence endpoints.
- [ ] Validate generated rulesets with Zod before save.

## Task 7: Implement Blog Post And Content Detail APIs

**Files:**

- Create: `poc-server/src/store-learning/routes/blogPosts.ts`
- Create: `poc-server/src/store-learning/workflows/generateBlogPost.ts`
- Test: `poc-server/test/storeLearningBlogPosts.test.ts`

- [ ] Add `GET /api/stores/:storeId/blog-posts`.
- [ ] Add `GET /api/blog-posts/:postId`.
- [ ] Add `PUT /api/blog-posts/:postId/draft`.
- [ ] Add approval and publish request actions.
- [ ] Add article/image/SEO regeneration actions.
- [ ] Validate generated article, image prompts, and SEO score with Zod before save.

## Task 8: Wire Existing Static Screens To APIs

**Files:**

- Modify only relevant `web/*.html` files from the Store Learning flow.
- Do not redesign pages.
- Do not modify `admin/` or `pc-web/`.

- [ ] `web/soho_store_register.html` calls store registration APIs.
- [ ] `web/03_AI학습_온보딩.html` calls learning settings APIs.
- [ ] `web/04_AI학습_수집중.html` polls collection run APIs.
- [ ] `web/05_AI학습_콘텐츠선택.html` calls item selection APIs.
- [ ] `web/06_AI학습_현황*.html` calls learning status APIs.
- [ ] `web/07_마케팅전략룰셋.html` calls ruleset APIs instead of local fixture data.
- [ ] `web/02_블로그관리.html` calls blog post list APIs.
- [ ] `web/09_AI콘텐츠생성_상세.html`, `web/10_블로그_발행대기_상세.html`, and `web/11_블로그_발행완료_상세.html` call blog post detail APIs.

## Task 9: Validation

**Files:**

- Modify: `docs/codex/VALIDATION.md`

- [ ] Run `cd poc-server && npm test`.
- [ ] Run `cd poc-server && npm run typecheck`.
- [ ] Run local mock-mode server and manually traverse the eight-step flow.
- [ ] Confirm browser requests hit `/api/*` on `poc-server` only.
- [ ] Confirm no Naver/OpenAI credentials appear in browser-visible code or responses.

