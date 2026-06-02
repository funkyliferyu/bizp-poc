# Web Static Flow Connectivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current `web` static screens easy to inspect by marking and connecting only the core user journeys.

**Architecture:** Keep the static HTML/iframe architecture. Add a reversible parent-level flow guide script and annotate core flow controls with `data-flow-*` attributes. Do not introduce a new frontend framework or API phase.

**Tech Stack:** Static HTML, inline JavaScript, shared `common.css`, Vitest static connectivity tests, Browser QA.

---

### Task 1: Documentation

**Files:**
- Create: `docs/flow-analysis/2026-06-02-web-static-flow-analysis.md`
- Create: `docs/superpowers/plans/2026-06-02-web-static-flow-connectivity.md`

- [ ] Record the `web` page inventory, confirmed links, core journeys, non-core buttons, and implementation-time decisions.
- [ ] Keep `pc-web` and `admin` as future scopes only.

### Task 2: Regression Test

**Files:**
- Create: `poc-server/test/staticWebConnectivity.test.ts`

- [ ] Assert all `web` local `.html` references resolve.
- [ ] Assert LNB items and core journey controls have `data-flow-target` markers.
- [ ] Assert the frame shell loads `flow-guide.js`.
- [ ] Assert PoC does not regain a duplicate sidebar.

### Task 3: Flow Guide GUI

**Files:**
- Create: `web/flow-guide.js`
- Modify: `web/index.html`

- [ ] Add a fixed `플로우 표시 ON/OFF` toggle in the parent frame.
- [ ] Store state in `localStorage.bizplanetFlowGuide`.
- [ ] Inject CSS into parent, nav iframe, and main iframe.
- [ ] Sync nav active/open state when the main iframe changes.

### Task 4: Core Flow Markers And Links

**Files:**
- Modify selected `web/*.html`

- [ ] Add `data-flow-target` and `data-flow-label` to LNB links and core CTA/row elements.
- [ ] Connect AI learning flow through `05_AI학습_콘텐츠선택.html`.
- [ ] Connect content publishing flow through pending and completed detail screens.
- [ ] Mark PoC API actions without changing their existing backend behavior.

### Task 5: Verification

**Commands:**
- `cd poc-server && npm test`
- `cd poc-server && npm run typecheck`

**Browser flow:**
- `http://localhost:5177/index.html`
- Verify ON/OFF toggle, LNB active sync, AI learning journey, content publishing journey, agency/store links, and one PoC decision action.
