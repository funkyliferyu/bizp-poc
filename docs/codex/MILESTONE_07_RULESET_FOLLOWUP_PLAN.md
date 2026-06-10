# Ruleset Follow-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the first-pass marketing strategy ruleset screen by aligning the API contract, removing browser-side fixture dependencies, and making the remaining ruleset tabs use API-backed values and server-generated previews.

**Architecture:** Make `strategy-ruleset` the canonical product API while keeping the existing `/ruleset` routes as compatibility aliases during migration. Keep all browser calls under `poc-server` APIs, move competitor benchmark and preview generation behind server services, and expand the ruleset payload so visible rows can be filled from direct Place/manual facts or validated analyzer fields.

**Tech Stack:** Static HTML/CSS/JS in `web/`, Express/TypeScript routes in `poc-server`, SQLite repositories, Vitest API/static tests, deterministic mock services with provider adapter seams for future real benchmark/LLM providers.

---

## Scope

Included:

- Decide and document the canonical API contract for the ruleset screen.
- Add canonical `strategy-ruleset` routes and keep `/ruleset` aliases until all browser/tests use the canonical route.
- Update `web/ruleset_editor.js` and `web/07_마케팅전략룰셋.html` to call only canonical `poc-server` APIs.
- Move `strategy_benchmark_fixture.json` usage behind a server API.
- Replace the hardcoded writing-preview rotation with a server preview endpoint.
- Expand the ruleset payload with safe direct store facts for operating hours, closed days, parking, phone, description, and menu-derived rows.
- Ensure every visible ruleset row has a stable field key, current implementation note, source tier, future suggestion, and current value where available.
- Update handoff and validation notes after implementation.

Excluded:

- Do not call Naver, OpenAI, or scraping providers from browser code.
- Do not add real competitor/provider collection in this follow-up; return deterministic mock/provider-ready benchmark data from the server.
- Do not redesign the whole ruleset page.
- Do not modify `admin/`, `pc-web/`, or old Event-to-Operation files.
- Do not remove the legacy `/ruleset` alias until no shipped page or test references it.

## API Contract Decision

### Decision

Use `strategy-ruleset` as the canonical API path:

```text
GET   /api/stores/:storeId/strategy-ruleset
PATCH /api/stores/:storeId/strategy-ruleset/fields/:fieldKey
POST  /api/stores/:storeId/strategy-ruleset/fields/:fieldKey/reset
GET   /api/stores/:storeId/strategy-ruleset/fields/:fieldKey/evidence
GET   /api/stores/:storeId/strategy-ruleset/benchmark-evidence
POST  /api/stores/:storeId/strategy-ruleset/regenerate-preview
```

Keep these existing routes as temporary compatibility aliases that call the same service functions:

```text
GET   /api/stores/:storeId/ruleset
PATCH /api/stores/:storeId/ruleset/fields/:fieldKey
POST  /api/stores/:storeId/ruleset/fields/:fieldKey/reset
GET   /api/stores/:storeId/ruleset/fields/:fieldKey/evidence
```

### Rationale

- Product and architecture docs already name the screen contract `strategy-ruleset`, including preview regeneration and benchmark evidence endpoints.
- `ruleset` is too generic once the system also has content-generation rules, SEO scoring rules, provider readiness rules, and publishing policies.
- The screen is specifically "마케팅 전략 룰셋"; the path should preserve that domain boundary.
- The existing field-level `/ruleset` implementation is useful and already tested, so replacing it with only a whole-resource `PUT` would lose ergonomic save/reset/evidence operations.
- A compatibility alias avoids breaking PR #31/#32 behavior while the browser and tests migrate.

### Resulting Shape

- Canonical path: `strategy-ruleset`.
- Canonical save shape: field-level `PATCH` for row edits.
- Optional whole-resource save belongs in a separate bulk-editing milestone only if the UI gains bulk editing.
- Old `/ruleset` aliases remain for one migration cycle and should be removed only after grep proves no browser/test/doc references remain except deprecation notes.

## Current Implementation Baseline

- `GET /api/stores/:storeId/ruleset` returns `store`, `ruleset`, `learningSnapshot`, `analysis`, `fields`, and `sourceMatrix`.
- Field edit/reset/evidence routes already exist under `/ruleset/fields/:fieldKey`.
- Analyzer and OpenAI prompt use `REQUIRED_ANALYZER_RULESET_FIELD_KEYS` from `rulesetSourceMatrix.ts`.
- `web/ruleset_editor.js` loads and edits ruleset fields from `/ruleset`.
- `web/07_마케팅전략룰셋.html` still fetches `strategy_benchmark_fixture.json` directly for competitor/reference UI.
- `web/07_마케팅전략룰셋.html` still uses inline `WRITING_PREVIEWS` constants for "다시 생성하기".
- Some visible rows still depend on static HTML text or direct store fields with no richer current value mapping.

## Files

- Modify: `poc-server/src/storeLearning/routes/stores.ts`
  - Add canonical strategy-ruleset routes.
  - Keep compatibility aliases.
- Modify: `poc-server/src/storeLearning/rulesets/rulesetService.ts`
  - Add direct store facts to the payload.
  - Keep serialized field/source matrix behavior.
- Create: `poc-server/src/storeLearning/rulesets/rulesetBenchmarkService.ts`
  - Provides deterministic benchmark evidence payloads through server APIs.
  - Owns the fixture-equivalent shape currently used by the browser.
- Create: `poc-server/src/storeLearning/rulesets/rulesetPreviewService.ts`
  - Generates deterministic preview variants from current ruleset fields and channel.
  - Leaves saved ruleset values untouched.
- Modify: `web/ruleset_editor.js`
  - Switch to canonical `strategy-ruleset` endpoints.
  - Render direct store facts and richer current values.
  - Load benchmark evidence and writing preview data from server APIs.
- Modify: `web/07_마케팅전략룰셋.html`
  - Remove direct fixture fetch and hardcoded preview dependency.
  - Add missing row hooks only where needed.
- Modify: `poc-server/test/rulesetApi.test.ts`
  - Add canonical route/alias parity tests.
  - Add benchmark evidence and preview API tests.
- Modify: `poc-server/test/rulesetPage.test.ts`
  - Assert browser code uses canonical API and does not fetch fixture JSON.
- Modify: `poc-server/test/staticWebConnectivity.test.ts`
  - Update expectations that currently require `strategy_benchmark_fixture.json` and `WRITING_PREVIEWS`.
- Modify: `docs/codex/HANDOFF.md`
- Modify: `docs/codex/VALIDATION.md`

## Task 0: Start From Clean Develop Context

**Files:**

- Read: `AGENTS.md`
- Read: `poc-server/AGENTS.md`
- Read: `docs/codex/GIT_WORKFLOW.md`
- Read: `docs/codex/CURRENT_TASK.md`
- Read: `docs/codex/PLAN.md`
- Read: this plan

- [x] Step 1: Confirm workspace and branch.

Run:

```bash
pwd
git branch --show-current
git status --short --branch
```

Expected:

- Workspace is `/Users/1004182/Documents/bizplanet-work/bizp-store-learning-poc`.
- Branch is a new `codex/*` branch from `develop`.
- `.DS_Store` is not staged.

- [x] Step 2: Confirm implementation base.

Run:

```bash
git fetch origin --prune
git log --oneline origin/develop -5
```

Expected:

- `origin/develop` contains PR #35 and the #26-#34 merge commits.
- PR base for implementation is `develop`.

## Task 1: Add Canonical API Contract Tests

**Files:**

- Modify: `poc-server/test/rulesetApi.test.ts`
- Modify: `poc-server/test/rulesetPage.test.ts`

- [x] Step 1: Add canonical route parity test.

Add this test inside `describe('marketing ruleset API', () => { ... })`:

```ts
  it('serves the same ruleset payload from canonical strategy-ruleset and legacy ruleset routes', async () => {
    const canonicalResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset`);
    const legacyResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/ruleset`);
    const canonical = await readJson(canonicalResponse);
    const legacy = await readJson(legacyResponse);

    expect(canonicalResponse.status).toBe(200);
    expect(legacyResponse.status).toBe(200);
    expect(canonical.store).toEqual(legacy.store);
    expect(canonical.ruleset).toEqual(legacy.ruleset);
    expect(canonical.fields).toEqual(legacy.fields);
    expect(canonical.sourceMatrix).toEqual(legacy.sourceMatrix);
  });
```

- [x] Step 2: Add canonical field edit/reset/evidence route test.

Add this test:

```ts
  it('edits, resets, and reads evidence through canonical strategy-ruleset field routes', async () => {
    const editedValue = '분당 기념일 케이크 전략 포지셔닝';
    const editResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset/fields/storePositioning`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userValue: editedValue })
    });
    const edited = await readJson(editResponse);

    expect(editResponse.status).toBe(200);
    expect(edited.field).toMatchObject({
      fieldKey: 'storePositioning',
      finalValue: editedValue,
      source: 'user_edited',
      locked: true
    });

    const evidenceResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset/fields/storePositioning/evidence`);
    const evidence = await readJson(evidenceResponse);

    expect(evidenceResponse.status).toBe(200);
    expect(evidence.field).toMatchObject({ fieldKey: 'storePositioning' });
    expect(evidence.evidence.length).toBeGreaterThan(0);

    const resetResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset/fields/storePositioning/reset`, {
      method: 'POST'
    });
    const reset = await readJson(resetResponse);

    expect(resetResponse.status).toBe(200);
    expect(reset.field).toMatchObject({
      fieldKey: 'storePositioning',
      userValue: null,
      source: 'ai_generated',
      locked: false
    });
  });
```

- [x] Step 3: Add browser canonical endpoint test.

Update `rulesetPage.test.ts` so it expects canonical browser calls:

```ts
expect(js).toContain('fetch(`/api/stores/${storeId}/strategy-ruleset`)');
expect(js).toContain('fetch(`/api/stores/${storeId}/strategy-ruleset/fields/${fieldKey}`');
expect(js).toContain('fetch(`/api/stores/${storeId}/strategy-ruleset/fields/${fieldKey}/reset`');
expect(js).toContain('fetch(`/api/stores/${storeId}/strategy-ruleset/fields/${fieldKey}/evidence`)');
expect(js).not.toContain('fetch(`/api/stores/${storeId}/ruleset`)');
```

- [x] Step 4: Run RED tests.

Run:

```bash
cd poc-server
npm test -- rulesetApi.test.ts -t "canonical"
npm test -- rulesetPage.test.ts
```

Expected:

- FAIL because `strategy-ruleset` routes and browser canonical calls do not exist yet.

## Task 2: Implement Canonical Strategy Ruleset Routes

**Files:**

- Modify: `poc-server/src/storeLearning/routes/stores.ts`

- [x] Step 1: Add helper handlers in `createStoreRoutes`.

Implementation shape:

```ts
  function sendRuleset(req: express.Request, res: express.Response) {
    const payload = buildMarketingRulesetPayload(repos, req.params.storeId);
    if (!payload) {
      res.status(404).json({ error: `Store not found: ${req.params.storeId}` });
      return;
    }
    res.json(payload);
  }

  function patchRulesetField(req: express.Request, res: express.Response, next: express.NextFunction) {
    try {
      const body = RulesetFieldPatchSchema.parse(req.body);
      const payload = updateRulesetFieldValue(repos, req.params.storeId, req.params.fieldKey, body.userValue);
      if (!payload) {
        res.status(404).json({ error: `Store or ruleset not found: ${req.params.storeId}` });
        return;
      }
      if (!payload.field) {
        res.status(404).json({ error: `Ruleset field not found: ${req.params.fieldKey}` });
        return;
      }
      res.json(payload);
    } catch (error) {
      next(error);
    }
  }

  function resetRulesetField(req: express.Request, res: express.Response) {
    const payload = resetRulesetFieldValue(repos, req.params.storeId, req.params.fieldKey);
    if (!payload) {
      res.status(404).json({ error: `Store or ruleset not found: ${req.params.storeId}` });
      return;
    }
    if (!payload.field) {
      res.status(404).json({ error: `Ruleset field not found: ${req.params.fieldKey}` });
      return;
    }
    res.json(payload);
  }

  function sendRulesetFieldEvidence(req: express.Request, res: express.Response) {
    const payload = buildRulesetFieldEvidence(repos, req.params.storeId, req.params.fieldKey);
    if (!payload) {
      res.status(404).json({ error: `Store or ruleset not found: ${req.params.storeId}` });
      return;
    }
    if (!payload.field) {
      res.status(404).json({ error: `Ruleset field not found: ${req.params.fieldKey}` });
      return;
    }
    res.json(payload);
  }
```

- [x] Step 2: Register canonical and legacy routes to the same handlers.

Implementation shape:

```ts
  router.get('/:storeId/strategy-ruleset', sendRuleset);
  router.get('/:storeId/ruleset', sendRuleset);

  router.patch('/:storeId/strategy-ruleset/fields/:fieldKey', patchRulesetField);
  router.patch('/:storeId/ruleset/fields/:fieldKey', patchRulesetField);

  router.post('/:storeId/strategy-ruleset/fields/:fieldKey/reset', resetRulesetField);
  router.post('/:storeId/ruleset/fields/:fieldKey/reset', resetRulesetField);

  router.get('/:storeId/strategy-ruleset/fields/:fieldKey/evidence', sendRulesetFieldEvidence);
  router.get('/:storeId/ruleset/fields/:fieldKey/evidence', sendRulesetFieldEvidence);
```

- [x] Step 3: Run GREEN API tests for canonical routes.

Run:

```bash
cd poc-server
npm test -- rulesetApi.test.ts -t "canonical"
```

Expected:

- PASS for canonical payload parity and canonical field edit/reset/evidence.

## Task 3: Switch Browser Ruleset Editor To Canonical APIs

**Files:**

- Modify: `web/ruleset_editor.js`
- Modify: `poc-server/test/rulesetPage.test.ts`

- [x] Step 1: Replace browser endpoint paths.

Change endpoint strings in `ruleset_editor.js`:

```js
fetch(`/api/stores/${storeId}/strategy-ruleset`)
fetch(`/api/stores/${storeId}/strategy-ruleset/fields/${fieldKey}`, ...)
fetch(`/api/stores/${storeId}/strategy-ruleset/fields/${fieldKey}/reset`, ...)
fetch(`/api/stores/${storeId}/strategy-ruleset/fields/${fieldKey}/evidence`)
```

- [x] Step 2: Run page wiring tests.

Run:

```bash
cd poc-server
npm test -- rulesetPage.test.ts
```

Expected:

- PASS.
- Browser code still has no external provider calls.

## Task 4: Move Benchmark Fixture Behind Server API

**Files:**

- Create: `poc-server/src/storeLearning/rulesets/rulesetBenchmarkService.ts`
- Modify: `poc-server/src/storeLearning/routes/stores.ts`
- Modify: `web/07_마케팅전략룰셋.html`
- Modify: `poc-server/test/rulesetApi.test.ts`
- Modify: `poc-server/test/rulesetPage.test.ts`
- Modify: `poc-server/test/staticWebConnectivity.test.ts`

- [x] Step 1: Add API test for benchmark evidence.

Add this test:

```ts
  it('returns benchmark evidence through the canonical strategy-ruleset API', async () => {
    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset/benchmark-evidence`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.storeId).toBe('store_demo_cake');
    expect(body.defaultType).toBe('recommended');
    expect(body.benchmarkTypes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'recommended',
          label: expect.any(String),
          candidates: expect.any(Array),
          comparison: expect.any(Array)
        })
      ])
    );
    expect(body.provider).toMatchObject({
      mode: 'mock',
      name: 'mockRulesetBenchmarkProvider'
    });
  });
```

- [x] Step 2: Implement `buildRulesetBenchmarkPayload`.

Create `rulesetBenchmarkService.ts` exporting:

```ts
export function buildRulesetBenchmarkPayload(storeId: string) {
  return {
    storeId,
    provider: {
      name: 'mockRulesetBenchmarkProvider',
      mode: 'mock'
    },
    defaultType: 'recommended',
    benchmarkTypes: [
      {
        id: 'recommended',
        label: '추천 기준',
        scope: '동일 업종과 인근 경쟁 신호를 함께 봅니다.',
        description: '현재는 서버 mock benchmark provider 결과입니다.',
        candidateCount: 3,
        reviewCount: 128,
        keywordCount: 24,
        candidates: [
          {
            name: '케이크랩',
            category: '케이크전문점',
            location: '정자역 600m',
            rankSignal: '지역+제작 방식+상담 강점을 함께 내세움',
            basisTags: ['지역 키워드', '상담 강점', '예약 안내'],
            evidence: ['플레이스 프로필 예시', '리뷰 키워드 예시']
          }
        ],
        comparison: [
          {
            key: 'storePositioning',
            label: '포지셔닝',
            ourStore: '분당 당일 제작 커스텀 케이크 전문점',
            benchmark: '지역+제작 방식+상담 강점을 함께 내세움',
            gap: '상담/픽업 동선 설명을 더 구체화할 수 있음',
            recommendation: '예약 가능 시간과 픽업 안내를 첫 문단에 배치',
            evidence: ['후보 업체 프로필 문구', '리뷰 반복 키워드']
          }
        ]
      }
    ]
  };
}
```

- [x] Step 3: Add canonical benchmark route.

In `stores.ts`:

```ts
router.get('/:storeId/strategy-ruleset/benchmark-evidence', (req, res) => {
  const store = repos.stores.findById(req.params.storeId);
  if (!store) {
    res.status(404).json({ error: `Store not found: ${req.params.storeId}` });
    return;
  }
  res.json(buildRulesetBenchmarkPayload(req.params.storeId));
});
```

- [x] Step 4: Update browser benchmark loading.

Replace:

```js
const response = await fetch('strategy_benchmark_fixture.json');
```

with:

```js
const response = await fetch(`/api/stores/${currentStoreId()}/strategy-ruleset/benchmark-evidence`);
```

Add a `currentStoreId()` helper in the inline script that matches the local-storage/query behavior in `ruleset_editor.js`.

- [x] Step 5: Update tests that expect direct fixture access.

In static/page tests:

```ts
expect(ruleset).not.toContain('strategy_benchmark_fixture.json');
expect(ruleset).toContain('/strategy-ruleset/benchmark-evidence');
```

- [x] Step 6: Run benchmark tests.

Run:

```bash
cd poc-server
npm test -- rulesetApi.test.ts -t "benchmark evidence"
npm test -- rulesetPage.test.ts
npm test -- staticWebConnectivity.test.ts
```

Expected:

- PASS.
- Browser no longer fetches `strategy_benchmark_fixture.json`.

## Task 5: Add Server-Generated Writing Preview Endpoint

**Files:**

- Create: `poc-server/src/storeLearning/rulesets/rulesetPreviewService.ts`
- Modify: `poc-server/src/storeLearning/routes/stores.ts`
- Modify: `web/07_마케팅전략룰셋.html`
- Modify: `poc-server/test/rulesetApi.test.ts`
- Modify: `poc-server/test/rulesetPage.test.ts`
- Modify: `poc-server/test/staticWebConnectivity.test.ts`

- [x] Step 1: Add API test for preview regeneration.

Add this test:

```ts
  it('regenerates a writing preview without changing saved ruleset fields', async () => {
    const beforeResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset`);
    const before = await readJson(beforeResponse);
    const beforeFields = before.fields;

    const previewResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset/regenerate-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'blog', topic: '딸기 생크림 케이크 예약 안내', variantIndex: 1 })
    });
    const preview = await readJson(previewResponse);

    const afterResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset`);
    const after = await readJson(afterResponse);

    expect(previewResponse.status).toBe(200);
    expect(preview).toMatchObject({
      channel: 'blog',
      topic: '딸기 생크림 케이크 예약 안내',
      provider: { mode: 'mock', name: 'mockRulesetPreviewProvider' },
      preview: {
        meta: expect.any(String),
        body: expect.stringContaining('딸기 생크림 케이크'),
        tags: expect.any(Array)
      }
    });
    expect(after.fields).toEqual(beforeFields);
  });
```

- [x] Step 2: Implement preview request schema and service.

In `stores.ts`, add a Zod schema:

```ts
const RulesetPreviewRequestSchema = z.object({
  channel: z.enum(['common', 'instagram', 'blog']),
  topic: z.string().trim().min(1).max(120).default('딸기 생크림 케이크 예약 안내'),
  variantIndex: z.number().int().min(0).max(20).default(0)
});
```

In `rulesetPreviewService.ts`, export a deterministic function:

```ts
export function buildRulesetPreviewPayload(input: {
  storeName: string;
  channel: 'common' | 'instagram' | 'blog';
  topic: string;
  variantIndex: number;
}) {
  const variantNumber = (input.variantIndex % 3) + 1;
  return {
    provider: { name: 'mockRulesetPreviewProvider', mode: 'mock' },
    channel: input.channel,
    topic: input.topic,
    variantIndex: input.variantIndex,
    preview: {
      meta: `${input.channel} 미리보기 ${variantNumber}`,
      body: `${input.storeName}의 ${input.topic} 콘텐츠 예시입니다. 예약 가능 여부와 픽업 시간을 자연스럽게 안내합니다.`,
      tags: ['분당 케이크', '예약 안내', '픽업 안내']
    }
  };
}
```

- [x] Step 3: Add route.

```ts
router.post('/:storeId/strategy-ruleset/regenerate-preview', (req, res, next) => {
  try {
    const store = repos.stores.findById(req.params.storeId);
    if (!store) {
      res.status(404).json({ error: `Store not found: ${req.params.storeId}` });
      return;
    }
    const body = RulesetPreviewRequestSchema.parse(req.body);
    res.json(buildRulesetPreviewPayload({
      storeName: store.name,
      channel: body.channel,
      topic: body.topic,
      variantIndex: body.variantIndex
    }));
  } catch (error) {
    next(error);
  }
});
```

- [x] Step 4: Update browser preview behavior.

Replace `WRITING_PREVIEWS` rotation with:

```js
async function regenerateWritingPreview(){
  writingPreviewIndexes[activeWritingChannel] = (writingPreviewIndexes[activeWritingChannel] || 0) + 1;
  const response = await fetch(`/api/stores/${currentStoreId()}/strategy-ruleset/regenerate-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel: activeWritingChannel,
      topic: '딸기 생크림 케이크 예약 안내',
      variantIndex: writingPreviewIndexes[activeWritingChannel]
    })
  });
  const payload = await response.json();
  renderWritingPreviewPayload(payload);
}
```

Keep a loading state:

```js
document.getElementById('writingPreviewBody').textContent = '미리보기를 생성하는 중입니다.';
```

- [x] Step 5: Run preview tests.

Run:

```bash
cd poc-server
npm test -- rulesetApi.test.ts -t "regenerates a writing preview"
npm test -- rulesetPage.test.ts
npm test -- staticWebConnectivity.test.ts
```

Expected:

- PASS.
- Static tests no longer require `const WRITING_PREVIEWS`.

## Task 6: Fill Remaining Visible Rows From API Payload

**Files:**

- Modify: `poc-server/src/storeLearning/rulesets/rulesetService.ts`
- Modify: `web/ruleset_editor.js`
- Modify: `web/07_마케팅전략룰셋.html`
- Modify: `poc-server/test/rulesetApi.test.ts`
- Modify: `poc-server/test/rulesetPage.test.ts`

- [x] Step 1: Add API test for direct facts and row current values.

Add this test:

```ts
  it('returns direct store facts for ruleset rows that do not require AI', async () => {
    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.storeFacts).toMatchObject({
      name: '분당 케이크하우스',
      category: 'bakery',
      address: '경기도 성남시 분당구 정자동',
      phone: '031-000-0000',
      storeIntro: expect.stringContaining('당일 제작')
    });
    expect(body.sourceMatrix.find((row: { fieldKey: string }) => row.fieldKey === 'phone')).toMatchObject({
      currentValue: '031-000-0000'
    });
  });
```

- [x] Step 2: Implement `storeFacts`.

In `rulesetService.ts`, add a serializer:

```ts
function serializeStoreFacts(store: StoreRecord) {
  const metadata = asRecord(store.metadata);
  return {
    name: store.name,
    category: store.category,
    address: store.address,
    phone: store.phone,
    storeIntro: store.description,
    operatingHours: metadata.operatingHours ?? null,
    closedDays: metadata.closedDays ?? null,
    parking: metadata.parking ?? null
  };
}
```

Use this local type if the store repository type is not already exported:

```ts
type StoreRecord = NonNullable<ReturnType<Repositories['stores']['findById']>>;
```

- [x] Step 3: Add `currentValue` to source matrix rows at serialization time.

Implementation shape:

```ts
function sourceMatrixWithCurrentValues(storeFacts: Record<string, unknown>, fields: RulesetField[]) {
  const fieldValues = new Map(fields.map((field) => [field.fieldKey, field.finalValue || field.aiValue]));
  return serializeRulesetSourceMatrix().map((row) => ({
    ...row,
    currentValue: fieldValues.get(row.fieldKey) ?? storeFacts[row.fieldKey] ?? null
  }));
}
```

- [x] Step 4: Render `storeFacts` and `sourceMatrix.currentValue` in the browser.

Update `ruleset_editor.js` so direct rows prefer:

1. editable ruleset field final value,
2. `payload.sourceMatrix[].currentValue`,
3. `payload.storeFacts[fieldKey]`,
4. existing static HTML fallback.

- [x] Step 5: Add missing `data-ruleset-field` hooks to rows that still have only static text.

Minimum visible rows to hook:

```text
operatingHours
closedDays
phone
parking
storeIntro
primaryColors
accentColors
imageStyle
imageAvoidStyle
instagramImageFormat
instagramImageStyle
instagramOverlayPolicy
blogImageFormat
blogImageStyle
blogOverlayPolicy
```

- [x] Step 6: Run row-fill tests.

Run:

```bash
cd poc-server
npm test -- rulesetApi.test.ts -t "direct store facts"
npm test -- rulesetPage.test.ts
```

Expected:

- PASS.

## Task 7: Full Validation And Documentation

**Files:**

- Modify: `docs/codex/HANDOFF.md`
- Modify: `docs/codex/VALIDATION.md`

- [x] Step 1: Run focused tests.

Run:

```bash
cd poc-server
npm test -- rulesetApi.test.ts rulesetPage.test.ts staticWebConnectivity.test.ts
```

Expected:

- PASS.

- [x] Step 2: Run full local validation.

Run:

```bash
cd poc-server
npm run typecheck
npm test
npm run demo:store-learning
```

Expected:

- `npm run typecheck` exits 0.
- `npm test` exits 0 with skipped live-provider tests only.
- `npm run demo:store-learning` seeds Store Learning demo data and prints store/channel/item summary.

- [x] Step 3: Update handoff.

Add a new top section to `docs/codex/HANDOFF.md`:

```markdown
## MILESTONE-07-FOLLOWUP-RULESET-CONTRACT

Canonical ruleset API is now `/api/stores/:storeId/strategy-ruleset`.
The old `/api/stores/:storeId/ruleset` routes remain as compatibility aliases.
Benchmark evidence and writing preview regeneration are served through `poc-server`
APIs, so `web/07_마케팅전략룰셋.html` no longer fetches local fixture JSON or
uses browser-side preview fixtures.
```

- [x] Step 4: Update validation.

Add commands and results to `docs/codex/VALIDATION.md`:

```markdown
## MILESTONE-07-FOLLOWUP-RULESET-CONTRACT Validation

- RED/GREEN details for canonical strategy-ruleset route tests.
- RED/GREEN details for benchmark API migration.
- RED/GREEN details for writing preview API migration.
- Final `npm run typecheck`, `npm test`, and `npm run demo:store-learning` results.
```

- [x] Step 5: Run diff checks.

Run:

```bash
git diff --check
git status --short
```

Expected:

- No whitespace errors.
- `.DS_Store` is not staged.

## Execution Order

Implement in this exact order:

1. Task 1: Canonical contract tests.
2. Task 2: Canonical server routes with legacy aliases.
3. Task 3: Browser switch to canonical endpoints.
4. Task 4: Benchmark API migration.
5. Task 5: Server-generated writing preview.
6. Task 6: Remaining visible row auto-fill.
7. Task 7: Validation and docs.

Do not start Task 4 before Task 3 passes. Do not start Task 5 before fixture removal tests pass. Do not start Task 6 before canonical route and server benchmark/preview APIs are stable.

## Review Checklist

- [x] Browser code calls only `/api/stores/:storeId/strategy-ruleset...`.
- [x] Legacy `/ruleset` aliases are tested but not used by browser code.
- [x] `web/07_마케팅전략룰셋.html` no longer fetches `strategy_benchmark_fixture.json`.
- [x] Writing preview regeneration comes from `poc-server` and does not mutate saved ruleset fields.
- [x] Source matrix rows show current values when direct facts or ruleset fields exist.
- [x] Direct Place/manual facts are not treated as AI-generated.
- [x] User-edited fields remain locked until explicitly reset.
- [x] No `admin/`, `pc-web/`, or old Event-to-Operation files changed.
- [x] No browser-side Naver/OpenAI calls or secrets.
