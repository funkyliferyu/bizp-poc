# Codex Handoff

## Current Scope

DATA-001 adds the SQLite-backed data model and repository layer for the Store Learning & Blog Content Automation PoC.

This change does not connect UI behavior, does not implement Naver/OpenAI calls, and does not modify the existing Event-to-Operation workflows.

## Added Runtime Pieces

- `poc-server/src/db/connection.ts` creates SQLite connections and defaults local PoC data to `poc-server/data/store-learning.sqlite`.
- `poc-server/src/db/migrate.ts` applies the schema.
- `poc-server/src/db/schema.sql` defines the Store Learning tables and indexes.
- `poc-server/src/repositories/*.ts` contains one repository module per requested table plus a shared CRUD helper.
- `poc-server/src/seedStoreLearning.ts` seeds one idempotent demo store.
- `poc-server/src/demoStoreLearning.ts` runs the Store Learning demo seed and prints a concise summary.
- `collection_items` persists selected-content state with `selected_for_analysis`, `selection_reason`, and `selected_at`.

## Repository Modules

The repository layer covers:

- `stores`
- `store_channels`
- `training_settings`
- `collection_runs`
- `collection_items`
- `analysis_runs`
- `analysis_evidence`
- `learning_snapshots`
- `marketing_rulesets`
- `ruleset_fields`
- `content_generations`
- `blog_posts`
- `media_assets`
- `seo_scores`
- `audit_events`

Use `createStoreLearningRepositories(connection)` from `poc-server/src/repositories/storeLearningRepositories.ts` when a workflow needs all repositories.

## Guardrails

- Keep browser/UI work out of DATA-001.
- Keep Naver and OpenAI calls out of DATA-001.
- Keep existing Event-to-Operation workflows untouched.
- Do not modify `admin/` or `pc-web/`.
- Keep SQLite access behind repositories so a future Postgres repository can share the same workflow surface.

## Next Suggested Task

The next task can add Store Learning API route skeletons that use these repositories in mock mode. Provider adapters and LLM validation should remain separate follow-up tasks unless explicitly requested.
