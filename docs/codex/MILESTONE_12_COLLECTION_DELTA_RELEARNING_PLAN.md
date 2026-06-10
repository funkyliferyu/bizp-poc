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
- Audit and clean up the marketing strategy ruleset > 우리 매장 분석 tab:
  verify the field value generation logic, make evidence field-specific,
  replace mock representative treatment subjects with real Place/store data,
  rename `AI 원값` to `초기화`, remove visible AI/source-diagnosis copy, and
  remove the remaining brand automatic input criteria block.
- Clean up the marketing strategy ruleset > 글쓰기 스타일 tab so every
  editable writing-style item has `저장` and `초기화`, no `근거 보기` action,
  server-derived current-value logic, server-derived right-side AI suggestion
  text/evidence, and placeholder-style rendering when no real value has been
  inferred or entered.
- Treat source-exhausted or already-collected runs as a no-new-content state:
  do not show rendered Place review placeholders as failures, do not mark
  Place profile review-count changes as meaningful profile changes, and dim the
  collection progress screen's analysis selection button when there is nothing
  new to analyze.
- Backfill missing legacy `reviewWeakness` ruleset fields from collected
  review/blog evidence so the 우리 매장 분석 tab does not fall back to the same
  static mock weakness copy and still exposes save/reset/evidence actions.
- Replace example-only clinic names in required Blog footer copy with the
  current store/hospital name before displaying or generating the ruleset.
- Remove the redundant field-state text shown to the right of action buttons
  when the action row already includes an `초기화` button.

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
- Do not connect our-store-analysis reference examples to live competitor or
  external benchmark providers in this follow-up. This task only audits the
  existing ruleset field logic and fixes the current store-analysis tab.
- Do not leave source-matrix diagnostics, future improvement copy, or
  `AI 처리`/`AI 판단` labels visible in the 우리 매장 분석 tab after cleanup.
- Do not use static browser-only right-side AI suggestion fixtures for the
  글쓰기 스타일 tab after Task 14. The browser may render fallback copy only
  as an explicit placeholder/empty state, not as a saved current value.
- Do not remove evidence APIs globally in this task. Remove the visible
  `근거 보기` action from 글쓰기 스타일 rows only unless a future task broadens
  that rule to other tabs.
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

### Task 13: Our Store Analysis Logic, Evidence, And UI Cleanup

**Files:**

- Inspect/modify: `web/07_마케팅전략룰셋.html`
- Inspect/modify: `web/ruleset_editor.js`
- Inspect/modify: `poc-server/src/storeLearning/rulesets/rulesetService.ts`
- Inspect/modify: `poc-server/src/storeLearning/rulesets/rulesetSourceMatrix.ts`
- Inspect/modify: `poc-server/src/storeLearning/analysis/analyzer.ts`
- Inspect/modify if live analyzer contract changes:
  `poc-server/src/storeLearning/analysis/openAIAnalysisProvider.ts`
- Inspect/modify if evidence persistence changes:
  `poc-server/src/storeLearning/analysis/analysisExecutionService.ts`
- Modify: `poc-server/test/rulesetPage.test.ts`
- Modify if API evidence/value contract changes:
  `poc-server/test/rulesetApi.test.ts`
- Modify if analyzer output contract changes:
  `poc-server/test/analysisExecutionApi.test.ts`

- [x] Add a short code-path audit before changing behavior. Record in
      `docs/codex/HANDOFF.md` that:
      - `web/07_마케팅전략룰셋.html` owns the static 우리 매장 분석 markup,
        visible labels, buttons, and remaining
        `data-source-matrix-section="brand"` block.
      - `web/ruleset_editor.js` owns API hydration, field aliases,
        healthcare label switching, reset/evidence button rendering, source
        badges, source notes, reference panels, and source matrix rendering.
      - `poc-server/src/storeLearning/rulesets/rulesetService.ts` owns
        `/strategy-ruleset` payloads, `storeFacts`, current source-matrix
        values, field reset/save, and the field evidence API.
      - `poc-server/src/storeLearning/rulesets/rulesetSourceMatrix.ts` owns
        canonical ruleset field definitions, labels, input-source descriptions,
        automation labels, and future-suggestion text.
      - `poc-server/src/storeLearning/analysis/analyzer.ts` owns mock
        deterministic field values and `rulesetFields[].evidenceItemIds`.
      - `poc-server/src/storeLearning/analysis/openAIAnalysisProvider.ts` owns
        the live analyzer prompt/structured output contract.
      - `poc-server/src/storeLearning/analysis/analysisExecutionService.ts`
        owns persistence of `analysis_evidence` and `ruleset_fields`.
- [x] Add RED tests proving 우리 매장 분석 has no visible
      `data-source-matrix-section="brand"` block and no visible
      `자동 입력 기준` copy.
- [x] Add RED tests proving 우리 매장 분석 no longer renders visible
      `AI 처리`, `AI 판단`, or `개선 제안` source/diagnosis copy.
- [x] Add RED tests proving the field action button text is `초기화`, not
      `AI 원값`, and the idle/reset state copy also uses `초기화` where visible.
- [x] Add RED tests proving healthcare stores render real representative
      treatment subjects from Place/store metadata, such as
      `metadata.naverPlaceParsed.hospitalInfo.subjects`, instead of bakery
      mock menu copy like `커스텀 레터링 케이크`.
- [x] Add RED tests proving generic/non-healthcare stores still render
      representative menu data from Place menu metadata or existing ruleset
      fields, and do not show the healthcare `대표 진료과목` label.
- [x] Add RED API/evidence tests proving `근거 보기` can return field-specific
      evidence summaries. The same collection item may support multiple fields,
      but the modal copy must explain why that item supports the requested
      field rather than showing the same generic summary for every field.
- [x] Inspect the current evidence model before changing it. Current behavior
      links `ruleset_fields.evidence_item_ids_json` to collection item IDs and
      shows `analysis_evidence.summary` by item; if the analyzer does not
      persist field-specific evidence, multiple fields can show the same modal
      copy. Prefer adding field-specific evidence through existing
      `analysis_evidence.metadata.fieldKey` or equivalent JSON metadata before
      adding a new table.
- [x] Update the analyzer output contract only as much as needed to preserve
      field-specific evidence. If extending `AnalyzerOutputSchema`, keep
      backward compatibility for existing mock/openai output where possible.
      The analyzer schema stayed backward-compatible; field-specific evidence
      is derived from existing `rulesetFields[].evidenceItemIds` and persisted
      in `analysis_evidence.metadata.fieldEvidence`.
- [x] Update `analysisExecutionService.ts` so field-specific evidence is
      persisted with provider/mode and field key metadata, without changing
      browser-side provider boundaries.
- [x] Update `rulesetService.ts` so `buildRulesetFieldEvidence` prefers
      evidence rows matching the requested field key and falls back to item
      excerpts only when field-specific evidence is absent.
- [x] Update the representative offering resolver so healthcare categories
      derive `representativeTreatmentSubjects` from real store/Place metadata
      first, then ruleset fields, then a clear empty/manual-needed state. Do
      not fall back to bakery mock menu strings for hospital/clinic stores.
- [x] Update `web/07_마케팅전략룰셋.html` and `web/ruleset_editor.js` to remove
      the brand source matrix block from the visible 우리 매장 분석 tab.
- [x] Update `web/ruleset_editor.js` so source badges/notes and action states
      in the 우리 매장 분석 tab use product-facing language only. Remove visible
      technical diagnostics such as `AI 처리`, `AI 판단`, and `개선 제안`.
- [x] Update reset controls so button/state copy says `초기화`.
- [x] Keep `근거 보기` visible if the field has evidence, but ensure the modal
      title/description uses Korean product copy and field-specific evidence.
- [x] Preserve browser API boundaries: no browser-side Naver, OpenAI,
      competitor discovery, scraping, or external provider calls.
- [x] Run `cd poc-server && npm test -- rulesetPage.test.ts`.
- [x] If evidence/API contracts changed, run
      `cd poc-server && npm test -- rulesetApi.test.ts analysisExecutionApi.test.ts`.
- [x] Run `cd poc-server && npm run typecheck`.
- [x] Run `git diff --check`.

### Task 14: Writing Style Actions, Suggestions, And Empty-Value Styling

**Files:**

- Inspect/modify: `web/07_마케팅전략룰셋.html`
- Inspect/modify: `web/ruleset_editor.js`
- Inspect/modify: `poc-server/src/storeLearning/rulesets/rulesetService.ts`
- Inspect/modify: `poc-server/src/storeLearning/rulesets/rulesetSourceMatrix.ts`
- Inspect/modify: `poc-server/src/storeLearning/analysis/analyzer.ts`
- Inspect/modify if live analyzer prompt needs the same contract:
  `poc-server/src/storeLearning/analysis/openAIAnalysisProvider.ts`
- Inspect/modify if seed/demo data needs realistic current/suggestion values:
  `poc-server/src/seedStoreLearning.ts`
- Modify: `poc-server/test/rulesetPage.test.ts`
- Modify if API contract changes:
  `poc-server/test/rulesetApi.test.ts`
- Modify if analyzer/seed contract changes:
  `poc-server/test/analysisExecutionApi.test.ts`

- [x] Add RED static tests proving every visible 글쓰기 스타일 editable
      field row has `저장` and `초기화` actions after hydration. Include the
      common rows and channel rows currently shown in the tab: `blogPurpose`,
      `blogWritingStyle`, `blogPreferredLength`, `blogHashtags`,
      `blogEmojiPolicy`, `seoKeywords`, `ctaStyle`, `industryCommonRules`,
      `blogRequiredIntroCopy`, and `blogRequiredFooterCopy`.
- [x] Add RED static tests proving 글쓰기 스타일 rows do not render the
      `근거 보기` action. Keep `근거 보기` behavior outside this tab unchanged
      unless a later CR asks to remove it elsewhere.
- [x] Add RED API tests proving the ruleset payload exposes, for each
      writing-style field, a server-derived object with:
      `fieldKey`, `currentValue`, `currentValueStatus`, `calculationLogic`,
      `aiSuggestion.value`, `aiSuggestion.judgment`, `aiSuggestion.evidence`,
      and `aiSuggestion.inputSignals`.
- [x] Define `currentValueStatus` values in the plan implementation as
      `inferred`, `user_edited`, `placeholder`, or `empty`. Use `placeholder`
      when the UI has guidance copy but no real inferred/saved value.
- [x] Add RED tests proving placeholder-only values render with an input-empty
      style instead of looking like saved text. The DOM should expose a stable
      class or data attribute such as `data-placeholder-value="true"` and
      must not send that placeholder text as the user value when saving unless
      the user edits it.
- [x] Inspect current writing-style value sources before implementing:
      static HTML defaults, seeded `ruleset_fields`, analyzer field values,
      healthcare defaults in `web/ruleset_editor.js`, and source-matrix rows.
      Record the code-path summary in `docs/codex/HANDOFF.md`.
- [x] Add a server-side writer for writing-style derivation in
      `rulesetService.ts`, for example `buildWritingStyleFieldInsights()`.
      The function should use existing ruleset fields, source-matrix labels,
      store category, selected Blog/Place evidence summaries, and healthcare
      defaults to produce current-value logic plus AI-suggestion payloads.
- [x] Keep the first implementation deterministic and local to `poc-server`.
      Do not call OpenAI/Naver from the browser, and do not introduce live
      competitor/provider calls for these suggestions.
- [x] Update `analysis/analyzer.ts` seed/mock field values only where needed
      so Blog purpose, sentence style, preferred length, hashtags, emoji
      policy, SEO keywords, CTA, industry-common rules, and required intro/
      footer copy have distinguishable current values and evidence signals.
- [x] If `openAIAnalysisProvider.ts` already emits or validates these fields,
      update its prompt/schema comments to preserve the same field names and
      evidence expectations. Do not require live-provider tests for this task.
- [x] Update `web/ruleset_editor.js` so the 글쓰기 스타일 right-side AI
      suggestion panel renders from the API payload, not hardcoded browser
      fixture copy. Show `현행유지` when the conservative judgment finds no
      meaningful improvement, and `개선 제안` only when the API marks it.
- [x] Update `web/ruleset_editor.js` so every 글쓰기 스타일 editable field
      receives the same save/reset affordance. The action row should omit
      `근거 보기` for this tab while still using existing PATCH/reset APIs.
- [x] Update `web/ruleset_editor.js` so placeholder-value rows look like empty
      input controls, retain helpful placeholder text for the user, and save
      only real user-entered text.
- [x] Preserve existing writing-style healthcare defaults, but mark them as
      real inferred defaults only when the store category is healthcare and
      the value is meant to be applied to generation. Otherwise show guidance
      as placeholder/empty style.
- [x] Run
      `cd poc-server && npm test -- rulesetPage.test.ts rulesetApi.test.ts analysisExecutionApi.test.ts`.
- [x] Run `cd poc-server && npm run typecheck`.
- [x] Run `cd poc-server && npm test`.
- [x] Run `cd poc-server && npm run demo:store-learning`.
- [x] Run `git diff --check`.
- [x] Smoke test `http://localhost:5177/07_%EB%A7%88%EC%BC%80%ED%8C%85%EC%A0%84%EB%9E%B5%EB%A3%B0%EC%85%8B.html?storeId=store_12841526`
      on the 글쓰기 스타일 tab: every field has save/reset, no evidence
      button, AI suggestion cards are API-backed, and placeholder rows look
      empty rather than saved.

### Task 15: No-New-Content Collection State Hardening

**Files:**

- Modify: `poc-server/src/storeLearning/collection/collectionItemIdentity.ts`
- Modify: `poc-server/src/storeLearning/collection/naverPlaceRenderedCollectionProvider.ts`
- Modify: `poc-server/src/storeLearning/routes/collectionRuns.ts`
- Modify: `web/collection_progress.js`
- Modify: `poc-server/test/collectionItemIdentity.test.ts`
- Modify: `poc-server/test/naverPlaceRenderedCollectionProvider.test.ts`
- Modify: `poc-server/test/selectionApi.test.ts`
- Modify: `poc-server/test/collectionProgressPage.test.ts`

- [x] Add RED tests proving Place profile fingerprints stay stable when only
      review counters change.
- [x] Add RED tests proving the rendered Place provider does not create failed
      review placeholders when GraphQL cannot confirm additional reviews.
- [x] Add RED tests proving no-meaningful-change collection runs expose no
      selectable analysis items.
- [x] Add RED static tests proving the collection progress page shows
      `새로 가져올 항목이 존재하지 않습니다.` and disables the analysis
      selection button.
- [x] Remove review-count statistics from Place profile fingerprinting so
      counts alone do not trigger `changed`.
- [x] Stop creating rendered Place `rendered_place_review_not_found` failed
      placeholders for unconfirmed remaining review slots.
- [x] Return an empty selectable item list for collection runs whose
      `summary.collectionDelta.hasMeaningfulChanges` is `false`.
- [x] Update collection progress UI no-change messaging and disable the
      analysis selection CTA with `새로 분석할 콘텐츠가 없습니다.` tooltip.
- [x] Run
      `cd poc-server && npm test -- --run test/collectionItemIdentity.test.ts test/naverPlaceRenderedCollectionProvider.test.ts test/selectionApi.test.ts test/collectionProgressPage.test.ts`.
- [x] Run `cd poc-server && npm run typecheck`.
- [x] Run `cd poc-server && npm test`.
- [x] Run `cd poc-server && npm run demo:store-learning`.
- [x] Run `node --check web/collection_progress.js`.
- [x] Run `git diff --check`.
- [x] Smoke test the collection progress page on `localhost:5177` with a
      no-meaningful-change run: the no-new text is visible and the analysis
      selection button is disabled.

### Task 16: Review Weakness Legacy Backfill And Actions

**Files:**

- Modify: `poc-server/src/storeLearning/rulesets/rulesetService.ts`
- Modify: `poc-server/src/storeLearning/rulesets/rulesetSourceMatrix.ts`
- Modify: `poc-server/test/rulesetApi.test.ts`

- [x] Add RED API tests proving a legacy ruleset without `reviewWeakness`
      receives a server-side backfilled `reviewWeakness` field.
- [x] Prove the backfilled value is derived from collected review evidence and
      does not reuse the static browser fallback copy such as
      `주차 공간 협소, 현금 결제 불가 언급`.
- [x] Prove the evidence API works for the backfilled field so the browser can
      render `근거 보기`.
- [x] Prove PATCH save and reset routes work for the backfilled field, enabling
      the visible `저장` and `초기화` actions.
- [x] Update the source-matrix implementation note so `reviewWeakness` is no
      longer described as a static UI sample.
- [x] Add lazy backfill in the ruleset payload path: when the latest marketing
      ruleset lacks `reviewWeakness`, derive a conservative strategy-only
      weakness summary from collected Place review/Blog text and persist it as
      `analysis_backfill`.
- [x] Exclude failed placeholder review items from the backfill by using only
      `status = collected` content.
- [x] Run
      `cd poc-server && npm test -- --run test/rulesetApi.test.ts -t "review weakness|field source matrix"`.
- [x] Run `cd poc-server && npm test -- --run test/rulesetApi.test.ts test/rulesetPage.test.ts`.
- [x] Run `cd poc-server && npm run typecheck`.
- [x] Run `cd poc-server && npm test`.
- [x] Run `cd poc-server && npm run demo:store-learning`.
- [x] Run `node --check web/ruleset_editor.js`.
- [x] Run `git diff --check`.
- [x] Smoke test `store_1020864025` on localhost: `reviewWeakness` displays
      collected-review-derived values and shows `저장`, `초기화`, and
      `근거 보기`; evidence opens with collected review excerpts.

### Task 17: Required Footer Store Name And Action-State Cleanup

**Files:**

- Modify: `poc-server/src/storeLearning/rulesets/rulesetService.ts`
- Modify if seeded/demo medical footer copy needs normalization:
  `poc-server/src/storeLearning/analysis/analyzer.ts`
- Modify: `web/ruleset_editor.js`
- Modify: `poc-server/test/rulesetApi.test.ts`
- Modify: `poc-server/test/rulesetPage.test.ts`

- [x] Add RED API tests proving healthcare `blogRequiredFooterCopy` uses the
      current store/hospital name, not the example text `테라스의원`, for stores
      such as `서구연세정형외과의원`.
- [x] Normalize the medical footer template server-side so example-only clinic
      names are replaced with `store.name` before the field is serialized as
      the current value or writing-style insight value.
- [x] Preserve explicitly user-edited footer copy as-is unless it still matches
      the known default/example template and has not been locked by the user.
- [x] Add RED static/browser-script tests proving the action row does not show
      redundant state text such as the trailing `초기화` to the right of the
      `저장`/`초기화` buttons in normal loaded rows.
- [x] Keep the `초기화` button itself visible and functional.
- [x] Keep transient operational states such as `저장 중`, `저장됨`, `복원 중`,
      and `처리 실패` available only when they are actively set after an action.
- [x] Update `web/ruleset_editor.js` so the default loaded state text is empty
      or hidden when no action is in progress.
- [x] Run `cd poc-server && npm test -- rulesetApi rulesetPage`.
- [x] Run `cd poc-server && npm run typecheck`.
- [x] Run `cd poc-server && npm test`.
- [x] Run `cd poc-server && npm run demo:store-learning`.
- [x] Run `node --check web/ruleset_editor.js`.
- [x] Run `git diff --check`.
- [x] Smoke test the 글쓰기 스타일 tab on localhost for
      `store_12841526`: the required footer uses `서구연세정형외과의원`, and
      action rows show the `초기화` button without a duplicate trailing
      `초기화` label.
