# Blog Formula V2 Batch Blog Posts Plan

> **For agentic workers:** Start from `develop`, create a `codex/*` branch, and keep this task scoped to Store Learning PoC runtime/UI only. Do not touch `admin/`, `pc-web/`, `README_POC.md`, or `web/event_operation_poc.html`.

**Goal:** Add a demo-only "생성배치 실행" flow on the Blog Management screen that keeps existing approval-pending posts and appends three new approval-pending blog posts generated from Blog Formula V2, each using a different topic brief when available.

**Architecture:** Reuse the existing Blog Formula V2 lane for formula/topic/sample/draft generation, then bridge the generated V2 draft into the existing operational blog-post tables: `content_generations`, `blog_posts`, `media_assets`, and `seo_scores`. The browser calls only `poc-server` APIs and drives three sequential server calls so it can show per-item progress in a modal. SEO scoring stays the current local/mock scorer; image assets remain prompt placeholders, but prompts must be paragraph-specific descriptions derived from the generated article.

**Tech Stack:** Vanilla HTML/CSS/JS in `web/`, Express/TypeScript in `poc-server`, SQLite repositories, Zod validation, existing Blog Formula V2 OpenAI provider boundary, Vitest.

---

## Execution Status

- Feature branch: `codex/blog-formula-v2-batch-blog-posts`
- PR: [#54](https://github.com/funkyliferyu/bizp-poc/pull/54)
- Status: Implemented, feature-branch validated, and opened as draft PR on
  2026-06-15.
- Next gate: review/merge PR #54 to `develop`, then re-run develop validation.

## Decisions

- Existing approval-pending posts stay visible. Batch execution adds three new V2-generated approval-pending posts.
- The batch button belongs on `web/02_블로그관리.html`, on the right side of the "블로그 관리" title row.
- The UI should show a progress popup while the three posts are generated sequentially.
- The generation path must use Blog Formula V2 topic briefs. Prefer three different `topic` values; if fewer than three unique topics exist, fill remaining slots by recency/order.
- Content detail should show the actual generated article loaded from `/api/blog-posts/:postId`.
- SEO score remains the existing local/mock score.
- Images are not generated. Store paragraph-specific image descriptions in `media_assets.prompt` and render them as the existing image prompt placeholders.
- Browser code must not call OpenAI, Naver, scraping providers, or any external provider directly.

## Files

- Modify: `docs/codex/PLAN.md`
- Create: `poc-server/src/storeLearning/blog/blogFormulaV2PostGenerator.ts`
- Modify: `poc-server/src/storeLearning/routes/stores.ts`
- Modify: `web/02_블로그관리.html`
- Modify: `web/blog_posts.js`
- Optionally modify: `web/09_AI콘텐츠생성_상세.html` only for small copy/hook changes if the current hooks are insufficient
- Test: `poc-server/test/blogGenerationApi.test.ts`
- Test: `poc-server/test/blogPostPages.test.ts`
- Test: `poc-server/test/contentDetailApi.test.ts`

## Task 1: Ledger And Branch Setup

- [x] Confirm startup state:

```bash
pwd
git branch --show-current
git status --short --branch
git log --oneline --decorate -5
```

Expected:

- Working directory is `/Users/1004182/Documents/bizplanet-work/bizp-store-learning-poc`.
- Current branch is `develop`.
- PR base is `develop`.
- Existing out-of-scope local files such as `.DS_Store` or editor swap files remain unstaged.

- [x] Create a feature branch:

```bash
git switch -c codex/blog-formula-v2-batch-blog-posts
```

- [x] Update `docs/codex/PLAN.md` to mark PR #52 and PR #53 as merged to `develop`, and add this plan as the next Store Learning V2 task. Do not mark this new task validated until the implementation and validation commands pass.

## Task 2: Add A V2-To-Blog-Post Bridge Service

Create `poc-server/src/storeLearning/blog/blogFormulaV2PostGenerator.ts`.

Core exported functions:

```ts
export type GenerateV2FormulaBlogPostInput = {
  formulaSetId?: string;
  topicBriefSetId: string;
  providerMode?: 'deterministic' | 'safe_mock' | 'openai' | 'auto';
  provider?: BlogDraftV2Provider | null;
};

export async function generateApprovalPendingBlogPostFromV2Formula(
  repos: StoreLearningRepositories,
  storeId: string,
  input: GenerateV2FormulaBlogPostInput
): Promise<{
  contentGeneration: ContentGeneration;
  blogPost: ReturnType<typeof serializeBlogPost>;
  mediaAssets: MediaAsset[];
  seoScore: {
    id: string;
    blogPostId: string;
    score: number;
    totalScore: number;
    status: string;
    rubric: Record<string, unknown>;
  };
  v2DraftGenerationId: string;
  topicBriefSetId: string;
}>;

export function selectTopicBriefSetsForV2Batch(
  repos: StoreLearningRepositories,
  storeId: string,
  count?: number
): Array<{ id: string; topic: string; sourcePostIds: string[] }>;
```

Implementation requirements:

- Load the latest V2 formula set unless `formulaSetId` is provided.
- Load the requested `v2_blog_topic_brief_sets` row and convert it to `BlogTopicBriefInput`.
- Call `retrieveBlogFormulaV2Samples(repos, storeId, { formulaSetId, topicBrief, maxSamples: 3 })`.
- Call `generateBlogFormulaV2DraftWithProvider` when a provider exists; otherwise call `generateBlogFormulaV2Draft`.
- Persist a `content_generations` row with:
  - `contentType: 'blog_post'`
  - `status: 'generated'`
  - `prompt.mode` from provider mode
  - `prompt.action: 'generate_blog_post_from_v2_formula'`
  - `prompt.v2FormulaSetId`
  - `prompt.v2TopicBriefSetId`
  - `prompt.v2DraftGenerationId`
  - `output` containing the converted blog article plus the original V2 output
- Persist a `blog_posts` row with `status: 'pending_approval'`.
- Convert `BlogDraftOutputV2.blogDraft` into at least three `bodySections`.
  - Split on blank lines.
  - Keep the first paragraph as an intro section if no heading structure exists.
  - Use stable fallback headings such as `도입`, `핵심 안내`, `상담 전 확인사항`.
- Create one `media_assets` row per body section, capped at three for the current UI.
  - `assetType: 'image_prompt'`
  - `status: 'placeholder'`
  - `prompt` must describe the corresponding section content, not generic placeholder text.
  - `metadata.placement` should be `cover`, `body_1`, `body_2`.
  - `metadata.generator` should be `openai_blog_formula_v2` for OpenAI or `deterministic_blog_formula_v2` for deterministic/safe mock.
- Create `seo_scores` using the existing local scoring shape, not an OpenAI SEO call.
- Record LLM audit through the existing V2 draft service; do not duplicate a second LLM audit row unless the bridge itself calls a provider.

## Task 3: Add API Endpoint For One V2 Batch Item

Modify `poc-server/src/storeLearning/routes/stores.ts`.

Add imports:

```ts
import { generateApprovalPendingBlogPostFromV2Formula, selectTopicBriefSetsForV2Batch } from '../blog/blogFormulaV2PostGenerator.js';
import { createBlogDraftV2ProviderForMode, type BlogDraftV2ProviderFactoryOptions } from '../blogFormulaV2/providers/draftProviderFactory.js';
```

Extend route options:

```ts
type StoreRoutesOptions = {
  connection: DbConnection;
  env?: ProviderEnv;
  blogProvider?: BlogContentProvider | null;
  blogProviderClient?: OpenAIBlogParseClient | null;
  blogDraftV2ProviderOptions?: BlogDraftV2ProviderFactoryOptions;
};
```

Add schemas near the existing route schemas:

```ts
const BlogFormulaV2GeneratePostBodySchema = z.object({
  formulaSetId: z.string().trim().min(1).optional(),
  topicBriefSetId: z.string().trim().min(1),
  providerMode: z.enum(['deterministic', 'safe_mock', 'openai', 'auto']).optional()
});
```

Add route before `GET /:storeId/blog-posts`:

```ts
router.post('/:storeId/blog-posts/generate-from-v2-formula', async (req, res, next) => {
  try {
    const body = BlogFormulaV2GeneratePostBodySchema.parse(req.body ?? {});
    const providerMode = body.providerMode ?? 'openai';
    const provider = createBlogDraftV2ProviderForMode(providerMode, {
      env,
      ...(blogDraftV2ProviderOptions ?? {})
    });
    const payload = await generateApprovalPendingBlogPostFromV2Formula(repos, req.params.storeId, {
      formulaSetId: body.formulaSetId,
      topicBriefSetId: body.topicBriefSetId,
      providerMode,
      provider
    });
    res.json(payload);
  } catch (error) {
    next(error);
  }
});
```

Add route for UI candidate selection:

```ts
router.get('/:storeId/blog-posts/v2-batch-candidates', (req, res, next) => {
  try {
    res.json({ topicBriefSets: selectTopicBriefSetsForV2Batch(repos, req.params.storeId, 3) });
  } catch (error) {
    next(error);
  }
});
```

## Task 4: API Tests

Modify `poc-server/test/blogGenerationApi.test.ts`.

Add a test that seeds/extracts V2 topic brief sets, injects a fake V2 draft OpenAI client through `createStoreRoutes`, calls `POST /api/stores/:storeId/blog-posts/generate-from-v2-formula`, and asserts:

- response status `200`
- returned `blogPost.status === 'pending_approval'`
- returned `blogPost.contentGenerationId` is set
- `contentGeneration.prompt.action === 'generate_blog_post_from_v2_formula'`
- `contentGeneration.prompt.v2TopicBriefSetId` matches the request
- `mediaAssets` length is `3`
- no `mediaAssets.prompt` contains `placeholder`
- `seoScore.totalScore` is a number
- existing `blog_post_demo_pending_approval` still exists

Add a second test for `GET /api/stores/:storeId/blog-posts/v2-batch-candidates`:

- It returns at most 3 candidates.
- It prefers distinct topics when possible.
- It does not create blog posts.

Run:

```bash
cd poc-server
npx vitest run test/blogGenerationApi.test.ts
```

Expected: new tests fail before implementation, pass after Tasks 2-3.

## Task 5: Blog Management UI Batch Button And Progress Modal

Modify `web/02_블로그관리.html`.

- Change the title row to a flex row with a right-aligned button:

```html
<div class="blog-page-head" style="display:flex;align-items:center;justify-content:space-between;gap:12px">
  <div class="page-title" style="margin-bottom:0">블로그 관리</div>
  <button class="btn btn-primary btn-sm" id="blog-v2-batch-generate-btn">생성배치 실행</button>
</div>
```

- Add a modal near the end of the page:

```html
<div id="blog-v2-batch-modal" class="modal-backdrop" style="display:none" role="status" aria-live="polite">
  <div class="modal modal-sm">
    <div class="modal-title">블로그 생성배치 실행 중</div>
    <div class="modal-desc" id="blog-v2-batch-modal-desc">토픽 브리프를 확인하고 있습니다.</div>
    <div id="blog-v2-batch-steps" style="display:grid;gap:8px;margin-top:12px"></div>
  </div>
</div>
```

## Task 6: Blog Management JS Sequential Batch Flow

Modify `web/blog_posts.js`.

Add element refs:

```js
const v2BatchButton = document.getElementById('blog-v2-batch-generate-btn');
const v2BatchModal = document.getElementById('blog-v2-batch-modal');
const v2BatchModalDesc = document.getElementById('blog-v2-batch-modal-desc');
const v2BatchSteps = document.getElementById('blog-v2-batch-steps');
```

Add functions:

```js
function setBatchModal(open, message) {
  if (v2BatchModal) v2BatchModal.style.display = open ? 'flex' : 'none';
  if (v2BatchModalDesc) v2BatchModalDesc.textContent = message || '';
}

function renderBatchSteps(candidates, activeIndex, completedIds) {
  if (!v2BatchSteps) return;
  v2BatchSteps.innerHTML = candidates.map((candidate, index) => {
    const done = completedIds.has(candidate.id);
    const active = index === activeIndex;
    const label = done ? '완료' : active ? '생성 중' : '대기';
    return `<div class="auto-gen-chip" data-topic-brief-set-id="${escapeHtml(candidate.id)}">${index + 1}/3 ${escapeHtml(candidate.topic)} · ${label}</div>`;
  }).join('');
}

async function loadV2BatchCandidates() {
  const response = await fetch(`/api/stores/${storeId}/blog-posts/v2-batch-candidates`);
  if (!response.ok) throw new Error(`토픽 브리프 후보를 불러오지 못했습니다. (${response.status})`);
  const payload = await response.json();
  return Array.isArray(payload.topicBriefSets) ? payload.topicBriefSets.slice(0, 3) : [];
}

async function generateV2Batch() {
  const completedIds = new Set();
  const originalText = v2BatchButton ? v2BatchButton.textContent : '';
  if (v2BatchButton) {
    v2BatchButton.disabled = true;
    v2BatchButton.textContent = '생성 중';
  }
  try {
    setBatchModal(true, '토픽 브리프를 확인하고 있습니다.');
    const candidates = await loadV2BatchCandidates();
    if (candidates.length < 3) {
      setBatchModal(true, '생성 가능한 토픽 브리프가 3건 미만입니다. 블로그 작성 포뮬라 탭에서 토픽 브리프를 먼저 생성해 주세요.');
      renderBatchSteps(candidates, -1, completedIds);
      return;
    }
    for (let index = 0; index < 3; index += 1) {
      renderBatchSteps(candidates, index, completedIds);
      setBatchModal(true, `${index + 1}/3 블로그 초안을 생성하고 있습니다.`);
      const response = await fetch(`/api/stores/${storeId}/blog-posts/generate-from-v2-formula`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicBriefSetId: candidates[index].id, providerMode: 'openai' })
      });
      if (!response.ok) throw new Error(`${index + 1}번째 블로그 초안을 생성하지 못했습니다. (${response.status})`);
      completedIds.add(candidates[index].id);
    }
    renderBatchSteps(candidates, -1, completedIds);
    setBatchModal(true, '블로그 초안 3건 생성이 완료되었습니다. 목록을 새로고침합니다.');
    await loadPosts();
  } catch (error) {
    setBatchModal(true, error instanceof Error ? error.message : '생성배치 실행에 실패했습니다.');
  } finally {
    if (v2BatchButton) {
      v2BatchButton.disabled = false;
      v2BatchButton.textContent = originalText;
    }
  }
}
```

Required behavior:

- `loadV2BatchCandidates()` calls `/api/stores/${storeId}/blog-posts/v2-batch-candidates`.
- If fewer than 3 candidates are available, show a clear error in the modal and do not call generation.
- `generateV2Batch()` loops over exactly three candidates:
  - update modal text to `1/3 생성 중`, `2/3 생성 중`, `3/3 생성 중`
  - call `/api/stores/${storeId}/blog-posts/generate-from-v2-formula`
  - body: `{ topicBriefSetId: candidate.id, providerMode: 'openai' }`
- Disable the batch button while running.
- On success, call `loadPosts()` and close or mark the modal completed.
- On failure, keep the modal open with the failing step and an error message.

## Task 7: Page Wiring Tests

Modify `poc-server/test/blogPostPages.test.ts`.

Assert:

- `web/02_블로그관리.html` contains `id="blog-v2-batch-generate-btn"`.
- `web/02_블로그관리.html` contains `id="blog-v2-batch-modal"`.
- `web/blog_posts.js` calls `/blog-posts/v2-batch-candidates`.
- `web/blog_posts.js` calls `/blog-posts/generate-from-v2-formula`.
- `web/blog_posts.js` contains `providerMode: 'openai'`.
- `web/blog_posts.js` does not contain browser-side OpenAI/Naver credential strings.

Run:

```bash
cd poc-server
npx vitest run test/blogPostPages.test.ts
```

## Task 8: Content Detail Data Contract

Modify `poc-server/test/contentDetailApi.test.ts`.

Add a test that creates one V2-generated blog post through the new endpoint, then calls `/api/blog-posts/:postId` and asserts:

- `article.bodySections.length >= 3`
- `article.bodyText` contains text from the fake V2 model response
- `mediaAssets[0].prompt` describes the first section content
- no image prompt equals or contains generic `placeholder`
- `seoScore.rubric.imageAltPrompt.feedback` is still present

No major `web/content_detail.js` change should be needed because it already renders server article/media/SEO data.

## Task 9: Full Validation

Run:

```bash
cd poc-server
npx tsc --noEmit -p tsconfig.json
npx vitest run
git diff --check
node --check ../web/blog_posts.js
node --check ../web/content_detail.js
```

Optional manual smoke with a snapshot DB:

```bash
sqlite3 poc-server/data/store-learning.sqlite "VACUUM INTO '/tmp/bizp-v2-batch-blog-posts.sqlite'"
cd poc-server
PORT=5188 STORE_LEARNING_DB_PATH=/tmp/bizp-v2-batch-blog-posts.sqlite npx tsx src/index.ts
```

Open:

```text
http://localhost:5188/02_블로그관리.html?storeId=store_1020864025
```

Manual checks:

- Existing approval-pending rows remain.
- Clicking `생성배치 실행` shows progress for three sequential generations.
- After completion, three new approval-pending V2-generated rows are added.
- Opening a new row shows the LLM-generated article body.
- SEO score is rendered from the existing scoring path.
- Image cards show paragraph-specific image descriptions.

## Out Of Scope

- Actual image generation or image upload.
- OpenAI SEO rescoring for this batch path.
- Publishing to Naver.
- Hybrid V1+V2 strategy generation.
- Any changes under `admin/` or `pc-web/`.
