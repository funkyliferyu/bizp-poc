# Milestone 05 Blog RAW Viewer Evidence Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let operators inspect collected Blog raw data from collection/selection screens and show item-level evidence badges before analysis selection.

**Architecture:** Add a collection-run RAW viewer modeled after the existing store RAW viewer. The viewer fetches only `poc-server` collection run APIs and renders tabs for Blog items, collected Blog items, failed Blog items, all items, and the collection run summary. The collection progress and content selection pages link to the viewer through `runId`; content selection rows show persisted item evidence from `metadata.bodyAvailability`, `metadata.blogSourceDiscovery`, and `sourceUrl`.

**Tech Stack:** Static HTML/JavaScript in `web/`, Vitest static page tests in `poc-server/test`, existing collection run APIs, Codex docs under `docs/codex`.

---

## Scope

Included:

- Add `web/collection_raw_data.html`.
- Add `web/collection_raw_data.js`.
- Add `RAW data 보기` buttons on:
  - `web/04_AI학습_수집중.html`
  - `web/05_AI학습_콘텐츠선택.html`
- Open the RAW viewer as `collection_raw_data.html?runId=<runId>&section=blogItems`.
- Show Blog item evidence badges in content selection rows:
  - full rendered body;
  - snippet/metadata only;
  - unavailable body;
  - source discovery, such as RSS/PostList/direct URL;
  - source URL availability.
- Keep browser pages calling only `poc-server` APIs.
- Update Codex handoff and validation notes.

Excluded:

- Backend route changes.
- Blog collection provider changes.
- Analyzer/ruleset changes.
- Learning status changes.
- UI redesign.
- Naver/OpenAI/browser-side provider calls.
- `admin/`, `pc-web/`, and old Event-to-Operation files.

## Task 1: Branch And Baseline

**Files:**

- Read: `web/store_raw_data.html`
- Read: `web/store_raw_data.js`
- Read: `web/04_AI학습_수집중.html`
- Read: `web/collection_progress.js`
- Read: `web/05_AI학습_콘텐츠선택.html`
- Read: `web/content_selection.js`
- Read: `poc-server/test/collectionProgressPage.test.ts`
- Read: `poc-server/test/selectionPage.test.ts`

- [x] Step 1: Create `codex/blog-raw-viewer-evidence` from the current Milestone 04 branch.

Expected:

- This branch is stacked on `codex/blog-collection-reliability` while PR #29 is open.
- Existing unrelated `.DS_Store` local modification remains unstaged.

- [x] Step 2: Confirm current gap.

Expected:

- Store registration already has a Place RAW viewer.
- Collection progress and content selection do not expose Blog RAW data.
- Content selection does not display `bodyAvailability` or source discovery evidence.

## Task 2: TDD For Static Contracts

**Files:**

- Create: `poc-server/test/collectionRawDataPage.test.ts`
- Modify: `poc-server/test/collectionProgressPage.test.ts`
- Modify: `poc-server/test/selectionPage.test.ts`

- [x] Step 1: Add `collectionRawDataPage.test.ts`.

Create:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('..');
const webRoot = path.join(repoRoot, 'web');

describe('collection raw data static page API wiring', () => {
  it('renders a collection RAW data viewer with Blog evidence tabs', () => {
    const html = readFileSync(path.join(webRoot, 'collection_raw_data.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'collection_raw_data.js'), 'utf8');

    expect(html).toContain('Collection RAW data');
    expect(html).toContain('id="raw-section-tabs"');
    expect(html).toContain('id="raw-json"');
    expect(html).toContain('id="raw-copy-button"');
    expect(html).toContain('collection_raw_data.js');
    expect(js).toContain("key: 'blogItems'");
    expect(js).toContain("key: 'collectedBlogItems'");
    expect(js).toContain("key: 'failedBlogItems'");
    expect(js).toContain("key: 'allItems'");
    expect(js).toContain("key: 'collectionRun'");
    expect(js).toContain('metadata.bodyAvailability');
    expect(js).toContain('metadata.blogSourceDiscovery');
  });

  it('calls only poc-server collection APIs from the RAW viewer', () => {
    const js = readFileSync(path.join(webRoot, 'collection_raw_data.js'), 'utf8');

    expect(js).toContain('fetch(`/api/collection-runs/${runId}`');
    expect(js).toContain('fetch(`/api/collection-runs/${runId}/items`');
    expect(js).toContain('function highlightJson');
    expect(js).toContain('pre.dataset.rawJson = json');
    expect(js).not.toMatch(/fetch\\(['"`]https?:\\/\\/(?!localhost|127\\.0\\.0\\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });
});
```

- [x] Step 2: Update collection progress page static test.

Add expectations:

```ts
expect(html).toContain('id="collection-blog-raw-button"');
expect(html).toContain('collection_raw_data.html?runId=');
expect(js).toContain('function rawDataUrl');
expect(js).toContain('collection_raw_data.html?');
expect(js).toContain("next.searchParams.set('section', 'blogItems')");
```

- [x] Step 3: Update content selection static test.

Add expectations:

```ts
expect(html).toContain('id="selection-blog-raw-button"');
expect(html).toContain('selection-evidence');
expect(js).toContain('function evidenceBadges');
expect(js).toContain('bodyAvailability');
expect(js).toContain('blogSourceDiscovery');
expect(js).toContain('collection_raw_data.html?');
expect(js).toContain("next.searchParams.set('section', 'blogItems')");
```

- [x] Step 4: Run focused static tests and verify RED.

Run from `poc-server/`:

```bash
npm test -- collectionRawDataPage.test.ts collectionProgressPage.test.ts selectionPage.test.ts
```

Expected:

- FAIL because `collection_raw_data.html/js`, RAW buttons, and evidence badges do not exist yet.

## Task 3: Implement Collection RAW Viewer

**Files:**

- Create: `web/collection_raw_data.html`
- Create: `web/collection_raw_data.js`

- [x] Step 1: Add `collection_raw_data.html`.

Use the same visual structure as `store_raw_data.html`, but set:

```html
<title>Collection RAW data</title>
<div class="raw-title">Collection RAW data</div>
<div class="raw-desc">수집 실행과 collection_items 원본 데이터를 서버 API로 조회해 확인합니다. 이 화면은 Naver나 OpenAI를 직접 호출하지 않습니다.</div>
<script src="collection_raw_data.js"></script>
```

- [x] Step 2: Add `collection_raw_data.js`.

Required behavior:

- Read `runId` and `section` from query string.
- Fetch `/api/collection-runs/${runId}`.
- Fetch `/api/collection-runs/${runId}/items`.
- Render tabs:
  - `blogItems`
  - `collectedBlogItems`
  - `failedBlogItems`
  - `allItems`
  - `collectionRun`
- For Blog item sections, include normalized evidence fields:

```js
function blogEvidence(item) {
  const metadata = item.metadata || {};
  return {
    id: item.id,
    status: item.status,
    title: item.title,
    sourceUrl: item.sourceUrl,
    bodyAvailability: metadata.bodyAvailability || null,
    blogSourceDiscovery: metadata.blogSourceDiscovery || null,
    sourceKind: metadata.sourceKind || null,
    sourceOwnership: metadata.sourceOwnership || null,
    bodyLength: item.bodyText ? item.bodyText.length : 0,
    bodyText: item.bodyText,
    metadata
  };
}
```

Expected:

- RAW viewer can inspect Blog data without direct provider calls.
- Copy button behavior matches `store_raw_data.js`.

## Task 4: Add RAW Buttons And Evidence Badges

**Files:**

- Modify: `web/04_AI학습_수집중.html`
- Modify: `web/collection_progress.js`
- Modify: `web/05_AI학습_콘텐츠선택.html`
- Modify: `web/content_selection.js`

- [x] Step 1: Add progress page RAW button.

Add near the collection action row:

```html
<button class="btn btn-ghost" id="collection-blog-raw-button" disabled data-raw-url-template="collection_raw_data.html?runId=">RAW data 보기</button>
```

- [x] Step 2: Wire progress page RAW button.

Add:

```js
function rawDataUrl() {
  const next = new URL('collection_raw_data.html?', window.location.href);
  next.searchParams.set('runId', latestRunId || '');
  next.searchParams.set('section', 'blogItems');
  return `${next.pathname}${next.search}`;
}
```

Enable it when `latestRunId` exists and navigate on click.

- [x] Step 3: Add selection page RAW button and evidence CSS.

Add an action button in the Blog card header:

```html
<button class="btn btn-ghost btn-sm" id="selection-blog-raw-button" disabled data-raw-url-template="collection_raw_data.html?runId=">RAW data 보기</button>
```

Add `.selection-evidence` and `.evidence-badge` styles.

- [x] Step 4: Render evidence badges in Blog rows.

Add:

```js
function evidenceBadges(item) {
  const metadata = item.metadata || {};
  const badges = [];
  const availability = metadata.bodyAvailability;
  if (availability) badges.push(['본문', availability]);
  if (metadata.blogSourceDiscovery) badges.push(['수집', metadata.blogSourceDiscovery]);
  if (item.sourceUrl) badges.push(['출처', 'URL']);
  return badges
    .map(([label, value]) => `<span class="evidence-badge"><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</span>`)
    .join('');
}
```

Render it below the title inside the title cell.

- [x] Step 5: Wire selection page RAW button.

Reuse `rawDataUrl()` with `runId` and `section=blogItems`, enable when `latestRunId` exists, and navigate on click.

## Task 5: GREEN And Regression Validation

**Files:**

- Read: `poc-server/test/collectionRawDataPage.test.ts`
- Read: `poc-server/test/collectionProgressPage.test.ts`
- Read: `poc-server/test/selectionPage.test.ts`
- Read: `web/collection_raw_data.html`
- Read: `web/collection_raw_data.js`
- Read: `web/content_selection.js`

- [x] Step 1: Run focused static page tests.

Run from `poc-server/`:

```bash
npm test -- collectionRawDataPage.test.ts collectionProgressPage.test.ts selectionPage.test.ts
```

Expected: PASS.

- [x] Step 2: Run static web connectivity tests.

Run from `poc-server/`:

```bash
npm test -- staticWebConnectivity.test.ts
```

Expected: PASS.

- [x] Step 3: Run selection and collection API regressions.

Run from `poc-server/`:

```bash
npm test -- selectionApi.test.ts collectionProgressApi.test.ts
```

Expected: PASS.

- [x] Step 4: Run typecheck.

Run from `poc-server/`:

```bash
npm run typecheck
```

Expected: PASS.

- [x] Step 5: Check whitespace.

Run from repo root:

```bash
git diff --check
```

Expected: no output and exit code `0`.

## Task 6: Update Operating Docs

**Files:**

- Modify: `docs/codex/HANDOFF.md`
- Modify: `docs/codex/VALIDATION.md`

- [x] Step 1: Add Milestone 05 scope to `HANDOFF.md`.
- [x] Step 2: Add Milestone 05 commands and validation evidence to `VALIDATION.md`.

Expected:

- Future sessions know Blog RAW data is visible through collection run APIs and evidence badges are shown before analysis.

## Task 7: Publish

**Files:**

- Stage only milestone files.

- [x] Step 1: Confirm staged files exclude `.DS_Store`.

Expected milestone files:

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

- [x] Step 2: Commit.

Use:

```bash
git commit -m "feat: add blog raw data viewer"
```

- [x] Step 3: Push and open a draft PR.

Expected:

- Push `codex/blog-raw-viewer-evidence`.
- Open a draft PR stacked on `codex/blog-collection-reliability` while PR #29 is open.
- After PR #29 merges, retarget this PR to `develop`.
