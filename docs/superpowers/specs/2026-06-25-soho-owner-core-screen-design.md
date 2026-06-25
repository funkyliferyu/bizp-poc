# Soho Owner Core Screen Design

- **Date**: 2026-06-25
- **Status**: Approved (brainstorming)
- **Branch**: `codex/soho-owner-design-spec`
- **Audience**: Store Learning PoC reviewers and implementers

## Problem

The current Store Learning PoC exposes the right capabilities for a store owner,
but the core owner-facing screens still feel like dense operator tools. On the
dashboard, blog management, and AI content detail pages, settings, status,
performance, SEO, regeneration, preview, and publishing actions appear with
similar visual weight.

For a small store owner who is new to AI-generated blog operations, this creates
one primary anxiety: there is too much on screen, so it is unclear where to look
first and what action to take next.

## Goals

- Redesign the owner-facing core flow around the question "What should I do
  next?"
- Keep the first implementation scope to:
  - `web/01_대시보드.html`
  - `web/02_블로그관리.html`
  - `web/09_AI콘텐츠생성_상세.html`
  - page JavaScript needed by those screens, mainly `web/blog_posts.js` and
    `web/content_detail.js`
- Preserve the Store Learning product flow and existing API-backed behavior.
- Reuse existing `poc-server` blog post, preview, SEO, regeneration, and publish
  request APIs as much as possible.
- Keep browser code calling only `poc-server` APIs.
- Reduce visible complexity without hiding important review controls.

## Non-Goals

- No changes to `admin/` or `pc-web/`.
- No redesign of unrelated static pages in `web/`.
- No edits to the old Event-to-Operation / watermelon event flow files.
- No browser-side Naver, OpenAI, scraping provider, or other external provider
  calls.
- No publishing partner integration.
- No new AI generation behavior, prompt tuning, or provider behavior.
- No main-branch publication work.

## Approved Direction

Use the combined **A+B** direction from the brainstorming session:

- Dashboard and Blog Management use an **"today's work"** model.
- AI Content Detail uses a **three-step review** model.

The design rule for all three screens is:

1. Explain the current state.
2. Explain why it matters in owner-friendly language.
3. Show the next action.

Advanced operations such as automatic generation settings, detailed SEO
breakdowns, regeneration, and diagnostic provenance stay available, but they
should carry lower default visual weight than the next owner decision.

## Screen Design

### Dashboard

The dashboard becomes the owner's first triage surface.

Primary components:

- **Today Action Card**
  - Shows the most important next action, such as "AI가 만든 블로그 글 2개를
    확인해 주세요."
  - Links directly to Blog Management or the first pending content detail.
  - Uses owner-facing language instead of internal workflow labels.
- **Learning Health Strip**
  - Summarizes whether AI learning is normal, waiting, failed, or needs review.
  - Keeps detailed learning evidence behind the existing learning-status page.
- **Blog Queue Preview**
  - Shows only a small number of posts that need owner action.
  - Keeps month timeline and performance data secondary.
- **Monthly Summary**
  - Shows published count, approval-pending count, and next generation date.
  - Avoids making performance analytics the first visual priority.

The dashboard should not become a full blog operations table. It should answer:
"Is anything waiting for me today?"

### Blog Management

Blog Management becomes a review queue, not just a chronological table.

Primary components:

- **Review Queue Header**
  - Shows "검토할 블로그 글 N건" and the fastest route to the first pending
    item.
  - Keeps the batch generation action visible but secondary to pending review
    when pending review exists.
- **Priority Rows**
  - Sort and group visually by owner action:
    - pending approval first
    - publish requested next
    - published/cancelled after that
  - Each pending row should show:
    - title
    - short generated-source line
    - owner-readable status
    - simple readiness label such as "좋음" or "확인 필요"
    - one primary action to review
- **Collapsed Auto Generation Settings**
  - Default view shows last update, generation count, next run, and publishing
    mode in one compact row.
  - Detailed settings remain behind the existing expandable control.
- **Empty and Loading States**
  - No pending approval: show a calm empty state with next generation timing.
  - Batch generation running: keep the existing progress modal pattern, but use
    owner-facing copy.

The page should answer: "Which generated posts need my attention?"

### AI Content Detail

AI Content Detail becomes a three-step review surface.

Primary components:

- **Step Indicator**
  - Step 1: 글 내용 확인
  - Step 2: 이미지와 SEO 확인
  - Step 3: 발행 요청
- **Step 1: Article Review**
  - Shows title, generated date, status, and article body.
  - The primary action moves to image/SEO review.
  - Regenerate text remains available but secondary.
- **Step 2: Image and SEO Review**
  - Shows selected/generated image prompts and a simplified SEO readiness
    result first.
  - Detailed SEO rubric is expandable.
  - Regenerate image and SEO rescore remain available but secondary.
- **Step 3: Publish Request**
  - Presents the final owner decision:
    - 바로 발행 요청
    - 일시 지정 발행 요청
    - 취소
  - Preview remains available as a supporting action.
- **Review Confidence Panel**
  - Summarizes concerns in plain language:
    - SEO readiness
    - selected image count
    - store name / region keyword presence
    - publish status

The page should answer: "Can I approve this post, and what should I check first?"

## API And Data Scope

The first implementation should reuse existing APIs where possible:

- `GET /api/stores/:storeId/blog-posts`
- `GET /api/blog-posts/:postId`
- `GET /api/blog-posts/:postId/preview`
- `POST /api/blog-posts/:postId/regenerate-text`
- `POST /api/blog-posts/:postId/regenerate-images`
- `POST /api/blog-posts/:postId/seo-score`
- `POST /api/blog-posts/:postId/request-publish`
- existing V2 batch generation endpoints

If the dashboard cannot derive enough summary from existing blog post and
learning-status endpoints, add a narrow server-side summary endpoint that returns
counts and next-action metadata only. Do not add browser-side provider calls or
duplicate provider logic in static JavaScript.

## Error Handling

Errors should be translated into owner actions.

- Dashboard:
  - no work: "오늘 확인할 글이 없습니다"
  - pending work: "AI가 만든 글을 확인해 주세요"
  - generation failure: "글 생성에 실패했습니다. 다시 시도해 주세요"
  - learning warning: "AI 학습 상태를 확인해 주세요"
- Blog Management:
  - list loading failure: table-level error row plus retry affordance
  - no pending approval: empty state with next generation timing
  - insufficient V2 topic candidates: existing modal with clearer next step
  - batch generation failure: modal remains open and explains retry path
- Content Detail:
  - detail loading failure: article area error state
  - preview failure: inline error without losing loaded draft
  - SEO rescore/regeneration failure: button returns to normal state and shows
    owner-readable failure copy
  - publish request failure: keep the user on Step 3 and explain retry

## Testing Strategy

Use the existing test style and broaden page tests around behavior and API
boundaries.

Suggested validation:

- Static/page tests confirm the dashboard, blog management, and content detail
  pages expose the new owner-facing components.
- Blog management tests confirm rows still call only `poc-server` APIs and keep
  the V2 batch generation flow.
- Content detail tests confirm the three-step structure, preview, regenerate,
  SEO rescore, and publish request actions still call existing endpoints.
- Browser/API boundary tests confirm no Naver/OpenAI/provider credential strings
  or direct external provider calls are introduced in browser assets.
- Responsive visual smoke confirms text and buttons do not overlap on narrower
  desktop/mobile-ish viewports.

Implementation validation should include:

```bash
cd poc-server
npm run typecheck
npm test
node --check ../web/blog_posts.js
node --check ../web/content_detail.js
git diff --check
```

If server behavior changes, also run the relevant demo/smoke flow with local
SQLite and `poc-server` APIs.

## Implementation Notes

- Prefer page-local CSS for screen-specific layout changes.
- Add shared `common.css` primitives only when they are reused across at least
  two of the three screens, such as action cards, step indicators, or collapsed
  detail rows.
- Keep cards at the existing 8px radius and preserve the BizPlanet PC Web UI
  guide's restrained typography and color system.
- Avoid marketing-style hero sections; these are owner operations screens.
- Do not hide core actions behind unfamiliar icons. Use icon plus text only
  where it clarifies a command.
- Keep the final flow short:
  `Dashboard -> Blog Management -> Content Detail -> Publish Request`.

## Open Follow-Up

After implementation, decide whether the dashboard needs a dedicated summary API
or whether it can remain a static/API-light shell for this PoC phase.
