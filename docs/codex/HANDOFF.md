# Codex Handoff

## Current Scope

CONTENT-001 connects the AI content detail page for the Store Learning & Blog Content Automation PoC to generated blog post data.

This change shows generated article content, media prompts/placeholders, SEO score detail, preview data, deterministic text regeneration, deterministic image prompt regeneration, SEO rescoring, and publish request state transition. It does not call OpenAI, call Naver, generate real images, publish to Naver Blog, redesign the page, or touch `admin/` / `pc-web/`.

## Added Runtime Pieces

- `poc-server/src/storeLearning/blog/blogGenerator.ts`
  - Extends blog post detail shaping with:
    - normalized article data
    - media prompt/alt display data
    - itemized SEO rubric
  - Adds deterministic mock text regeneration.
  - Adds deterministic mock image prompt regeneration.
  - Adds structured SEO scoring with Zod validation.
  - Adds server-side preview data and escaped preview HTML.
  - Adds publish request status transition to `publish_requested`.
- `poc-server/src/storeLearning/routes/blogPosts.ts` now exposes:
  - `GET /api/blog-posts/:postId`
  - `POST /api/blog-posts/:postId/regenerate-text`
  - `POST /api/blog-posts/:postId/regenerate-images`
  - `POST /api/blog-posts/:postId/seo-score`
  - `GET /api/blog-posts/:postId/preview`
  - `POST /api/blog-posts/:postId/request-publish`
- `poc-server/src/db/schema.sql`, `poc-server/src/db/migrate.ts`, `poc-server/src/repositories/media_assets.ts`
  - Add `media_assets.prompt` as a local PoC compatibility column for image prompt checks.
- `poc-server/src/seedStoreLearning.ts`
  - Seeds the demo media asset prompt.
- `web/09_AI콘텐츠생성_상세.html`
  - Preserves the existing layout.
  - Adds stable hooks for title, metadata, status, body, media list, SEO score, action buttons, and preview.
  - Loads `content_detail.js`.
- `web/content_detail.js`
  - Loads by `postId` query parameter.
  - Calls poc-server blog detail APIs only.
  - Renders article body, image prompts, SEO total, SEO checklist, preview, and status.
  - Wires text regeneration, image prompt regeneration, SEO rescoring, preview, and publish request.
- `poc-server/test/contentDetailApi.test.ts`
  - Covers detail shape, text regeneration, image prompt regeneration, SEO rescoring, preview, and publish request persistence.
- `poc-server/test/contentDetailPage.test.ts`
  - Covers page hooks and verifies browser code calls only poc-server APIs.

## API Behavior

`GET /api/blog-posts/:postId` returns:

- shaped `blogPost`
- normalized `article`
- source `contentGeneration`
- shaped `mediaAssets` with `prompt`
- itemized `seoScore`

`POST /api/blog-posts/:postId/regenerate-text`:

- uses deterministic mock generation
- preserves ruleset constraints through the existing ruleset-backed generator
- updates `blog_posts.title`, `blog_posts.article_json`, and revision metadata
- creates a new text revision `content_generation`
- creates a fresh itemized `seo_score`

`POST /api/blog-posts/:postId/regenerate-images`:

- does not call image providers
- updates or creates three placeholder `media_assets`
- stores regenerated prompts in both `prompt` and `metadata_json`
- creates a fresh itemized `seo_score`

`POST /api/blog-posts/:postId/seo-score`:

- creates a fresh `seo_scores` row with:
  - title keyword score
  - body keyword score
  - meta description score
  - readability score
  - image alt/prompt score
  - CTA score
  - total score

`GET /api/blog-posts/:postId/preview`:

- returns blog-shaped preview data with escaped HTML for the local PoC preview modal.

`POST /api/blog-posts/:postId/request-publish`:

- updates `blog_posts.status` to `publish_requested`
- updates article status metadata
- does not publish externally

## Guardrails

- Browser pages call poc-server APIs only.
- Mock mode works without external keys.
- No server-side or browser-side OpenAI calls were added.
- No server-side or browser-side Naver calls were added.
- Image regeneration is prompt/placeholder regeneration only.
- Publish request is a local status transition only.
- Existing Event-to-Operation workflows were not modified.
- `admin/` and `pc-web/` were not modified.
- `web/09_AI콘텐츠생성_상세.html` was not redesigned; only hooks, one SEO button, and a page script include were added.

## Local Run Notes

Run the server from `poc-server/`:

```bash
npm run dev
```

Open:

```text
http://localhost:5177/09_AI콘텐츠생성_상세.html?postId=blog_post_demo_pending_approval
```

Useful API checks:

```bash
curl http://localhost:5177/api/blog-posts/blog_post_demo_pending_approval
curl -X POST http://localhost:5177/api/blog-posts/blog_post_demo_pending_approval/regenerate-text
curl -X POST http://localhost:5177/api/blog-posts/blog_post_demo_pending_approval/regenerate-images
curl -X POST http://localhost:5177/api/blog-posts/blog_post_demo_pending_approval/seo-score
curl http://localhost:5177/api/blog-posts/blog_post_demo_pending_approval/preview
curl -X POST http://localhost:5177/api/blog-posts/blog_post_demo_pending_approval/request-publish
```

Useful DB checks:

```bash
sqlite3 data/store-learning.sqlite "select id, status, title from blog_posts where id='blog_post_demo_pending_approval';"
sqlite3 data/store-learning.sqlite "select blog_post_id, total_score from seo_scores where blog_post_id='blog_post_demo_pending_approval';"
sqlite3 data/store-learning.sqlite "select blog_post_id, asset_type, prompt from media_assets where blog_post_id='blog_post_demo_pending_approval';"
```

## Next Suggested Task

After CONTENT-001 is merged, the next work should decide whether to continue with local approval/publish workflow depth or introduce provider-boundary tasks for real OpenAI/image generation/Naver publishing. Keep those real integrations server-side and behind provider adapters.
