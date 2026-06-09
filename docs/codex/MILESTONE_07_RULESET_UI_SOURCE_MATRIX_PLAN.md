# Ruleset UI Source Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the marketing strategy ruleset screen consume the ruleset source matrix and auto-fill currently static rows from API-backed field keys.

**Architecture:** Keep using the existing `GET /api/stores/:storeId/ruleset` API and `web/ruleset_editor.js`. Add source-matrix rendering on the browser side, attach matrix guidance to editable rows, and expand demo seed ruleset fields so the default local screen has API-backed values for the rows introduced in Milestone 06.

**Tech Stack:** Static HTML/CSS/JS, Express API payloads, SQLite demo seed repositories, Vitest static/API tests.

---

## Scope

Included:

- Add source-matrix containers to `web/07_마케팅전략룰셋.html`.
- Add `data-ruleset-field` / `data-ruleset-value` hooks to currently static ruleset rows.
- Render source matrix rows with current implementation and better future method notes.
- Attach compact source guidance to loaded ruleset fields.
- Expand `seedDemoStore` ruleset fields for default local demo values.
- Update Codex handoff and validation docs.

Excluded:

- Do not redesign the whole page layout.
- Do not add browser-side Naver/OpenAI calls.
- Do not change analyzer, provider adapters, Blog generation, learning-status completion semantics, `admin/`, `pc-web/`, or old Event-to-Operation files.
- Do not replace competitor benchmark fixture/provider behavior.

## Files

- Modify: `web/07_마케팅전략룰셋.html`
  - Add source matrix styles.
  - Add source matrix containers per section.
  - Add missing ruleset field hooks.
- Modify: `web/ruleset_editor.js`
  - Parse `payload.sourceMatrix`.
  - Render matrix rows grouped by section.
  - Add source matrix notes to editable fields.
- Modify: `poc-server/src/seedStoreLearning.ts`
  - Add expanded default demo ruleset fields for UI rows.
- Modify: `poc-server/test/rulesetPage.test.ts`
  - Static tests for source matrix containers and browser-only API behavior.
- Modify: `poc-server/test/rulesetApi.test.ts`
  - API test that demo seed includes UI field keys.
- Modify: `docs/codex/HANDOFF.md`
- Modify: `docs/codex/VALIDATION.md`

## Task 1: Branch And Scope Confirmation

- [x] Step 1: Confirm workspace and branch.

Run:

```bash
pwd
git branch --show-current
git status --short --branch
```

Expected:

- Workspace is `/Users/1004182/Documents/bizplanet-work/bizp-store-learning-poc`.
- New branch is `codex/ruleset-ui-source-matrix`.
- Existing `.DS_Store` remains unstaged and outside scope.

- [x] Step 2: Confirm PR base.

Expected:

- This branch is stacked on `codex/ruleset-source-matrix` while PR #31 is open.
- After PR #31 merges, retarget this PR to `develop`.

## Task 2: RED Tests

**Files:**

- Modify: `poc-server/test/rulesetPage.test.ts`
- Modify: `poc-server/test/rulesetApi.test.ts`

- [x] Step 1: Add static page source-matrix test.

Add to `rulesetPage.test.ts`:

```ts
  it('renders source matrix containers and field hooks for currently static ruleset rows', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'ruleset_editor.js'), 'utf8');

    expect(html).toContain('data-source-matrix-section="store"');
    expect(html).toContain('data-source-matrix-section="brand"');
    expect(html).toContain('data-source-matrix-section="write_common,write_instagram,write_blog"');
    expect(html).toContain('data-source-matrix-section="image_common,image_instagram,image_blog"');
    expect(html).toContain('data-ruleset-field="representativeMenu"');
    expect(html).toContain('data-ruleset-field="catchphrase"');
    expect(html).toContain('data-ruleset-field="blogPreferredLength"');
    expect(html).toContain('data-ruleset-field="blogImageFormat"');
    expect(js).toContain('function renderSourceMatrix');
    expect(js).toContain('payload.sourceMatrix');
    expect(js).toContain('currentImplementation');
    expect(js).toContain('futureSuggestion');
  });
```

- [x] Step 2: Add seeded API field-key test.

Add to `rulesetApi.test.ts`:

```ts
  it('seeds ruleset fields used by the UI source matrix rows', async () => {
    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/ruleset`);
    const body = await readJson(response);
    const fieldKeys = body.fields.map((field: { fieldKey: string }) => field.fieldKey);

    expect(response.status).toBe(200);
    expect(fieldKeys).toEqual(
      expect.arrayContaining([
        'representativeMenu',
        'reviewStrength',
        'reviewWeakness',
        'catchphrase',
        'blogPurpose',
        'blogPreferredLength',
        'blogImageFormat',
        'blogImageStyle',
        'blogOverlayPolicy'
      ])
    );
  });
```

- [x] Step 3: Run RED tests.

Run:

```bash
cd poc-server
npm test -- rulesetPage.test.ts -t "source matrix containers"
npm test -- rulesetApi.test.ts -t "seeds ruleset fields"
```

Expected:

- FAIL because the HTML/JS source matrix hooks do not exist and the demo seed only has the older two fields.

## Task 3: Implement Ruleset UI Source Matrix

**Files:**

- Modify: `web/07_마케팅전략룰셋.html`
- Modify: `web/ruleset_editor.js`

- [x] Step 1: Add source matrix CSS and containers.

Implementation notes:

- Add compact table/list styles near existing ruleset CSS.
- Add a `.ruleset-source-matrix` block to:
  - store tab with `data-source-matrix-section="store"`;
  - brand tab with `data-source-matrix-section="brand"`;
  - writing tab with `data-source-matrix-section="write_common,write_instagram,write_blog"`;
  - image tab with `data-source-matrix-section="image_common,image_instagram,image_blog"`.
- Keep the page structure and existing tabs intact.

- [x] Step 2: Add missing field hooks.

Add `data-ruleset-field` and `[data-ruleset-value]` to rows for:

- `representativeMenu`
- `catchphrase`
- `humorLevel`
- `trendSensitivity`
- `instagramPurpose`
- `instagramWritingStyle`
- `instagramPreferredLength`
- `instagramHashtags`
- `instagramEmojiPolicy`
- `blogPurpose`
- `blogPreferredLength`
- `blogEmojiPolicy`
- `primaryColors`
- `accentColors`
- `imageStyle`
- `imageAvoidStyle`
- `instagramImageFormat`
- `instagramImageStyle`
- `instagramOverlayPolicy`
- `blogImageFormat`
- `blogImageStyle`
- `blogOverlayPolicy`

- [x] Step 3: Render source matrix from API.

Implementation notes in `ruleset_editor.js`:

- Add a `sourceMatrixMap`.
- Add source-tier/automation labels.
- Add `renderSourceMatrix(payload)`.
- In each matrix row, show:
  - label and field key;
  - current value or `수집/AI 결과 대기`;
  - source tier and automation status;
  - current implementation;
  - future suggestion.
- Call `renderSourceMatrix(payload)` from `renderRuleset(payload)`.

- [x] Step 4: Attach matrix guidance to fields.

Implementation notes:

- `renderRulesetField(element, rulesetField)` should add a compact note that includes source tier/current implementation/future suggestion.
- Avoid duplicating notes after save/reset re-render.

- [x] Step 5: Run GREEN page tests.

Run:

```bash
cd poc-server
npm test -- rulesetPage.test.ts -t "source matrix containers"
```

Expected:

- PASS.

## Task 4: Expand Demo Seed Fields

**Files:**

- Modify: `poc-server/src/seedStoreLearning.ts`

- [x] Step 1: Add helper to seed expanded ruleset fields.

Implementation notes:

- Keep existing `positioning` and `contentKeywords` fields for backward compatibility.
- Add a compact helper array for expanded fields.
- Use existing `timestamp(...)` helper.
- Use existing collection item IDs as evidence only.

- [x] Step 2: Run GREEN API test.

Run:

```bash
cd poc-server
npm test -- rulesetApi.test.ts -t "seeds ruleset fields"
```

Expected:

- PASS.

## Task 5: Docs And Validation

**Files:**

- Modify: `docs/codex/HANDOFF.md`
- Modify: `docs/codex/VALIDATION.md`

- [x] Step 1: Update handoff with MILESTONE-07-RULESET-UI-SOURCE-MATRIX.
- [x] Step 2: Update validation with RED/GREEN/final commands.
- [x] Step 3: Run final validation.

Run:

```bash
cd poc-server
npm test -- rulesetPage.test.ts rulesetApi.test.ts
npm test -- staticWebConnectivity.test.ts
npm run typecheck
cd ..
git diff --check
```

Expected:

- PASS.
- `.DS_Store` remains unstaged.

## Task 6: Publish

**Files to stage:**

- `docs/codex/MILESTONE_07_RULESET_UI_SOURCE_MATRIX_PLAN.md`
- `docs/codex/HANDOFF.md`
- `docs/codex/VALIDATION.md`
- `poc-server/src/seedStoreLearning.ts`
- `poc-server/test/rulesetApi.test.ts`
- `poc-server/test/rulesetPage.test.ts`
- `web/07_마케팅전략룰셋.html`
- `web/ruleset_editor.js`

- [x] Step 1: Confirm staged files exclude `.DS_Store`.
- [x] Step 2: Commit with `feat: wire ruleset source matrix UI`.
- [x] Step 3: Push and open a draft PR.

Expected:

- Branch: `codex/ruleset-ui-source-matrix`.
- PR base: `codex/ruleset-source-matrix` while PR #31 is open.
- Draft PR: https://github.com/funkyliferyu/bizp-poc/pull/32.
- After PR #31 merges, retarget this PR to `develop`.
