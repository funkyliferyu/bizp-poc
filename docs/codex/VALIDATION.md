# Validation

## LLM-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run demo
npm run demo:store-learning
```

Manual smoke:

```bash
PORT=5178 npm run dev
```

## Expected Coverage

- `npm run db:migrate` keeps the Store Learning SQLite schema available.
- `npm run db:seed` keeps the demo store path available without external keys.
- `npm run typecheck` verifies analysis provider types, route injection, and tests compile.
- `npm test` runs existing Event-to-Operation tests plus Store Learning API/page tests.
- `npm run demo` verifies the old Event-to-Operation demo remains behaviorally unchanged.
- `npm run demo:store-learning` verifies the Store Learning demo still works in mock mode.

## TDD Evidence

- RED `npm test -- analysisExecutionApi.test.ts`: failed because `openAIAnalysisProvider` did not exist.
- GREEN `npm test -- analysisExecutionApi.test.ts`: passed, 1 file / 4 tests.
- GREEN after test env isolation: `npm run typecheck && npm test -- analysisExecutionApi.test.ts selectionApi.test.ts` passed, 2 files / 6 tests.

## Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 26 files / 91 tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.

## Manual Smoke Result

Smoke server:

```bash
PORT=5178 npm run dev
```

Observed API smoke in default mock mode:

```text
POST /api/analysis-runs => analysisRunId created
POST /api/analysis-runs/:analysisRunId/start => status completed
analysisRun.result.analyzerMode => mock
analysisRun.result.analyzerProvider => mockDeterministicAnalyzer
analysisEvidence.length => 3
rulesetFields.length => 9
```

Observed browser smoke:

```text
URL => http://127.0.0.1:5178/06_AI학습_현황.html?storeId=store_demo_cake
learning_status.js loaded => true
rulesetStatus => ✓ 생성 완료
browser console errors => []
```

## Manual Checks

Default mock mode:

- `POST /api/analysis-runs/:analysisRunId/start` should still work without external keys.
- `analysisRun.result.analyzerMode` should remain `mock`.
- Existing learning snapshot/ruleset/evidence persistence should remain unchanged.

Credentialed OpenAI mode:

- Set `OPENAI_API_KEY`.
- Optionally set `OPENAI_MODEL`.
- `POST /api/analysis-runs/:analysisRunId/start` should use `openAIAnalysisProvider`.
- Saved analysis run result should include:
  - `analyzerMode = openai`
  - `analyzerProvider = openAIAnalysisProvider`
- Saved learning snapshot should include:
  - `mode = openai`
  - `provider = openAIAnalysisProvider`
- OpenAI output must be rejected before saving if evidence IDs do not belong to selected collection items.

## Boundaries

- Browser pages still call poc-server APIs only.
- OpenAI credentials stay server-side.
- Mock mode still works without external keys.
- Analyzer outputs use Zod schema validation before persistence.
- Analyzer evidence references are checked against selected collection items before persistence.
- Naver collection behavior is unchanged in LLM-001.
- Blog generation, image generation, and Naver Blog publishing are unchanged.
- Existing Event-to-Operation workflows should remain behaviorally unchanged.
- `admin/` and `pc-web/` should remain unchanged.
- The generated local SQLite file is under ignored `poc-server/data/`.
