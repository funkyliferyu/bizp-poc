# Marketing Strategy Ruleset Benchmark Plan

## Goal

Make `우리 매장 분석` explain what benchmark basis was used and show how each strategy result compares against that basis.

## Implementation Steps

1. Add static regression tests for benchmark fixture, UI markers, comparison rows, and evidence modal.
2. Create `docs/flow-analysis/2026-06-02-marketing-strategy-ruleset-benchmark-analysis.md`.
3. Create `web/strategy_benchmark_fixture.json` with five benchmark modes:
   - recommended
   - sameIndustry
   - nearby
   - keywordTop
   - custom
4. Update `web/07_마케팅전략룰셋.html`:
   - add benchmark selection controls
   - render selected benchmark summary
   - render candidate stores
   - render `우리 매장 vs 기준점` comparison rows
   - add evidence modal
5. Append `[2026-06-02 #14]` to the confirmation document.
6. Verify:
   - `cd poc-server && npm test -- staticWebConnectivity.test.ts`
   - `cd poc-server && npm test`
   - `cd poc-server && npm run typecheck`
   - browser QA on `http://localhost:5177/index.html`

## Regression Risks

- The old tab switching code must still work.
- Existing save/reset modals must remain available.
- The flow guide must not over-mark non-flow controls.
- Static JSON fetch should work through the local dev server.

## User Review Focus

- Whether `추천 기준` should remain the default.
- Whether benchmark candidate count and evidence labels are understandable.
- Whether `근거 보기` gives enough confidence before the API phase.
