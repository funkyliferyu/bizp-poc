# Naver Place RAG Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate two RAG-ready DOCX files per Naver Place store: `info_<storeName>.docx` for static store information and `reviews_<storeName>.docx` for visitor reviews plus owner replies.

**Architecture:** Keep all Naver access server-side behind existing provider adapters. Reuse `stores.metadata.naverPlaceParsed` for static Place data, reuse `collection_items` for collected reviews, and add a focused RAG export service that maps persisted data into deterministic document models before rendering DOCX. Persist generated files under local runtime storage, not git.

**Tech Stack:** TypeScript, Express, SQLite repositories, existing Naver rendered Place provider, Zod validation, DOCX generation adapter, Vitest, Playwright live verification.

---

## Source Findings

- Sample `info_haehwaro.docx` is a structured plain-language reference document with sections: basic info, directions/parking, hours, facilities, seats, owner intro, menus, reservation, coupons, operating data, notices.
- Sample `reviews_haehwaro.docx` is a plain RAG-friendly review list: `[리뷰 N] (date) - reviewer + review body`, followed by `▶ 사장님 답글: ...` when an owner reply exists.
- Current code already stores rendered Place profile data in `stores.metadata.naverPlaceParsed`.
- Current `naverPlaceRenderedCollectionProvider` already extracts visitor review fields into `collection_items`:
  - `body_text`
  - `metadata.reviewerName`
  - `metadata.reviewDate`
  - `metadata.rating`
  - `metadata.ownerReplyText`
  - `metadata.replyStatus`
  - `metadata.ordinal`
  - `metadata.reviewTabUrl`

## Boundaries

- Browser pages must call `poc-server` APIs only.
- Naver fetching stays server-side through provider adapters.
- Do not modify `admin/` or `pc-web/`.
- Do not modify Event-to-Operation workflows.
- No automatic publishing.
- Runtime DOCX files must be ignored by git.

## File Structure

- Create `poc-server/src/storeLearning/rag/ragDocumentTypes.ts`
  - Zod schemas and TypeScript types for info/review document models.
- Create `poc-server/src/storeLearning/rag/storeInfoRagBuilder.ts`
  - Maps `Store` + `metadata.naverPlaceParsed` to static info sections.
- Create `poc-server/src/storeLearning/rag/reviewRagBuilder.ts`
  - Reads collected Place review items, applies recent-20 plus sampled-80 selection, formats owner replies.
- Create `poc-server/src/storeLearning/rag/reviewSampler.ts`
  - Deterministic sampling logic for >100 reviews.
- Create `poc-server/src/storeLearning/rag/docxWriter.ts`
  - Converts document models to DOCX buffers.
- Create `poc-server/src/storeLearning/rag/ragDocumentService.ts`
  - Orchestrates data load, optional review refresh, DOCX writing, and manifest persistence.
- Create `poc-server/src/storeLearning/routes/ragDocuments.ts`
  - APIs for generate/list/download.
- Modify `poc-server/src/index.ts`
  - Mount `/api/stores/:storeId/rag-documents` or `/api/rag-documents`.
- Modify `poc-server/package.json`
  - Add `rag:export` script and DOCX dependency if selected.
- Create `poc-server/src/exportStoreRagDocuments.ts`
  - CLI export for local verification.
- Create tests:
  - `poc-server/test/ragReviewSampler.test.ts`
  - `poc-server/test/ragDocumentBuilders.test.ts`
  - `poc-server/test/ragDocumentApi.test.ts`
  - `poc-server/test/ragDocxWriter.test.ts`

---

## Stage 1: RAG Data Model And Static Info Builder

**Branch:** `rag/place-info-document-model`

**Implementation**
- [ ] Add Zod schemas for:
  - `StoreInfoRagDocument`
  - `StoreInfoSection`
  - `StoreReviewRagDocument`
  - `StoreReviewEntry`
- [ ] Build `storeInfoRagBuilder` using only persisted store data.
- [ ] Map these Place fields when available:
  - name, category, phone, address, road/jibun/postal if available
  - homepage/instagram/external links
  - directions, parking, business hours, break hours, closed days
  - facilities, payment info, seat/room metadata
  - place intro and AI summary as separate lines
  - menu items, menu images count, reservation URL, coupons, notices, review stats, broadcast infos, keywords
- [ ] Do not call Naver in this stage.

**Validation**
- [ ] Unit test with a fixture based on `store_1824807602` metadata.
- [ ] `cd poc-server && npm run typecheck`
- [ ] `cd poc-server && npm test -- ragDocumentBuilders.test.ts`

**PR/Merge**
- [ ] Commit: `feat: add store info rag document model`
- [ ] PR to `codex/api-backed-poc-flow`
- [ ] Merge before Stage 2.

---

## Stage 2: Review Selection And Sampling

**Branch:** `rag/place-review-sampling`

**Implementation**
- [ ] Add `reviewSampler.ts`.
- [ ] Sort collected visitor reviews by:
  1. parsed `metadata.reviewDate` descending when parseable
  2. `metadata.ordinal` ascending fallback
  3. `createdAt` descending final fallback
- [ ] Selection rule:
  - If collected reviews <= 100: include all collected reviews.
  - If collected reviews > 100: include latest 20, then sample 80 from the remaining older reviews.
  - Sampling should be deterministic for repeatability: use seeded pseudo-random interval sampling with seed `${storeId}:${latestRunId}`.
- [ ] Preserve owner replies:
  - `ownerReplyText` included when non-empty.
  - Missing reply represented as `사장님 답글 없음`.
- [ ] Add `reviewRagBuilder.ts` that converts selected review items to `[리뷰 N]` entries.

**Validation**
- [ ] Test 50 reviews returns 50.
- [ ] Test 120 reviews returns 100 with latest 20 always included.
- [ ] Test sampling is stable for the same seed.
- [ ] Test owner replies are attached to the matching review.
- [ ] `cd poc-server && npm test -- ragReviewSampler.test.ts ragDocumentBuilders.test.ts`

**PR/Merge**
- [ ] Commit: `feat: add place review rag sampling`
- [ ] PR to `codex/api-backed-poc-flow`
- [ ] Merge before Stage 3.

---

## Stage 3: Review Collection Depth For RAG Export

**Branch:** `rag/place-review-depth-collection`

**Implementation**
- [ ] Extend rendered Place review provider to support a RAG export target count of 100.
- [ ] Add a provider boundary method or option for review-depth collection:
  - default UI collection remains unchanged
  - RAG export can request `placeReviewLimit = 100`
- [ ] Improve rendered review collection to scroll/load additional review cards when the rendered page initially exposes fewer than requested.
- [ ] Persist every collected review as `collection_items` with owner reply metadata.
- [ ] If Naver blocks the request, return a structured failure reason and do not create misleading DOCX output.

**Validation**
- [ ] Fixture test for multiple loaded review batches.
- [ ] Live-gated test with `RUN_NAVER_LIVE=1` only.
- [ ] SQLite check:
  - `select count(*) from collection_items where store_id='<storeId>' and channel='place' and source_type='review' and status='collected';`
- [ ] `cd poc-server && npm run naver:verify` when live provider is enabled.

**PR/Merge**
- [ ] Commit: `feat: collect place reviews for rag export`
- [ ] PR to `codex/api-backed-poc-flow`
- [ ] Merge before Stage 4.

---

## Stage 4: DOCX Generation And Local Artifact Storage

**Branch:** `rag/docx-export-files`

**Implementation**
- [ ] Add DOCX writer adapter.
- [ ] Prefer adding `docx` npm dependency unless repo maintainers prefer direct OOXML.
- [ ] Output files:
  - `poc-server/data/rag-documents/<storeId>/info_<safeStoreName>.docx`
  - `poc-server/data/rag-documents/<storeId>/reviews_<safeStoreName>.docx`
- [ ] Add manifest JSON:
  - generatedAt
  - storeId/storeName
  - reviewCount
  - source collection run id
  - file paths
  - warnings
- [ ] Ensure `poc-server/data/rag-documents/` is gitignored.
- [ ] Add CLI:
  - `npm run rag:export -- --storeId=store_1824807602`

**Validation**
- [ ] Unit test confirms DOCX files contain expected text after extracting `word/document.xml`.
- [ ] Render sample DOCX using the document render workflow when available.
- [ ] Compare generated structure against the provided samples:
  - `info_haehwaro.docx`
  - `reviews_haehwaro.docx`
- [ ] `cd poc-server && npm run rag:export -- --storeId=store_1824807602`

**PR/Merge**
- [ ] Commit: `feat: export store rag docx files`
- [ ] PR to `codex/api-backed-poc-flow`
- [ ] Merge before Stage 5.

---

## Stage 5: API, Optional UI Hook, And End-To-End Verification

**Branch:** `rag/store-rag-document-api`

**Implementation**
- [ ] Add API routes:
  - `POST /api/stores/:storeId/rag-documents/generate`
  - `GET /api/stores/:storeId/rag-documents`
  - `GET /api/stores/:storeId/rag-documents/info/download`
  - `GET /api/stores/:storeId/rag-documents/reviews/download`
- [ ] Request body:
  - `{ "refreshReviews": false, "reviewLimit": 100 }`
- [ ] Response includes manifest and warnings.
- [ ] Optional UI hook can be added later; if included now, keep it minimal in `soho_store_register.html` near Naver Place collected info.
- [ ] No browser-side Naver calls.

**Validation**
- [ ] API test generates both DOCX files from seeded data.
- [ ] Manual local test:
  - Import Place
  - Run review collection or use existing collected reviews
  - Generate RAG docs
  - Download both files
  - Confirm `info_...docx` contains static info
  - Confirm `reviews_...docx` contains review text and owner replies
- [ ] Full validation:
  - `cd poc-server && npm run typecheck`
  - `cd poc-server && npm test`
  - `cd poc-server && npm run demo:store-learning`

**PR/Merge**
- [ ] Commit: `feat: add store rag document api`
- [ ] PR to `codex/api-backed-poc-flow`
- [ ] Merge after manual download verification.

---

## Open Decisions Before Implementation

1. **DOCX dependency:** Use `docx` npm package for maintainability, or direct OOXML generation to avoid a dependency.
2. **UI timing:** API/CLI first is safer. UI button can be a later small PR.
3. **Review refresh behavior:** Default should use persisted reviews. `refreshReviews=true` should be explicit because Naver can rate-limit or block.
4. **Sampling wording:** User asked “랜덤 간격 샘플링 80개”; implementation should use seeded pseudo-random interval sampling so reruns are reproducible.

## Recommended Execution Order

1. Stage 1 PR: document model and static info builder.
2. Stage 2 PR: review builder and deterministic sampling.
3. Stage 3 PR: review collection depth hardening.
4. Stage 4 PR: DOCX export and local storage.
5. Stage 5 PR: API/download and optional UI hook.
