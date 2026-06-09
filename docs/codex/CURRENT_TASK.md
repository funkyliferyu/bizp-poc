# Current Codex Task

## Current Phase

Project workflow stabilization before the next Store Learning feature task.

## Repository State

- Latest Store Learning work through PR #23 has been merged into `codex/api-backed-poc-flow`.
- `main` is the intended public/stable branch.
- `develop` is the intended integration branch.
- Future implementation work should branch from `develop` unless explicitly redirected.

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

Start the next feature from `develop` in a new session only after confirming:

1. `pwd`
2. current branch
3. `git status --short`
4. intended task id and scope
5. files allowed to change
6. files forbidden to change
7. validation commands

## Forbidden Areas By Default

- `admin/`
- `pc-web/`
- old Event-to-Operation source-of-truth files
- browser-side Naver/OpenAI calls
- committed `.env`, runtime SQLite DBs, `.DS_Store`, or secrets
