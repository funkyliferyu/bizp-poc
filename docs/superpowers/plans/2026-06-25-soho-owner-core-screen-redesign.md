# Soho Owner Core Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the owner-facing dashboard, blog management, and AI content detail screens so a small store owner can immediately see today's work, review generated blog posts, and request publishing without wading through dense operations UI.

**Architecture:** Keep the redesign in the existing static web and `poc-server` validation structure. Reuse current blog post, SEO, preview, regeneration, V2 batch, and publish request APIs; prefer page-local HTML/CSS and JavaScript changes, adding shared CSS only for primitives reused across the three target screens. The implementation branch should stay as a Draft PR until local validation and owner-facing screen review pass.

**Tech Stack:** Static HTML/CSS/JavaScript in `web/`, Express/TypeScript APIs in `poc-server`, Vitest plus Playwright-based page tests, SQLite-backed local validation.

---

## Branch And PR Policy

- Work on `codex/soho-owner-core-screen-redesign`.
- Keep `main` untouched.
- Keep `develop` untouched until the Draft PR is reviewed, validated, and explicitly approved for merge.
- Target the Draft PR at `develop`.
- Include the approved design spec in the PR:
  `docs/superpowers/specs/2026-06-25-soho-owner-core-screen-design.md`.

## File Structure

- Modify `web/01_대시보드.html`
  - Owns the marketing-channel dashboard triage surface.
  - Adds Today Action Card, Learning Health Strip, Blog Queue Preview, and Monthly Summary layout.
- Modify `web/02_블로그관리.html`
  - Owns the blog review queue shell, queue header, compact auto-generation settings, and batch modal copy.
- Modify `web/blog_posts.js`
  - Owns blog-post list ordering, queue summary copy, readiness labels, empty state, and batch-generation progress copy.
  - Must continue calling only `poc-server` APIs.
- Modify `web/09_AI콘텐츠생성_상세.html`
  - Owns the three-step review surface, review confidence panel, and action grouping.
- Modify `web/content_detail.js`
  - Owns step navigation, confidence panel rendering, SEO readiness text, and owner-readable error states.
  - Must continue calling only existing blog detail APIs.
- Modify or create `poc-server/test/sohoOwnerCoreScreenDesign.test.ts`
  - Focused static tests for dashboard, blog management, and content detail hooks/copy.
- Modify `poc-server/test/blogPostPages.test.ts`
  - Extend existing API-boundary and V2 batch assertions for the review queue.
- Modify `poc-server/test/contentDetailPage.test.ts`
  - Extend existing content detail tests for the three-step structure and endpoint preservation.

## Task 1: Add Focused Owner Screen Contract Tests

**Files:**
- Create: `poc-server/test/sohoOwnerCoreScreenDesign.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `poc-server/test/sohoOwnerCoreScreenDesign.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('..');
const webRoot = path.join(repoRoot, 'web');

function readWeb(file: string) {
  return readFileSync(path.join(webRoot, file), 'utf8');
}

describe('Soho owner core screen redesign contracts', () => {
  it('turns the marketing dashboard into a today-work triage surface', () => {
    const html = readWeb('01_대시보드.html');

    expect(html).toContain('id="owner-today-work"');
    expect(html).toContain('오늘 먼저 할 일');
    expect(html).toContain('id="owner-primary-action-card"');
    expect(html).toContain('id="owner-learning-health"');
    expect(html).toContain('id="owner-blog-queue-preview"');
    expect(html).toContain('id="owner-monthly-summary"');
    expect(html).toContain('data-flow-target="02_블로그관리.html"');
    expect(html).toContain('data-flow-label="다음: 블로그 검토"');
  });

  it('turns blog management into a review queue before a full operations table', () => {
    const html = readWeb('02_블로그관리.html');

    expect(html).toContain('id="blog-review-queue"');
    expect(html).toContain('id="blog-review-queue-title"');
    expect(html).toContain('검토할 블로그 글');
    expect(html).toContain('id="blog-review-empty"');
    expect(html).toContain('id="blog-review-primary-action"');
    expect(html).toContain('id="blog-auto-generation-summary"');
    expect(html).toContain('id="blog-post-list"');
    expect(html).toContain('blog_posts.js');
  });

  it('turns content detail into a three-step review surface', () => {
    const html = readWeb('09_AI콘텐츠생성_상세.html');

    expect(html).toContain('id="content-review-steps"');
    expect(html).toContain('data-review-step="article"');
    expect(html).toContain('data-review-step="assets"');
    expect(html).toContain('data-review-step="publish"');
    expect(html).toContain('id="review-step-article"');
    expect(html).toContain('id="review-step-assets"');
    expect(html).toContain('id="review-step-publish"');
    expect(html).toContain('id="review-confidence-panel"');
    expect(html).toContain('글 내용 확인');
    expect(html).toContain('이미지와 SEO 확인');
    expect(html).toContain('발행 요청');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd poc-server
npm test -- --run test/sohoOwnerCoreScreenDesign.test.ts
```

Expected: FAIL because `owner-today-work`, `blog-review-queue`, and
`content-review-steps` hooks do not exist yet.

- [ ] **Step 3: Commit the failing contract tests**

```bash
git add poc-server/test/sohoOwnerCoreScreenDesign.test.ts
git commit -m "test: add soho owner screen contracts"
```

## Task 2: Redesign The Marketing Dashboard Triage Surface

**Files:**
- Modify: `web/01_대시보드.html`
- Test: `poc-server/test/sohoOwnerCoreScreenDesign.test.ts`

- [ ] **Step 1: Add dashboard CSS primitives**

In `web/01_대시보드.html`, inside the existing `<style>` block, add:

```css
.owner-work-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:14px;margin-bottom:16px}
.owner-today-card{background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:16px}
.owner-today-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.owner-today-title{font-size:18px;font-weight:800;color:#1A1A2E;margin-bottom:4px}
.owner-today-copy{font-size:12px;color:#6B7280;line-height:1.6}
.owner-action-card{border:1px solid #FFD8A8;background:#FFF9F0;border-radius:8px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
.owner-action-title{font-size:13px;font-weight:800;color:#1A1A2E;margin-bottom:3px}
.owner-action-desc{font-size:11px;color:#6B7280;line-height:1.5}
.owner-health-card{border:1px solid #E2E8F0;background:#fff;border-radius:8px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.owner-summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.owner-summary-cell{border:1px solid #E2E8F0;border-radius:8px;background:#fff;padding:10px}
.owner-summary-label{font-size:11px;color:#9AA0B4;margin-bottom:4px}
.owner-summary-value{font-size:22px;font-weight:800;color:#1A1A2E}
.owner-queue-list{display:grid;gap:8px;margin-top:10px}
.owner-queue-row{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid #EDF2F7;padding-top:8px;font-size:12px;color:#1A1A2E}
.owner-queue-row:first-child{border-top:none;padding-top:0}
@media(max-width:900px){.owner-work-grid{grid-template-columns:1fr}.owner-action-card,.owner-health-card{align-items:flex-start;flex-direction:column}}
```

- [ ] **Step 2: Replace the top KPI block with owner triage markup**

In `web/01_대시보드.html`, replace the existing `<!-- KPI -->` block through the
following `<!-- 2열 그리드 -->` opening comment with:

```html
  <!-- 오늘 할 일 -->
  <section class="owner-work-grid" id="owner-today-work">
    <div class="owner-today-card">
      <div class="owner-today-head">
        <div>
          <div class="owner-today-title">오늘 먼저 할 일</div>
          <div class="owner-today-copy">확인해야 할 블로그 글 2건이 있습니다. 글을 읽고 발행 요청만 하면 됩니다.</div>
        </div>
        <span class="badge b-orange">검토 필요</span>
      </div>
      <div class="owner-action-card" id="owner-primary-action-card">
        <div>
          <div class="owner-action-title">AI가 만든 블로그 글을 확인해 주세요</div>
          <div class="owner-action-desc">승인 대기 글 2건 · 예상 검토 시간 5분</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="location.href='02_블로그관리.html'" data-flow-target="02_블로그관리.html" data-flow-label="다음: 블로그 검토">검토하러 가기</button>
      </div>
      <div class="owner-health-card" id="owner-learning-health">
        <div>
          <div class="owner-action-title">AI 학습은 정상입니다</div>
          <div class="owner-action-desc">최근 학습 2026.05.16 · 다음 수집 2026.05.30</div>
        </div>
        <a class="card-link" href="06_AI학습_현황.html">학습 현황 보기</a>
      </div>
    </div>
    <div class="owner-today-card" id="owner-monthly-summary">
      <div class="card-title">이번 달 요약</div>
      <div class="owner-summary-grid">
        <div class="owner-summary-cell">
          <div class="owner-summary-label">발행 완료</div>
          <div class="owner-summary-value">14</div>
          <div class="kpi-sub">블로그 기준</div>
        </div>
        <div class="owner-summary-cell" style="border-color:#FFA94D;background:#FFF9F0">
          <div class="owner-summary-label" style="color:#E8590C">승인 대기</div>
          <div class="owner-summary-value" style="color:#E8590C">2</div>
          <div class="kpi-sub">오늘 확인 필요</div>
        </div>
      </div>
      <div id="owner-blog-queue-preview" class="owner-queue-list">
        <div class="owner-queue-row">
          <span>분당 레터링케이크 커스텀 주문 후기</span>
          <span class="badge b-orange">승인 대기</span>
        </div>
        <div class="owner-queue-row">
          <span>봄 시즌 딸기케이크 신메뉴 소개</span>
          <span class="badge b-orange">승인 대기</span>
        </div>
      </div>
    </div>
  </section>

  <!-- 2열 그리드 -->
```

- [ ] **Step 3: Run the focused dashboard contract test**

Run:

```bash
cd poc-server
npm test -- --run test/sohoOwnerCoreScreenDesign.test.ts
```

Expected: dashboard assertions PASS; blog management and content detail
assertions still FAIL.

- [ ] **Step 4: Commit dashboard redesign**

```bash
git add web/01_대시보드.html
git commit -m "feat: add owner dashboard triage surface"
```

## Task 3: Redesign Blog Management As A Review Queue

**Files:**
- Modify: `web/02_블로그관리.html`
- Modify: `web/blog_posts.js`
- Modify: `poc-server/test/blogPostPages.test.ts`
- Test: `poc-server/test/sohoOwnerCoreScreenDesign.test.ts`

- [ ] **Step 1: Extend blog management tests first**

In `poc-server/test/blogPostPages.test.ts`, add this test inside
`describe('blog post list page API wiring', () => { ... })`:

```ts
  it('prioritizes pending approval posts as an owner review queue', () => {
    const html = readFileSync(path.join(webRoot, '02_블로그관리.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'blog_posts.js'), 'utf8');

    expect(html).toContain('id="blog-review-queue"');
    expect(html).toContain('id="blog-review-queue-title"');
    expect(html).toContain('id="blog-review-primary-action"');
    expect(html).toContain('id="blog-review-empty"');
    expect(html).toContain('id="blog-auto-generation-summary"');
    expect(js).toContain('function postStatusPriority');
    expect(js).toContain('function blogReadinessLabel');
    expect(js).toContain('function sortPostsForOwnerReview');
    expect(js).toContain("status === 'pending_approval'");
    expect(js).toContain('검토할 블로그 글');
    expect(js).not.toMatch(/fetch\\(['"`]https?:\\/\\/(?!localhost|127\\.0\\.0\\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });
```

- [ ] **Step 2: Run the blog page tests to verify failure**

Run:

```bash
cd poc-server
npm test -- --run test/blogPostPages.test.ts test/sohoOwnerCoreScreenDesign.test.ts
```

Expected: FAIL because the review queue hooks and sort/readiness helpers do not
exist.

- [ ] **Step 3: Add blog review queue CSS and header markup**

In `web/02_블로그관리.html`, inside the `<style>` block, add:

```css
.blog-review-queue{background:#fff;border:1px solid #D8E0F0;border-radius:8px;margin-bottom:16px;overflow:hidden}
.blog-review-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:14px 16px;border-bottom:1px solid #EDF1F7;background:#fff}
.blog-review-title{font-size:16px;font-weight:800;color:#1A1A2E;margin-bottom:4px}
.blog-review-desc{font-size:12px;color:#6B7280;line-height:1.6}
.blog-review-summary{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 16px;background:#FAFBFC;border-bottom:1px solid #EDF1F7}
.blog-review-empty{display:none;padding:16px;font-size:12px;color:#6B7280;line-height:1.6}
.blog-review-empty.is-visible{display:block}
.blog-table-note{font-size:11px;color:#6B7280;margin-top:3px;line-height:1.45}
```

Then replace the current `.blog-page-head` section and pending alert block with:

```html
  <section class="blog-review-queue" id="blog-review-queue">
    <div class="blog-review-head">
      <div>
        <div class="blog-review-title" id="blog-review-queue-title">검토할 블로그 글 0건</div>
        <div class="blog-review-desc">AI가 만든 글 중 사장님 확인이 필요한 글을 먼저 보여드립니다.</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">
        <button class="btn btn-primary btn-sm" id="blog-review-primary-action" disabled>검토할 글 없음</button>
        <button class="btn btn-ghost btn-sm" id="blog-v2-batch-generate-btn">생성배치 실행</button>
      </div>
    </div>
    <div class="blog-review-summary" id="blog-pending-alert">
      <span class="badge b-orange" id="blog-pending-count">승인 대기 0건</span>
      <span style="font-size:12px;color:#6B7280">글을 읽고 문제가 없으면 발행 요청해 주세요.</span>
      <button class="btn btn-sm" id="blog-pending-action" style="background:#E8590C;color:#fff;border:none" data-flow-target="09_AI콘텐츠생성_상세.html" data-flow-label="다음: 콘텐츠 상세">첫 글 확인</button>
    </div>
    <div class="blog-review-empty" id="blog-review-empty">지금 확인할 블로그 글이 없습니다. 다음 자동 생성 예정일을 확인해 주세요.</div>
  </section>
```

Add `id="blog-auto-generation-summary"` to the existing `<summary
class="auto-gen-summary">` element:

```html
    <summary class="auto-gen-summary" id="blog-auto-generation-summary">
```

- [ ] **Step 4: Update blog list JavaScript ordering and copy**

In `web/blog_posts.js`, after `function scoreClass(score) { ... }`, add:

```js
  function postStatusPriority(status) {
    if (status === 'pending_approval') return 0;
    if (status === 'publish_requested') return 1;
    if (status === 'published') return 2;
    if (status === 'cancelled') return 3;
    return 4;
  }

  function sortPostsForOwnerReview(posts) {
    return [...posts].sort((a, b) => {
      const statusDelta = postStatusPriority(a.status) - postStatusPriority(b.status);
      if (statusDelta !== 0) return statusDelta;
      return new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime();
    });
  }

  function blogReadinessLabel(post) {
    if (post.status === 'pending_approval' && Number(post.seoScore) >= 80) {
      return { label: '좋음', className: 'b-green' };
    }
    if (post.status === 'pending_approval') {
      return { label: '확인 필요', className: 'b-yellow' };
    }
    if (post.status === 'publish_requested') {
      return { label: '요청 완료', className: 'b-green' };
    }
    if (post.status === 'published') {
      return { label: '발행 완료', className: 'b-green' };
    }
    return { label: '보관', className: 'b-gray' };
  }
```

In `renderBlogManagement(posts)`, replace `if (!posts.length) { ... }` and the
`posts.map(...)` input with:

```js
    const orderedPosts = sortPostsForOwnerReview(posts);
    if (!orderedPosts.length) {
      blogList.innerHTML = emptyRow(7, '지금 확인할 블로그 글이 없습니다.');
      return;
    }

    blogList.innerHTML = orderedPosts
```

Inside the rendered `<tr>`, replace the SEO badge cell with:

```js
            <td><span class="badge ${blogReadinessLabel(post).className}" style="font-size:10px">${escapeHtml(blogReadinessLabel(post).label)}</span></td>
```

In `updateCounts(count)`, replace the body with:

```js
    if (blogPendingCount) blogPendingCount.textContent = `승인 대기 ${count}건`;
    if (aiContentPendingCount) aiContentPendingCount.textContent = `${count}건`;
    const queueTitle = document.getElementById('blog-review-queue-title');
    if (queueTitle) queueTitle.textContent = `검토할 블로그 글 ${count}건`;
```

In `updateSummary(summary, posts)`, after the `if (blogPendingAction && count >
0) { ... }` block, add:

```js
    const reviewPrimaryAction = document.getElementById('blog-review-primary-action');
    const reviewEmpty = document.getElementById('blog-review-empty');
    if (reviewEmpty) reviewEmpty.classList.toggle('is-visible', count === 0);
    if (reviewPrimaryAction) {
      reviewPrimaryAction.disabled = count === 0;
      reviewPrimaryAction.textContent = count > 0 ? '첫 글 확인' : '검토할 글 없음';
      reviewPrimaryAction.onclick = count > 0 ? () => { window.location.href = firstPendingApprovalHref; } : null;
    }
```

In `loadPosts()`, replace:

```js
      renderBlogManagement(apiLinkedPosts);
```

with:

```js
      renderBlogManagement(sortPostsForOwnerReview(apiLinkedPosts));
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd poc-server
npm test -- --run test/blogPostPages.test.ts test/sohoOwnerCoreScreenDesign.test.ts
```

Expected: blog management assertions PASS; content detail assertions in
`sohoOwnerCoreScreenDesign.test.ts` still FAIL.

- [ ] **Step 6: Run JavaScript syntax check**

Run:

```bash
cd poc-server
node --check ../web/blog_posts.js
```

Expected: PASS.

- [ ] **Step 7: Commit blog management redesign**

```bash
git add web/02_블로그관리.html web/blog_posts.js poc-server/test/blogPostPages.test.ts
git commit -m "feat: prioritize blog review queue"
```

## Task 4: Redesign Content Detail As Three-Step Review

**Files:**
- Modify: `web/09_AI콘텐츠생성_상세.html`
- Modify: `web/content_detail.js`
- Modify: `poc-server/test/contentDetailPage.test.ts`
- Test: `poc-server/test/sohoOwnerCoreScreenDesign.test.ts`

- [ ] **Step 1: Extend content detail tests first**

In `poc-server/test/contentDetailPage.test.ts`, add this test inside
`describe('AI content detail page API wiring', () => { ... })`:

```ts
  it('keeps existing detail APIs while adding the three-step owner review flow', () => {
    const html = readFileSync(path.join(webRoot, '09_AI콘텐츠생성_상세.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'content_detail.js'), 'utf8');

    expect(html).toContain('id="content-review-steps"');
    expect(html).toContain('id="review-step-article"');
    expect(html).toContain('id="review-step-assets"');
    expect(html).toContain('id="review-step-publish"');
    expect(html).toContain('id="review-confidence-panel"');
    expect(html).toContain('id="detail-next-assets-btn"');
    expect(html).toContain('id="detail-next-publish-btn"');
    expect(js).toContain('function setReviewStep');
    expect(js).toContain('function renderReviewConfidence');
    expect(js).toContain("setReviewStep('article')");
    expect(js).toContain('fetch(`/api/blog-posts/${postId}`)');
    expect(js).toContain('fetch(`/api/blog-posts/${postId}/preview`)');
    expect(js).toContain('fetch(`/api/blog-posts/${postId}/request-publish`');
    expect(js).not.toMatch(/fetch\\(['"`]https?:\\/\\/(?!localhost|127\\.0\\.0\\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd poc-server
npm test -- --run test/contentDetailPage.test.ts test/sohoOwnerCoreScreenDesign.test.ts
```

Expected: FAIL because the three-step hooks and functions do not exist.

- [ ] **Step 3: Add content detail CSS**

In `web/09_AI콘텐츠생성_상세.html`, inside the `<style>` block, add:

```css
.content-review-layout{display:grid;grid-template-columns:190px minmax(0,1fr) 240px;gap:14px;align-items:start}
.review-step-nav{background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:12px;position:sticky;top:70px}
.review-step-title{font-size:12px;font-weight:800;color:#1A1A2E;margin-bottom:10px}
.review-step-button{width:100%;border:1px solid #E2E8F0;background:#F8FAFC;color:#4A5568;border-radius:7px;padding:9px 10px;text-align:left;font-size:12px;font-weight:700;font-family:'Noto Sans KR',sans-serif;cursor:pointer;margin-bottom:8px}
.review-step-button.active{background:#EEF2FF;border-color:#BAC8FF;color:#3B5BDB}
.review-step-section{display:none}
.review-step-section.active{display:block}
.review-section-head{margin-bottom:12px}
.review-section-title{font-size:16px;font-weight:800;color:#1A1A2E;margin-bottom:4px}
.review-section-desc{font-size:12px;color:#6B7280;line-height:1.6}
.review-confidence-panel{background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:12px;position:sticky;top:70px}
.review-confidence-item{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;border-top:1px solid #EDF2F7;padding:9px 0;font-size:12px;color:#4A5568;line-height:1.5}
.review-confidence-item:first-child{border-top:none;padding-top:0}
.review-confidence-label{font-weight:700;color:#1A1A2E}
.review-step-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:12px}
@media(max-width:980px){.content-review-layout{grid-template-columns:1fr}.review-step-nav,.review-confidence-panel{position:static}.review-step-button{display:inline-flex;width:auto;margin-right:6px}.review-step-nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap}}
```

- [ ] **Step 4: Wrap content detail body in three review sections**

In `web/09_AI콘텐츠생성_상세.html`, inside `<div class="main-content">`, keep the
existing back link and replace the main content card/action-bar area with this
structure. Move the existing title/meta/status and body markup into Step 1,
existing SEO/image markup into Step 2, and existing publish buttons into Step 3:

```html
  <div class="content-review-layout">
    <nav class="review-step-nav" id="content-review-steps" aria-label="콘텐츠 검토 단계">
      <div class="review-step-title">검토 단계</div>
      <button class="review-step-button active" type="button" data-review-step="article">1. 글 내용 확인</button>
      <button class="review-step-button" type="button" data-review-step="assets">2. 이미지와 SEO 확인</button>
      <button class="review-step-button" type="button" data-review-step="publish">3. 발행 요청</button>
    </nav>

    <div>
      <section class="card review-step-section active" id="review-step-article" data-review-panel="article">
        <div class="card-header">
          <div>
            <div id="content-detail-title" style="font-size:15px;font-weight:700;color:#1A1A2E;margin-bottom:4px">분당 케이크 맛집 추천 — 커스텀 케이크 전문점 솔직 후기</div>
            <div id="content-detail-meta" style="font-size:11px;color:#9AA0B4">2026.05.23 생성 · 블로그</div>
          </div>
          <span class="badge b-orange" id="content-detail-status">승인 대기</span>
        </div>
        <div class="card-body">
          <div class="review-section-head">
            <div class="review-section-title">글 내용 확인</div>
            <div class="review-section-desc">제목과 본문 흐름을 먼저 확인하세요. 수정이 필요하면 글 재생성을 사용할 수 있습니다.</div>
          </div>
          <div class="content-provenance-line" id="content-provenance-line"></div>
          <div style="font-size:11px;font-weight:700;color:#4A5568;margin-bottom:6px">본문</div>
          <div class="content-body-box" id="draftContentBody"></div>
          <div class="review-step-actions">
            <button class="btn btn-ghost btn-sm" id="regenerate-text-btn"><span class="icon-refresh-cw" data-icon="refresh-cw" data-size="12" data-color="currentColor"></span> 글 재생성</button>
            <button class="btn btn-primary btn-sm" id="detail-next-assets-btn" type="button">이미지와 SEO 확인</button>
          </div>
        </div>
      </section>

      <section class="card review-step-section" id="review-step-assets" data-review-panel="assets">
        <div class="card-body">
          <div class="review-section-head">
            <div class="review-section-title">이미지와 SEO 확인</div>
            <div class="review-section-desc">발행 전에 이미지 프롬프트와 검색 준비도를 확인합니다. 세부 평가는 접힌 영역 안에서 확인합니다.</div>
          </div>
          <div style="margin-bottom:16px">
            <div style="font-size:11px;font-weight:700;color:#4A5568;margin-bottom:8px">SEO 준비도</div>
            <div class="seo-bar">
              <span id="seo-total-score" style="font-size:22px;font-weight:700;color:#2F9E44">84</span>
              <div class="seo-track"><div class="seo-fill" id="seo-score-fill"></div></div>
              <span id="seo-score-summary" style="font-size:11px;color:#4A5568">발행 준비도 양호</span>
            </div>
            <details class="seo-breakdown" id="seoScoreBreakdown">
              <summary class="seo-breakdown-head">
                <div class="seo-breakdown-title">SEO 세부 평가</div>
                <span class="badge b-green" id="seo-score-badge">총점 84점</span>
              </summary>
              <div class="seo-score-items" id="seoScoreItems"></div>
            </details>
          </div>
          <div style="margin-bottom:16px">
            <div style="font-size:11px;font-weight:700;color:#4A5568;margin-bottom:8px">이미지 <span style="color:#9AA0B4;font-weight:400">· 발행할 이미지를 선택하세요</span></div>
            <div id="content-image-list" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px"></div>
          </div>
          <div class="review-step-actions">
            <button class="btn btn-ghost btn-sm" id="regenerate-images-btn"><span class="icon-refresh-cw" data-icon="refresh-cw" data-size="12" data-color="currentColor"></span> 이미지 재생성</button>
            <button class="btn btn-ghost btn-sm" id="seo-rescore-btn"><span class="icon-search" data-icon="search" data-size="12" data-color="currentColor"></span> SEO 재평가</button>
            <button class="btn btn-primary btn-sm" id="detail-next-publish-btn" type="button">발행 요청으로 이동</button>
          </div>
        </div>
      </section>

      <section class="card review-step-section" id="review-step-publish" data-review-panel="publish">
        <div class="card-body">
          <div class="review-section-head">
            <div class="review-section-title">발행 요청</div>
            <div class="review-section-desc">검토가 끝났다면 대행사에 발행을 요청하세요. 바로 요청하거나 원하는 일시를 지정할 수 있습니다.</div>
          </div>
          <div class="action-bar">
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-ghost" id="openBlogPreviewBtn" onclick="openBlogPreview()"><span class="icon-maximize-2" data-icon="maximize-2" data-size="12" data-color="currentColor"></span> 블로그 적용 미리보기</button>
              <button class="btn btn-danger btn-sm" onclick="document.getElementById('modal-cancel').style.display='flex'">취소</button>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-ghost" onclick="document.getElementById('modal-schedule').style.display='flex'" data-flow-target="modal:schedule-publish" data-flow-label="상태: 발행 일시 모달">일시 지정 발행 요청</button>
              <button class="btn btn-primary" id="request-publish-btn" data-flow-target="10_블로그_발행대기_상세.html" data-flow-label="다음: 발행 대기">바로 발행 요청</button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <aside class="review-confidence-panel" id="review-confidence-panel">
      <div class="review-step-title">검토 요약</div>
      <div class="review-confidence-item">
        <span class="review-confidence-label">SEO</span>
        <span id="review-confidence-seo">불러오는 중</span>
      </div>
      <div class="review-confidence-item">
        <span class="review-confidence-label">이미지</span>
        <span id="review-confidence-images">불러오는 중</span>
      </div>
      <div class="review-confidence-item">
        <span class="review-confidence-label">상태</span>
        <span id="review-confidence-status">승인 대기</span>
      </div>
    </aside>
  </div>
```

Keep the existing schedule, cancel, and blog preview modals after this layout.

- [ ] **Step 5: Add step navigation and confidence rendering**

In `web/content_detail.js`, after `let latestContentProvenance = null;`, add:

```js
  const reviewStepButtons = Array.from(document.querySelectorAll('[data-review-step]'));
  const reviewStepPanels = Array.from(document.querySelectorAll('[data-review-panel]'));
  const nextAssetsBtn = document.getElementById('detail-next-assets-btn');
  const nextPublishBtn = document.getElementById('detail-next-publish-btn');
  const reviewConfidenceSeo = document.getElementById('review-confidence-seo');
  const reviewConfidenceImages = document.getElementById('review-confidence-images');
  const reviewConfidenceStatus = document.getElementById('review-confidence-status');

  function setReviewStep(step) {
    reviewStepButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.reviewStep === step);
    });
    reviewStepPanels.forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.reviewPanel === step);
    });
  }

  function renderReviewConfidence(payload) {
    const total = payload?.seoScore?.totalScore ?? payload?.seoScore?.score;
    if (reviewConfidenceSeo) {
      reviewConfidenceSeo.textContent = Number(total) >= 80 ? `${total}점 · 발행 가능` : `${total ?? '-'}점 · 확인 필요`;
    }
    if (reviewConfidenceImages) {
      const count = Array.isArray(payload?.mediaAssets) ? payload.mediaAssets.length : 0;
      reviewConfidenceImages.textContent = count > 0 ? `${count}개 준비됨` : '이미지 확인 필요';
    }
    if (reviewConfidenceStatus) {
      reviewConfidenceStatus.textContent = statusLabel(payload?.blogPost?.status);
    }
  }
```

In `renderDetail(payload)`, after `renderContentProvenance(...)`, add:

```js
    renderReviewConfidence(payload);
```

Near the existing event listeners, add:

```js
  reviewStepButtons.forEach((button) => {
    button.addEventListener('click', () => setReviewStep(button.dataset.reviewStep || 'article'));
  });
  if (nextAssetsBtn) nextAssetsBtn.addEventListener('click', () => setReviewStep('assets'));
  if (nextPublishBtn) nextPublishBtn.addEventListener('click', () => setReviewStep('publish'));
```

Inside `document.addEventListener('DOMContentLoaded', loadDetail);`, replace with:

```js
  document.addEventListener('DOMContentLoaded', () => {
    setReviewStep('article');
    loadDetail();
  });
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
cd poc-server
npm test -- --run test/contentDetailPage.test.ts test/sohoOwnerCoreScreenDesign.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run JavaScript syntax check**

Run:

```bash
cd poc-server
node --check ../web/content_detail.js
```

Expected: PASS.

- [ ] **Step 8: Commit content detail redesign**

```bash
git add web/09_AI콘텐츠생성_상세.html web/content_detail.js poc-server/test/contentDetailPage.test.ts
git commit -m "feat: add content detail review steps"
```

## Task 5: Owner-Friendly Empty, Loading, And Failure States

**Files:**
- Modify: `web/blog_posts.js`
- Modify: `web/content_detail.js`
- Modify: `poc-server/test/blogPostPages.test.ts`
- Modify: `poc-server/test/contentDetailPage.test.ts`

- [ ] **Step 1: Add failure-copy assertions**

In `poc-server/test/blogPostPages.test.ts`, add to the review queue test:

```ts
    expect(js).toContain('지금 확인할 블로그 글이 없습니다.');
    expect(js).toContain('글 생성에 실패했습니다. 다시 시도해 주세요.');
    expect(js).toContain('블로그 글을 만들 토픽이 부족합니다.');
```

In `poc-server/test/contentDetailPage.test.ts`, add to the three-step test:

```ts
    expect(js).toContain('글을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
    expect(js).toContain('미리보기를 불러오지 못했습니다. 글 내용은 그대로 보존됩니다.');
    expect(js).toContain('발행 요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.');
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd poc-server
npm test -- --run test/blogPostPages.test.ts test/contentDetailPage.test.ts
```

Expected: FAIL because the owner-friendly failure copy does not exist.

- [ ] **Step 3: Update blog management messages**

In `web/blog_posts.js`, update these messages:

```js
      blogList.innerHTML = emptyRow(7, '지금 확인할 블로그 글이 없습니다.');
```

In `loadPosts()` catch block, set:

```js
      const message = '블로그 글을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.';
```

In `generateV2Batch()`, replace the insufficient-candidates modal message with:

```js
        setBatchModal(true, `블로그 글을 만들 토픽이 부족합니다. 블로그 작성 포뮬라 탭에서 토픽 브리프를 먼저 생성해 주세요.`, true);
```

In `generateV2Batch()` catch block, replace the modal fallback with:

```js
      setBatchModal(true, error instanceof Error ? error.message : '글 생성에 실패했습니다. 다시 시도해 주세요.', true);
```

- [ ] **Step 4: Update content detail messages**

In `web/content_detail.js`, update `loadDetail()` catch block:

```js
      setError('글을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
```

In `openPreview()` catch block:

```js
      setError('미리보기를 불러오지 못했습니다. 글 내용은 그대로 보존됩니다.');
```

In `requestPublish(button)` catch block:

```js
      setError('발행 요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      setReviewStep('publish');
```

- [ ] **Step 5: Run focused tests and syntax checks**

Run:

```bash
cd poc-server
npm test -- --run test/blogPostPages.test.ts test/contentDetailPage.test.ts test/sohoOwnerCoreScreenDesign.test.ts
node --check ../web/blog_posts.js
node --check ../web/content_detail.js
```

Expected: PASS.

- [ ] **Step 6: Commit owner-friendly state copy**

```bash
git add web/blog_posts.js web/content_detail.js poc-server/test/blogPostPages.test.ts poc-server/test/contentDetailPage.test.ts
git commit -m "fix: clarify owner review failure states"
```

## Task 6: Final Validation And Draft PR Preparation

**Files:**
- Modify if needed: `docs/codex/VALIDATION.md`
- Modify if needed: `docs/codex/HANDOFF.md`

- [ ] **Step 1: Run full local validation**

Run:

```bash
cd poc-server
npm run typecheck
npm test
node --check ../web/blog_posts.js
node --check ../web/content_detail.js
cd ..
git diff --check
```

Expected:

- TypeScript typecheck PASS.
- Vitest suite PASS, except any pre-existing environment skips.
- JS syntax checks PASS.
- `git diff --check` PASS.

- [ ] **Step 2: Run a local browser smoke if Chromium is available**

Run:

```bash
cd poc-server
npm run dev
```

Open:

```text
http://localhost:5177/01_%EB%8C%80%EC%8B%9C%EB%B3%B4%EB%93%9C.html
http://localhost:5177/02_%EB%B8%94%EB%A1%9C%EA%B7%B8%EA%B4%80%EB%A6%AC.html
http://localhost:5177/09_AI%EC%BD%98%ED%85%90%EC%B8%A0%EC%83%9D%EC%84%B1_%EC%83%81%EC%84%B8.html
```

Expected:

- Dashboard shows "오늘 먼저 할 일" and routes to Blog Management.
- Blog Management shows the review queue header and keeps the V2 batch modal.
- Content Detail opens on Step 1 and can move to Step 2 and Step 3.
- Buttons and text do not overlap at desktop width and at a narrower browser
  width around 900px.

Stop the server after smoke validation.

- [ ] **Step 3: Record validation notes**

If validation passes, append a concise entry to `docs/codex/VALIDATION.md`:

```md
## Soho Owner Core Screen Redesign Validation

Date: 2026-06-25

Branch:

- `codex/soho-owner-core-screen-redesign`

Scope:

- Redesigned the marketing dashboard, blog management, and AI content detail
  owner flow around today's work, review queue, and three-step content review.

Validation:

- `cd poc-server && npm run typecheck` -> PASS.
- `cd poc-server && npm test` -> PASS.
- `cd poc-server && node --check ../web/blog_posts.js` -> PASS.
- `cd poc-server && node --check ../web/content_detail.js` -> PASS.
- `git diff --check` -> PASS.
```

If browser smoke was run, add:

```md
- Manual browser smoke through local `poc-server` -> PASS for dashboard, blog
  management, and content detail review flow.
```

- [ ] **Step 4: Commit validation docs**

If `docs/codex/VALIDATION.md` or `docs/codex/HANDOFF.md` changed:

```bash
git add docs/codex/VALIDATION.md docs/codex/HANDOFF.md
git commit -m "docs: record soho owner screen validation"
```

- [ ] **Step 5: Prepare Draft PR**

Run:

```bash
git status --short
git log --oneline origin/develop..HEAD
git diff --stat origin/develop...HEAD
```

Expected:

- Only intentional files are changed.
- `.DS_Store`, `.env`, SQLite data, runtime RAG output, and secret-bearing files
  are not staged.

Then push and create a Draft PR to `develop`:

```bash
git push -u origin codex/soho-owner-core-screen-redesign
gh pr create --base develop --head codex/soho-owner-core-screen-redesign --draft --title "[codex] Redesign Soho owner core screens" --body "$(cat <<'EOF'
## Summary
- Reframes the marketing dashboard around today's owner action.
- Turns Blog Management into a generated-post review queue.
- Turns AI Content Detail into a three-step review and publish-request flow.

## Test Plan
- [ ] cd poc-server && npm run typecheck
- [ ] cd poc-server && npm test
- [ ] cd poc-server && node --check ../web/blog_posts.js
- [ ] cd poc-server && node --check ../web/content_detail.js
- [ ] git diff --check
- [ ] Local browser smoke for dashboard, blog management, and content detail

## Notes
- Draft PR only. Do not merge to develop until owner-facing review and local validation pass.
EOF
)"
```

Expected:

- Draft PR opens against `develop`.
- `develop` and `main` remain unchanged.

## Self-Review

- Spec coverage:
  - Dashboard today-work triage: Task 2.
  - Blog Management review queue and compact auto-generation controls: Task 3.
  - Content Detail three-step review and confidence panel: Task 4.
  - Owner-readable errors: Task 5.
  - API boundary and validation: Tasks 3, 4, 5, and 6.
  - Draft PR management: Task 6.
- Completion-marker scan:
  - Every task has concrete files, code snippets, commands, and expected results.
- Type and hook consistency:
  - HTML IDs in tests match IDs introduced in implementation steps.
  - JavaScript helper names in tests match implementation steps:
    `postStatusPriority`, `blogReadinessLabel`, `sortPostsForOwnerReview`,
    `setReviewStep`, and `renderReviewConfidence`.
