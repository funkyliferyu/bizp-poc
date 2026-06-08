# OpenAI Integration Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a controlled OpenAI integration validation set, then run the live OpenAI-backed Store Learning functions with the local `.env` key and report safe verification results.

**Architecture:** Keep normal tests mock-safe and no-key compatible. Add a separate opt-in live validation path that only runs when `RUN_OPENAI_INTEGRATION=1` and `OPENAI_API_KEY` are present. Use seeded temporary SQLite state, server-side providers, Zod validation, and redacted result summaries.

**Tech Stack:** TypeScript, Vitest, Express service modules, OpenAI SDK, Zod, SQLite repositories.

---

## File Structure

- Modify: `.gitignore`
  - Ensure `.env`, `.env.*`, `.DS_Store`, logs, and local runtime files are ignored while keeping `.env.example` trackable.
- Create: `poc-server/test/openaiLiveIntegration.test.ts`
  - Opt-in Vitest live tests for OpenAI runtime probe, analysis provider, and blog provider.
- Modify: `poc-server/package.json`
  - Add `openai:verify` script that runs only the live OpenAI integration test with `RUN_OPENAI_INTEGRATION=1`.
- Modify: `docs/codex/VALIDATION.md`
  - Record commands and live verification results after execution.
- Modify: `docs/codex/HANDOFF.md`
  - Add operating notes for live OpenAI validation.

## Task 1: Secret Safety Baseline

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Verify secret files are ignored**

Run:

```bash
git check-ignore -v poc-server/.env .env 2>/dev/null || true
```

Expected before fix if not committed yet:

```text
# May be empty for missing root .env, but poc-server/.env must be ignored after this task.
```

- [ ] **Step 2: Ensure `.gitignore` contains the required patterns**

Expected `.gitignore` content includes:

```gitignore
# Local secrets and environment overrides
.env
.env.*
**/.env
**/.env.*
!.env.example
!**/.env.example

# OS/editor noise
.DS_Store
**/.DS_Store

# Runtime logs
*.log
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*
```

- [ ] **Step 3: Verify `.env.example` does not need to be ignored**

Run:

```bash
git check-ignore -v poc-server/.env.example 2>/dev/null || true
```

Expected:

```text
# No output, because .env.example remains trackable.
```

- [ ] **Step 4: Verify `poc-server/.env` is ignored**

Run:

```bash
git check-ignore -v poc-server/.env
```

Expected:

```text
.gitignore:<line>:**/.env poc-server/.env
```

## Task 2: Add Live OpenAI Integration Tests

**Files:**
- Create: `poc-server/test/openaiLiveIntegration.test.ts`

- [ ] **Step 1: Write failing opt-in tests**

Create `poc-server/test/openaiLiveIntegration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDatabaseConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { seedDemoStore } from '../src/seedStoreLearning.js';
import { probeOpenAIRuntime } from '../src/ai/runtimeHealth.js';
import { startAnalysisRun } from '../src/storeLearning/analysis/analysisExecutionService.js';
import { createOpenAIAnalysisProvider } from '../src/storeLearning/analysis/openAIAnalysisProvider.js';
import {
  generateApprovalPendingBlogPost,
  rescoreBlogPostSeo
} from '../src/storeLearning/blog/blogGenerator.js';
import { createOpenAIBlogProvider } from '../src/storeLearning/blog/openAIBlogProvider.js';

const runLive = process.env.RUN_OPENAI_INTEGRATION === '1';
const describeLive = runLive ? describe : describe.skip;

describeLive('live OpenAI integration', () => {
  it(
    'verifies OpenAI runtime model access without exposing secrets',
    async () => {
      const result = await probeOpenAIRuntime();

      expect(result.ok).toBe(true);
      expect(result.mode).toBe('openai');
      expect(result.openaiConfigured).toBe(true);
      expect(JSON.stringify(result)).not.toContain(process.env.OPENAI_API_KEY ?? 'sk-');
    },
    30_000
  );

  it(
    'runs OpenAI analysis and persists validated artifacts',
    async () => {
      const connection = createDatabaseConnection({ filename: ':memory:' });
      try {
        migrateDatabase(connection);
        const seed = seedDemoStore(connection);
        const repos = createStoreLearningRepositories(connection);
        const artifacts = await startAnalysisRun(
          repos,
          seed.analysisRunId,
          createOpenAIAnalysisProvider({ model: process.env.OPENAI_MODEL })
        );
        const run = repos.analysisRuns.findById(seed.analysisRunId);

        expect(run?.status).toBe('completed');
        expect(run?.result).toEqual(
          expect.objectContaining({
            analyzerMode: 'openai',
            analyzerProvider: 'openAIAnalysisProvider'
          })
        );
        expect(artifacts?.learningSnapshot?.status).toBe('active');
        expect(artifacts?.marketingRuleset?.status).toBe('draft');
        expect(artifacts?.rulesetFields.length).toBeGreaterThanOrEqual(2);
        expect(artifacts?.analysisEvidence.length).toBeGreaterThanOrEqual(1);
      } finally {
        connection.close();
      }
    },
    90_000
  );

  it(
    'generates and scores a blog post through OpenAI with Zod-validated output',
    async () => {
      const connection = createDatabaseConnection({ filename: ':memory:' });
      try {
        migrateDatabase(connection);
        const seed = seedDemoStore(connection);
        const repos = createStoreLearningRepositories(connection);
        const provider = createOpenAIBlogProvider({ model: process.env.OPENAI_MODEL });
        const generated = await generateApprovalPendingBlogPost(repos, seed.storeId, provider);
        const rescored = await rescoreBlogPostSeo(repos, generated.blogPost.id, provider);

        expect(generated.blogPost.status).toBe('pending_approval');
        expect(generated.contentGeneration.prompt).toEqual(
          expect.objectContaining({
            mode: 'openai',
            provider: 'openAIBlogProvider'
          })
        );
        expect(generated.blogPost.article.bodySections.length).toBeGreaterThanOrEqual(3);
        expect(generated.blogPost.article.seoKeywords.length).toBeGreaterThanOrEqual(1);
        expect(rescored?.seoScore.totalScore).toBeGreaterThanOrEqual(0);
        expect(Object.keys(rescored?.seoScore.rubric ?? {})).toEqual([
          'titleKeyword',
          'bodyKeyword',
          'metaDescription',
          'readability',
          'imageAltPrompt',
          'cta'
        ]);
      } finally {
        connection.close();
      }
    },
    90_000
  );
});
```

- [ ] **Step 2: Run test without live flag**

Run:

```bash
cd poc-server
npm test -- openaiLiveIntegration.test.ts
```

Expected:

```text
Test Files  1 passed
Tests  3 skipped
```

- [ ] **Step 3: Run live test with flag**

Run:

```bash
cd poc-server
RUN_OPENAI_INTEGRATION=1 npm test -- openaiLiveIntegration.test.ts
```

Expected:

```text
Test Files  1 passed
Tests  3 passed
```

If this fails due quota, auth, model access, or rate limits, stop and report the redacted failure.

## Task 3: Add Package Script

**Files:**
- Modify: `poc-server/package.json`

- [ ] **Step 1: Add the script**

Modify `scripts`:

```json
"openai:verify": "RUN_OPENAI_INTEGRATION=1 NODE_OPTIONS=--disable-warning=ExperimentalWarning vitest run test/openaiLiveIntegration.test.ts"
```

- [ ] **Step 2: Verify script works**

Run:

```bash
cd poc-server
npm run openai:verify
```

Expected:

```text
Test Files  1 passed
Tests  3 passed
```

## Task 4: Run Full Regression

**Files:**
- No code changes unless failures require a minimal fix.

- [ ] **Step 1: Run normal no-live validation**

Run:

```bash
cd poc-server
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run demo
npm run demo:store-learning
```

Expected:

```text
typecheck passes
npm test passes
demo passes
demo:store-learning passes
```

- [ ] **Step 2: Run provider readiness smoke**

Run:

```bash
cd poc-server
PORT=5178 npm run dev
```

In another command:

```bash
curl http://localhost:5178/api/store-learning/provider-readiness
```

Expected:

```json
{
  "mode": "real_configured",
  "credentials": {
    "openaiConfigured": true
  },
  "providers": {
    "analysis": { "selectedProvider": "openAIAnalysisProvider" },
    "blogGeneration": { "selectedProvider": "openAIBlogProvider" }
  }
}
```

Stop the server with `Ctrl+C`.

## Task 5: Update Handoff and Validation Docs

**Files:**
- Modify: `docs/codex/HANDOFF.md`
- Modify: `docs/codex/VALIDATION.md`

- [ ] **Step 1: Update validation docs with live result**

Add:

```markdown
## OpenAI Live Integration Validation

- `npm run openai:verify`: passed or failed with redacted reason.
- Runtime probe: ok/failed.
- Analysis provider: completed and persisted validated artifacts.
- Blog provider: generated approval-pending post and SEO score.
- Secrets were not printed.
```

- [ ] **Step 2: Update handoff docs with operating notes**

Add:

```markdown
## OpenAI Validation Operating Notes

- Live OpenAI checks are opt-in via `RUN_OPENAI_INTEGRATION=1`.
- Normal `npm test` remains mock-safe.
- The validation test uses temporary SQLite state.
- The test performs live model calls and may consume API quota.
```

## Task 6: Commit and PR

**Files:**
- Stage only:
  - `.gitignore`
  - `poc-server/package.json`
  - `poc-server/test/openaiLiveIntegration.test.ts`
  - `docs/codex/HANDOFF.md`
  - `docs/codex/VALIDATION.md`

- [ ] **Step 1: Confirm secrets are not staged**

Run:

```bash
git status --short
git diff --cached --name-only
```

Expected staged files do not include:

```text
poc-server/.env
poc-server/.env.example
```

- [ ] **Step 2: Commit**

Run:

```bash
git add .gitignore poc-server/package.json poc-server/test/openaiLiveIntegration.test.ts docs/codex/HANDOFF.md docs/codex/VALIDATION.md
git commit -m "test: add openai integration validation"
```

- [ ] **Step 3: Push and create PR**

Run:

```bash
git push -u origin HEAD
gh pr create \
  --base codex/api-backed-poc-flow \
  --head "$(git branch --show-current)" \
  --title "test: add openai integration validation" \
  --body "## Summary
- Adds opt-in live OpenAI integration validation.
- Keeps normal test suite mock-safe.
- Verifies runtime probe, analysis provider, and blog provider with Zod persistence.

## Validation
- [ ] cd poc-server && npm run openai:verify
- [ ] cd poc-server && npm run typecheck
- [ ] cd poc-server && npm test
- [ ] cd poc-server && npm run demo
- [ ] cd poc-server && npm run demo:store-learning

## Scope
Included:
- OpenAI validation tests
- validation script
- docs

Excluded:
- UI changes
- Naver provider changes
- publishing/image generation"
```

## Self-Review

- Spec coverage: The plan creates a validation set, runs live OpenAI functionality, preserves mock tests, and documents results.
- Placeholder scan: No TBD or unspecified implementation steps remain.
- Type consistency: Uses existing exported provider functions and repository APIs already present in the project.
