# PoC Server Agent Guide

## Scope

`poc-server/` is the future backend for the Store Learning & Blog Content Automation PoC. The current code still contains older Event-to-Operation endpoints and fixtures; do not treat those as the product model for the new PoC.

Before changing server code, read `../docs/codex/PLAN.md` and confirm the next sequential milestone. Server changes should belong to that milestone unless the user explicitly changes scope.

## Required Runtime Shape

- Serve all product data through `/api/*` endpoints.
- Keep browser pages dependent on `poc-server` APIs only.
- Keep Naver/OpenAI credentials server-side.
- Support mock mode without external credentials.
- Put real provider calls behind adapters, not directly inside route handlers.
- Validate provider and LLM data before persistence.

## Persistence Direction

- Use SQLite for the local PoC database.
- Add a repository layer for all data access.
- Keep repository contracts compatible with a future Postgres implementation.
- Do not let route handlers depend on SQLite-specific SQL details.

## Provider Direction

- Naver collection must be adapter-driven.
- Official Naver APIs are limited. Do not assume official APIs can provide full blog body text or all Place reviews.
- Model collection as a provider/fallback pipeline so official APIs, partner exports, approved scraping services, manual import, and mock fixtures can be selected by environment.

## AI Output Direction

- All LLM outputs must be parsed with Zod schemas.
- Save only validated structured outputs.
- Store validation errors and raw provider run metadata for debugging, but do not expose secrets to browser responses.
