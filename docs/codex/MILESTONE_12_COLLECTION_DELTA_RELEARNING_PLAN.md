# Collection Delta And Relearning Skip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent unchanged re-learning from re-running AI analysis, fix learning status date/review display details, and track additional ruleset UI CR feedback.

**Architecture:** Keep provider calls server-side and keep the first correctness step post-collection: collect provider drafts, compare them with persisted items, store delta summary metadata, and only then decide whether analysis has meaningful new input. Reuse the latest completed analysis artifacts when the current collection run has no new Blog posts, no new Place reviews, and an unchanged Place profile. Treat ruleset UI cleanup as browser UI follow-up driven by existing `poc-server` ruleset APIs unless tests prove an API contract is missing.

**Tech Stack:** Express/TypeScript, Vitest, SQLite repositories, static HTML/CSS/JS under `web/`.

---

## Scope

Included:

- Add Place profile identity/fingerprint comparison.
- Add collection delta summary values for `new`, `duplicate`, `unchanged`, and `changed`.
- Skip analyzer execution when a collection run has no meaningful changes and a previous completed learning result exists.
- Reuse latest completed analysis/snapshot/ruleset artifacts for the skipped analysis run.
- Update collection and selection UI messaging for no-change runs.
- Show real Blog publication dates instead of collection dates.
- Show 5 Place reviews in the collapsed learning status state.
- Apply marketing strategy ruleset store-info improvement suggestions only for
  운영시간, 휴무일, and 주차.
- Remove the lower automatic input criteria/source matrix block from the
  marketing strategy ruleset UI.
- Mark every our-store-analysis reference box as a red common example title,
  for example `(공통예시) 포지셔닝 참고`.
- Add category-aware field visibility/label rules, such as replacing
  `대표 메뉴` with `대표 진료과목` for hospital/clinic stores.
- Add writing-style controls for industry-common rules and mandatory Blog
  intro/footer copy, especially healthcare medical-law footer text.
- Redesign writing style as a current AI-inferred style plus conservative
  AI-suggestion page, including CTA-improvement evidence.
- Clean up the image-style tab so static image guidance is labeled as a red
  common example, removes AI/source-improvement copy, removes the visible
  automatic input criteria block, and promotes ratio/format plus text overlay
  fields into the top image-style controls.
- Mark the similar-comparison tab/block as a red common example with the title
  `(공통예시) 유사업체비교`.
- When the marketing strategy ruleset has no parking information, show
  `수동입력 필요` instead of `주차 정보 수집 중`, and provide a right-aligned
  `매장정보에서 입력하기` action that opens the current store in the store
  registration screen focused on parking input.

Excluded:

- Do not optimize provider fetches before comparison in this milestone.
- Do not add real Instagram/Daangn/YouTube/TikTok providers.
- Do not apply store-info improvement suggestions for fields not mentioned in
  the ruleset CR, including name, category, address, phone, business number,
  and store intro.
- Do not connect our-store-analysis reference boxes to real benchmark data or
  store-specific evidence in this pass; they remain clearly labeled examples.
- Do not provide legal advice or fetch external legal/medical sources from the
  browser. Use the provided reference copy as editable required content for this
  PoC flow.
- Do not expose writing-style source matrix rows in the user-facing UI after
  the redesign. Keep implementation/source metadata behind API/tests if needed.
- Do not connect image-style examples to real image analysis or external image
  providers in this pass. Treat the image-style block as common example
  guidance until real image asset analysis is explicitly scoped.
- Do not connect similar-comparison examples to real competitor discovery or
  external benchmark providers in this pass. This CR only changes the visible
  example labeling.
- Do not re-run Place collection or infer parking availability when Place/store
  data is missing parking information. Missing parking is a manual input state
  in the ruleset UI.
- Do not modify `admin/`, `pc-web/`, `README_POC.md`, `web/event_operation_poc.html`, or old Event-to-Operation files.
- Do not stage `.DS_Store`, runtime SQLite DBs, `.env`, screenshots, or generated artifacts.

## Tasks

### Task 1: Collection Delta Contract

**Files:**

- Modify: `poc-server/src/storeLearning/collection/collectionItemIdentity.ts`
- Modify: `poc-server/src/storeLearning/collection/collectionRunner.ts`
- Modify: `poc-server/test/collectionProgressApi.test.ts`

- [x] Add RED tests proving repeated runs record duplicate Blog/review items and unchanged Place profile without saving a new profile item.
- [x] Add profile identity/fingerprint helpers.
- [x] Store `summary.collectionDelta` on collection runs.
- [x] Persist `metadata.collectionDelta` and `metadata.profileFingerprint` on saved profile items.
- [x] Run `cd poc-server && npm test -- collectionProgressApi.test.ts`.

### Task 2: Analysis No-Op Reuse

**Files:**

- Modify: `poc-server/src/storeLearning/routes/analysisRuns.ts`
- Modify: `poc-server/src/storeLearning/analysis/analysisExecutionService.ts`
- Modify: `poc-server/test/analysisExecutionApi.test.ts`
- Modify: `poc-server/test/selectionApi.test.ts`

- [x] Add RED tests proving no-change collection runs can create a completed skipped analysis run with empty selected items.
- [x] Add artifact reuse in `getAnalysisArtifacts` for skipped analysis runs.
- [x] Mark skipped runs with `result.skippedReason`, `result.reusedAnalysisRunId`, `result.learningSnapshotId`, and `result.marketingRulesetId`.
- [x] Preserve the existing error path when no previous completed analysis exists.
- [x] Run `cd poc-server && npm test -- analysisExecutionApi.test.ts selectionApi.test.ts`.

### Task 3: Browser No-Change Messaging

**Files:**

- Modify: `web/collection_progress.js`
- Modify: `web/content_selection.js`
- Modify: `poc-server/test/collectionProgressPage.test.ts`
- Modify: `poc-server/test/selectionPage.test.ts`

- [x] Add RED static tests for collection delta messages and no-change analysis button behavior.
- [x] Show 신규 수집 0개, 기존 캐시 재사용, and 플레이스 정보 변경 없음 from `collectionDelta`.
- [x] Allow the selection page to create a skipped analysis run when selected item count is 0 and the server marks the run as no-change.
- [x] Run `cd poc-server && npm test -- collectionProgressPage.test.ts selectionPage.test.ts`.

### Task 4: Learning Status Display Fixes

**Files:**

- Modify: `poc-server/src/storeLearning/learning/learningStatusPresenters.ts`
- Modify: `web/learning_status.js`
- Modify: `web/content_selection.js`
- Modify: `poc-server/test/learningStatusApi.test.ts`
- Modify: `poc-server/test/learningStatusPage.test.ts`
- Modify: `poc-server/test/selectionPage.test.ts`

- [x] Add RED tests proving Blog `publishedAt` does not fall back to `collectedAt`.
- [x] Add RED static tests proving learning status collapsed Place reviews show 5 rows.
- [x] Render unknown publication dates as `-`.
- [x] Use provider metadata publication date in the selection page Blog `발행일` column.
- [x] Run `cd poc-server && npm test -- learningStatusApi.test.ts learningStatusPage.test.ts selectionPage.test.ts`.

### Task 5: Final Validation And Docs

**Files:**

- Modify: `docs/codex/PLAN.md`
- Modify: `docs/codex/HANDOFF.md`
- Modify: `docs/codex/VALIDATION.md`

- [x] Run `cd poc-server && npm run typecheck`.
- [x] Run `cd poc-server && npm test`.
- [x] Run `cd poc-server && npm run demo:store-learning`.
- [x] Run `git diff --check`.
- [x] Record validation and handoff notes.

### Task 6: Ruleset Store Info UI Cleanup

**Files:**

- Modify: `web/07_마케팅전략룰셋.html`
- Modify: `web/ruleset_editor.js`
- Modify: `poc-server/test/rulesetPage.test.ts`
- Modify only if an existing response field is missing:
  `poc-server/src/storeLearning/routes/strategyRuleset.ts`
- Modify only if the API contract changes:
  `poc-server/test/rulesetApi.test.ts`

- [x] Add RED tests in `poc-server/test/rulesetPage.test.ts` proving the
      marketing ruleset store tab no longer renders the lower automatic input
      criteria/source matrix block.
- [x] Add RED tests proving only `operatingHours`, `closedDays`, and `parking`
      receive the applied store-info improvement behavior.
- [x] Add RED tests proving unmentioned store-info fields do not render
      "개선 제안" note blocks, including name, category, address, phone,
      business number, and store intro.
- [x] Update `web/ruleset_editor.js` so store-info rows render direct
      Place/store values for 운영시간, 휴무일, and 주차 without showing the
      current "future improvement" suggestion copy after application.
- [x] Update `web/ruleset_editor.js` so unmentioned store-info rows reject or
      hide improvement suggestions instead of applying them silently.
- [x] Remove the store tab's lower automatic input criteria/source matrix
      container from `web/07_마케팅전략룰셋.html`, and remove any unused browser
      rendering path if no remaining visible tab needs it.
- [x] Run `cd poc-server && npm test -- rulesetPage.test.ts`.
- [x] API changes were not needed; ran
      `cd poc-server && npm test -- staticWebConnectivity.test.ts rulesetApi.test.ts`
      as related regression coverage.
- [x] Run `cd poc-server && npm run typecheck`.
- [x] Run `git diff --check`.

### Task 7: Ruleset Reference Examples And Industry Fields

**Files:**

- Modify: `web/07_마케팅전략룰셋.html`
- Modify: `web/ruleset_editor.js`
- Modify: `poc-server/test/rulesetPage.test.ts`
- Modify only if category/type metadata is missing from the response:
  `poc-server/src/storeLearning/routes/strategyRuleset.ts`
- Modify only if the API contract changes:
  `poc-server/test/rulesetApi.test.ts`

- [x] Add RED tests in `poc-server/test/rulesetPage.test.ts` proving the
      reference panel title uses the exact prefix format
      `(공통예시) 포지셔닝 참고` for the default positioning reference.
- [x] Add RED tests proving all reference buttons/panels use the same
      `(공통예시) ... 참고` title format, including positioning, strength,
      menu or treatment-subject, target, content keywords, review strength,
      and review weakness.
- [x] Add RED tests proving the common-example title treatment is rendered in
      red, either through a dedicated class or explicit CSS on the reference
      panel title.
- [x] Add RED tests proving reference boxes do not become real-data connected
      during this pass: no browser-side Naver/OpenAI/external fetches and no
      claim that candidate examples are store-specific live evidence.
- [x] Add RED tests with a hospital/clinic fixture proving the our-store-analysis
      tab hides `대표 메뉴` and shows `대표 진료과목`.
- [x] Add RED tests with a non-healthcare fixture proving the generic/food
      ruleset still shows `대표 메뉴` and does not show `대표 진료과목`.
- [x] Update `web/07_마케팅전략룰셋.html` reference rendering so
      `showReferenceLayer(rowKey)` writes titles such as
      `(공통예시) 포지셔닝 참고` and applies the red example styling for every
      reference key.
- [x] Keep reference data static/illustrative for this milestone. Do not wire
      reference panels to the live store data connection, Naver, OpenAI, or
      external provider calls.
- [x] Add an industry/category resolver in `web/ruleset_editor.js` or a small
      adjacent helper if needed. It should classify hospital/clinic categories
      from store category text such as `병원`, `의원`, `클리닉`, `정형외과`,
      `피부과`, or `치과`.
- [x] Use that resolver to control our-store-analysis field visibility and
      labels: healthcare stores show `대표 진료과목`; generic/food stores show
      `대표 메뉴`.
- [x] The current API payload already exposes enough category metadata; no
      strategy ruleset API contract change was needed.
- [x] Run `cd poc-server && npm test -- rulesetPage.test.ts`.
- [x] API changes were not needed; ran
      `cd poc-server && npm test -- staticWebConnectivity.test.ts rulesetApi.test.ts`
      as related regression coverage.
- [x] Run `cd poc-server && npm run typecheck`.
- [x] Run `git diff --check`.

### Task 8: Writing Style Medical Rules And Required Blog Copy

**Files:**

- Modify: `web/07_마케팅전략룰셋.html`
- Modify: `web/ruleset_editor.js`
- Modify: `poc-server/test/rulesetPage.test.ts`
- Modify if ruleset field persistence/API contract is needed:
  `poc-server/src/storeLearning/rulesets/rulesetSourceMatrix.ts`
- Modify if ruleset field serialization/edit/reset must support new fields:
  `poc-server/src/storeLearning/rulesets/rulesetService.ts`
- Modify if generated Blog preview/content should consume the new required
  copy in this milestone:
  `poc-server/src/storeLearning/blog/blogGenerator.ts`
- Modify if API contract or seed fields change:
  `poc-server/test/rulesetApi.test.ts`
- Modify if Blog generation contract changes:
  `poc-server/test/blogGenerationApi.test.ts`

- [x] Add RED tests in `poc-server/test/rulesetPage.test.ts` proving the
      writing-style common tab has an 업종공통규칙 row/block.
- [x] Add RED tests proving healthcare/medical categories show a common rule
      equivalent to `블로그 하단에 반드시 의료법 관련 내용 포함`.
- [x] Add RED tests proving the attached medical-law footer reference is
      represented as editable text, including:
      `*본 포스팅은 테라스의원에서 의료정보 제공 및 병원 광고 목적으로 직접 작성한 글이며, <의료법 제 56조 제 1항>을 준수합니다.`
      and
      `*모든 시술은 개인의 피부에 따라 크고 작은 부작용이 발생할 수 있습니다. 반드시 사전에 의료진과 충분한 상담을 진행한 후 시술을 결정하시는 것을 권장드립니다.`
- [x] Add RED tests proving generic/non-healthcare stores do not receive the
      medical-law footer copy by default.
- [x] Add RED tests proving the catchphrase area is no longer a single generic
      slogan-only field. It must expose required Blog inclusion controls such as
      intro required copy and footer required copy.
- [x] Add RED tests proving hospital/clinic stores can show repeated Blog intro
      copy guidance, such as representative doctor/profile text, and repeated
      footer copy guidance, such as clinic credentials, hours, phone, and
      compliance disclaimers.
- [x] Update `web/07_마케팅전략룰셋.html` writing-style common tab with an
      industry-common-rules block and required Blog intro/footer copy controls.
- [x] Update `web/ruleset_editor.js` so existing category detection also
      controls writing-style medical rule visibility and non-healthcare
      fallback behavior.
- [x] Keep the required-copy fields editable and lockable using the existing
      ruleset field save/reset actions where possible. If new persisted field
      keys are needed, add the minimum contract, for example:
      `industryCommonRules`, `blogRequiredIntroCopy`, and
      `blogRequiredFooterCopy`.
- [x] If new ruleset field keys are added, update source matrix metadata so
      they appear under the writing-style section with clear source/status
      labels and no browser-side external provider calls.
- [x] Blog preview/generation consumption is deferred; document the contract in
      `docs/codex/HANDOFF.md` and keep UI/API tests ready for the next
      implementation step.
- [x] Run `cd poc-server && npm test -- rulesetPage.test.ts`.
- [x] API fields changed; ran
      `cd poc-server && npm test -- rulesetApi.test.ts rulesetPage.test.ts`.
- [x] Blog generation did not change; ran
      `cd poc-server && npm test -- blogGenerationApi.test.ts rulesetApi.test.ts rulesetPage.test.ts`
      as regression coverage.
- [x] Run `cd poc-server && npm run typecheck`.
- [x] Run `git diff --check`.

### Task 9: Writing Style Current State And AI Suggestions Layout

**Files:**

- Modify: `web/07_마케팅전략룰셋.html`
- Modify: `web/ruleset_editor.js`
- Modify: `poc-server/test/rulesetPage.test.ts`
- Modify if API payload needs structured writing-style suggestions:
  `poc-server/src/storeLearning/rulesets/rulesetService.ts`
- Modify if source matrix metadata should remain API-only:
  `poc-server/src/storeLearning/rulesets/rulesetSourceMatrix.ts`
- Modify if analyzer output needs new style/suggestion fields:
  `poc-server/src/storeLearning/analysis/analyzer.ts`
- Modify if generation consumes new style fields in this milestone:
  `poc-server/src/storeLearning/blog/blogGenerator.ts`
- Modify if API or generation contracts change:
  `poc-server/test/rulesetApi.test.ts`
- Modify if Blog generation changes:
  `poc-server/test/blogGenerationApi.test.ts`

- [x] Add RED tests in `poc-server/test/rulesetPage.test.ts` proving the
      writing-style tab does not render `자동 입력 기준` or a visible
      `data-source-matrix-section="write_common,write_instagram,write_blog"`
      block.
- [x] Add RED tests proving writing style uses a current-style plus AI-suggestion
      layout, with current editable input on the left and an AI suggestion panel
      on the right for each row.
- [x] Add RED tests proving the top-level writing-style controls include
      `글의 목적`, `문장 스타일`, `선호 길이`, `해시태그`, `이모지 사용`,
      `SEO 키워드`, and `CTA`.
- [x] Add RED tests proving `글의 목적` supports at least 3 purpose types and
      documents that generation can randomly select one or more purposes per
      generated post.
- [x] Add RED tests proving `문장 스타일` is a detected style that generation
      should apply consistently.
- [x] Add RED tests proving each required writing-style field has a conservative
      AI judgment state, either `개선 제안` or `현행유지`.
- [x] Add RED tests proving the AI suggestion panel can show improvement text
      and evidence, and that `현행유지` is used when no clear improvement
      opportunity exists.
- [x] Update `web/07_마케팅전략룰셋.html` so the writing-style common area no
      longer reads as a technical settings table. It should present AI-inferred
      current style fields as editable controls.
- [x] Update `web/07_마케팅전략룰셋.html` and `web/ruleset_editor.js` to render
      a right-side AI suggestion panel per field, including judgment,
      suggested text when applicable, and evidence.
- [x] Hide/remove the visible writing-style source matrix container. Preserve
      source/status metadata behind the `poc-server` API only if existing tests
      or internal contracts still need it.
- [x] Ensure `글의 목적` can store/display multiple purpose values and preserves
      user edits/locks with the existing save/reset pattern where possible.
- [x] Ensure `선호 길이`, `해시태그`, `이모지 사용`, `SEO 키워드`, and `CTA`
      are first-class controls in the common writing-style surface, even if
      channel-specific tabs continue to exist.
- [x] Structured AI suggestions remain static UI in this pass. API changes were
      limited to first-class writing-style field keys and covered in
      `poc-server/test/rulesetApi.test.ts`.
- [x] Blog generation consumption of multiple purposes/style fields is deferred;
      ran Blog generation regression tests without changing generator behavior.
- [x] Run `cd poc-server && npm test -- rulesetPage.test.ts`.
- [x] API fields changed; ran
      `cd poc-server && npm test -- rulesetApi.test.ts rulesetPage.test.ts`.
- [x] Blog generation did not change; ran
      `cd poc-server && npm test -- blogGenerationApi.test.ts rulesetApi.test.ts rulesetPage.test.ts`
      as regression coverage.
- [x] Run `cd poc-server && npm run typecheck`.
- [x] Run `git diff --check`.

### Task 10: Image Style Common Example Cleanup

**Files:**

- Modify: `web/07_마케팅전략룰셋.html`
- Modify: `web/ruleset_editor.js`
- Modify: `poc-server/test/rulesetPage.test.ts`
- Modify only if image-style source metadata needs to remain API-only:
  `poc-server/src/storeLearning/rulesets/rulesetSourceMatrix.ts`
- Modify only if API contract changes:
  `poc-server/test/rulesetApi.test.ts`

- [x] Add RED tests in `poc-server/test/rulesetPage.test.ts` proving the image
      style tab title/block is labeled exactly like a common example:
      `(공통예시) 이미지 스타일`.
- [x] Add RED tests proving the common-example image style title is rendered in
      red, using the same or equivalent visual treatment as the existing
      `(공통예시) ... 참고` reference titles.
- [x] Add RED tests proving the visible image-style tab no longer renders
      `AI 처리`, `AI 판단`, or `개선 제안` note/source text.
- [x] Add RED tests proving the visible image-style tab no longer renders the
      `자동 입력 기준` source matrix block or a visible
      `data-source-matrix-section="image_common,image_instagram,image_blog"`
      container.
- [x] Add RED tests proving the content that previously existed only in the
      automatic input criteria block for `비율·포맷` and `텍스트 오버레이` is
      promoted into top image-style controls after `피할 스타일`.
- [x] Update `web/07_마케팅전략룰셋.html` so the image style card/header reads
      `(공통예시) 이미지 스타일` and uses a red common-example title style.
- [x] Update the image style common tab so the field order is:
      주 사용 색상, 강조 색상, 이미지 무드, 주 사용 스타일, 피할 스타일,
      비율·포맷, 텍스트 오버레이.
- [x] Keep Instagram/Blog image-specific tabs only if they are still useful for
      preview/navigation, but do not leave their old automatic-input matrix as a
      visible block.
- [x] Update `web/ruleset_editor.js` so image-style fields do not render
      per-field source notes such as `AI 처리` or `개선 제안` in the visible
      image-style UI.
- [x] Preserve browser API boundaries: do not add browser-side Naver, OpenAI,
      image-analysis, or external provider calls.
- [x] Run `cd poc-server && npm test -- rulesetPage.test.ts`.
- [x] API/source metadata did not change; ran related regression coverage:
      `cd poc-server && npm test -- staticWebConnectivity.test.ts rulesetApi.test.ts`.
- [x] Run `cd poc-server && npm run typecheck`.
- [x] Run `git diff --check`.

### Task 11: Similar Comparison Common Example Label

**Files:**

- Modify: `web/07_마케팅전략룰셋.html`
- Modify: `poc-server/test/rulesetPage.test.ts`
- Modify only if shared common-example title styling needs a helper:
  `web/ruleset_editor.js`

- [x] Add RED tests in `poc-server/test/rulesetPage.test.ts` proving the
      similar-comparison tab/block title is labeled exactly
      `(공통예시) 유사업체비교`.
- [x] Add RED tests proving the `(공통예시) 유사업체비교` title is rendered in
      red, using the same or equivalent common-example styling as the
      our-store-analysis reference panels and planned image-style title.
- [x] Add RED tests proving this pass does not add browser-side Naver, OpenAI,
      competitor discovery, benchmark scraping, or external provider calls.
- [x] Update `web/07_마케팅전략룰셋.html` so the similar-comparison card/header
      reads `(공통예시) 유사업체비교`.
- [x] Apply a red common-example title class or equivalent style to that
      header, reusing existing `.reference-panel-title.common-example` styling
      if it fits the markup.
- [x] Keep the existing comparison type/company/table mock data and interactions
      intact. Do not alter comparison logic, benchmark evidence modals, or
      comparison API contracts in this task.
- [x] Run `cd poc-server && npm test -- rulesetPage.test.ts`.
- [x] Run `cd poc-server && npm run typecheck`.
- [x] Run `git diff --check`.

### Task 12: Ruleset Missing Parking Manual Input CTA

**Files:**

- Modify: `web/07_마케팅전략룰셋.html`
- Modify: `web/ruleset_editor.js`
- Modify: `web/soho_store_register.js`
- Modify: `poc-server/test/rulesetPage.test.ts`
- Modify: `poc-server/test/storeRegistrationPage.test.ts`
- Modify only if the store registration page needs a visible focus target:
  `web/soho_store_register.html`

- [x] Add RED tests in `poc-server/test/rulesetPage.test.ts` proving the
      marketing ruleset store-info tab no longer contains the fallback text
      `주차 정보 수집 중`.
- [x] Add RED tests proving the parking row has a stable hook for a missing
      parking state, for example `data-manual-required-field="parking"`, and
      can render the exact text `수동입력 필요`.
- [x] Add RED tests proving the parking row has a right-aligned
      `매장정보에서 입력하기` action with a stable hook such as
      `data-store-registration-action="parking"`.
- [x] Add RED tests proving the parking action builds an internal browser URL
      only, preserving API boundaries:
      `soho_store_register.html?storeId=<currentStoreId>&focus=parking`.
      The browser must not call Naver/OpenAI/external providers for this
      action.
- [x] Add RED tests in `poc-server/test/storeRegistrationPage.test.ts` proving
      `soho_store_register.js` reads a `storeId` query parameter before
      falling back to `bizplanet.storeRegistration.storeId` in local storage.
- [x] Add RED tests proving `soho_store_register.js` handles `focus=parking`
      by focusing or scrolling to the existing parking controls, using the
      current store's edit screen rather than creating a new store.
- [x] Update `web/07_마케팅전략룰셋.html` so the static parking fallback is
      `수동입력 필요`, not `주차 정보 수집 중`.
- [x] Update `web/07_마케팅전략룰셋.html` so the parking row can display the
      right-aligned `매장정보에서 입력하기` button without disturbing the
      existing store-info row layout.
- [x] Update `web/ruleset_editor.js` with a small parking value normalizer:
      empty, null, `-`, `수집/결과 대기`, or old `주차 정보 수집 중` values
      should render as `수동입력 필요`.
- [x] Update `web/ruleset_editor.js` so the manual parking action is visible
      only for the missing parking state and navigates to
      `soho_store_register.html?storeId=${currentStoreId()}&focus=parking`.
- [x] Update `web/soho_store_register.js` so `currentStoreId` initializes from
      the `storeId` query parameter when present, stores it in local storage,
      and loads that existing store via `GET /api/stores/:storeId`.
- [x] Update `web/soho_store_register.js` so `focus=parking` scrolls to the
      existing parking radio group or parking note input after saved store data
      has populated. Keep the interaction local to the browser page.
- [x] Preserve existing save behavior: after the user edits parking and saves,
      the existing `PUT /api/stores/:storeId` path should update the same
      store, not create a duplicate.
- [x] Run `cd poc-server && npm test -- rulesetPage.test.ts storeRegistrationPage.test.ts`.
- [x] Run `cd poc-server && npm test -- staticWebConnectivity.test.ts rulesetApi.test.ts storeRegistrationApi.test.ts`.
- [x] Run `cd poc-server && npm run typecheck`.
- [x] Run `cd poc-server && npm test`.
- [x] Run `cd poc-server && npm run demo:store-learning`.
- [x] Run `git diff --check`.
- [x] Smoke test the in-app browser ruleset parking action and
      `soho_store_register.html?storeId=<currentStoreId>&focus=parking`
      focus behavior.
- [x] Record validation and handoff notes.
