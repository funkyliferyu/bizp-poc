# MILESTONE-08-LEARNING-STATUS-RESULTS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the AI learning status completion display with API-backed collection, analysis, and ruleset result semantics.

**Architecture:** Keep browser pages dependent on `poc-server` APIs only. The server computes a compact completion contract from persisted collection items, latest analysis artifacts, learning snapshots, and marketing rulesets; the static learning status page renders that contract without redesigning the full page shell.

**Tech Stack:** TypeScript, Express routes, SQLite-backed repositories, Vitest static/API tests, static HTML/CSS/JS in `web/`.

---

## Scope

Implement the next sequential Store Learning milestone:

- `마케팅 채널관리 > AI 학습 > 학습 현황` shows whether learning is complete from real persisted PoC data.
- Learning is complete when Blog collection exists, Place profile information exists, AI analysis completed, and a marketing ruleset exists.
- The display should show collection/analysis/ruleset criteria, not only static mock dates.
- Browser JavaScript must keep calling only `poc-server` `/api/*` endpoints.

## Out Of Scope

- No `admin/` changes.
- No `pc-web/` changes.
- No old Event-to-Operation flow changes.
- No direct browser calls to Naver, OpenAI, scraping providers, or other provider APIs.
- No Blog generation/content detail changes in this milestone.
- No full redesign of `web/06_AI학습_현황.html`.
- No provider behavior changes.

## Branch And PR

- Branch: `codex/learning-status-results`.
- Base while stacked: `codex/ruleset-ui-source-matrix` / PR #32.
- After PR #32 merges, retarget this PR to `develop`.

## Validation Commands

Run from `poc-server/`:

```bash
npm test -- learningStatusApi.test.ts -t "completion criteria"
npm test -- learningStatusPage.test.ts -t "completion result"
npm test -- learningStatusApi.test.ts learningStatusPage.test.ts
npm test -- staticWebConnectivity.test.ts
npm run typecheck
```

Run from repo root:

```bash
git diff --check
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5177/06_AI%ED%95%99%EC%8A%B5_%ED%98%84%ED%99%A9.html?storeId=store_demo_cake"
git status --short --branch
```

## Task 1: Confirm Working Context

**Files:** none.

- [x] Step 1: Confirm `pwd`.

Expected:

- `/Users/1004182/Documents/bizplanet-work/bizp-store-learning-poc`.

- [x] Step 2: Confirm current branch.

Expected:

- `codex/learning-status-results`.

- [x] Step 3: Confirm worktree status.

Expected:

- Only existing unrelated `.DS_Store` is dirty before milestone edits.

## Task 2: RED API Contract Test

**Files:**

- Modify: `poc-server/test/learningStatusApi.test.ts`

- [x] Step 1: Add a failing API test for completion criteria.

Add a test named:

```ts
it('returns completion criteria from collected Blog, updated Place profile, analysis, and ruleset results', async () => {
  const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/learning-status`);
  const body = await readJson(response);

  expect(response.status).toBe(200);
  expect(body.completion).toMatchObject({
    status: 'completed',
    label: '학습 완료',
    criteria: {
      blogCollection: {
        status: 'complete',
        collectedCount: 1,
        selectedCount: 1
      },
      placeProfile: {
        status: 'complete',
        collectedCount: 1
      },
      aiAnalysis: {
        status: 'complete',
        analysisRunId: 'analysis_run_demo_store_learning'
      },
      marketingRuleset: {
        status: 'complete',
        rulesetId: 'marketing_ruleset_demo_v1',
        version: 1
      }
    }
  });
  expect(body.completion.message).toContain('블로그 수집');
  expect(body.completion.message).toContain('마케팅 전략 룰셋');
});
```

- [x] Step 2: Run the focused RED test.

Run:

```bash
cd poc-server && npm test -- learningStatusApi.test.ts -t "completion criteria"
```

Expected:

- FAIL because `body.completion` is currently undefined.

## Task 3: RED Static Page Contract Test

**Files:**

- Modify: `poc-server/test/learningStatusPage.test.ts`

- [x] Step 1: Add a failing static page test for completion result hooks.

Add a test named:

```ts
it('renders API-backed completion result hooks without provider calls', () => {
  const html = readFileSync(path.join(webRoot, '06_AI학습_현황.html'), 'utf8');
  const js = readFileSync(path.join(webRoot, 'learning_status.js'), 'utf8');

  expect(html).toContain('id="learning-completion-summary"');
  expect(html).toContain('id="learning-completion-label"');
  expect(html).toContain('id="learning-completion-message"');
  expect(html).toContain('id="learning-completion-checklist"');
  expect(html).toContain('id="learning-next-collection"');
  expect(html).toContain('id="learning-collection-cycle"');

  expect(js).toContain('function renderCompletion');
  expect(js).toContain('status.completion');
  expect(js).toContain('learning-completion-checklist');
  expect(js).toContain('learning-next-collection');
  expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
  expect(js).not.toContain('OPENAI');
  expect(js).not.toContain('NAVER_CLIENT');
});
```

- [x] Step 2: Run the focused RED test.

Run:

```bash
cd poc-server && npm test -- learningStatusPage.test.ts -t "completion result"
```

Expected:

- FAIL because completion result hooks and `renderCompletion` are not implemented yet.

## Task 4: Implement Learning Completion Service

**Files:**

- Modify: `poc-server/src/storeLearning/learning/learningStatusService.ts`

- [x] Step 1: Add helpers to compute completion criteria.

Implementation shape:

- Count collected Blog post items.
- Count collected Place profile items.
- Read latest successful analysis artifacts through existing `getLatestAnalysisArtifacts`.
- Treat marketing ruleset completion as present ruleset plus at least one ruleset field.
- Return `status`, `label`, `message`, `completedAt`, and `criteria`.

- [x] Step 2: Attach `completion` to `buildLearningStatus`.

Expected payload:

```ts
{
  completion: {
    status: 'completed' | 'needs_collection' | 'needs_analysis' | 'needs_ruleset' | 'analysis_failed' | 'in_progress',
    label: string,
    message: string,
    completedAt: string | null,
    criteria: {
      blogCollection: { status: string, label: string, collectedCount: number, selectedCount: number },
      placeProfile: { status: string, label: string, collectedCount: number, latestItemId: string | null },
      aiAnalysis: { status: string, label: string, analysisRunId: string | null, completedAt: string | null },
      marketingRuleset: { status: string, label: string, rulesetId: string | null, version: number | null }
    }
  }
}
```

- [x] Step 3: Run the API GREEN test.

Run:

```bash
cd poc-server && npm test -- learningStatusApi.test.ts -t "completion criteria"
```

Expected:

- PASS.

## Task 5: Implement Learning Status Page Display

**Files:**

- Modify: `web/06_AI학습_현황.html`
- Modify: `web/learning_status.js`

- [x] Step 1: Add narrow completion display hooks to the existing learning status card.

Add IDs:

- `learning-completion-summary`
- `learning-completion-label`
- `learning-completion-message`
- `learning-completion-checklist`
- `learning-next-collection`
- `learning-collection-cycle`

- [x] Step 2: Render completion criteria from the API payload.

Implementation shape:

- Add `renderCompletion(completion)`.
- Render each criterion as a compact row with `완료`, `대기`, or `확인 필요`.
- Update the hardcoded next collection date and cycle KPI with `status.nextCollectionAt` and `status.collectionCycle`.
- Keep ruleset navigation behavior unchanged.

- [x] Step 3: Run the static page GREEN test.

Run:

```bash
cd poc-server && npm test -- learningStatusPage.test.ts -t "completion result"
```

Expected:

- PASS.

## Task 6: Docs And Final Validation

**Files:**

- Modify: `docs/codex/HANDOFF.md`
- Modify: `docs/codex/VALIDATION.md`
- Modify: `docs/codex/MILESTONE_08_LEARNING_STATUS_RESULTS_PLAN.md`

- [x] Step 1: Update `HANDOFF.md` with MILESTONE-08 scope and stacked PR note.
- [x] Step 2: Update `VALIDATION.md` with RED/GREEN evidence and final commands.
- [x] Step 3: Mark completed plan checkboxes.
- [x] Step 4: Run final validation commands.

Expected final validation:

- `npm test -- learningStatusApi.test.ts learningStatusPage.test.ts`
- `npm test -- staticWebConnectivity.test.ts`
- `npm run typecheck`
- `git diff --check`
- Local HTTP check returns `200`.

## Task 7: Publish

**Files to stage:**

- `docs/codex/MILESTONE_08_LEARNING_STATUS_RESULTS_PLAN.md`
- `docs/codex/HANDOFF.md`
- `docs/codex/VALIDATION.md`
- `poc-server/src/storeLearning/learning/learningStatusService.ts`
- `poc-server/test/learningStatusApi.test.ts`
- `poc-server/test/learningStatusPage.test.ts`
- `web/06_AI학습_현황.html`
- `web/learning_status.js`

- [x] Step 1: Confirm staged files exclude `.DS_Store`.
- [x] Step 2: Commit with `feat: show learning status results`.
- [x] Step 3: Push and open a draft PR.

Expected:

- Branch: `codex/learning-status-results`.
- PR base: `codex/ruleset-ui-source-matrix` while PR #32 is open.
- Draft PR: https://github.com/funkyliferyu/bizp-poc/pull/33.
- After PR #32 merges, retarget this PR to `develop`.
