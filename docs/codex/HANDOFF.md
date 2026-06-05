# Codex Handoff

## Current Scope

BLOG-001 generates approval-pending blog post drafts for the Store Learning & Blog Content Automation PoC from the current marketing ruleset.

This change adds deterministic mock blog generation, persists generated draft artifacts, and connects the existing blog management/list pages to stored blog posts. It does not call OpenAI, call Naver, generate real images, add regeneration endpoints, publish content, redesign pages, or touch `admin/` / `pc-web/`.

## Added Runtime Pieces

- `poc-server/src/storeLearning/blog/blogGenerator.ts`
  - Finds the latest marketing ruleset for a store.
  - Builds a deterministic blog draft from ruleset fields and store metadata.
  - Validates generated output with `BlogDraftOutputSchema` before persistence.
  - Persists:
    - `content_generation`
    - `blog_post` with `status = pending_approval`
    - image prompt placeholder `media_assets`
    - initial `seo_score`
  - Shapes list/detail responses for browser use.
- `poc-server/src/storeLearning/routes/stores.ts` now also exposes:
  - `POST /api/stores/:storeId/blog-posts/generate`
  - `GET /api/stores/:storeId/blog-posts`
- `poc-server/src/storeLearning/routes/blogPosts.ts`
  - Exposes `GET /api/blog-posts/:postId`.
- `poc-server/src/index.ts`
  - Mounts `/api/blog-posts`.
- `web/blog_posts.js`
  - Loads approval-pending blog posts from poc-server APIs only.
  - Generates a new mock draft from the current ruleset when the list page button is clicked.
  - Renders rows on `02_블로그관리.html` and `08_AI콘텐츠생성_목록.html`.
  - Navigates rows to `09_AI콘텐츠생성_상세.html?postId=...`.
- `web/02_블로그관리.html`
  - Adds `id="blog-pending-count"`, `id="blog-post-list"`, and `blog_posts.js`.
- `web/08_AI콘텐츠생성_목록.html`
  - Adds `id="blog-generate-btn"`, `id="ai-content-pending-count"`, `id="ai-content-list"`, and `blog_posts.js`.
- `poc-server/src/db/schema.sql`, `poc-server/src/db/migrate.ts`, `poc-server/src/repositories/seo_scores.ts`
  - Add `seo_scores.total_score` as a compatibility column while preserving existing `score`.
- `poc-server/src/seedStoreLearning.ts`
  - Seeds demo SEO rows with both `score` and `totalScore`.
- `poc-server/test/blogGenerationApi.test.ts`
  - Covers generation persistence, list API, detail API, media placeholders, and SEO score persistence.
- `poc-server/test/blogPostPages.test.ts`
  - Covers page hooks and confirms browser code only calls poc-server blog post APIs.

## API Behavior

`POST /api/stores/:storeId/blog-posts/generate` returns:

- `contentGeneration`
- shaped `blogPost`
- placeholder `mediaAssets`
- `seoScore`

`GET /api/stores/:storeId/blog-posts` returns:

- store summary
- shaped posts sorted newest first
- `pendingApprovalCount`

`GET /api/blog-posts/:postId` returns:

- shaped blog post
- source content generation
- linked media assets
- latest SEO score

## Guardrails

- Browser pages call poc-server APIs only.
- Mock generation works without external keys.
- No server-side or browser-side OpenAI calls were added.
- No server-side or browser-side Naver calls were added.
- Media records are prompt placeholders only; no image generation is performed.
- No detailed editor, regeneration, publish request, analysis, collection, or ruleset regeneration behavior was added.
- Existing Event-to-Operation workflows were not modified.
- `admin/` and `pc-web/` were not modified.
- Existing HTML pages were not redesigned; only data hooks, one suitable generate button, and a small page script include were added.

## Local Run Notes

Run the server from `poc-server/`:

```bash
npm run dev
```

Open either page:

```text
http://localhost:5177/02_블로그관리.html?storeId=store_demo_cake
http://localhost:5177/08_AI콘텐츠생성_목록.html?storeId=store_demo_cake
```

Useful API checks:

```bash
curl http://localhost:5177/api/stores/store_demo_cake/blog-posts
curl -X POST http://localhost:5177/api/stores/store_demo_cake/blog-posts/generate
curl http://localhost:5177/api/blog-posts/blog_post_demo_pending_approval
```

Useful DB checks:

```bash
sqlite3 data/store-learning.sqlite "select id, status, title from blog_posts order by created_at desc limit 5;"
sqlite3 data/store-learning.sqlite "select id, store_id from content_generations order by created_at desc limit 5;"
sqlite3 data/store-learning.sqlite "select blog_post_id, total_score from seo_scores order by created_at desc limit 5;"
```

## Next Suggested Task

CONTENT-001 can connect the content detail screen to `GET /api/blog-posts/:postId` and add preview, SEO detail, and later regeneration actions. Keep real OpenAI/image generation provider work behind future provider-boundary tasks unless explicitly requested.
