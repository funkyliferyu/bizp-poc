# Validation

## DATA-001 Commands

Run from `poc-server/`:

```bash
npm run typecheck
npm test
npm run demo:store-learning
```

## Expected Coverage

- `npm run typecheck` verifies the new SQLite connection, migration, repository, seed, and demo modules compile.
- `npm test` runs the existing Event-to-Operation tests plus Store Learning repository tests.
- `npm run demo:store-learning` migrates the local SQLite DB, seeds one demo store, and prints a summary.
- Store Learning repository tests also cover selected-content persistence, repository update/read flows, migration backfill for selection columns, and idempotent demo seeding.

## DATA-001 Boundaries

- No UI wiring is expected.
- No Naver/OpenAI calls are expected.
- Existing Event-to-Operation workflows should remain behaviorally unchanged.
- `admin/` and `pc-web/` should remain unchanged.
- The generated local SQLite file is under ignored `poc-server/data/`.
- `.DS_Store` files should not appear in PR status.
