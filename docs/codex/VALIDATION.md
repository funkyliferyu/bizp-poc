# Validation

## BLOG-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run demo
npm run demo:store-learning
sqlite3 data/store-learning.sqlite "select id, status, title from blog_posts order by created_at desc limit 5;"
sqlite3 data/store-learning.sqlite "select id, store_id from content_generations order by created_at desc limit 5;"
sqlite3 data/store-learning.sqlite "select blog_post_id, total_score from seo_scores order by created_at desc limit 5;"
```

Manual smoke test:

```bash
npm run dev
```

Then open:

```text
http://localhost:5177/02_블로그관리.html?storeId=store_demo_cake
http://localhost:5177/08_AI콘텐츠생성_목록.html?storeId=store_demo_cake
```

Expected page checks:

- Approval-pending blog posts load from the API.
- The AI content list generate button creates a new pending approval draft.
- Pending count updates after generation.
- Clicking a generated post navigates to `09_AI콘텐츠생성_상세.html?postId=...`.
- Browser console has no errors during the smoke path.

## Expected Coverage

- `npm run db:migrate` applies the Store Learning SQLite schema and idempotent `seo_scores.total_score` migration.
- `npm run db:seed` keeps the demo store seed path idempotent and seeds demo blog/SEO data.
- `npm run typecheck` verifies the blog generator, routes, and repository usage compile.
- `npm test` runs existing Event-to-Operation tests plus Store Learning repository, registration, training, collection, selection, analysis, learning status, ruleset, and blog generation tests.
- `npm run demo` verifies the existing Event-to-Operation demo still runs.
- `npm run demo:store-learning` verifies the Store Learning demo seed path still runs.
- SQLite checks verify generated blog posts, content generations, and SEO total scores.

## TDD Evidence

- RED `npm test -- blogGenerationApi.test.ts blogPostPages.test.ts`: failed because the blog post routes, page hooks, and `web/blog_posts.js` did not exist.
- GREEN `npm test -- blogGenerationApi.test.ts blogPostPages.test.ts`: passed, 2 files / 4 tests.

## Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 24 files / 81 tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the seeded Store Learning summary.
- SQLite blog post spot check: passed.
- SQLite content generation spot check: passed.
- SQLite SEO `total_score` spot check: passed.

SQLite sample after browser generation:

```text
blog_post_1780675735795_store_demo_cake|pending_approval|분당 케이크하우스 추천 - 분당 케이크하우스 예약 안내
blog_post_demo_pending_approval|pending_approval|분당 케이크 맛집 추천 - 당일 제작 레터링 케이크 안내

content_generation_blog_1780675735795_store_demo_cake|store_demo_cake
content_generation_demo_blog|store_demo_cake

blog_post_1780675735795_store_demo_cake|86
blog_post_demo_pending_approval|86
```

## Manual Browser Smoke

Smoke URLs:

```text
http://127.0.0.1:5178/08_AI콘텐츠생성_목록.html?storeId=store_demo_cake
http://127.0.0.1:5178/02_블로그관리.html?storeId=store_demo_cake
```

Observed AI content list state:

```text
initial.title=AI 콘텐츠 자동 생성
initial.pending=1건
initial.rows=1
initial.firstStatus=승인 대기
afterGenerate.pending=2건
afterGenerate.rows=2
afterGenerate.firstStatus=승인 대기
afterGenerate.firstPostId=blog_post_1780675735795_store_demo_cake
detail.postIdMatches=true
```

Observed blog management state:

```text
title=블로그 관리
pending=승인 대기 2건
rows=2
firstStatus=승인 대기
firstPostId=blog_post_1780675735795_store_demo_cake
browserConsoleErrors=[]
```

## BLOG-001 Boundaries

- No browser-side Naver/OpenAI calls are present.
- No real server-side Naver/OpenAI calls are present.
- No real image generation is present.
- No detailed editor, regeneration, publish request, analysis, collection, or ruleset regeneration behavior was added.
- Existing Event-to-Operation workflows should remain behaviorally unchanged.
- `admin/` and `pc-web/` should remain unchanged.
- The generated local SQLite file is under ignored `poc-server/data/`.
