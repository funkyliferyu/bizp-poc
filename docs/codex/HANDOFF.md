# Store Learning PoC Handoff

## Current Task

Create planning and operating documents for the Store Learning & Blog Content Automation PoC. Product behavior is not implemented in this task.

## Source Of Truth

Use these files for the new PoC:

- `AGENTS.md`
- `poc-server/AGENTS.md`
- `docs/product/store-learning-blog-content-poc.md`
- `docs/architecture/runtime-model-v0.md`
- `docs/architecture/data-model-v0.md`
- `docs/architecture/api-contract-v0.md`
- `docs/qa/acceptance-checklist-v0.md`
- `docs/codex/PLAN.md`
- `docs/codex/VALIDATION.md`

Do not use `README_POC.md` or `web/event_operation_poc.html` as product source of truth. They belong to the older Event-to-Operation / watermelon event flow.

## Non-Negotiables

- Keep existing Event-to-Operation files untouched.
- Do not modify `admin/`.
- Do not modify `pc-web/`.
- Do not redesign current `web/` HTML pages in this docs-only task.
- Browser pages must call `poc-server` APIs only.
- Naver/OpenAI credentials must stay server-side.
- Mock mode must work without external keys.
- Real Naver collection must be behind provider adapters.
- Official Naver APIs are limited; full blog body and Place reviews need provider/fallback design.
- LLM outputs must use Zod schemas and structured validation before saving.
- Use SQLite as the local PoC DB with repository interfaces for future Postgres migration.

## Current Repo Notes

- The current server package is still named for the old Event-to-Operation PoC.
- Existing `poc-server/src/index.ts` contains old `/api/events/*` and approval endpoints.
- The new Store Learning API should be introduced under a clearly separated module/route namespace.
- `web/07_마케팅전략룰셋.html` currently reads `strategy_benchmark_fixture.json`; future implementation should replace that with `poc-server` API data without redesigning the page.
- The static `web/` screen map is documented in `docs/product/store-learning-blog-content-poc.md`.

## Recommended Next Implementation Move

Start with server-side foundations before touching browser behavior:

1. Add Store Learning Zod schemas.
2. Add repository interfaces.
3. Add SQLite implementation and migrations.
4. Add mock provider adapters.
5. Add store registration and learning settings APIs.

This keeps mock mode runnable and prevents browser pages from taking dependencies on incomplete provider behavior.

