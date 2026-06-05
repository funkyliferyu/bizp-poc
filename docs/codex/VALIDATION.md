# Validation

## CONTENT-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run demo
npm run demo:store-learning
sqlite3 data/store-learning.sqlite "select id, status, title from blog_posts where id='blog_post_demo_pending_approval';"
sqlite3 data/store-learning.sqlite "select blog_post_id, total_score from seo_scores where blog_post_id='blog_post_demo_pending_approval';"
sqlite3 data/store-learning.sqlite "select blog_post_id, asset_type, prompt from media_assets where blog_post_id='blog_post_demo_pending_approval';"
```

Manual smoke test:

```bash
npm run dev
```

Then open:

```text
http://localhost:5177/09_AI콘텐츠생성_상세.html?postId=blog_post_demo_pending_approval
```

Expected page checks:

- Generated title/body load from the API.
- Image placeholder or image prompts display.
- SEO total score displays.
- Six SEO itemized checks display.
- Text regeneration updates body/title and SEO score.
- Image regeneration updates prompt placeholders.
- SEO re-score updates total/checklist data.
- Preview modal displays blog-shaped preview.
- Publish request changes status to `publish_requested`.

## Expected Coverage

- `npm run db:migrate` applies the Store Learning SQLite schema and idempotent `media_assets.prompt` migration.
- `npm run db:seed` keeps the demo store seed path idempotent and seeds demo prompt data.
- `npm run typecheck` verifies the blog detail service, routes, and repository usage compile.
- `npm test` runs existing Event-to-Operation tests plus Store Learning registration, training, collection, selection, analysis, learning, ruleset, blog, and content detail tests.
- `npm run demo` verifies the existing Event-to-Operation demo still runs.
- `npm run demo:store-learning` verifies the Store Learning demo seed path still runs.
- SQLite checks verify blog post publish status, SEO total scores, and media prompts.

## TDD Evidence

- RED `npm test -- contentDetailApi.test.ts contentDetailPage.test.ts`: failed because CONTENT-001 routes/detail shape, `media_assets.prompt`, page hooks, and `web/content_detail.js` did not exist.
- GREEN `npm test -- contentDetailApi.test.ts contentDetailPage.test.ts`: passed, 2 files / 6 tests.

## Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 26 files / 87 tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the seeded Store Learning summary.
- SQLite blog post status spot check: passed.
- SQLite SEO `total_score` spot check: passed.
- SQLite media prompt spot check: passed after single-query retry; parallel SQLite reads can briefly lock the local DB.

SQLite sample after browser smoke:

```text
blog_post_demo_pending_approval|publish_requested|분당 케이크 추천 - 분당 케이크하우스 예약 안내 · 2차 초안

blog_post_demo_pending_approval|86
blog_post_demo_pending_approval|90
blog_post_demo_pending_approval|94
blog_post_demo_pending_approval|94
blog_post_demo_pending_approval|94
blog_post_demo_pending_approval|94
blog_post_demo_pending_approval|94

blog_post_demo_pending_approval|image_prompt|케이크 디테일과 포장 상태를 보여주는 이미지 - 대표 이미지 · 재생성 placeholder 1
blog_post_demo_pending_approval|image_prompt|분당 케이크하우스 레터링 케이크 디테일 이미지 placeholder · 재생성 placeholder 2
blog_post_demo_pending_approval|image_prompt|분당 케이크하우스 픽업 또는 포장 안내 이미지 placeholder · 재생성 placeholder 3
```

## Manual Browser Smoke

Smoke URL:

```text
http://127.0.0.1:5178/09_AI콘텐츠생성_상세.html?postId=blog_post_demo_pending_approval
```

Observed initial state:

```text
title=분당 케이크 맛집 추천 - 당일 제작 레터링 케이크 안내
status=승인 대기
body includes 정자동
imageCount=3
seoTotal=94
seoItemCount=6
```

Observed after actions:

```text
afterTextRegen.title=분당 케이크 추천 - 분당 케이크하우스 예약 안내 · 2차 초안
afterTextRegen.body includes 재생성
afterTextRegen.seoTotal=90
afterImageRegen.imageCount=3
afterImageRegen.firstPrompt includes 재생성 placeholder 1
afterImageRegen.seoTotal=94
afterSeoRescore.seoBadge=총점 94점
afterSeoRescore.labels=제목 키워드, 본문 키워드, 메타 설명, 가독성, 이미지 ALT/프롬프트, CTA
preview.display=flex
preview.bodyHasArticle=true
afterPublish.status=발행 요청
afterPublishReload.buttonText=발행 요청 완료
afterPublishReload.buttonDisabled=true
browserConsoleErrors=[]
```

## CONTENT-001 Boundaries

- No browser-side Naver/OpenAI calls are present.
- No real server-side Naver/OpenAI calls are present.
- No real image generation is present.
- No actual Naver Blog publishing is present.
- Existing Event-to-Operation workflows should remain behaviorally unchanged.
- `admin/` and `pc-web/` should remain unchanged.
- The generated local SQLite file is under ignored `poc-server/data/`.
