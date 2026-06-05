# Validation

## ANALYZE-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm test -- analysisExecutionApi.test.ts
npm run typecheck
npm test
npm run demo
npm run demo:store-learning
```

SQLite spot checks:

```bash
sqlite3 data/store-learning.sqlite "select id, status from analysis_runs;"
sqlite3 data/store-learning.sqlite "select id, store_id from learning_snapshots;"
sqlite3 data/store-learning.sqlite "select id, store_id from marketing_rulesets;"
sqlite3 data/store-learning.sqlite "select field_key, source, locked from ruleset_fields limit 20;"
sqlite3 data/store-learning.sqlite "select count(*) from analysis_evidence;"
```

## Expected Coverage

- `npm run db:migrate` applies the Store Learning SQLite schema, including editable `ruleset_fields` columns.
- `npm run db:seed` keeps the demo store seed path idempotent with the expanded ruleset field model.
- `npm test -- analysisExecutionApi.test.ts` verifies queued analysis execution, artifact persistence, evidence linkage, and latest-analysis lookup.
- `npm run typecheck` verifies analyzer schemas, provider boundary, execution service, route changes, repository types, and migrations compile.
- `npm test` runs existing Event-to-Operation tests plus Store Learning repository, registration, training, collection, selection, and analysis tests.
- `npm run demo` verifies the existing Event-to-Operation demo still runs.
- `npm run demo:store-learning` verifies the Store Learning demo seed path still runs.
- SQLite checks verify persisted analysis runs, snapshots, rulesets, editable fields, and evidence rows.

## TDD Evidence

- RED `npm test -- analysisExecutionApi.test.ts`: failed because `POST /api/analysis-runs/:analysisRunId/start` and latest-analysis behavior did not exist.
- GREEN `npm test -- analysisExecutionApi.test.ts`: passed, 1 file / 2 tests.
- Early `npm run typecheck`: passed after implementation.
- Early `npm test`: passed, 18 files / 68 tests.

## Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 18 files / 68 tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the seeded Store Learning summary.

## SQLite Evidence

Persistent DB analysis execution sample:

```text
analysisRunId=analysis_run_validation_1780672952917
status=completed
snapshotId=learning_snapshot_analysis_run_validation_1780672952917
rulesetId=marketing_ruleset_analysis_run_validation_1780672952917_v2
evidenceCount=3
fieldCount=9
```

Analysis run statuses:

```text
analysis_run_demo_store_learning|succeeded
analysis_run_store_demo_cake_1780672202266|queued
analysis_run_validation_1780672952917|completed
```

Learning snapshots:

```text
learning_snapshot_demo_store_learning|store_demo_cake
learning_snapshot_analysis_run_validation_1780672952917|store_demo_cake
```

Marketing rulesets:

```text
marketing_ruleset_demo_v1|store_demo_cake
marketing_ruleset_analysis_run_validation_1780672952917_v2|store_demo_cake
```

Ruleset field sample:

```text
positioning|analysis|0
contentKeywords|analysis|0
storePositioning|mock_analyzer|0
keyStrengths|mock_analyzer|0
targetCustomers|mock_analyzer|0
toneAndManner|mock_analyzer|0
blogWritingStyle|mock_analyzer|0
seoKeywords|mock_analyzer|0
ctaStyle|mock_analyzer|0
imageDirection|mock_analyzer|0
negativeExpressions|mock_analyzer|0
```

Analysis evidence count:

```text
5
```

## ANALYZE-001 Boundaries

- No browser-side Naver/OpenAI calls are present.
- No real server-side Naver/OpenAI calls are present.
- Analyzer execution uses deterministic mock provider data only.
- Analyzer output is validated with Zod before persistence.
- No blog generation, image generation, or Naver collection is implemented.
- Learning status and ruleset pages are not fully connected.
- Existing Event-to-Operation workflows should remain behaviorally unchanged.
- `admin/` and `pc-web/` should remain unchanged.
- The generated local SQLite file is under ignored `poc-server/data/`.
