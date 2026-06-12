# Blog Formula V2 Safe Mock Integration Lane Plan

> **Status:** Superseded on 2026-06-12.

This plan originally described a `safe_mock`-only provider-shaped lane. That
scope is now too narrow because Blog Formula V2 already has a deterministic
mock-safe lane. The next executable task should add the real server-side
OpenAI formula-extraction provider boundary while keeping a safe mock fallback.

Use this replacement plan instead:

```text
docs/codex/NEXT_SESSION_BLOG_FORMULA_V2_OPENAI_FORMULA_PROVIDER_PLAN.md
```

The replacement keeps the important boundaries from this document:

- browser pages call only `poc-server` APIs
- no browser-side Naver/OpenAI/provider calls
- V2 writes only to `v2_` tables
- no Hybrid or combined V1/V2 generation lane
- safe mock remains available for no-key local validation
