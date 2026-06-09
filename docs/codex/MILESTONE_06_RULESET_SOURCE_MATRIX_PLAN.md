# Ruleset Source Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the analyzer/ruleset contract so every important Store Learning ruleset row has a stable field key and a documented source matrix before the ruleset UI replacement milestone.

**Architecture:** Add one server-side source-matrix module under `poc-server/src/storeLearning/rulesets/` and return that matrix from the existing `/api/stores/:storeId/ruleset` payload. Reuse the same field-key list in the mock analyzer and OpenAI analyzer prompt so generated ruleset fields align with the screen contract. Keep browser pages API-only and defer the visual table replacement to the next milestone.

**Tech Stack:** TypeScript, Express routes, SQLite repositories, Vitest, Zod analyzer validation, static HTML/JS only where needed.

---

## Scope

Included:

- Add a source matrix for direct Place/manual fields and AI ruleset fields.
- Add field keys for currently static ruleset UI rows that should later be auto-filled.
- Return `sourceMatrix` from `GET /api/stores/:storeId/ruleset`.
- Attach source matrix metadata to serialized ruleset fields when a field key matches.
- Expand the mock analyzer output and OpenAI prompt required field-key list.
- Update Codex handoff and validation notes.

Excluded:

- Do not replace the full `web/07_마케팅전략룰셋.html` table UI yet.
- Do not add browser-side Naver/OpenAI calls.
- Do not add competitor provider collection.
- Do not change Blog generation, learning-status completion semantics, `admin/`, `pc-web/`, or old Event-to-Operation files.

## Files

- Create: `poc-server/src/storeLearning/rulesets/rulesetSourceMatrix.ts`
  - Owns stable ruleset field/source matrix definitions.
  - Exports required analyzer field keys and helper lookup functions.
- Modify: `poc-server/src/storeLearning/rulesets/rulesetService.ts`
  - Adds `sourceMatrix` to the ruleset API payload.
  - Adds `sourceMatrix` to each serialized ruleset field when available.
- Modify: `poc-server/src/storeLearning/analysis/analyzer.ts`
  - Uses expanded required field keys in the mock analyzer output.
- Modify: `poc-server/src/storeLearning/analysis/openAIAnalysisProvider.ts`
  - Uses the same required field-key list in the OpenAI prompt input.
- Modify: `poc-server/test/rulesetApi.test.ts`
  - Tests ruleset API source matrix shape.
- Modify: `poc-server/test/analysisExecutionApi.test.ts`
  - Tests expanded analyzer fields and OpenAI prompt required keys.
- Modify: `docs/codex/HANDOFF.md`
  - Adds current milestone notes.
- Modify: `docs/codex/VALIDATION.md`
  - Adds RED/GREEN/final validation commands and evidence.

## Source Matrix Rows

Direct Place/manual rows:

- `name`
- `category`
- `address`
- `phone`
- `businessNumber`
- `operatingHours`
- `closedDays`
- `parking`
- `storeIntro`

AI/generated ruleset rows:

- `storePositioning`
- `keyStrengths`
- `representativeMenu`
- `targetCustomers`
- `contentKeywords`
- `reviewStrength`
- `reviewWeakness`
- `toneAndManner`
- `catchphrase`
- `negativeExpressions`
- `humorLevel`
- `trendSensitivity`
- `instagramPurpose`
- `instagramWritingStyle`
- `instagramPreferredLength`
- `instagramHashtags`
- `instagramEmojiPolicy`
- `blogPurpose`
- `blogWritingStyle`
- `blogPreferredLength`
- `blogEmojiPolicy`
- `seoKeywords`
- `ctaStyle`
- `primaryColors`
- `accentColors`
- `imageDirection`
- `imageStyle`
- `imageAvoidStyle`
- `instagramImageFormat`
- `instagramImageStyle`
- `instagramOverlayPolicy`
- `blogImageFormat`
- `blogImageStyle`
- `blogOverlayPolicy`

Each row must include:

- `fieldKey`
- `label`
- `section`
- `valueKind`
- `sourceTier`
- `currentImplementation`
- `inputSources`
- `requiresAi`
- `automationStatus`
- `futureSuggestion`
- `notes`

## Task 1: Branch And Scope Confirmation

**Files:**

- Read: `AGENTS.md`
- Read: `poc-server/AGENTS.md`
- Read: `docs/codex/GIT_WORKFLOW.md`
- Read: `docs/codex/CURRENT_TASK.md`
- Read: `docs/codex/HANDOFF.md`
- Read: `docs/codex/VALIDATION.md`

- [x] Step 1: Confirm workspace and branch.

Run:

```bash
pwd
git branch --show-current
git status --short --branch
```

Expected:

- Workspace is `/Users/1004182/Documents/bizplanet-work/bizp-store-learning-poc`.
- New branch is `codex/ruleset-source-matrix`.
- Existing `.DS_Store` modification is not part of this milestone.

- [x] Step 2: Confirm forbidden areas.

Expected:

- No changes in `admin/`.
- No changes in `pc-web/`.
- No changes to old Event-to-Operation source-of-truth files.
- Browser pages still call `poc-server` APIs only.

## Task 2: Write Source Matrix API RED Test

**Files:**

- Modify: `poc-server/test/rulesetApi.test.ts`

- [x] Step 1: Add a failing test for the ruleset source matrix.

Add this test inside `describe('marketing ruleset API', () => { ... })`:

```ts
  it('returns a field source matrix for direct Place/manual rows and AI ruleset rows', async () => {
    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/ruleset`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.sourceMatrix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: 'operatingHours',
          label: '운영시간',
          section: 'store',
          sourceTier: 'place_direct',
          requiresAi: false,
          automationStatus: 'available_now'
        }),
        expect.objectContaining({
          fieldKey: 'representativeMenu',
          label: '대표 메뉴',
          section: 'brand',
          sourceTier: 'place_then_ai',
          requiresAi: true,
          automationStatus: 'ai_processing'
        }),
        expect.objectContaining({
          fieldKey: 'reviewWeakness',
          label: '리뷰 약점',
          section: 'brand',
          sourceTier: 'ai_processing',
          requiresAi: true,
          automationStatus: 'ai_processing'
        }),
        expect.objectContaining({
          fieldKey: 'blogPreferredLength',
          label: '선호 길이',
          section: 'write_blog',
          sourceTier: 'ai_processing',
          requiresAi: true,
          automationStatus: 'ai_processing'
        }),
        expect.objectContaining({
          fieldKey: 'blogImageFormat',
          label: '비율·포맷',
          section: 'image_blog',
          sourceTier: 'ai_processing',
          requiresAi: true,
          automationStatus: 'ai_processing'
        })
      ])
    );
    expect(body.sourceMatrix.find((row: { fieldKey: string }) => row.fieldKey === 'reviewWeakness')).toMatchObject({
      currentImplementation: expect.stringContaining('static'),
      futureSuggestion: expect.stringContaining('Place')
    });
    expect(body.fields.find((field: { fieldKey: string }) => field.fieldKey === 'positioning')).toMatchObject({
      sourceMatrix: expect.objectContaining({
        fieldKey: 'storePositioning',
        sourceTier: 'ai_processing'
      })
    });
  });
```

- [x] Step 2: Run the RED test.

Run:

```bash
cd poc-server
npm test -- rulesetApi.test.ts -t "field source matrix"
```

Expected:

- FAIL because `body.sourceMatrix` is currently undefined and serialized fields do not include source matrix metadata.

## Task 3: Write Analyzer Field-Key RED Test

**Files:**

- Modify: `poc-server/test/analysisExecutionApi.test.ts`

- [x] Step 1: Expand the mock analyzer test expectations.

In `generates a learning snapshot, marketing ruleset, editable fields, and item-linked evidence`, extend the `fields.map((field) => field.fieldKey)` assertion with these keys:

```ts
        'representativeMenu',
        'reviewStrength',
        'reviewWeakness',
        'catchphrase',
        'humorLevel',
        'trendSensitivity',
        'instagramPurpose',
        'instagramWritingStyle',
        'instagramPreferredLength',
        'instagramHashtags',
        'instagramEmojiPolicy',
        'blogPurpose',
        'blogPreferredLength',
        'blogEmojiPolicy',
        'primaryColors',
        'accentColors',
        'imageStyle',
        'imageAvoidStyle',
        'instagramImageFormat',
        'instagramImageStyle',
        'instagramOverlayPolicy',
        'blogImageFormat',
        'blogImageStyle',
        'blogOverlayPolicy'
```

Also add:

```ts
    expect(fields.find((field) => field.fieldKey === 'reviewWeakness')).toMatchObject({
      aiValue: expect.stringContaining('주차'),
      source: 'mock_analyzer',
      evidenceItemIds: expect.arrayContaining(['collection_item_demo_place_review'])
    });
```

- [x] Step 2: Expand the latest-analysis field count expectation.

Change:

```ts
expect(latest.rulesetFields.length).toBeGreaterThanOrEqual(9);
```

to:

```ts
expect(latest.rulesetFields.length).toBeGreaterThanOrEqual(30);
```

- [x] Step 3: Add OpenAI prompt-key expectations.

In `persists OpenAI analyzer output with validated evidence links`, after the `parseCalls` assertions add:

```ts
    expect(JSON.stringify(parseCalls[0])).toContain('reviewWeakness');
    expect(JSON.stringify(parseCalls[0])).toContain('blogImageFormat');
    expect(JSON.stringify(parseCalls[0])).toContain('representativeMenu');
```

- [x] Step 4: Run the RED test.

Run:

```bash
cd poc-server
npm test -- analysisExecutionApi.test.ts -t "generates a learning snapshot"
npm test -- analysisExecutionApi.test.ts -t "OpenAI analyzer output"
```

Expected:

- FAIL because the mock analyzer only creates the original 9 fields and the OpenAI prompt only lists those keys.

## Task 4: Implement Source Matrix And Expanded Analyzer Fields

**Files:**

- Create: `poc-server/src/storeLearning/rulesets/rulesetSourceMatrix.ts`
- Modify: `poc-server/src/storeLearning/rulesets/rulesetService.ts`
- Modify: `poc-server/src/storeLearning/analysis/analyzer.ts`
- Modify: `poc-server/src/storeLearning/analysis/openAIAnalysisProvider.ts`

- [x] Step 1: Add `rulesetSourceMatrix.ts`.

Implementation requirements:

- Export `RULESET_SOURCE_MATRIX`.
- Export `REQUIRED_ANALYZER_RULESET_FIELD_KEYS`.
- Export `sourceMatrixForFieldKey(fieldKey: string)`.
- Export `serializeRulesetSourceMatrix()`.
- Alias `positioning` to `storePositioning` for older seeded/demo fields.

- [x] Step 2: Add source matrix to ruleset API payload.

Implementation requirements in `rulesetService.ts`:

- Import `serializeRulesetSourceMatrix` and `sourceMatrixForFieldKey`.
- `serializeField(field)` must include `sourceMatrix: sourceMatrixForFieldKey(field.fieldKey)`.
- `buildMarketingRulesetPayload()` must include `sourceMatrix: serializeRulesetSourceMatrix()` whether a ruleset exists or not.

- [x] Step 3: Expand mock analyzer ruleset fields.

Implementation requirements in `analyzer.ts`:

- Keep existing top-level `AnalyzerOutputSchema` unchanged unless required by tests.
- Keep existing original fields and values stable.
- Add ruleset fields for all expanded AI keys listed in Task 3.
- Evidence IDs must reference selected items only.
- Use deterministic Korean values.

- [x] Step 4: Reuse required field keys in OpenAI prompt.

Implementation requirements in `openAIAnalysisProvider.ts`:

- Import `REQUIRED_ANALYZER_RULESET_FIELD_KEYS`.
- Replace the inline `requiredRulesetFieldKeys` array with `REQUIRED_ANALYZER_RULESET_FIELD_KEYS`.

- [x] Step 5: Run focused GREEN tests.

Run:

```bash
cd poc-server
npm test -- rulesetApi.test.ts analysisExecutionApi.test.ts
```

Expected:

- PASS.

## Task 5: Documentation And Regression Validation

**Files:**

- Modify: `docs/codex/HANDOFF.md`
- Modify: `docs/codex/VALIDATION.md`

- [x] Step 1: Update handoff.

Add `MILESTONE-06-RULESET-SOURCE-MATRIX` as the current scope with:

- Source matrix API payload.
- Expanded analyzer field keys.
- OpenAI prompt field-key alignment.
- Explicitly excluded full UI replacement, learning-status completion changes, provider changes, `admin/`, `pc-web/`, and old Event-to-Operation changes.

- [x] Step 2: Update validation.

Add:

```bash
cd poc-server
npm test -- rulesetApi.test.ts -t "field source matrix"
npm test -- analysisExecutionApi.test.ts -t "generates a learning snapshot"
npm test -- analysisExecutionApi.test.ts -t "OpenAI analyzer output"
npm test -- rulesetApi.test.ts analysisExecutionApi.test.ts
npm test -- rulesetPage.test.ts
npm run typecheck
cd ..
git diff --check
git status --short
```

- [x] Step 3: Run final validation.

Run:

```bash
cd poc-server
npm test -- rulesetApi.test.ts analysisExecutionApi.test.ts
npm test -- rulesetPage.test.ts
npm run typecheck
cd ..
git diff --check
```

Expected:

- PASS.
- `.DS_Store` remains unstaged and outside the milestone commit.

## Task 6: Publish

**Files:**

- Stage only milestone files:
  - `docs/codex/MILESTONE_06_RULESET_SOURCE_MATRIX_PLAN.md`
  - `docs/codex/HANDOFF.md`
  - `docs/codex/VALIDATION.md`
  - `poc-server/src/storeLearning/rulesets/rulesetSourceMatrix.ts`
  - `poc-server/src/storeLearning/rulesets/rulesetService.ts`
  - `poc-server/src/storeLearning/analysis/analyzer.ts`
  - `poc-server/src/storeLearning/analysis/openAIAnalysisProvider.ts`
  - `poc-server/test/rulesetApi.test.ts`
  - `poc-server/test/analysisExecutionApi.test.ts`

- [x] Step 1: Confirm staged files exclude `.DS_Store`.

Run:

```bash
git diff --cached --name-only
git status --short
```

Expected:

- Staged files match the milestone list.
- `.DS_Store` appears only as an unstaged local modification if still present.

- [x] Step 2: Commit.

Use:

```bash
git commit -m "feat: add ruleset source matrix"
```

- [x] Step 3: Push and open a draft PR.

Expected:

- Branch: `codex/ruleset-source-matrix`.
- PR base: `codex/blog-raw-viewer-evidence` while PR #30 is open.
- After PR #30 merges, retarget this PR to `develop`.
