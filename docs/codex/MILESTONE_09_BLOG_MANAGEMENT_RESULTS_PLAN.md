# MILESTONE-09-BLOG-MANAGEMENT-RESULTS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Blog management and AI content list pages show approval-pending AI drafts as learning/ruleset-backed results with correct detail navigation.

**Architecture:** Reuse the existing blog post generation and list APIs. Add compact generation-source metadata and first pending draft summary to the store blog-post list response, then render that metadata in the existing static pages without adding browser-side provider calls or redesigning the page.

**Tech Stack:** TypeScript, Express routes, SQLite-backed repositories, Vitest API/static tests, static HTML/CSS/JS in `web/`.

---

## Scope

Implement the next sequential Store Learning milestone:

- Blog management shows AI-generated approval-pending posts as outputs of the latest marketing ruleset.
- The approval alert CTA opens the actual first pending approval post detail, not a static detail URL.
- AI content list rows show the generated source/ruleset summary so reviewers can see the draft is produced from Store Learning.
- Browser JavaScript keeps calling only `poc-server` `/api/*` endpoints.

## Out Of Scope

- No `admin/` changes.
- No `pc-web/` changes.
- No old Event-to-Operation flow changes.
- No direct browser calls to Naver, OpenAI, scraping providers, image providers, or other provider APIs.
- No Blog publish provider implementation changes.
- No full redesign of Blog management, AI content list, or content detail pages.
- No generated image creation; image assets remain placeholders.

## Branch And PR

- Branch: `codex/blog-management-results`.
- Base while stacked: `codex/learning-status-results` / PR #33.
- After PR #33 merges, retarget this PR to `develop`.

## Validation Commands

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

## Task 1: Confirm Working Context

**Files:** none.

- [x] Step 1: Confirm `pwd`.

Expected:

- `/Users/1004182/Documents/bizplanet-work/bizp-store-learning-poc`.

- [x] Step 2: Confirm current branch.

Expected:

- `codex/blog-management-results`.

- [x] Step 3: Confirm worktree status.

Expected:

- Only existing unrelated `.DS_Store` is dirty before milestone edits.

## Task 2: RED API Contract Test

**Files:**

- Modify: `poc-server/test/blogGenerationApi.test.ts`

- [x] Step 1: Add a failing API test for list summary metadata.

Add a test named:

```ts
it('returns list summary metadata for the first approval-pending ruleset-generated draft', async () => {
  const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/blog-posts`);
  const body = await readJson(response);

  expect(response.status).toBe(200);
  expect(body.summary).toMatchObject({
    pendingApprovalCount: 1,
    firstPendingApprovalPostId: 'blog_post_demo_pending_approval',
    firstPendingApprovalHref: '09_AI콘텐츠생성_상세.html?postId=blog_post_demo_pending_approval',
    generatedDraftCount: 1
  });
  expect(body.posts[0]).toMatchObject({
    id: 'blog_post_demo_pending_approval',
    status: 'pending_approval',
    generationSource: {
      type: 'ruleset',
      label: '마케팅 룰셋 기반',
      rulesetId: 'marketing_ruleset_demo_v1',
      contentGenerationId: 'content_generation_demo_blog'
    }
  });
});
```

- [x] Step 2: Run the focused RED test.

Run:

```bash
cd poc-server && npm test -- blogGenerationApi.test.ts -t "list summary"
```

Expected:

- FAIL because `body.summary` and `post.generationSource` do not exist yet.

## Task 3: RED Static Page Contract Test

**Files:**

- Modify: `poc-server/test/blogPostPages.test.ts`

- [x] Step 1: Add a failing static page test for pending approval CTA and source hooks.

Add a test named:

```ts
it('renders pending approval CTA and generation source hooks on Blog management lists', () => {
  const blogManagement = readFileSync(path.join(webRoot, '02_블로그관리.html'), 'utf8');
  const contentList = readFileSync(path.join(webRoot, '08_AI콘텐츠생성_목록.html'), 'utf8');
  const js = readFileSync(path.join(webRoot, 'blog_posts.js'), 'utf8');

  expect(blogManagement).toContain('id="blog-pending-alert"');
  expect(blogManagement).toContain('id="blog-pending-action"');
  expect(contentList).toContain('id="ai-content-source-note"');
  expect(js).toContain('payload.summary');
  expect(js).toContain('firstPendingApprovalHref');
  expect(js).toContain('generationSource');
  expect(js).toContain('data-generation-source');
  expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
  expect(js).not.toContain('OPENAI');
  expect(js).not.toContain('NAVER_CLIENT');
});
```

- [x] Step 2: Run the focused RED test.

Run:

```bash
cd poc-server && npm test -- blogPostPages.test.ts -t "pending approval CTA"
```

Expected:

- FAIL because the alert/action/source hooks and renderer contract are not implemented yet.

## Task 4: Implement Blog List Summary Contract

**Files:**

- Modify: `poc-server/src/storeLearning/blog/blogGenerator.ts`
- Modify: `poc-server/src/seedStoreLearning.ts`

- [x] Step 1: Add `generatedFromRulesetId` to the seeded demo blog post article.

Use the existing `rulesetId` value in `seedStoreLearning.ts`.

- [x] Step 2: Add `generationSource` to serialized blog posts.

Implementation shape:

```ts
generationSource: {
  type: generatedFromRulesetId ? 'ruleset' : contentGeneration ? 'content_generation' : 'manual',
  label: generatedFromRulesetId ? '마케팅 룰셋 기반' : contentGeneration ? 'AI 생성' : '직접등록',
  rulesetId: generatedFromRulesetId,
  contentGenerationId: post.contentGenerationId
}
```

- [x] Step 3: Add `summary` to `listBlogPostsForStore`.

Implementation shape:

- `pendingApprovalCount`
- `firstPendingApprovalPostId`
- `firstPendingApprovalHref`
- `generatedDraftCount`
- Keep existing top-level `pendingApprovalCount` for compatibility.

- [x] Step 4: Run the API GREEN test.

Run:

```bash
cd poc-server && npm test -- blogGenerationApi.test.ts -t "list summary"
```

Expected:

- PASS.

## Task 5: Implement Blog Management UI Wiring

**Files:**

- Modify: `web/02_블로그관리.html`
- Modify: `web/08_AI콘텐츠생성_목록.html`
- Modify: `web/blog_posts.js`

- [x] Step 1: Add stable hooks to the approval alert and AI content source note.

Add IDs:

- `blog-pending-alert`
- `blog-pending-action`
- `ai-content-source-note`

- [x] Step 2: Render the first pending approval CTA from API summary.

Implementation shape:

- If `pendingApprovalCount > 0`, show the alert and set the action button to `summary.firstPendingApprovalHref`.
- If no pending approvals, hide the alert.
- Preserve the existing fallback page behavior when summary is absent.

- [x] Step 3: Render `generationSource` in Blog management and AI content rows.

Implementation shape:

- Add a small source line or badge under the row title.
- Add `data-generation-source` to rows for static verification.

- [x] Step 4: Run the static page GREEN test.

Run:

```bash
cd poc-server && npm test -- blogPostPages.test.ts -t "pending approval CTA"
```

Expected:

- PASS.

## Task 6: Docs And Final Validation

**Files:**

- Modify: `docs/codex/HANDOFF.md`
- Modify: `docs/codex/VALIDATION.md`
- Modify: `docs/codex/MILESTONE_09_BLOG_MANAGEMENT_RESULTS_PLAN.md`

- [x] Step 1: Update `HANDOFF.md` with MILESTONE-09 scope and stacked PR note.
- [x] Step 2: Update `VALIDATION.md` with RED/GREEN evidence and final commands.
- [x] Step 3: Mark completed plan checkboxes.
- [x] Step 4: Run final validation commands.

Expected final validation:

- `npm test -- blogGenerationApi.test.ts blogPostPages.test.ts contentDetailPage.test.ts`
- `npm test -- staticWebConnectivity.test.ts`
- `npm run typecheck`
- `git diff --check`
- Local HTTP checks return `200`.

## Task 7: Publish

**Files to stage:**

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

- [x] Step 1: Confirm staged files exclude `.DS_Store`.
- [x] Step 2: Commit with `feat: show blog management results`.
- [x] Step 3: Push and open a draft PR.

Expected:

- Branch: `codex/blog-management-results`.
- PR base: `codex/learning-status-results` while PR #33 is open.
- Draft PR: https://github.com/funkyliferyu/bizp-poc/pull/34.
- After PR #33 merges, retarget this PR to `develop`.
