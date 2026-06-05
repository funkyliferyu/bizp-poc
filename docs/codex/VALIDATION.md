# Validation

## RULESET-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run demo
npm run demo:store-learning
sqlite3 data/store-learning.sqlite "select field_key, source, locked from ruleset_fields limit 20;"
```

Manual smoke test:

```bash
npm run dev
```

Then open:

```text
http://localhost:5177/07_마케팅전략룰셋.html?storeId=store_demo_cake
```

Expected page checks:

- Ruleset fields are populated from the API.
- A mapped field can be edited and saved.
- Refreshing the page keeps the saved user value.
- Edited fields display locked/user-edited state.
- Evidence view shows linked collection item evidence.
- Reset restores the AI value.

## Expected Coverage

- `npm run db:migrate` applies the Store Learning SQLite schema.
- `npm run db:seed` keeps the demo store seed path idempotent.
- `npm run typecheck` verifies the ruleset service, routes, static page tests, and repository usage compile.
- `npm test` runs existing Event-to-Operation tests plus Store Learning repository, registration, training, collection, selection, analysis, learning status, and ruleset tests.
- `npm run demo` verifies the existing Event-to-Operation demo still runs.
- `npm run demo:store-learning` verifies the Store Learning demo seed path still runs.
- SQLite check verifies persisted field `source` and `locked` values.

## TDD Evidence

- RED `npm test -- rulesetApi.test.ts rulesetPage.test.ts`: failed because the ruleset API routes, page hooks, and `ruleset_editor.js` did not exist.
- GREEN `npm test -- rulesetApi.test.ts rulesetPage.test.ts`: passed, 2 files / 5 tests.

## Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 22 files / 77 tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the seeded Store Learning summary.
- SQLite ruleset field spot check: passed.

SQLite sample:

```text
positioning|analysis|0
contentKeywords|analysis|0
storePositioning|ai_generated|0
keyStrengths|mock_analyzer|0
targetCustomers|mock_analyzer|0
toneAndManner|mock_analyzer|0
blogWritingStyle|mock_analyzer|0
seoKeywords|mock_analyzer|0
ctaStyle|mock_analyzer|0
imageDirection|mock_analyzer|0
negativeExpressions|mock_analyzer|0
```

## Manual Browser Smoke

Smoke URL:

```text
http://127.0.0.1:5178/07_마케팅전략룰셋.html?storeId=store_demo_cake
```

Observed page state:

```text
before.status=v2 · draft
before.value=경기도 성남시 커스텀 케이크 전문점
before.buttonCount=3
afterSave.value=브라우저 스모크 테스트용 분당 레터링 케이크 전략
afterSave.label=포지셔닝 수정됨 locked
afterReload.value=브라우저 스모크 테스트용 분당 레터링 케이크 전략
evidenceModal.display=flex
evidenceModal.title=storePositioning 근거 보기
evidenceModal.evidenceText includes 네이버 플레이스 매장 프로필 and 플레이스 리뷰 요약
afterReset.value=경기도 성남시 커스텀 케이크 전문점
afterReset.label=포지셔닝 AI 분석
logs=[]
```

Browser note:

- The edit/save/reload/evidence/reset flow completed in the in-app browser.
- Full-page and viewport screenshot capture timed out in the browser CDP layer, so no screenshot artifact was retained.

## RULESET-001 Boundaries

- No browser-side Naver/OpenAI calls are present.
- No real server-side Naver/OpenAI calls are present.
- No ruleset regeneration behavior was added.
- No blog generation or image generation was added.
- Existing Event-to-Operation workflows should remain behaviorally unchanged.
- `admin/` and `pc-web/` should remain unchanged.
- The generated local SQLite file is under ignored `poc-server/data/`.
