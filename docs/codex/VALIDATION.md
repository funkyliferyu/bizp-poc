# Validation

## LEARN-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run demo
npm run demo:store-learning
```

Manual smoke test:

```bash
npm run dev
```

Then open:

```text
http://localhost:5177/06_AI학습_현황.html?storeId=store_demo_cake
```

Expected page checks:

- Blog tab displays stored Blog learning data.
- Place tab displays stored Place profile/review learning data.
- Instagram tab displays a not-connected/empty state.
- Last analyzed time is populated.
- Ruleset status is populated.

## Expected Coverage

- `npm run db:migrate` applies the Store Learning SQLite schema.
- `npm run db:seed` keeps the demo store seed path idempotent.
- `npm run typecheck` verifies the learning status service, routes, repository usage, and tests compile.
- `npm test` runs existing Event-to-Operation tests plus Store Learning repository, registration, training, collection, selection, analysis, and learning status tests.
- `npm run demo` verifies the existing Event-to-Operation demo still runs.
- `npm run demo:store-learning` verifies the Store Learning demo seed path still runs.
- Manual smoke verifies `06_AI학습_현황.html` renders Blog, Place, and Instagram tabs from backend APIs.

## TDD Evidence

- RED `npm test -- learningStatusApi.test.ts learningStatusPage.test.ts`: failed because the learning status API routes, page IDs, and `learning_status.js` did not exist.
- GREEN `npm test -- learningStatusApi.test.ts learningStatusPage.test.ts`: passed, 2 files / 4 tests.

## Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 20 files / 72 tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the seeded Store Learning summary.

## Manual Browser Smoke

Browser plugin note:

- The Codex in-app browser object was listed but returned a disconnected Playwright browser object in this session.
- The same Browser plugin's Chrome tab control was used as a local browser fallback.

Smoke URL:

```text
http://127.0.0.1:5178/06_AI학습_현황.html?storeId=store_demo_cake
```

Observed page state:

```text
lastAnalyzed=2026.06.06
rulesetStatus=✓ 생성 완료
channelStatusText=네이버 블로그분석 완료 네이버 플레이스분석 완료 인스타그램미연결
blogVisible=10 / 101개 표시
placeReviewCount=8
placeKeywords=당일 제작 상담커스텀 디자인친절한 픽업 안내
instagramEmpty=인스타그램 채널이 연결되지 않았습니다.
instagramVisible=미연결
screenshot=/tmp/learn-001-smoke-final.png
```

Console notes:

- No page script errors were observed.
- Chrome extension warnings appeared from an installed extension script, not from the Store Learning page code.

## LEARN-001 Boundaries

- No browser-side Naver/OpenAI calls are present.
- No real server-side Naver/OpenAI calls are present.
- No analysis generation behavior was changed.
- No ruleset editing behavior was added.
- No blog generation or image generation was added.
- Existing Event-to-Operation workflows should remain behaviorally unchanged.
- `admin/` and `pc-web/` should remain unchanged.
- The generated local SQLite file is under ignored `poc-server/data/`.
