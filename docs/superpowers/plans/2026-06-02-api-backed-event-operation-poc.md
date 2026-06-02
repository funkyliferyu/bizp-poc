# API-backed Event-to-Operation PoC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the PoC generation loop try real OpenAI-backed memory and draft generation when configured, while preserving deterministic mock fallback and making generation trace visible in the UI.

**Architecture:** Add generation trace types to the existing Zod schemas, introduce AI-aware wrappers around memory and channel draft generation, and pass step trace into approval packages. The browser keeps the same workflow but renders runtime mode, memory mode, and approval package step trace.

**Tech Stack:** TypeScript, Express, Zod, OpenAI SDK, Vitest, static HTML/JS.

---

### Task 1: Generation Trace Schema

**Files:**
- Modify: `poc-server/src/schemas/businessMemory.ts`
- Modify: `poc-server/src/schemas/approvalPackage.ts`
- Test: `poc-server/test/apiBackedGeneration.test.ts`

- [ ] Add `GenerationStepTraceSchema` with `name`, `mode`, optional `fallbackReason`, and optional `generatedAt`.
- [ ] Add optional `generationTrace` to `BusinessMemorySchema`.
- [ ] Extend `ApprovalPackageSchema.trace.mode` to include `mixed`.
- [ ] Add `trace.steps` to approval packages.

### Task 2: AI-aware Memory Generation

**Files:**
- Modify: `poc-server/src/workflows/buildBusinessMemory.ts`
- Test: `poc-server/test/apiBackedGeneration.test.ts`

- [ ] Keep deterministic `buildBusinessMemory` as mock fallback.
- [ ] Add `buildBusinessMemoryWithAI(input, options)` that accepts an injected client for tests.
- [ ] Return OpenAI parsed memory with `generationTrace.mode = "openai"` when fake or real client succeeds.
- [ ] Return mock memory with `generationTrace.mode = "mock"` and `fallbackReason` when no client or parsing fails.

### Task 3: AI-aware Channel Draft Generation

**Files:**
- Modify: `poc-server/src/workflows/generateChannelDrafts.ts`
- Test: `poc-server/test/apiBackedGeneration.test.ts`

- [ ] Add `generateChannelDraftsWithAI(memory, event, options)` that returns `{ channelOutputs, trace }`.
- [ ] Keep `generateChannelDrafts(memory, event)` as compatibility wrapper returning only `channelOutputs`.
- [ ] Preserve mock fallback on missing client or invalid OpenAI response.

### Task 4: Approval Trace Assembly and Routes

**Files:**
- Modify: `poc-server/src/workflows/buildApprovalPackage.ts`
- Modify: `poc-server/src/index.ts`
- Test: `poc-server/test/apiBackedGeneration.test.ts`

- [ ] Let `buildApprovalPackage` accept generation step traces.
- [ ] Summarize workflow mode as `mock`, `openai`, or `mixed`.
- [ ] Use `buildBusinessMemoryWithAI` in `/api/memory/build`.
- [ ] Use `generateChannelDraftsWithAI` in `/api/events/:eventId/run`.
- [ ] Add `/api/runtime` so the UI can show whether OpenAI is configured.

### Task 5: PoC UI Trace Rendering

**Files:**
- Modify: `web/event_operation_poc.html`
- Test: `poc-server/test/staticWebConnectivity.test.ts`

- [ ] Load `/api/runtime` on page startup and update the top status.
- [ ] Render memory generation mode after memory build.
- [ ] Render approval `trace.steps` in the review summary.
- [ ] Keep existing flow-guide markers unchanged.

### Task 6: Verification

**Files:**
- Modify: `docs/confirmation/2026-06-02-api-backed-poc-checkpoints.md`

- [ ] Run `cd poc-server && npm test`.
- [ ] Run `cd poc-server && npm run typecheck`.
- [ ] Browser-check `http://localhost:5177/index.html` for runtime mode, memory mode, approval trace, and approval decision loop.
- [ ] Append final verification notes to the confirmation document.
