# Milestone 03 Training Settings Contract Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AI training settings to collection-run contract explicit by persisting configured channel source URLs in each collection run summary.

**Architecture:** Training settings remain the only browser-side place where channel URLs and limits are saved. `POST /api/stores/:storeId/collection-runs` derives a server-side collection plan from saved settings and records both limits and source URLs in `collection_runs.summary_json`, so collection progress and future Blog collection reliability work can read the same durable contract. Browser pages still call only `poc-server` APIs.

**Tech Stack:** TypeScript, Express routes in `poc-server/src/storeLearning/routes/stores.ts`, SQLite-backed repositories, Vitest API/page contract tests, static HTML/JavaScript in `web/`.

---

## Scope

Included:

- Add `summary.sourceUrls` to collection runs created from saved training settings.
- Preserve existing `requestedLimits`, `channelPlan`, and `sourcePolicy` summary fields.
- Keep Blog URL source priority documented by page tests:
  1. saved store channel URL,
  2. Naver Place external Blog link,
  3. manual value saved through training settings.
- Keep Instagram and Daangn as stored future inputs only; do not add providers.
- Update Codex handoff and validation notes.

Excluded:

- Blog collection provider reliability changes.
- Blog RAW viewer.
- Ruleset, learning status, dashboard, admin, pc-web, and old Event-to-Operation changes.
- Browser calls to Naver, OpenAI, or external providers.

## Task 1: Branch And Baseline

**Files:**

- Read: `docs/product/STORE_LEARNING_DATA_MAP.md`
- Read: `web/training_settings.js`
- Read: `poc-server/src/storeLearning/routes/stores.ts`
- Read: `poc-server/test/trainingSettingsApi.test.ts`
- Read: `poc-server/test/trainingSettingsPage.test.ts`

- [x] Step 1: Create `codex/training-settings-contract` from the current Milestone 02 branch.

Expected:

- This branch is stacked on `codex/store-registration-cleanup` while PR #27 is open.
- Existing unrelated `.DS_Store` local modification remains unstaged.

- [x] Step 2: Confirm the current contract gap.

Expected current state:

- `collectionPlanFromSettings` records limits and channel enabled state.
- `collectionPlanFromSettings` does not record channel `sourceUrl` values in `summary`.
- `training_settings.js` already saves settings before creating a collection run.

## Task 2: TDD For Collection Run Source URLs

**Files:**

- Modify: `poc-server/test/trainingSettingsApi.test.ts`

- [x] Step 1: Update the existing collection-run summary expectation to include source URLs.

Add this object to the expected `summary` in `creates a queued collection run from saved training settings`:

```ts
sourceUrls: {
  naverBlog: 'https://blog.naver.com/demo-cake',
  naverPlace: 'https://naver.me/demo-cake',
  instagram: 'https://instagram.com/demo-cake',
  daangn: 'https://www.daangn.com/kr/local-profile/demo'
}
```

- [x] Step 2: Add a focused API contract test for disabled or blank future channels.

Add:

```ts
it('records configured source URLs in collection run summaries without enabling future providers', async () => {
  await fetch(`${baseUrl}/api/stores/store_demo_cake/training-settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channels: {
        naverBlog: { enabled: true, blogPostLimit: 10, sourceUrl: 'https://blog.naver.com/demo-cake' },
        naverPlace: { enabled: true, placeReviewLimit: 10, sourceUrl: 'https://naver.me/demo-cake' },
        instagram: { enabled: false, instagramPostLimit: 0, sourceUrl: 'https://instagram.com/demo-cake' },
        daangn: { enabled: false, daangnPostLimit: 0, sourceUrl: null }
      }
    })
  });

  const runResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/collection-runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const run = await readJson(runResponse);

  expect(run.collectionRun.summary.sourceUrls).toEqual({
    naverBlog: 'https://blog.naver.com/demo-cake',
    naverPlace: 'https://naver.me/demo-cake',
    instagram: 'https://instagram.com/demo-cake',
    daangn: null
  });
  expect(run.collectionRun.summary.channelPlan.instagram).toEqual({ enabled: false, limit: 0 });
  expect(run.collectionRun.summary.channelPlan.daangn).toEqual({ enabled: false, limit: 0 });
});
```

- [x] Step 3: Run the focused test and verify RED.

Run from `poc-server/`:

```bash
npm test -- trainingSettingsApi.test.ts -t "source URLs"
```

Expected:

- FAIL because `summary.sourceUrls` is currently `undefined`.

## Task 3: Implement Summary Source URL Contract

**Files:**

- Modify: `poc-server/src/storeLearning/routes/stores.ts`

- [x] Step 1: Add source URLs to the collection plan summary.

In `collectionPlanFromSettings`, add:

```ts
sourceUrls: {
  naverBlog: channels.naverBlog.sourceUrl ?? null,
  naverPlace: channels.naverPlace.sourceUrl ?? null,
  instagram: channels.instagram.sourceUrl ?? null,
  daangn: channels.daangn?.sourceUrl ?? null
},
```

Expected:

- Source URLs are recorded independently from provider availability.
- Disabled Instagram/Daangn can keep stored URLs for future provider work without being collected.

## Task 4: Page Contract Confirmation

**Files:**

- Modify: `poc-server/test/trainingSettingsPage.test.ts`

- [x] Step 1: Add static assertions for the existing browser contract.

Add expectations that `training_settings.js`:

```ts
expect(js).toContain("channelSource(payload, 'blog') ||");
expect(js).toContain('firstUrlMatching(homepageUrls, /(^|\\\\/\\\\/)(m\\\\.)?blog\\\\.naver\\\\.com\\\\//i)');
expect(js).toContain("setTextValue('training-blog-url', settings.channels.naverBlog.sourceUrl || storeChannelSources.blog)");
expect(js).toContain('await saveSettings();');
expect(js).toContain("body: JSON.stringify({})");
```

Expected:

- Browser still derives visible defaults from saved store data.
- Browser still persists manual edits before starting server-side collection.
- Browser still does not pass provider-specific source URLs directly to external APIs.

## Task 5: GREEN And Regression Validation

**Files:**

- Read: `poc-server/test/trainingSettingsApi.test.ts`
- Read: `poc-server/test/trainingSettingsPage.test.ts`
- Read: `poc-server/src/storeLearning/routes/stores.ts`

- [x] Step 1: Run focused API source URL test.

Run from `poc-server/`:

```bash
npm test -- trainingSettingsApi.test.ts -t "source URLs"
```

Expected: PASS.

- [x] Step 2: Run full training settings tests.

Run from `poc-server/`:

```bash
npm test -- trainingSettingsApi.test.ts trainingSettingsPage.test.ts
```

Expected: PASS.

- [x] Step 3: Run collection progress API tests.

Run from `poc-server/`:

```bash
npm test -- collectionProgressApi.test.ts
```

Expected: PASS and existing collection runner summaries still preserve old fields plus new `sourceUrls`.

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

- [x] Step 1: Add Milestone 03 scope to `HANDOFF.md`.
- [x] Step 2: Add Milestone 03 commands and validation evidence to `VALIDATION.md`.

Expected:

- Future sessions know collection runs now expose configured source URLs.

## Task 7: Publish

**Files:**

- Stage only milestone files.

- [x] Step 1: Confirm staged files exclude `.DS_Store`.

Expected milestone files:

- `docs/codex/MILESTONE_03_TRAINING_SETTINGS_CONTRACT_PLAN.md`
- `docs/codex/HANDOFF.md`
- `docs/codex/VALIDATION.md`
- `poc-server/src/storeLearning/routes/stores.ts`
- `poc-server/test/trainingSettingsApi.test.ts`
- `poc-server/test/trainingSettingsPage.test.ts`

- [ ] Step 2: Commit.

Use:

```bash
git commit -m "feat: record training source urls"
```

- [ ] Step 3: Push and open a draft PR.

Expected:

- Push `codex/training-settings-contract`.
- Open a draft PR stacked on `codex/store-registration-cleanup` while PR #27 is open.
- After PR #27 merges, retarget this PR to `develop`.
