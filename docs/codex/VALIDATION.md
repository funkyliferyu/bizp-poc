# Validation

## MILESTONE-12-COLLECTION-DELTA-RELEARNING-CR Task 13 Planned

New our-store-analysis CR has been added to
`docs/codex/MILESTONE_12_COLLECTION_DELTA_RELEARNING_PLAN.md` as Task 13 after
the latest Task 12 validation. Task 13 has not been implemented or validated
yet.

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
