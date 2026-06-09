# Current Codex Task

## Current Phase

Sequential plan ledger control for Store Learning work.

## Repository State

- `main` is the intended public/stable branch.
- `develop` is the intended integration branch.
- `docs/codex/PLAN.md` is the central checklist for deciding the next todo.
- Milestone PRs #26-#34 exist, but they are not complete until merged and
  validated on `develop`.

## Branch Policy

Use:

```text
feature/* -> develop -> main
```

`main` is for public/static UI access and stable snapshots. `develop` is for API-backed local integration validation.

## Runtime Validation Policy

GitHub Pages is static UI only. Store Learning runtime behavior requires:

- local `poc-server`
- SQLite
- server-side `.env` for real providers when needed
- mock mode for no-key local review

Default local validation:

```bash
cd poc-server
npm run typecheck
npm test
npm run demo
npm run demo:store-learning
```

Manual runtime smoke:

```bash
cd poc-server
npm run dev
```

Open:

```text
http://localhost:5177/soho_store_register.html
```

## Next Exact Step

Start every session by reading `docs/codex/PLAN.md` and choosing the first
milestone that is not merged and validated on `develop`.

Current next todo:

1. Review/integrate PR #26 into `develop`.
2. Validate PR #26 on `develop` and update `docs/codex/PLAN.md`,
   `docs/codex/HANDOFF.md`, and `docs/codex/VALIDATION.md` as needed.
3. Continue sequentially with PR #27 through PR #34.
4. Run the final document/validation milestone only after PRs #26-#34 are
   merged to `develop`.

Before editing files, confirm:

1. `pwd`
2. current branch
3. `git status --short`
4. next ledger todo
5. intended task id and scope
6. files allowed to change
7. files forbidden to change
8. validation commands

## Forbidden Areas By Default

- `admin/`
- `pc-web/`
- old Event-to-Operation source-of-truth files
- browser-side Naver/OpenAI calls
- committed `.env`, runtime SQLite DBs, `.DS_Store`, or secrets
