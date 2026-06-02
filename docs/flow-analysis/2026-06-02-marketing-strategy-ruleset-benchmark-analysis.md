# Marketing Strategy Ruleset Benchmark Analysis

## Scope

- Target screen: `web/07_마케팅전략룰셋.html`
- Target tab: `우리 매장 분석`
- Current issue: the screen shows AI analysis results without exposing the benchmark basis used to produce them.
- This phase is static PoC only. It does not connect to Naver Place, search ranking, review APIs, or LLM APIs yet.

## Current Problems

- The analysis values are presented as final answers, but the comparison basis is invisible.
- Users cannot tell whether the basis is a strong store in the same detailed industry, a nearby competitor, a keyword search leader, or a manually specified store.
- The screen has no way to inspect candidate benchmark stores before trusting the strategy.
- The screen has no evidence path from analysis result back to candidates, reviews, keywords, or ranking signals.
- The existing structure makes `AI 분석` look authoritative even when the source scope is unclear.

## Recommended Benchmark Model

The default benchmark should be `추천 기준`, combining three lenses:

- Same detailed industry leaders
- Nearby competitors
- Keyword search leaders

Users can switch to a specific lens when they want to inspect or constrain the basis:

- `동일 세부 업종`: compare against high-performing stores in the same detailed category.
- `인근 경쟁`: compare against nearby stores in the same or adjacent categories.
- `키워드 상위`: compare against stores repeatedly exposed for content material keywords.
- `직접 지정`: compare against stores entered by the user through a store name or place URL.

## Static PoC Data Shape

Use `web/strategy_benchmark_fixture.json` as the static source of truth.

Each benchmark type includes:

- candidate count
- review count
- keyword count
- query or selection basis
- candidate stores with evidence tags
- comparison rows for positioning, menu, target, content keywords, review strengths, and review weaknesses

## Screen Improvements

- Add a `비교 기준 설정` panel above the analysis.
- Show segmented benchmark type controls with `추천 기준` active by default.
- Show the selected benchmark summary and source scope.
- Show candidate benchmark stores before the comparison result.
- Replace the result-only analysis with `우리 매장 vs 기준점` comparison rows.
- Add `근거 보기` actions so each row can expose the source signals behind the recommendation.

## Confirmed In This Phase

- The default basis is visible.
- The user can switch among benchmark lenses.
- Candidate stores are visible before accepting the result.
- Comparison rows show our store, benchmark pattern, gap, and recommendation.
- Evidence can be inspected in a modal.

## Requires API Phase

- Real search ranking collection.
- Real Naver Place or equivalent place profile lookup.
- Review keyword extraction from live reviews.
- Store deduplication across keyword and nearby sources.
- Benchmark score weighting and explainability.
- User-provided store URL parsing and validation.
