# Real Store E2E Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Store Learning flow work naturally for newly registered real Naver Place stores, from Place import through channel setup, collection progress, analysis execution, learning status, and ruleset entry.

**Architecture:** Keep all external-provider work server-side. Persist detected Place channel links through store metadata and `store_channels`, render browser pages from `poc-server` APIs only, and separate the collection progress review screen from the later analysis selection screen. Keep benchmark evidence and preview regeneration in the existing mock/provider-ready server contract.

**Tech Stack:** Static HTML/CSS/JS in `web/`, Express/TypeScript routes in `poc-server`, SQLite repositories, Naver Place provider adapters, Vitest API/static tests, optional local browser smoke through `poc-server`.

---

## Scope

Included:

- Start from latest `develop` and a new `codex/*` branch.
- Verify and harden the real-store flow:
  1. `soho_store_register.html`
  2. `03_AI학습_온보딩.html`
  3. `04_AI학습_수집중.html`
  4. `05_AI학습_콘텐츠선택.html`
  5. `06_AI학습_현황.html`
  6. `07_마케팅전략룰셋.html`
- Parse Naver Place external/SNS links for Blog, Instagram, Daangn, YouTube, and TikTok when those links are present in Place metadata.
- Persist detected channel links in SQLite without exposing credentials or making browser-side provider calls.
- Show detected Instagram, Daangn, YouTube, and TikTok channels in learning settings as provider-ready `준비중` channels when source URLs exist.
- Make the collection progress screen show the saved requested limits immediately, not static default/mock counts first.
- Convert the collection progress header to a dashboard-block summary.
- Change the collection progress bottom section from analysis selection to collected-content review.
- Keep real analysis item selection on the next page.
- Add visible loading/progress feedback when the user clicks `분석 실행`.
- Fix relearn so it carries the current `storeId`, creates a new collection run, and navigates with `storeId` plus `runId`.
- Make learning status Blog and Place tabs render persisted real data instead of static placeholder rows.
- Use real publication/review dates from provider metadata where available.
- Make Blog source links open in a new tab.
- Show dynamic Place blocks by industry and available data, including hospital `진료과목` instead of generic menu rows.
- Hide Place news when no real news data exists.
- Provide review/photo expand and pagination controls as requested.

Excluded:

- Do not modify `admin/`.
- Do not modify `pc-web/`.
- Do not touch `README_POC.md` or `web/event_operation_poc.html`.
- Do not call Naver, OpenAI, scraping providers, or other external providers from browser JavaScript.
- Do not commit `.DS_Store`, SQLite runtime DBs, `.env`, screenshots, or generated artifacts.
- Do not implement real Instagram/Daangn/YouTube/TikTok collection providers in this milestone.
- Do not convert benchmark or preview endpoints to live providers; keep them mock/provider-ready.

## Implementation Order

### Task 0: Start From Clean Develop Context

**Files:**

- Read: `AGENTS.md`
- Read: `poc-server/AGENTS.md`
- Read: `docs/codex/GIT_WORKFLOW.md`
- Read: `docs/codex/CURRENT_TASK.md`
- Read: `docs/codex/PLAN.md`
- Read: `docs/codex/HANDOFF.md`
- Read: `docs/codex/VALIDATION.md`
- Read: `docs/codex/MILESTONE_11_REAL_STORE_E2E_HARDENING_PLAN.md`

- [x] **Step 1: Confirm workspace and branch inputs**

Run:

```bash
pwd
git branch --show-current
git status --short --branch
git fetch origin --prune
git log --oneline --decorate -5
gh pr view 36 --json number,state,mergedAt,mergeCommit,baseRefName,headRefName,url
gh pr list --base develop --state open
```

Expected:

- Workspace is `/Users/1004182/Documents/bizplanet-work/bizp-store-learning-poc`.
- `origin/develop` points at or includes `a30aaad feat: finalize ruleset API contract`.
- PR #36 is merged to `develop`.
- No open PR blocks the `develop` base.
- `.DS_Store` may be locally modified and must remain unstaged.

- [x] **Step 2: Create the implementation branch**

Run:

```bash
git switch develop
git pull --ff-only origin develop
git switch -c codex/real-store-e2e-hardening
```

Expected:

- Current branch is `codex/real-store-e2e-hardening`.
- PR base for the future implementation PR is `develop`.

### Task 1: Persist Place External Channel Links

**Files:**

- Create: `poc-server/src/storeLearning/providers/placeExternalChannels.ts`
- Modify: `poc-server/src/storeLearning/providers/naverPlaceRenderedProvider.ts`
- Modify: `poc-server/src/storeLearning/routes/stores.ts`
- Modify: `poc-server/test/naverPlaceRenderedProvider.test.ts`
- Modify: `poc-server/test/storeRegistrationApi.test.ts`

- [x] **Step 1: Add RED provider parsing tests**

Add tests that build a rendered Place Apollo fixture containing:

- `homepages.repr` with Instagram.
- `homepages.items` or equivalent list entries for Blog, YouTube, and TikTok.
- `relatedLinks` entries with Blog and Daangn/Karrot URLs.

Expected assertions:

```ts
expect(profile.externalChannelLinks).toEqual(
  expect.arrayContaining([
    { channel: 'blog', label: '블로그', url: 'https://blog.naver.com/terraceclinic' },
    { channel: 'instagram', label: '인스타그램', url: 'https://www.instagram.com/terraceclinic' },
    { channel: 'youtube', label: '유튜브', url: 'https://www.youtube.com/@terraceclinic' },
    { channel: 'tiktok', label: '틱톡', url: 'https://www.tiktok.com/@terraceclinic' },
    { channel: 'daangn', label: '당근', url: 'https://www.daangn.com/kr/local-profile/terraceclinic' }
  ])
);
```

Run:

```bash
cd poc-server
npm test -- naverPlaceRenderedProvider.test.ts -t "external channel"
```

Expected: FAIL because `externalChannelLinks` and channel normalization do not exist yet.

- [x] **Step 2: Add RED store import persistence tests**

Add an import test with `NAVER_PLACE_PROVIDER=rendered` that confirms:

- `store.metadata.externalChannelLinks` exists.
- `store.metadata.naverPlaceParsed.externalChannelLinks` exists.
- `store_channels` contains detected channel rows for `blog`, `instagram`, `youtube`, `tiktok`, and `daangn`.
- Future-provider rows use `providerMode: 'provider_ready'` and settings `{ providerScope: 'not_implemented', detectedFrom: 'naver_place' }`.

Run:

```bash
cd poc-server
npm test -- storeRegistrationApi.test.ts -t "external channel"
```

Expected: FAIL because imports currently only upsert the Place channel.

- [x] **Step 3: Implement channel-link normalization**

Create `placeExternalChannels.ts` with:

- `StoreExternalChannel = { channel: 'blog' | 'instagram' | 'daangn' | 'youtube' | 'tiktok'; label: string; url: string }`
- `normalizeExternalChannelLink(input)`
- `extractExternalChannelLinks(values)`
- `dedupeExternalChannelLinks(links)`

Recognition rules:

```text
blog:     blog.naver.com, m.blog.naver.com
instagram: instagram.com
youtube:  youtube.com, youtu.be
tiktok:   tiktok.com
daangn:   daangn.com, karrotmarket.com
```

- [x] **Step 4: Add links to rendered Place metadata**

In `naverPlaceRenderedProvider.ts`:

- Extend `RenderedPlaceProfile` with `externalChannelLinks`.
- Build `externalChannelLinks` from existing `homepageUrl`, `homepage`, `externalLinks`, Apollo `homepages`, and Apollo `relatedLinks`.
- Add it to `naverPlaceParsed`.
- Add it to top-level `metadata`.

Run:

```bash
cd poc-server
npm test -- naverPlaceRenderedProvider.test.ts -t "external channel"
```

Expected: PASS.

- [x] **Step 5: Persist detected channels on import and patch**

In `stores.ts`:

- Add a helper that reads `store.metadata.externalChannelLinks` and `store.metadata.naverPlaceParsed.externalChannelLinks`.
- Upsert `store_channels` rows for detected channels.
- Keep blog as `providerModeFromConfig(configuredBlogProvider(env))`.
- Keep `instagram`, `daangn`, `youtube`, and `tiktok` as `providerMode: 'provider_ready'`.
- Use `status: 'connected'` when a source URL exists.
- Do not enable future-provider collection.

Run:

```bash
cd poc-server
npm test -- storeRegistrationApi.test.ts -t "external channel"
```

Expected: PASS.

### Task 2: Show Provider-Ready Channels In Learning Settings

**Files:**

- Modify: `poc-server/src/storeLearning/routes/stores.ts`
- Modify: `poc-server/test/trainingSettingsApi.test.ts`
- Modify: `poc-server/test/trainingSettingsPage.test.ts`
- Modify: `web/03_AI학습_온보딩.html`
- Modify: `web/training_settings.js`

- [x] **Step 1: Add RED API tests for YouTube and TikTok channel preservation**

Add a training settings test that:

- Imports or creates a store with `store_channels` source URLs for `youtube` and `tiktok`.
- Saves training settings for Blog and Place.
- Confirms future-provider channel rows are not deleted.
- Confirms collection-run summary includes future-provider `sourceUrls.youtube` and `sourceUrls.tiktok` but no enabled collection plan for them.

Run:

```bash
cd poc-server
npm test -- trainingSettingsApi.test.ts -t "future-provider"
```

Expected: FAIL because `youtube` and `tiktok` are not part of the settings contract yet.

- [x] **Step 2: Extend the settings contract without enabling collection**

In `stores.ts`:

- Extend `TrainingSettingsBodySchema` to accept optional `youtube` and `tiktok`.
- Normalize both channels with `enabled: false`, limit `0`, and optional `sourceUrl`.
- Persist rows via `syncTrainingSourceChannels`.
- Add `sourceUrls.youtube` and `sourceUrls.tiktok` to collection summaries.
- Do not add either channel to the `CollectionPlan` consumed by collection providers.

Run:

```bash
cd poc-server
npm test -- trainingSettingsApi.test.ts -t "future-provider"
```

Expected: PASS.

- [x] **Step 3: Add RED static page tests**

Update `trainingSettingsPage.test.ts` to assert:

- `03_AI학습_온보딩.html` has `training-youtube-url`, `training-youtube-status`, `training-tiktok-url`, and `training-tiktok-status`.
- `training_settings.js` derives YouTube/TikTok URLs from store channels and Place metadata.
- Future-provider badges render `준비중` when a URL exists.
- Browser code still calls only `poc-server` APIs.

Run:

```bash
cd poc-server
npm test -- trainingSettingsPage.test.ts -t "AI training onboarding"
```

Expected: FAIL before the page/script updates.

- [x] **Step 4: Update the learning settings page**

In `03_AI학습_온보딩.html` and `training_settings.js`:

- Add read-only/provider-ready cards for YouTube and TikTok.
- Add Daangn to the same provider-ready behavior when a URL exists.
- Keep Blog and Place as actual collection settings.
- For Instagram, Daangn, YouTube, and TikTok:
  - If URL exists: show URL and status `준비중`.
  - If URL does not exist: show `미등록`.
  - Keep collection limit disabled or fixed to `수집 안 함` for provider-ready-only channels.

Run:

```bash
cd poc-server
npm test -- trainingSettingsPage.test.ts trainingSettingsApi.test.ts
```

Expected: PASS.

### Task 3: Refactor Collection Progress Into Dashboard And Collected-Content Review

**Files:**

- Modify: `poc-server/test/collectionProgressPage.test.ts`
- Modify: `poc-server/test/collectionProgressApi.test.ts`
- Modify: `web/04_AI학습_수집중.html`
- Modify: `web/collection_progress.js`

- [x] **Step 1: Add RED API/static tests for requested limits**

Add coverage that creates a run with:

```ts
naverBlog: { enabled: true, blogPostLimit: 10 }
naverPlace: { enabled: true, placeReviewLimit: 50 }
```

Expected:

- Before provider items are created, browser-visible planned totals can be derived from `collectionRun.summary.requestedLimits`.
- `collection_progress.js` contains a helper such as `requestedTargetForChannel(run, channel)`.
- The page no longer contains static text like `수집 중 (23 / 50)` or static Blog table rows.

Run:

```bash
cd poc-server
npm test -- collectionProgressApi.test.ts collectionProgressPage.test.ts -t "requested"
```

Expected: FAIL because the current HTML has static counts and static review tables.

- [x] **Step 2: Replace the top long list with dashboard summary blocks**

In `04_AI학습_수집중.html`:

- Replace the long progress rows with a compact grid of channel summary blocks.
- Each block should have stable hooks:
  - `collection-summary-blog`
  - `collection-summary-place`
  - `collection-summary-instagram`
  - `collection-summary-overall`
- Show label, status, collected count, planned count, and source URL status where available.
- Keep the page shell and breadcrumb intact.

- [x] **Step 3: Render planned counts immediately**

In `collection_progress.js`:

- Use `collectionRun.summary.requestedLimits.blogPostLimit` for Blog planned count.
- Use `collectionRun.summary.requestedLimits.placeReviewLimit + 1` or a separate profile indicator for Place planned count, because Place profile is included independently from review count.
- Use `collectionRun.summary.channelPlan` to show disabled/provider-ready channels as `대기`, `준비중`, or `수집 안 함`.
- Never show a hardcoded `50` before the API response says `50`.

- [x] **Step 4: Change bottom section to collected-content review**

In `04_AI학습_수집중.html`:

- Rename `분석할 콘텐츠 선택` to `수집완료 콘텐츠 내역`.
- Replace the description with `수집 완료된 콘텐츠입니다. 충분한 레퍼런스 콘텐츠가 확보되었는지 확인하세요.`
- Remove the AI-written-content warning block.
- Remove selection checkbox UI.
- Keep the CTA to `05_AI학습_콘텐츠선택.html` for the actual next selection step.

- [x] **Step 5: Render actual collected items with expand and paging**

In `collection_progress.js`:

- Read actual items from `GET /api/collection-runs/:runId/items`.
- Default display: 10 collected items.
- Add `펼치기` to show up to 50 items on the first page.
- Add 50-item pagination with `이전` and `다음`.
- Render source type, title, publication/review date when available, and collection status.
- Link `RAW data 보기` to the existing RAW viewer.

Run:

```bash
cd poc-server
npm test -- collectionProgressPage.test.ts collectionProgressApi.test.ts
```

Expected: PASS.

### Task 4: Make Analysis Execution Visible And Server-Driven

**Files:**

- Modify: `poc-server/test/selectionPage.test.ts`
- Modify: `poc-server/test/selectionApi.test.ts`
- Modify: `web/05_AI학습_콘텐츠선택.html`
- Modify: `web/content_selection.js`

- [x] **Step 1: Add RED static tests for analysis progress feedback**

Update `selectionPage.test.ts` to assert:

- `05_AI학습_콘텐츠선택.html` has an analysis progress container or modal hook, such as `selection-analysis-progress`.
- `content_selection.js` posts to `/api/analysis-runs`, then posts to `/api/analysis-runs/${analysisRunId}/start`.
- The UI renders at least these steps: `분석 실행 준비`, `콘텐츠 확정`, `AI 분석`, `룰셋 생성`, `학습 현황 이동`.

Run:

```bash
cd poc-server
npm test -- selectionPage.test.ts -t "analysis"
```

Expected: FAIL before the page/script updates.

- [x] **Step 2: Add API test for queue-and-start analysis flow**

Update `selectionApi.test.ts` to create an analysis run and call `POST /api/analysis-runs/:analysisRunId/start`.

Expected:

- The run status becomes `completed` in mock mode.
- The response includes a learning snapshot and marketing ruleset.
- The selected item IDs are retained in `analysisRun.result.selectedItemIds`.

Run:

```bash
cd poc-server
npm test -- selectionApi.test.ts -t "starts analysis"
```

Expected: PASS if existing API already supports it; FAIL only if the route stack in the test needs wiring or the service has a real bug.

- [x] **Step 3: Implement visible analysis progress**

In `content_selection.js`:

- Disable the analysis button on click.
- Show inline progress or a modal with the five steps.
- Create the analysis run.
- Start the analysis run server-side.
- On success, navigate to `06_AI학습_현황.html?storeId=<storeId>&analysisRunId=<analysisRunId>`.
- On failure, keep the user on the page and show the error message.

Run:

```bash
cd poc-server
npm test -- selectionPage.test.ts selectionApi.test.ts
```

Expected: PASS.

### Task 5: Fix Relearning Navigation From Learning Status

**Files:**

- Modify: `poc-server/test/learningStatusPage.test.ts`
- Modify: `web/06_AI학습_현황.html`
- Modify: `web/learning_status.js`

- [x] **Step 1: Add RED static tests for relearn flow**

Update `learningStatusPage.test.ts` to assert:

- The `지금 재학습` button has a stable hook, such as `learning-relearn-btn`.
- `learning_status.js` calls `POST /api/stores/${storeId}/collection-runs`.
- Navigation to `04_AI학습_수집중.html` includes both `storeId` and `runId`.
- Browser code still calls only `poc-server` APIs.

Run:

```bash
cd poc-server
npm test -- learningStatusPage.test.ts -t "relearn"
```

Expected: FAIL because the current button navigates to `04_AI학습_수집중.html` without state.

- [x] **Step 2: Implement relearn run creation**

In `learning_status.js`:

- Add `createCollectionRun(storeId)`.
- Add `goToCollectionProgress(storeId, runId)`.
- Wire `learning-relearn-btn` to create a run and navigate.
- Keep localStorage store ID updated.
- Show a temporary disabled/loading state while the run is being created.

Run:

```bash
cd poc-server
npm test -- learningStatusPage.test.ts
```

Expected: PASS.

### Task 6: Enrich Learning Status API With Real Blog And Place Data

**Files:**

- Create: `poc-server/src/storeLearning/learning/learningStatusPresenters.ts`
- Modify: `poc-server/src/storeLearning/learning/learningStatusService.ts`
- Modify: `poc-server/src/storeLearning/collection/naverPlaceRenderedCollectionProvider.ts`
- Modify: `poc-server/test/learningStatusApi.test.ts`
- Modify: `poc-server/test/naverPlaceRenderedCollectionProvider.test.ts`

- [x] **Step 1: Add RED Blog tab data tests**

Update `learningStatusApi.test.ts` so `GET /api/stores/:storeId/learning-status/blog` returns items with:

- `sourceUrl`
- `publishedAt` from metadata such as `postDate`, `publishedAt`, or `postdate`
- `viewCount` only when real metadata contains views
- `collectedAt` as a fallback, not as the display publication date when publication metadata exists

Run:

```bash
cd poc-server
npm test -- learningStatusApi.test.ts -t "blog tab data"
```

Expected: FAIL because current `itemSummary` only exposes `collectedAt` and summary.

- [x] **Step 2: Add RED Place tab data tests**

Update `learningStatusApi.test.ts` so `GET /api/stores/:storeId/learning-status/place` returns:

- `profile.facts` derived from real profile/store metadata.
- `profile.industrySections`, where hospitals expose `진료과목` from `hospitalInfo.subjects` and do not show generic menu rows when menu data is empty.
- `photos.place` and `photos.visitor` arrays using persisted image URLs.
- `photos.placeMoreUrl` and `photos.visitorMoreUrl` pointing to the relevant Naver Place photo tab URL.
- `reviews[].reviewDate` from `metadata.reviewDate`.
- `reviews[].collectedAt` retained separately.
- `newsItems` empty when no real provider data exists.

Run:

```bash
cd poc-server
npm test -- learningStatusApi.test.ts -t "place tab data"
```

Expected: FAIL because the current place status payload exposes only a profile summary and review summaries.

- [x] **Step 3: Preserve visitor photos and review dates in collection metadata**

In `naverPlaceRenderedCollectionProvider.ts`:

- Keep any review-authored date as `metadata.reviewDate`.
- Preserve review photo URLs as `metadata.photoUrls` or `metadata.visitorPhotoUrls`.
- Preserve profile/place image URLs already imported by the Place provider.
- Do not replace review-authored dates with collection timestamps.

Run:

```bash
cd poc-server
npm test -- naverPlaceRenderedCollectionProvider.test.ts -t "review date"
npm test -- naverPlaceRenderedCollectionProvider.test.ts -t "visitor photo"
```

Expected: PASS after provider metadata is preserved.

- [x] **Step 4: Add learning status presenters**

Create `learningStatusPresenters.ts` with focused helpers:

- `presentBlogItem(item)`
- `presentPlaceProfile(store, profileItem)`
- `presentPlaceReview(item)`
- `presentPlacePhotos(store, items)`
- `presentPlaceIndustrySections(store, metadata)`
- `presentPlaceNews(metadata)`

Use these helpers from `learningStatusService.ts` so route handlers remain thin.

Run:

```bash
cd poc-server
npm test -- learningStatusApi.test.ts
```

Expected: PASS.

### Task 7: Render Learning Status Real Data And Interactions

**Files:**

- Modify: `poc-server/test/learningStatusPage.test.ts`
- Modify: `web/06_AI학습_현황.html`
- Modify: `web/learning_status.js`

- [x] **Step 1: Add RED static tests for Blog interactions**

Update `learningStatusPage.test.ts` to assert:

- Blog rows include a source-open button or link hook, such as `data-blog-source-url`.
- `learning_status.js` uses `window.open(url, '_blank', 'noopener,noreferrer')` or renders safe `target="_blank"` anchors.
- Blog table uses `publishedAt` and `viewCount`, not `selectedForAnalysis` in the 조회수 column.

Run:

```bash
cd poc-server
npm test -- learningStatusPage.test.ts -t "Blog source"
```

Expected: FAIL before rendering changes.

- [x] **Step 2: Add RED static tests for Place interactions**

Update `learningStatusPage.test.ts` to assert:

- The Place tab has dynamic containers for facts, industry sections, place photos, visitor photos, reviews, pagination, and news.
- Static bakery/menu placeholder rows are removed from `06_AI학습_현황.html`.
- Review controls include `펼치기`, `이전`, and `다음`.
- Photo more tiles or buttons can open the Naver Place photo tab URL in a new tab.
- News container is hidden when no `newsItems` exist.

Run:

```bash
cd poc-server
npm test -- learningStatusPage.test.ts -t "Place"
```

Expected: FAIL before rendering changes.

- [x] **Step 3: Render Blog rows from API fields**

In `learning_status.js`:

- Use `item.publishedAt || item.collectedAt` for the displayed date.
- Use `item.viewCount` only when present; otherwise show `-`.
- Render the title as text plus a small clickable open icon/link when `sourceUrl` exists.
- Keep the page API-only; opening the source URL is user navigation, not data fetching.

- [x] **Step 4: Render Place dynamic sections**

In `learning_status.js`:

- Replace static Place HTML with render functions for:
  - facts
  - industry sections
  - place photos
  - visitor photos
  - reviews
  - news
- For hospitals, show `진료과목`, medical equipment, and similar hospital sections when present.
- For restaurants/cafes, show menu only when `menuItems` exist.
- Hide empty sections.

- [x] **Step 5: Implement review paging**

In `learning_status.js`:

- Default review display: 2 rows, preserving current compact view.
- `펼치기`: show 20 reviews.
- Pagination after expand: 20 reviews per page.
- Controls: `이전`, `다음`.
- Display `review.reviewDate` first and use `collectedAt` only for secondary metadata if needed.

Run:

```bash
cd poc-server
npm test -- learningStatusPage.test.ts learningStatusApi.test.ts
```

Expected: PASS.

### Task 8: Validate New Store StoreFacts And Ruleset Empty State

**Files:**

- Modify: `poc-server/test/rulesetApi.test.ts`
- Modify: `poc-server/test/rulesetPage.test.ts`
- Modify: `web/ruleset_editor.js`

- [x] **Step 1: Add tests for real imported store facts**

Add API coverage for a newly imported rendered Place store where no marketing ruleset exists yet.

Expected:

- `GET /api/stores/:storeId/strategy-ruleset` returns safe `storeFacts` from Place metadata when the store exists.
- Operating hours, closed days, parking, and intro come from the current metadata shape.
- Missing ruleset data is represented as an empty/needs-analysis state, not a crash.

Run:

```bash
cd poc-server
npm test -- rulesetApi.test.ts -t "newly imported store"
```

Expected: FAIL if the current ruleset service assumes demo ruleset artifacts.

- [x] **Step 2: Improve empty ruleset guidance**

In `ruleset_editor.js`:

- When no ruleset exists, show a concise explanation:
  - Collection and analysis must run before AI-generated rules are available.
  - Direct Place facts can still be previewed where available.
- Keep the canonical `/strategy-ruleset` API path.

Run:

```bash
cd poc-server
npm test -- rulesetApi.test.ts rulesetPage.test.ts
```

Expected: PASS.

### Task 9: End-To-End Local Smoke

**Files:**

- Modify: `docs/codex/HANDOFF.md`
- Modify: `docs/codex/VALIDATION.md`
- Modify: `docs/codex/PLAN.md`

- [x] **Step 1: Run focused validation**

Run:

```bash
cd poc-server
npm test -- naverPlaceRenderedProvider.test.ts storeRegistrationApi.test.ts trainingSettingsApi.test.ts trainingSettingsPage.test.ts collectionProgressApi.test.ts collectionProgressPage.test.ts selectionApi.test.ts selectionPage.test.ts learningStatusApi.test.ts learningStatusPage.test.ts rulesetApi.test.ts rulesetPage.test.ts staticWebConnectivity.test.ts
npm run typecheck
```

Expected:

- All listed test files pass.
- TypeScript passes.

- [x] **Step 2: Run full server validation**

Run:

```bash
cd poc-server
npm test
npm run demo:store-learning
```

Expected:

- Full test suite passes, allowing already skipped live-provider tests to remain skipped.
- Demo seed succeeds.

- [x] **Step 3: Run manual local flow smoke**

Run:

```bash
cd poc-server
npm run dev
```

Open:

```text
http://localhost:5177/soho_store_register.html
```

Smoke checklist:

- Real Naver Place import creates a store and keeps `storeId` in query/localStorage.
- Learning settings loads Blog/Place URLs and provider-ready Instagram/Daangn/YouTube/TikTok links when detected.
- A Blog limit of 10 is shown as 10 immediately on collection progress.
- Collection progress bottom area shows collected-content review, not analysis selection.
- Content selection page still performs actual analysis selection.
- Clicking `분석 실행` shows progress and starts server-side analysis.
- Learning status Blog rows use real source URLs/dates/views where available.
- Learning status Place tab uses real Place profile/review/photo data and hides missing news.
- `지금 재학습` creates a new run and navigates with `storeId` plus `runId`.
- Ruleset page handles a new store with no ruleset gracefully.

- [x] **Step 4: Record validation**

Update:

- `docs/codex/HANDOFF.md`
- `docs/codex/VALIDATION.md`
- `docs/codex/PLAN.md`

Record:

- Commands run.
- Pass/fail output.
- Manual smoke notes.
- Any live-provider limitations or blocked-provider results.
- Confirmation that `.DS_Store`, SQLite DBs, `.env`, `admin/`, `pc-web/`, and old Event-to-Operation files are untouched.

## Final PR Checklist

- [x] Current branch is `codex/real-store-e2e-hardening`.
- [x] PR base is `develop`.
- [x] `git status --short` excludes `.DS_Store` from staged changes.
- [ ] `git diff --stat` contains only planned files.
      Note: local `.DS_Store` remains modified outside this task and must stay unstaged.
- [x] No `admin/` changes.
- [x] No `pc-web/` changes.
- [x] No `README_POC.md` or `web/event_operation_poc.html` changes.
- [x] Browser code calls only `/api/*` or opens user-clicked source URLs in a new tab.
- [x] No Naver/OpenAI credentials appear in HTML, browser JS, localStorage, query strings, committed fixtures, docs, or screenshots.

## Deferred Follow-Ups

- [ ] Share a persisted Place review cache between registration RAG document generation and AI learning collection. Current behavior still lets each flow collect its own reviews. Future behavior should reuse already collected reviews by `storeId`/Place review identity and fetch only the deficit needed for the target policy.
