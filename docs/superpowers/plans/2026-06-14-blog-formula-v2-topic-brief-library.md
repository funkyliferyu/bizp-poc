# Blog Formula V2 — Topic Brief Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mine a per-store library of reusable "Topic Brief sets" from a store's own owner-blog-post history (1 post = 1 set), grouped by topic, and let the user pick one to auto-fill the existing 소재 Brief form for formula-based draft generation.

**Architecture:** A new SL-F2 extraction call produces one `TopicBriefSetV2` candidate per post; OpenAI extracts interpretive fields while deterministic/safe_mock use a title/keyword heuristic. Candidates are persisted one-row-per-post in a new `v2_blog_topic_brief_sets` table (FK'd to the formula set), populated in batches of 10 — the first batch automatically on `/extract`, further batches via a new `POST /topic-brief-sets/extend` route that reuses the original extraction's provider mode. The GET payload exposes the library plus a remaining-count so the UI can show a single dropdown and a "더 많은 블로그에서 포뮬라 생성" button.

**Tech Stack:** TypeScript (Node ESM, `.js` import specifiers), Express routes, better-sqlite3 via `createRepository`, Zod schemas, `openai` SDK `zodResponseFormat`, Vitest, vanilla browser JS.

**Reference spec:** `docs/superpowers/specs/2026-06-14-blog-formula-v2-topic-brief-library-design.md`

**Conventions to follow:**
- All intra-package imports use the `.js` extension (ESM): `import { x } from './y.js'`.
- Run all server commands from `poc-server/`: `cd poc-server`.
- Test runner: `npx vitest run <file>`. Type check: `npx tsc --noEmit -p tsconfig.json`.
- Repository `create()` requires `id` and auto-fills `createdAt`/`updatedAt`.
- `camelToSnake` maps property → column automatically; only `*_json` columns need `columnOverrides`.

---

## Task 1: Table + repository for `v2_blog_topic_brief_sets`

**Files:**
- Modify: `poc-server/src/db/schema.sql` (after the `v2_blog_topic_briefs` block, ~line 322)
- Modify: `poc-server/src/repositories/v2_blog_formula.ts`
- Modify: `poc-server/src/repositories/storeLearningRepositories.ts`
- Test: `poc-server/test/blogFormulaV2TopicBriefSetRepository.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `poc-server/test/blogFormulaV2TopicBriefSetRepository.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDatabaseConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { seedBlogFormulaV2Fixture } from './helpers/blogFormulaV2Fixtures.js';

function setup() {
  const connection = createDatabaseConnection({ filename: ':memory:' });
  migrateDatabase(connection);
  const fixture = seedBlogFormulaV2Fixture(connection);
  const repos = createStoreLearningRepositories(connection);
  const formulaSet = repos.v2BlogFormulaSets.create({
    id: 'formula_set_brief_sets',
    storeId: fixture.storeId,
    version: 'formula_v2.1',
    status: 'generated',
    formula: {},
    sourcePostIds: fixture.ownerPostIds,
    model: 'test'
  });
  return { connection, repos, fixture, formulaSetId: formulaSet.id };
}

function baseRow(formulaSetId: string, storeId: string, sourcePostId: string) {
  return {
    id: `tbs_${sourcePostId}`,
    formulaSetId,
    storeId,
    sourcePostId,
    topic: '리팟레이저',
    mainKeyword: '리팟레이저',
    secondaryKeywords: ['흑자'],
    targetReader: '리팟레이저 정보를 찾는 잠재 고객',
    coreConcern: '부작용·재발 등 시술 전 걱정',
    mainAngle: '걱정 해소와 정보 제공 중심 전개',
    mustInclude: ['개인차', '부작용 가능성', '의료진 상담'],
    mustAvoid: [],
    ctaDirection: '상담을 통해 본인에게 맞는 계획을 확인하도록 안내',
    confidence: 0.4,
    status: 'candidate'
  };
}

describe('v2_blog_topic_brief_sets repository', () => {
  it('persists json columns and lists rows by formula set', () => {
    const { repos, fixture, formulaSetId } = setup();
    repos.v2BlogTopicBriefSets.create(baseRow(formulaSetId, fixture.storeId, fixture.ownerPostIds[0]));
    repos.v2BlogTopicBriefSets.create(baseRow(formulaSetId, fixture.storeId, fixture.ownerPostIds[1]));

    const rows = repos.v2BlogTopicBriefSets.listByFormulaSetId(formulaSetId);
    expect(rows).toHaveLength(2);
    expect(rows[0].secondaryKeywords).toEqual(['흑자']);
    expect(rows[0].mustInclude).toEqual(['개인차', '부작용 가능성', '의료진 상담']);
    expect(rows[0].confidence).toBe(0.4);
    expect(rows[0].status).toBe('candidate');
  });

  it('rejects duplicate (formula_set_id, source_post_id)', () => {
    const { repos, fixture, formulaSetId } = setup();
    repos.v2BlogTopicBriefSets.create(baseRow(formulaSetId, fixture.storeId, fixture.ownerPostIds[0]));
    expect(() =>
      repos.v2BlogTopicBriefSets.create({
        ...baseRow(formulaSetId, fixture.storeId, fixture.ownerPostIds[0]),
        id: 'tbs_duplicate'
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd poc-server && npx vitest run test/blogFormulaV2TopicBriefSetRepository.test.ts`
Expected: FAIL — `repos.v2BlogTopicBriefSets` is undefined (and the table does not exist).

- [ ] **Step 3: Add the table to `schema.sql`**

In `poc-server/src/db/schema.sql`, immediately after the `CREATE INDEX ... idx_v2_blog_topic_briefs_store_id ...` line (~line 322), insert:

```sql

CREATE TABLE IF NOT EXISTS v2_blog_topic_brief_sets (
  id TEXT PRIMARY KEY,
  formula_set_id TEXT NOT NULL REFERENCES v2_blog_formula_sets(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  source_post_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  main_keyword TEXT NOT NULL,
  secondary_keywords_json TEXT NOT NULL DEFAULT '[]',
  target_reader TEXT,
  core_concern TEXT,
  main_angle TEXT,
  must_include_json TEXT NOT NULL DEFAULT '[]',
  must_avoid_json TEXT NOT NULL DEFAULT '[]',
  cta_direction TEXT,
  confidence REAL NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (formula_set_id, source_post_id)
);

CREATE INDEX IF NOT EXISTS idx_v2_blog_topic_brief_sets_formula_set_id ON v2_blog_topic_brief_sets(formula_set_id);
CREATE INDEX IF NOT EXISTS idx_v2_blog_topic_brief_sets_store_id ON v2_blog_topic_brief_sets(store_id);
```

- [ ] **Step 4: Add the entity type, columns, and repository factory in `v2_blog_formula.ts`**

After the `V2BlogTopicBrief` type (ends ~line 45), add:

```ts
export type V2BlogTopicBriefSet = BaseEntity & {
  formulaSetId: string;
  storeId: string;
  sourcePostId: string;
  topic: string;
  mainKeyword: string;
  secondaryKeywords: JsonValue;
  targetReader: string | null;
  coreConcern: string | null;
  mainAngle: string | null;
  mustInclude: JsonValue;
  mustAvoid: JsonValue;
  ctaDirection: string | null;
  confidence: number;
  status: string;
};
```

After the `topicBriefColumns` array (find it near line 126), add:

```ts
const topicBriefSetColumns = [
  'id',
  'formulaSetId',
  'storeId',
  'sourcePostId',
  'topic',
  'mainKeyword',
  'secondaryKeywords',
  'targetReader',
  'coreConcern',
  'mainAngle',
  'mustInclude',
  'mustAvoid',
  'ctaDirection',
  'confidence',
  'status',
  'createdAt',
  'updatedAt'
] as const;
```

After `createV2BlogTopicBriefsRepository` (ends ~line 259), add:

```ts
export function createV2BlogTopicBriefSetsRepository(connection: DbConnection) {
  const repository = createRepository<V2BlogTopicBriefSet>(connection, {
    tableName: 'v2_blog_topic_brief_sets',
    columns: topicBriefSetColumns,
    jsonColumns: ['secondaryKeywords', 'mustInclude', 'mustAvoid'],
    columnOverrides: {
      secondaryKeywords: 'secondary_keywords_json',
      mustInclude: 'must_include_json',
      mustAvoid: 'must_avoid_json'
    }
  });
  return {
    ...repository,
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId),
    listByFormulaSetId: (formulaSetId: string) => repository.findManyBy('formulaSetId', formulaSetId)
  };
}
```

- [ ] **Step 5: Register the repository in `storeLearningRepositories.ts`**

In the import block from `'./v2_blog_formula.js'`, add `createV2BlogTopicBriefSetsRepository,` (keep alphabetical-ish ordering near `createV2BlogTopicBriefsRepository`). Then in the returned object, after the `v2BlogTopicBriefs:` line, add:

```ts
    v2BlogTopicBriefSets: createV2BlogTopicBriefSetsRepository(connection),
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd poc-server && npx vitest run test/blogFormulaV2TopicBriefSetRepository.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add poc-server/src/db/schema.sql poc-server/src/repositories/v2_blog_formula.ts poc-server/src/repositories/storeLearningRepositories.ts poc-server/test/blogFormulaV2TopicBriefSetRepository.test.ts
git commit -m "feat: add v2_blog_topic_brief_sets table and repository"
```

---

## Task 2: `TopicBriefSetV2` schemas and candidate type

**Files:**
- Modify: `poc-server/src/storeLearning/blogFormulaV2/types.ts`
- Test: `poc-server/test/topicBriefSetSchema.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `poc-server/test/topicBriefSetSchema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  TopicBriefSetV2Schema,
  TopicBriefSetV2ResponseFormatSchema
} from '../src/storeLearning/blogFormulaV2/types.js';

describe('TopicBriefSetV2 schemas', () => {
  it('parses a full topic brief set with single-post evidence', () => {
    const parsed = TopicBriefSetV2Schema.parse({
      id: 'tbs_1',
      sourcePostIds: ['collection_item_v2_owner_1'],
      confidence: 0.7,
      status: 'candidate',
      topic: '리팟레이저',
      mainKeyword: '리팟레이저 부작용',
      secondaryKeywords: ['흑자 제거'],
      targetReader: '리팟레이저 정보를 찾는 고객',
      coreConcern: '부작용 걱정',
      mainAngle: '원리 설명 중심',
      mustInclude: ['개인차'],
      mustAvoid: [],
      ctaDirection: '상담 안내'
    });
    expect(parsed.sourcePostIds).toEqual(['collection_item_v2_owner_1']);
    expect(parsed.status).toBe('candidate');
  });

  it('accepts nullable interpretive fields', () => {
    const parsed = TopicBriefSetV2Schema.parse({
      id: 'tbs_2',
      sourcePostIds: ['p2'],
      confidence: 0.4,
      status: 'candidate',
      topic: '울쎄라',
      mainKeyword: '울쎄라',
      secondaryKeywords: [],
      targetReader: null,
      coreConcern: null,
      mainAngle: null,
      mustInclude: [],
      mustAvoid: [],
      ctaDirection: null
    });
    expect(parsed.targetReader).toBeNull();
  });

  it('response-format schema parses an array of model items keyed by post id', () => {
    const parsed = TopicBriefSetV2ResponseFormatSchema.parse({
      topicBriefSets: [
        {
          id: 'collection_item_v2_owner_1',
          topic: '리팟레이저',
          mainKeyword: '리팟레이저 부작용',
          secondaryKeywords: ['흑자 제거'],
          targetReader: null,
          coreConcern: '부작용 걱정',
          mainAngle: '원리 설명',
          mustInclude: ['개인차'],
          mustAvoid: [],
          ctaDirection: '상담 안내'
        }
      ]
    });
    expect(parsed.topicBriefSets[0].id).toBe('collection_item_v2_owner_1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd poc-server && npx vitest run test/topicBriefSetSchema.test.ts`
Expected: FAIL — `TopicBriefSetV2Schema` is not exported.

- [ ] **Step 3: Add the schemas and types to `types.ts`**

In `poc-server/src/storeLearning/blogFormulaV2/types.ts`, after the `SelfIntroductionPatternV2Schema` block (ends ~line 50), add:

```ts
// A reusable Topic Brief mined from one owner_blog_post (1 post = 1 set), see
// topicBriefSetHeuristic.ts / SL-F2. sourcePostIds always holds exactly the one
// post the set was derived from. Same fields as BlogTopicBriefInput plus
// FormulaEvidence so the library carries provenance like other formula blocks.
export const TopicBriefSetV2Schema = FormulaEvidenceSchema.extend({
  id: z.string(),
  topic: z.string(),
  mainKeyword: z.string(),
  secondaryKeywords: z.array(z.string()),
  targetReader: z.string().nullable(),
  coreConcern: z.string().nullable(),
  mainAngle: z.string().nullable(),
  mustInclude: z.array(z.string()),
  mustAvoid: z.array(z.string()),
  ctaDirection: z.string().nullable()
});

// One item the SL-F2 model returns per provided post; `id` echoes the post id so
// the server can attach sourcePostIds. Server-only fields (confidence, status)
// are filled afterwards, so they are omitted here for OpenAI structured outputs.
export const TopicBriefSetV2ResponseItemSchema = z.object({
  id: z.string(),
  topic: z.string(),
  mainKeyword: z.string(),
  secondaryKeywords: z.array(z.string()),
  targetReader: z.string().nullable(),
  coreConcern: z.string().nullable(),
  mainAngle: z.string().nullable(),
  mustInclude: z.array(z.string()),
  mustAvoid: z.array(z.string()),
  ctaDirection: z.string().nullable()
});

export const TopicBriefSetV2ResponseFormatSchema = z.object({
  topicBriefSets: z.array(TopicBriefSetV2ResponseItemSchema)
});
```

Then in the type-export block at the bottom (after `export type SelfIntroductionPatternV2 = ...`), add:

```ts
export type TopicBriefSetV2 = z.infer<typeof TopicBriefSetV2Schema>;
// A topic brief set before it is persisted (the DB row id is assigned on insert).
export type TopicBriefSetCandidate = Omit<TopicBriefSetV2, 'id'>;
export type TopicBriefSetV2ResponseItem = z.infer<typeof TopicBriefSetV2ResponseItemSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd poc-server && npx vitest run test/topicBriefSetSchema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add poc-server/src/storeLearning/blogFormulaV2/types.ts poc-server/test/topicBriefSetSchema.test.ts
git commit -m "feat: add TopicBriefSetV2 schemas and candidate type"
```

---

## Task 3: SL-F2 prompt builder

**Files:**
- Create: `poc-server/src/storeLearning/blogFormulaV2/topicBriefSetPrompt.ts`
- Test: `poc-server/test/topicBriefSetPrompt.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `poc-server/test/topicBriefSetPrompt.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  BLOG_TOPIC_BRIEF_SET_V2_CALL_ID,
  TOPIC_BRIEF_SET_BATCH_SIZE,
  buildTopicBriefSetV2PromptInput
} from '../src/storeLearning/blogFormulaV2/topicBriefSetPrompt.js';
import type { OwnerBlogPostV2 } from '../src/storeLearning/blogFormulaV2/sourcePosts.js';

function post(id: string, body: string): OwnerBlogPostV2 {
  return {
    collectionItemId: id,
    title: `${id} 제목`,
    sourceUrl: null,
    bodyText: body,
    charCount: body.length,
    isTruncated: false,
    sourceKind: 'owner_blog_post',
    publishedAt: '2026-05-30T03:00:00.000Z',
    createdAt: '2026-05-30T03:00:00.000Z'
  };
}

describe('buildTopicBriefSetV2PromptInput (SL-F2)', () => {
  it('exposes each post by collectionItemId and truncates long bodies', () => {
    const longBody = '가'.repeat(5000);
    const result = buildTopicBriefSetV2PromptInput({
      store: { id: 's1', name: '테라스의원', category: '피부과', representativeKeywords: ['리팟레이저'] },
      posts: [post('p1', longBody), post('p2', '짧은 본문')]
    });

    expect(BLOG_TOPIC_BRIEF_SET_V2_CALL_ID).toBe('SL-F2');
    expect(TOPIC_BRIEF_SET_BATCH_SIZE).toBe(10);
    expect(result.sourcePostIds).toEqual(['p1', 'p2']);
    expect(result.promptInput.posts[0].id).toBe('p1');
    expect(result.promptInput.posts[0].bodyText.length).toBeLessThanOrEqual(2000);
    expect(result.promptInput.storeProfile.representativeKeywords).toEqual(['리팟레이저']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd poc-server && npx vitest run test/topicBriefSetPrompt.test.ts`
Expected: FAIL — module `topicBriefSetPrompt.js` not found.

- [ ] **Step 3: Create the prompt builder**

Create `poc-server/src/storeLearning/blogFormulaV2/topicBriefSetPrompt.ts`:

```ts
import type { OwnerBlogPostV2 } from './sourcePosts.js';

export const BLOG_TOPIC_BRIEF_SET_V2_PROMPT_SCHEMA_VERSION = 'blog_topic_brief_set_v2_extraction_input.v1';
export const BLOG_TOPIC_BRIEF_SET_V2_RESPONSE_FORMAT_NAME = 'store_learning_blog_topic_brief_set_v2';
export const BLOG_TOPIC_BRIEF_SET_V2_CALL_ID = 'SL-F2';
export const TOPIC_BRIEF_SET_BATCH_SIZE = 10;

const MAX_BODY_CHARS_PER_POST = 2000;

const topicBriefSetInstructions = [
  'For each provided owner Blog post, produce exactly one reusable Topic Brief set.',
  'Echo the provided post id in the "id" field so each set maps back to its post.',
  'Infer topic and mainKeyword from the title and recurring keywords; list other notable keywords as secondaryKeywords.',
  'Infer targetReader, coreConcern, mainAngle, mustInclude, mustAvoid, and ctaDirection from how the post is written.',
  'Keep phrasing medical-ad-safe: no treatment-outcome guarantees, rankings, or no-side-effect claims.',
  'Use null for any interpretive field you cannot infer; never invent facts not supported by the post.'
] as const;

const topicBriefSetConstraints = [
  'Return one item per provided post and no extra items.',
  'Each "id" must match one of the provided post ids.',
  'Return Korean topic, keywords, and interpretive text.'
] as const;

export type TopicBriefSetPromptStore = {
  id: string;
  name: string | null;
  category: string | null;
  representativeKeywords: string[];
};

export type TopicBriefSetV2PromptInput = {
  task: 'Extract one reusable Topic Brief set per owner Blog post.';
  schemaVersion: typeof BLOG_TOPIC_BRIEF_SET_V2_PROMPT_SCHEMA_VERSION;
  instructions: typeof topicBriefSetInstructions;
  constraints: typeof topicBriefSetConstraints;
  storeProfile: TopicBriefSetPromptStore;
  posts: Array<{ id: string; title: string | null; bodyText: string }>;
};

export type BuildTopicBriefSetV2PromptInputInput = {
  store: TopicBriefSetPromptStore;
  posts: OwnerBlogPostV2[];
};

export function buildTopicBriefSetV2PromptInput(input: BuildTopicBriefSetV2PromptInputInput) {
  const posts = input.posts.map((post) => ({
    id: post.collectionItemId,
    title: post.title,
    bodyText: post.bodyText.slice(0, MAX_BODY_CHARS_PER_POST)
  }));

  const promptInput: TopicBriefSetV2PromptInput = {
    task: 'Extract one reusable Topic Brief set per owner Blog post.',
    schemaVersion: BLOG_TOPIC_BRIEF_SET_V2_PROMPT_SCHEMA_VERSION,
    instructions: topicBriefSetInstructions,
    constraints: topicBriefSetConstraints,
    storeProfile: input.store,
    posts
  };

  return { promptInput, sourcePostIds: posts.map((post) => post.id) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd poc-server && npx vitest run test/topicBriefSetPrompt.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add poc-server/src/storeLearning/blogFormulaV2/topicBriefSetPrompt.ts poc-server/test/topicBriefSetPrompt.test.ts
git commit -m "feat: add SL-F2 topic brief set prompt builder"
```

---

## Task 4: Heuristic, provider interface, and safe_mock provider

**Files:**
- Create: `poc-server/src/storeLearning/blogFormulaV2/topicBriefSetHeuristic.ts`
- Create: `poc-server/src/storeLearning/blogFormulaV2/providers/topicBriefSetProvider.ts`
- Create: `poc-server/src/storeLearning/blogFormulaV2/providers/safeMockTopicBriefSetProvider.ts`
- Test: `poc-server/test/topicBriefSetHeuristic.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `poc-server/test/topicBriefSetHeuristic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildHeuristicTopicBriefSets } from '../src/storeLearning/blogFormulaV2/topicBriefSetHeuristic.js';
import { createSafeMockTopicBriefSetProvider } from '../src/storeLearning/blogFormulaV2/providers/safeMockTopicBriefSetProvider.js';
import { TopicBriefSetV2Schema } from '../src/storeLearning/blogFormulaV2/types.js';
import type { OwnerBlogPostV2 } from '../src/storeLearning/blogFormulaV2/sourcePosts.js';

function post(id: string, title: string, body: string): OwnerBlogPostV2 {
  return {
    collectionItemId: id,
    title,
    sourceUrl: null,
    bodyText: body,
    charCount: body.length,
    isTruncated: false,
    sourceKind: 'owner_blog_post',
    publishedAt: '2026-05-30T03:00:00.000Z',
    createdAt: '2026-05-30T03:00:00.000Z'
  };
}

const store = {
  id: 's1',
  name: '테라스의원',
  category: '피부과',
  representativeKeywords: ['리팟레이저', '흑자', '울쎄라']
};

describe('buildHeuristicTopicBriefSets', () => {
  it('derives topic from representative keywords and fills generic interpretive defaults', () => {
    const sets = buildHeuristicTopicBriefSets(store, [
      post('p1', '리팟레이저 부작용 걱정', '흑자 제거 후 색소침착 걱정'),
      post('p2', '울쎄라 600샷 가격', '샷 수와 피부 상태를 함께 판단')
    ]);

    expect(sets).toHaveLength(2);
    expect(sets[0].topic).toBe('리팟레이저');
    expect(sets[0].sourcePostIds).toEqual(['p1']);
    expect(sets[0].secondaryKeywords).toContain('흑자');
    expect(sets[0].mustInclude).toEqual(['개인차', '부작용 가능성', '의료진 상담']);
    expect(sets[0].status).toBe('candidate');
    expect(sets[0].confidence).toBe(0.4);
    expect(sets[1].topic).toBe('울쎄라');
    // each candidate is a valid TopicBriefSetV2 once an id is attached
    expect(() => TopicBriefSetV2Schema.parse({ ...sets[0], id: 'tbs_1' })).not.toThrow();
  });

  it('falls back to the first representative keyword when none match', () => {
    const sets = buildHeuristicTopicBriefSets(store, [post('p3', '일반 피부 관리', '계절별 보습 팁')]);
    expect(sets[0].topic).toBe('리팟레이저');
  });
});

describe('safe_mock topic brief set provider', () => {
  it('returns heuristic sets with safe_mock provenance', async () => {
    const provider = createSafeMockTopicBriefSetProvider();
    const result = await provider.extractTopicBriefSets({
      store,
      posts: [post('p1', '리팟레이저 부작용', '흑자 제거')]
    });
    expect(result.provider.mode).toBe('safe_mock');
    expect(result.provider.noExternalCalls).toBe(true);
    expect(result.sets[0].topic).toBe('리팟레이저');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd poc-server && npx vitest run test/topicBriefSetHeuristic.test.ts`
Expected: FAIL — module `topicBriefSetHeuristic.js` not found.

- [ ] **Step 3: Create the heuristic**

Create `poc-server/src/storeLearning/blogFormulaV2/topicBriefSetHeuristic.ts`:

```ts
import type { OwnerBlogPostV2 } from './sourcePosts.js';
import type { TopicBriefSetPromptStore } from './topicBriefSetPrompt.js';
import type { TopicBriefSetCandidate } from './types.js';

const HEURISTIC_REQUIRED_DISCLOSURES = ['개인차', '부작용 가능성', '의료진 상담'];
const HEURISTIC_CORE_CONCERN = '부작용·재발 등 시술 전 걱정';
const HEURISTIC_MAIN_ANGLE = '걱정 해소와 정보 제공 중심 전개';
const HEURISTIC_CTA_DIRECTION = '상담을 통해 본인에게 맞는 계획을 확인하도록 안내';
const HEURISTIC_FALLBACK_TOPIC = '주제 미상';

function firstTitleToken(title: string | null): string | undefined {
  if (!title) return undefined;
  return title.toLowerCase().match(/[0-9a-z가-힣]+/g)?.find((token) => token.length >= 2);
}

function pickTopic(post: OwnerBlogPostV2, representativeKeywords: string[]): string {
  const haystack = `${post.title ?? ''} ${post.bodyText}`;
  const matched = representativeKeywords.find((keyword) => haystack.includes(keyword));
  if (matched) return matched;
  if (representativeKeywords.length > 0) return representativeKeywords[0];
  return firstTitleToken(post.title) ?? HEURISTIC_FALLBACK_TOPIC;
}

export function buildHeuristicTopicBriefSets(
  store: TopicBriefSetPromptStore,
  posts: OwnerBlogPostV2[]
): TopicBriefSetCandidate[] {
  return posts.map((post) => {
    const topic = pickTopic(post, store.representativeKeywords);
    const haystack = `${post.title ?? ''} ${post.bodyText}`;
    const secondaryKeywords = store.representativeKeywords.filter(
      (keyword) => keyword !== topic && haystack.includes(keyword)
    );
    return {
      sourcePostIds: [post.collectionItemId],
      confidence: 0.4,
      status: 'candidate' as const,
      topic,
      mainKeyword: topic,
      secondaryKeywords,
      targetReader: `${topic} 정보를 찾는 잠재 고객`,
      coreConcern: HEURISTIC_CORE_CONCERN,
      mainAngle: HEURISTIC_MAIN_ANGLE,
      mustInclude: [...HEURISTIC_REQUIRED_DISCLOSURES],
      mustAvoid: [],
      ctaDirection: HEURISTIC_CTA_DIRECTION
    };
  });
}
```

- [ ] **Step 4: Create the provider interface**

Create `poc-server/src/storeLearning/blogFormulaV2/providers/topicBriefSetProvider.ts`:

```ts
import type { OwnerBlogPostV2 } from '../sourcePosts.js';
import type { TopicBriefSetCandidate } from '../types.js';
import type {
  BLOG_TOPIC_BRIEF_SET_V2_CALL_ID,
  BLOG_TOPIC_BRIEF_SET_V2_PROMPT_SCHEMA_VERSION,
  TopicBriefSetPromptStore
} from '../topicBriefSetPrompt.js';

export type TopicBriefSetProviderMode = 'deterministic' | 'safe_mock' | 'openai';
export type TopicBriefSetExtractProviderMode = TopicBriefSetProviderMode | 'auto';

export type TopicBriefSetProviderProvenance = {
  name: string;
  mode: TopicBriefSetProviderMode;
  model: string;
  callId: typeof BLOG_TOPIC_BRIEF_SET_V2_CALL_ID;
  promptShapeVersion: typeof BLOG_TOPIC_BRIEF_SET_V2_PROMPT_SCHEMA_VERSION;
  noExternalCalls: boolean;
};

export type TopicBriefSetExtractInput = {
  store: TopicBriefSetPromptStore;
  posts: OwnerBlogPostV2[];
};

export type TopicBriefSetProviderResult = {
  sets: TopicBriefSetCandidate[];
  provider: TopicBriefSetProviderProvenance;
};

export type TopicBriefSetProvider = {
  name: string;
  mode: TopicBriefSetProviderMode;
  model: string;
  extractTopicBriefSets(input: TopicBriefSetExtractInput): Promise<TopicBriefSetProviderResult>;
};
```

- [ ] **Step 5: Create the safe_mock provider**

Create `poc-server/src/storeLearning/blogFormulaV2/providers/safeMockTopicBriefSetProvider.ts`:

```ts
import {
  BLOG_TOPIC_BRIEF_SET_V2_CALL_ID,
  BLOG_TOPIC_BRIEF_SET_V2_PROMPT_SCHEMA_VERSION
} from '../topicBriefSetPrompt.js';
import { buildHeuristicTopicBriefSets } from '../topicBriefSetHeuristic.js';
import type {
  TopicBriefSetProvider,
  TopicBriefSetProviderProvenance
} from './topicBriefSetProvider.js';

const SAFE_MOCK_MODEL = 'safe-mock-topic-brief-set-v2';

function provenance(): TopicBriefSetProviderProvenance {
  return {
    name: 'safeMockTopicBriefSetProvider',
    mode: 'safe_mock',
    model: SAFE_MOCK_MODEL,
    callId: BLOG_TOPIC_BRIEF_SET_V2_CALL_ID,
    promptShapeVersion: BLOG_TOPIC_BRIEF_SET_V2_PROMPT_SCHEMA_VERSION,
    noExternalCalls: true
  };
}

export function createSafeMockTopicBriefSetProvider(): TopicBriefSetProvider {
  return {
    name: 'safeMockTopicBriefSetProvider',
    mode: 'safe_mock',
    model: SAFE_MOCK_MODEL,
    async extractTopicBriefSets(input) {
      return { sets: buildHeuristicTopicBriefSets(input.store, input.posts), provider: provenance() };
    }
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd poc-server && npx vitest run test/topicBriefSetHeuristic.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add poc-server/src/storeLearning/blogFormulaV2/topicBriefSetHeuristic.ts poc-server/src/storeLearning/blogFormulaV2/providers/topicBriefSetProvider.ts poc-server/src/storeLearning/blogFormulaV2/providers/safeMockTopicBriefSetProvider.ts poc-server/test/topicBriefSetHeuristic.test.ts
git commit -m "feat: add topic brief set heuristic and safe_mock provider"
```

---

## Task 5: OpenAI SL-F2 provider

**Files:**
- Create: `poc-server/src/storeLearning/blogFormulaV2/providers/openAITopicBriefSetProvider.ts`
- Test: `poc-server/test/topicBriefSetOpenAIProvider.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `poc-server/test/topicBriefSetOpenAIProvider.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createOpenAITopicBriefSetProvider } from '../src/storeLearning/blogFormulaV2/providers/openAITopicBriefSetProvider.js';
import type { OwnerBlogPostV2 } from '../src/storeLearning/blogFormulaV2/sourcePosts.js';

function post(id: string): OwnerBlogPostV2 {
  return {
    collectionItemId: id,
    title: `${id} 제목`,
    sourceUrl: null,
    bodyText: '본문',
    charCount: 2,
    isTruncated: false,
    sourceKind: 'owner_blog_post',
    publishedAt: '2026-05-30T03:00:00.000Z',
    createdAt: '2026-05-30T03:00:00.000Z'
  };
}

function stubClient(items: unknown[]) {
  return {
    beta: {
      chat: {
        completions: {
          parse: async () => ({ choices: [{ message: { parsed: { topicBriefSets: items } } }] })
        }
      }
    }
  };
}

const store = { id: 's1', name: '테라스의원', category: '피부과', representativeKeywords: ['리팟레이저'] };

function modelItem(id: string) {
  return {
    id,
    topic: '리팟레이저',
    mainKeyword: '리팟레이저 부작용',
    secondaryKeywords: ['흑자 제거'],
    targetReader: '리팟레이저 정보를 찾는 고객',
    coreConcern: '부작용 걱정',
    mainAngle: '원리 설명',
    mustInclude: ['개인차'],
    mustAvoid: [],
    ctaDirection: '상담 안내'
  };
}

describe('OpenAI topic brief set provider (SL-F2)', () => {
  it('maps model items to candidates tagged by sourcePostId', async () => {
    const provider = createOpenAITopicBriefSetProvider({ client: stubClient([modelItem('p1')]), model: 'gpt-4o-mini' });
    const result = await provider.extractTopicBriefSets({ store, posts: [post('p1')] });

    expect(result.provider.mode).toBe('openai');
    expect(result.provider.noExternalCalls).toBe(false);
    expect(result.sets).toHaveLength(1);
    expect(result.sets[0].sourcePostIds).toEqual(['p1']);
    expect(result.sets[0].confidence).toBe(0.7);
    expect(result.sets[0].status).toBe('candidate');
    expect(result.sets[0].coreConcern).toBe('부작용 걱정');
  });

  it('drops model items whose id is not in the provided batch', async () => {
    const provider = createOpenAITopicBriefSetProvider({
      client: stubClient([modelItem('p1'), modelItem('ghost')]),
      model: 'gpt-4o-mini'
    });
    const result = await provider.extractTopicBriefSets({ store, posts: [post('p1')] });
    expect(result.sets.map((set) => set.sourcePostIds[0])).toEqual(['p1']);
  });

  it('throws when no client is available', async () => {
    const provider = createOpenAITopicBriefSetProvider({ client: null });
    await expect(provider.extractTopicBriefSets({ store, posts: [post('p1')] })).rejects.toThrow(
      'OpenAI client is unavailable'
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd poc-server && npx vitest run test/topicBriefSetOpenAIProvider.test.ts`
Expected: FAIL — module `openAITopicBriefSetProvider.js` not found.

- [ ] **Step 3: Create the OpenAI provider**

Create `poc-server/src/storeLearning/blogFormulaV2/providers/openAITopicBriefSetProvider.ts`:

```ts
import { zodResponseFormat } from 'openai/helpers/zod';
import { getOpenAIClient } from '../../../ai/openaiClient.js';
import {
  BLOG_TOPIC_BRIEF_SET_V2_CALL_ID,
  BLOG_TOPIC_BRIEF_SET_V2_PROMPT_SCHEMA_VERSION,
  BLOG_TOPIC_BRIEF_SET_V2_RESPONSE_FORMAT_NAME,
  buildTopicBriefSetV2PromptInput
} from '../topicBriefSetPrompt.js';
import { TopicBriefSetV2ResponseFormatSchema, type TopicBriefSetCandidate } from '../types.js';
import type {
  TopicBriefSetProvider,
  TopicBriefSetProviderProvenance
} from './topicBriefSetProvider.js';

export type OpenAITopicBriefSetParseClient = {
  beta: {
    chat: {
      completions: {
        parse: (params: unknown) => Promise<{ choices: Array<{ message: { parsed: unknown } }> }>;
      };
    };
  };
};

type OpenAITopicBriefSetProviderOptions = {
  client?: OpenAITopicBriefSetParseClient | null;
  model?: string;
};

const DEFAULT_MODEL = 'gpt-4o-mini';
const systemPrompt =
  'You are a Korean local-store blog topic analyst. ' +
  'For each provided owner Blog post, extract one reusable Topic Brief set: ' +
  'topic, main keyword, secondary keywords, target reader, core concern, main angle, ' +
  'must-include points, must-avoid expressions, and a soft CTA direction. ' +
  'Echo the provided post id in each item. Use only the provided post as evidence, ' +
  'keep medical, legal, and guarantee claims conservative, and use null for fields you cannot infer.';

function provenance(model: string): TopicBriefSetProviderProvenance {
  return {
    name: 'openAITopicBriefSetProvider',
    mode: 'openai',
    model,
    callId: BLOG_TOPIC_BRIEF_SET_V2_CALL_ID,
    promptShapeVersion: BLOG_TOPIC_BRIEF_SET_V2_PROMPT_SCHEMA_VERSION,
    noExternalCalls: false
  };
}

export function createOpenAITopicBriefSetProvider(
  options: OpenAITopicBriefSetProviderOptions = {}
): TopicBriefSetProvider {
  const model = options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;

  return {
    name: 'openAITopicBriefSetProvider',
    mode: 'openai',
    model,
    async extractTopicBriefSets(input) {
      const client = 'client' in options ? options.client : getOpenAIClient();
      if (!client) {
        throw new Error('OpenAI client is unavailable');
      }

      const { promptInput } = buildTopicBriefSetV2PromptInput(input);
      const responseFormat = zodResponseFormat(
        TopicBriefSetV2ResponseFormatSchema,
        BLOG_TOPIC_BRIEF_SET_V2_RESPONSE_FORMAT_NAME
      );
      const completion = await client.beta.chat.completions.parse({
        model,
        messages: [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: JSON.stringify(promptInput, null, 2) }
        ],
        response_format: responseFormat
      });
      const parsed = TopicBriefSetV2ResponseFormatSchema.parse(completion.choices[0]?.message.parsed ?? null);
      const postIds = new Set(input.posts.map((post) => post.collectionItemId));
      const sets: TopicBriefSetCandidate[] = parsed.topicBriefSets
        .filter((item) => postIds.has(item.id))
        .map((item) => ({
          sourcePostIds: [item.id],
          confidence: 0.7,
          status: 'candidate' as const,
          topic: item.topic,
          mainKeyword: item.mainKeyword,
          secondaryKeywords: item.secondaryKeywords,
          targetReader: item.targetReader,
          coreConcern: item.coreConcern,
          mainAngle: item.mainAngle,
          mustInclude: item.mustInclude,
          mustAvoid: item.mustAvoid,
          ctaDirection: item.ctaDirection
        }));

      return { sets, provider: provenance(model) };
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd poc-server && npx vitest run test/topicBriefSetOpenAIProvider.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add poc-server/src/storeLearning/blogFormulaV2/providers/openAITopicBriefSetProvider.ts poc-server/test/topicBriefSetOpenAIProvider.test.ts
git commit -m "feat: add OpenAI SL-F2 topic brief set provider"
```

---

## Task 6: Provider factory

**Files:**
- Create: `poc-server/src/storeLearning/blogFormulaV2/providers/topicBriefSetProviderFactory.ts`
- Test: `poc-server/test/topicBriefSetProviderFactory.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `poc-server/test/topicBriefSetProviderFactory.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createTopicBriefSetProviderForMode } from '../src/storeLearning/blogFormulaV2/providers/topicBriefSetProviderFactory.js';

describe('createTopicBriefSetProviderForMode', () => {
  it('returns null for deterministic and undefined (heuristic runs inline)', () => {
    expect(createTopicBriefSetProviderForMode(undefined)).toBeNull();
    expect(createTopicBriefSetProviderForMode('deterministic')).toBeNull();
  });

  it('returns the safe_mock provider', () => {
    expect(createTopicBriefSetProviderForMode('safe_mock')?.mode).toBe('safe_mock');
  });

  it('returns the openai provider', () => {
    expect(createTopicBriefSetProviderForMode('openai', { openAIClient: null })?.mode).toBe('openai');
  });

  it('auto resolves to safe_mock without an api key and openai with one', () => {
    expect(createTopicBriefSetProviderForMode('auto', { env: {} })?.mode).toBe('safe_mock');
    expect(
      createTopicBriefSetProviderForMode('auto', { env: { OPENAI_API_KEY: 'sk-test' }, openAIClient: null })?.mode
    ).toBe('openai');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd poc-server && npx vitest run test/topicBriefSetProviderFactory.test.ts`
Expected: FAIL — module `topicBriefSetProviderFactory.js` not found.

- [ ] **Step 3: Create the factory**

Create `poc-server/src/storeLearning/blogFormulaV2/providers/topicBriefSetProviderFactory.ts`:

```ts
import {
  createOpenAITopicBriefSetProvider,
  type OpenAITopicBriefSetParseClient
} from './openAITopicBriefSetProvider.js';
import { createSafeMockTopicBriefSetProvider } from './safeMockTopicBriefSetProvider.js';
import type {
  TopicBriefSetExtractProviderMode,
  TopicBriefSetProvider
} from './topicBriefSetProvider.js';

export type TopicBriefSetProviderFactoryEnv = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

export type TopicBriefSetProviderFactoryOptions = {
  env?: TopicBriefSetProviderFactoryEnv;
  openAIClient?: OpenAITopicBriefSetParseClient | null;
  model?: string;
};

function createOpenAIProvider(options: TopicBriefSetProviderFactoryOptions) {
  const env = options.env ?? process.env;
  const providerOptions: Parameters<typeof createOpenAITopicBriefSetProvider>[0] = {
    model: options.model ?? env.OPENAI_MODEL
  };
  if ('openAIClient' in options) {
    providerOptions.client = options.openAIClient;
  }
  return createOpenAITopicBriefSetProvider(providerOptions);
}

export function createTopicBriefSetProviderForMode(
  mode: TopicBriefSetExtractProviderMode | undefined,
  options: TopicBriefSetProviderFactoryOptions = {}
): TopicBriefSetProvider | null {
  if (!mode || mode === 'deterministic') return null;
  if (mode === 'safe_mock') return createSafeMockTopicBriefSetProvider();
  if (mode === 'openai') return createOpenAIProvider(options);

  const env = options.env ?? process.env;
  if (env.OPENAI_API_KEY) return createOpenAIProvider(options);
  return createSafeMockTopicBriefSetProvider();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd poc-server && npx vitest run test/topicBriefSetProviderFactory.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add poc-server/src/storeLearning/blogFormulaV2/providers/topicBriefSetProviderFactory.ts poc-server/test/topicBriefSetProviderFactory.test.ts
git commit -m "feat: add topic brief set provider factory"
```

---

## Task 7: Service — extend, mode resolver, payload

**Files:**
- Modify: `poc-server/src/storeLearning/blogFormulaV2/blogFormulaV2Service.ts`
- Test: `poc-server/test/blogFormulaV2TopicBriefSets.test.ts` (create)

This task adds the batching/extend logic, the provider-mode resolver, the row→`TopicBriefSetV2` serializer, and exposes `topicBriefSets` + `topicBriefSetRemainingCount` in the GET payload. The route wiring is Task 8.

- [ ] **Step 1: Write the failing test**

Create `poc-server/test/blogFormulaV2TopicBriefSets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDatabaseConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import {
  extendBlogFormulaV2TopicBriefSets,
  getBlogFormulaV2Payload,
  getTopicBriefSetProviderModeForStore
} from '../src/storeLearning/blogFormulaV2/blogFormulaV2Service.js';

const STORE_ID = 'store_topic_brief_sets';
const RUN_ID = 'run_topic_brief_sets';

function setup(postCount: number) {
  const connection = createDatabaseConnection({ filename: ':memory:' });
  migrateDatabase(connection);
  const repos = createStoreLearningRepositories(connection);
  repos.stores.create({
    id: STORE_ID,
    name: '테라스의원',
    category: '피부과',
    metadata: { representativeKeywords: ['리팟레이저', '흑자', '울쎄라'] }
  });
  repos.collectionRuns.create({ id: RUN_ID, storeId: STORE_ID, status: 'selection_ready', mode: 'mock' });
  for (let index = 0; index < postCount; index += 1) {
    repos.collectionItems.create({
      id: `post_${index}`,
      runId: RUN_ID,
      storeId: STORE_ID,
      channel: 'blog',
      sourceType: 'post',
      status: 'collected',
      title: `리팟레이저 부작용 ${index}`,
      bodyText: `흑자 제거 후 색소침착 걱정 ${index}`,
      metadata: {
        sourceKind: 'owner_blog_post',
        sourceOwnership: 'owned',
        bodyAvailability: 'available',
        isTruncated: false,
        publishedAt: `2026-05-${String(28 - index).padStart(2, '0')}T03:00:00.000Z`
      }
    });
  }
  const formulaSet = repos.v2BlogFormulaSets.create({
    id: 'formula_set_tbs',
    storeId: STORE_ID,
    version: 'formula_v2.1',
    status: 'generated',
    formula: {},
    sourcePostIds: [],
    model: 'deterministic-blog-formula-v2'
  });
  return { connection, repos, formulaSetId: formulaSet.id };
}

describe('extendBlogFormulaV2TopicBriefSets', () => {
  it('mines the first batch of 10 (heuristic) and reports the remaining count', async () => {
    const { repos, formulaSetId } = setup(12);
    const result = await extendBlogFormulaV2TopicBriefSets(repos, STORE_ID, { formulaSetId, provider: null });

    expect(result.added).toHaveLength(10);
    expect(result.topicBriefSets).toHaveLength(10);
    expect(result.remainingCount).toBe(2);
    expect(result.added[0].topic).toBe('리팟레이저');
    expect(result.added[0].sourcePostIds).toHaveLength(1);
  });

  it('appends the next batch without replacing and skips covered posts', async () => {
    const { repos, formulaSetId } = setup(12);
    await extendBlogFormulaV2TopicBriefSets(repos, STORE_ID, { formulaSetId, provider: null });
    const second = await extendBlogFormulaV2TopicBriefSets(repos, STORE_ID, { formulaSetId, provider: null });

    expect(second.added).toHaveLength(2);
    expect(second.topicBriefSets).toHaveLength(12);
    expect(second.remainingCount).toBe(0);
    const sourceIds = second.topicBriefSets.map((set) => set.sourcePostIds[0]);
    expect(new Set(sourceIds).size).toBe(12);
  });

  it('returns an empty batch when all posts are covered', async () => {
    const { repos, formulaSetId } = setup(3);
    await extendBlogFormulaV2TopicBriefSets(repos, STORE_ID, { formulaSetId, provider: null });
    const again = await extendBlogFormulaV2TopicBriefSets(repos, STORE_ID, { formulaSetId, provider: null });
    expect(again.added).toHaveLength(0);
    expect(again.remainingCount).toBe(0);
  });
});

describe('getBlogFormulaV2Payload topic brief sets', () => {
  it('exposes topicBriefSets and the remaining count', async () => {
    const { repos, formulaSetId } = setup(12);
    await extendBlogFormulaV2TopicBriefSets(repos, STORE_ID, { formulaSetId, provider: null });
    const payload = getBlogFormulaV2Payload(repos, STORE_ID);
    expect(payload.topicBriefSets).toHaveLength(10);
    expect(payload.status.topicBriefSetRemainingCount).toBe(2);
  });
});

describe('getTopicBriefSetProviderModeForStore', () => {
  it('returns undefined when the formula run has no provider (deterministic)', () => {
    const { repos, formulaSetId } = setup(3);
    repos.v2BlogFormulaRuns.create({
      id: 'frun_1',
      storeId: STORE_ID,
      formulaSetId,
      input: {},
      output: { formulaSetId },
      validation: {},
      model: 'deterministic-blog-formula-v2',
      status: 'completed'
    });
    expect(getTopicBriefSetProviderModeForStore(repos, STORE_ID, formulaSetId)).toBeUndefined();
  });

  it('reads the provider mode from the formula run output', () => {
    const { repos, formulaSetId } = setup(3);
    repos.v2BlogFormulaRuns.create({
      id: 'frun_2',
      storeId: STORE_ID,
      formulaSetId,
      input: {},
      output: { formulaSetId, provider: { mode: 'openai' } },
      validation: {},
      model: 'gpt-4o-mini',
      status: 'completed'
    });
    expect(getTopicBriefSetProviderModeForStore(repos, STORE_ID, formulaSetId)).toBe('openai');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd poc-server && npx vitest run test/blogFormulaV2TopicBriefSets.test.ts`
Expected: FAIL — `extendBlogFormulaV2TopicBriefSets` is not exported.

- [ ] **Step 3: Add imports to `blogFormulaV2Service.ts`**

In the `'./types.js'` import block (lines 6-18), add these to the imported list:

```ts
  TopicBriefSetV2Schema,
```
and in the type-only imports of that same block add:
```ts
  type TopicBriefSetCandidate,
  type TopicBriefSetV2,
```

After the `import { listOwnerBlogPostsForFormulaV2, type OwnerBlogPostV2 } from './sourcePosts.js';` line (line 35), add:

```ts
import { buildHeuristicTopicBriefSets } from './topicBriefSetHeuristic.js';
import type { TopicBriefSetPromptStore } from './topicBriefSetPrompt.js';
import type {
  TopicBriefSetExtractProviderMode,
  TopicBriefSetProvider
} from './providers/topicBriefSetProvider.js';
import { TOPIC_BRIEF_SET_BATCH_SIZE } from './topicBriefSetPrompt.js';
```

In the `import type { V2Blog... }` — there is no such import yet; add a value/type import for the row type near the top (after line 3's repositories import):

```ts
import type { V2BlogTopicBriefSet } from '../../repositories/v2_blog_formula.js';
```

- [ ] **Step 4: Add helpers + serializer near the other helpers (after `topicBriefInputFromRecord`, ~line 111)**

```ts
function representativeKeywordsFromStore(store: ReturnType<typeof requireStore>): string[] {
  const metadata = store.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
  return asStringArray((metadata as Record<string, JsonValue>).representativeKeywords);
}

function topicBriefSetStore(store: ReturnType<typeof requireStore>): TopicBriefSetPromptStore {
  return {
    id: store.id,
    name: store.name,
    category: store.category,
    representativeKeywords: representativeKeywordsFromStore(store)
  };
}

function serializeTopicBriefSet(record: V2BlogTopicBriefSet): TopicBriefSetV2 {
  return TopicBriefSetV2Schema.parse({
    id: record.id,
    sourcePostIds: [record.sourcePostId],
    confidence: record.confidence,
    status: record.status,
    topic: record.topic,
    mainKeyword: record.mainKeyword,
    secondaryKeywords: asStringArray(record.secondaryKeywords),
    targetReader: record.targetReader,
    coreConcern: record.coreConcern,
    mainAngle: record.mainAngle,
    mustInclude: asStringArray(record.mustInclude),
    mustAvoid: asStringArray(record.mustAvoid),
    ctaDirection: record.ctaDirection
  });
}

function readProviderMode(output: JsonValue | undefined | null): string | undefined {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return undefined;
  const provider = (output as Record<string, JsonValue>).provider;
  if (!provider || typeof provider !== 'object' || Array.isArray(provider)) return undefined;
  const mode = (provider as Record<string, JsonValue>).mode;
  return typeof mode === 'string' ? mode : undefined;
}

async function produceTopicBriefSetCandidates(
  store: ReturnType<typeof requireStore>,
  posts: OwnerBlogPostV2[],
  provider: TopicBriefSetProvider | null
): Promise<TopicBriefSetCandidate[]> {
  const promptStore = topicBriefSetStore(store);
  if (!provider) return buildHeuristicTopicBriefSets(promptStore, posts);
  const result = await provider.extractTopicBriefSets({ store: promptStore, posts });
  return result.sets;
}
```

- [ ] **Step 5: Add the exported extend + resolver functions (after `extractBlogFormulaV2WithProvider`, before `scorePost`, ~line 374)**

```ts
export function getTopicBriefSetProviderModeForStore(
  repos: StoreLearningRepositories,
  storeId: string,
  formulaSetId?: string
): TopicBriefSetExtractProviderMode | undefined {
  const formulaSet = requireFormulaSet(repos, storeId, formulaSetId);
  const latestRun = latestByCreatedAt(repos.v2BlogFormulaRuns.listByFormulaSetId(formulaSet.id));
  const mode = readProviderMode(latestRun?.output);
  if (mode === 'safe_mock' || mode === 'openai' || mode === 'deterministic') return mode;
  return undefined;
}

type ExtendTopicBriefSetsOptions = {
  formulaSetId?: string;
  provider?: TopicBriefSetProvider | null;
};

export async function extendBlogFormulaV2TopicBriefSets(
  repos: StoreLearningRepositories,
  storeId: string,
  options: ExtendTopicBriefSetsOptions = {}
) {
  const store = requireStore(repos, storeId);
  const formulaSet = requireFormulaSet(repos, storeId, options.formulaSetId);
  const allPosts = listOwnerBlogPostsForFormulaV2(repos, storeId);
  const existing = repos.v2BlogTopicBriefSets.listByFormulaSetId(formulaSet.id);
  const covered = new Set(existing.map((row) => row.sourcePostId));
  const remaining = allPosts.filter((post) => !covered.has(post.collectionItemId));
  const batch = remaining.slice(0, TOPIC_BRIEF_SET_BATCH_SIZE);

  if (batch.length === 0) {
    return {
      added: [] as TopicBriefSetV2[],
      topicBriefSets: existing.map(serializeTopicBriefSet),
      remainingCount: 0
    };
  }

  const candidates = await produceTopicBriefSetCandidates(store, batch, options.provider ?? null);
  const added = candidates.map((candidate) =>
    serializeTopicBriefSet(
      repos.v2BlogTopicBriefSets.create({
        id: makeId('v2_topic_brief_set'),
        formulaSetId: formulaSet.id,
        storeId,
        sourcePostId: candidate.sourcePostIds[0],
        topic: candidate.topic,
        mainKeyword: candidate.mainKeyword,
        secondaryKeywords: candidate.secondaryKeywords,
        targetReader: candidate.targetReader,
        coreConcern: candidate.coreConcern,
        mainAngle: candidate.mainAngle,
        mustInclude: candidate.mustInclude,
        mustAvoid: candidate.mustAvoid,
        ctaDirection: candidate.ctaDirection,
        confidence: candidate.confidence,
        status: candidate.status
      })
    )
  );

  const topicBriefSets = repos.v2BlogTopicBriefSets.listByFormulaSetId(formulaSet.id).map(serializeTopicBriefSet);
  return {
    added,
    topicBriefSets,
    remainingCount: remaining.length - batch.length
  };
}
```

- [ ] **Step 6: Extend the GET payload in `getBlogFormulaV2Payload`**

Replace the body of `getBlogFormulaV2Payload` (lines 157-180). Add the topic-brief-set lookup after the `ownerPosts` line and include the two new fields in the returned object:

```ts
export function getBlogFormulaV2Payload(repos: StoreLearningRepositories, storeId: string) {
  requireStore(repos, storeId);
  const formulaSet = latestByUpdatedAt(repos.v2BlogFormulaSets.listByStoreId(storeId));
  const latestDraftGeneration = latestByUpdatedAt(repos.v2BlogDraftGenerations.listByStoreId(storeId));
  const latestValidation = latestDraftGeneration
    ? latestByCreatedAt(repos.v2BlogDraftValidations.listByDraftGenerationId(latestDraftGeneration.id))
    : null;
  const ownerPosts = listOwnerBlogPostsForFormulaV2(repos, storeId);
  const topicBriefSetRows = formulaSet ? repos.v2BlogTopicBriefSets.listByFormulaSetId(formulaSet.id) : [];
  const topicBriefSets = topicBriefSetRows.map(serializeTopicBriefSet);
  const coveredPostCount = new Set(topicBriefSetRows.map((row) => row.sourcePostId)).size;
  const topicBriefSetRemainingCount = formulaSet ? Math.max(0, ownerPosts.length - coveredPostCount) : 0;

  return {
    lane: 'blog_formula_v2',
    independentFromV1: true,
    status: {
      formulaSetStatus: formulaSet?.status ?? 'none',
      sourceOwnerBlogPostCount: ownerPosts.length,
      model: formulaSet?.model ?? BLOG_FORMULA_V2_MODEL,
      reviewStatus: latestValidation?.status ?? 'not_validated',
      topicBriefSetRemainingCount
    },
    formulaSet,
    sourcePosts: formulaSet ? repos.v2BlogFormulaSourcePosts.listByFormulaSetId(formulaSet.id) : [],
    topicBriefSets,
    latestDraftGeneration,
    latestValidation
  };
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd poc-server && npx vitest run test/blogFormulaV2TopicBriefSets.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 8: Type-check the package**

Run: `cd poc-server && npx tsc --noEmit -p tsconfig.json`
Expected: no output (clean).

- [ ] **Step 9: Commit**

```bash
git add poc-server/src/storeLearning/blogFormulaV2/blogFormulaV2Service.ts poc-server/test/blogFormulaV2TopicBriefSets.test.ts
git commit -m "feat: add topic brief set extend service and payload fields"
```

---

## Task 8: Routes — extend endpoint + first-batch on extract

**Files:**
- Modify: `poc-server/src/storeLearning/routes/blogFormulaV2.ts`
- Test: `poc-server/test/blogFormulaV2Api.test.ts` (add cases)

The first batch is populated by the `/extract` route (best-effort) using a topic-brief provider that matches the requested formula provider mode — this keeps the service `extract*` functions synchronous/unchanged and builds providers where factory options already live. The `/topic-brief-sets/extend` route reuses the original extraction's provider mode resolved from the formula run.

- [ ] **Step 1: Write the failing test**

Add to `poc-server/test/blogFormulaV2Api.test.ts`, inside the `describe('Blog Formula V2 API', ...)` block (after the existing tests, before the block's closing `});`):

```ts
  it('populates the first topic brief set batch on deterministic extract and exposes it via GET', async () => {
    await fetch(`${baseUrl}/api/stores/${BLOG_FORMULA_V2_STORE_ID}/v2/blog-formula/extract`, { method: 'POST' });

    const getResponse = await fetch(`${baseUrl}/api/stores/${BLOG_FORMULA_V2_STORE_ID}/v2/blog-formula`);
    const payload = await readJson(getResponse);

    expect(Array.isArray(payload.topicBriefSets)).toBe(true);
    expect(payload.topicBriefSets.length).toBe(4); // fixture has 4 owner posts
    expect(payload.status.topicBriefSetRemainingCount).toBe(0);
    expect(payload.topicBriefSets[0].topic).toBeTruthy();
  });

  it('extends the topic brief set library via POST /topic-brief-sets/extend', async () => {
    await fetch(`${baseUrl}/api/stores/${BLOG_FORMULA_V2_STORE_ID}/v2/blog-formula/extract`, { method: 'POST' });

    const extendResponse = await fetch(
      `${baseUrl}/api/stores/${BLOG_FORMULA_V2_STORE_ID}/v2/blog-formula/topic-brief-sets/extend`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
    );
    const extended = await readJson(extendResponse);

    expect(extendResponse.status).toBe(200);
    // all 4 fixture posts were already covered by the first batch on extract
    expect(extended.added).toHaveLength(0);
    expect(extended.topicBriefSets).toHaveLength(4);
    expect(extended.remainingCount).toBe(0);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd poc-server && npx vitest run test/blogFormulaV2Api.test.ts`
Expected: FAIL — `topicBriefSets` is undefined / the `/topic-brief-sets/extend` route returns 404 or 400.

- [ ] **Step 3: Update imports in `blogFormulaV2.ts`**

In the import block from `'../blogFormulaV2/blogFormulaV2Service.js'` (lines 5-15), add:

```ts
  extendBlogFormulaV2TopicBriefSets,
  getTopicBriefSetProviderModeForStore,
```

After the `createBlogDraftV2ProviderForMode` import (line 20), add:

```ts
import { createTopicBriefSetProviderForMode } from '../blogFormulaV2/providers/topicBriefSetProviderFactory.js';
```

- [ ] **Step 4: Add the extend body schema (after `ValidateDraftBodySchema`, ~line 55)**

```ts
const ExtendTopicBriefSetsBodySchema = z.object({
  formulaSetId: z.string().trim().min(1).optional()
});
```

- [ ] **Step 5: Add a first-batch helper inside `createBlogFormulaV2Routes` (after the `storeId` helper, ~line 64)**

```ts
  function topicBriefSetFactoryOptions() {
    return {
      env: providerFactoryOptions?.env,
      openAIClient: providerFactoryOptions?.openAIClient,
      model: providerFactoryOptions?.model
    };
  }

  async function populateFirstTopicBriefSetBatch(
    storeIdValue: string,
    formulaSetId: string,
    providerMode: 'deterministic' | 'safe_mock' | 'openai' | 'auto' | undefined
  ) {
    try {
      const provider = createTopicBriefSetProviderForMode(providerMode, topicBriefSetFactoryOptions());
      await extendBlogFormulaV2TopicBriefSets(repos, storeIdValue, { formulaSetId, provider });
    } catch {
      // best-effort: the topic brief library stays empty and is retryable via the extend route
    }
  }
```

- [ ] **Step 6: Wire the first batch into the `/extract` handler**

Replace the `/extract` handler body (lines 74-88) with:

```ts
  router.post('/extract', async (req, res, next) => {
    try {
      const body = ExtractFormulaBodySchema.parse(req.body ?? {});
      const provider = createBlogFormulaV2ProviderForMode(body.providerMode, {
        ...(providerFactoryOptions ?? {})
      });
      const result = provider
        ? await extractBlogFormulaV2WithProvider(repos, storeId(req), provider)
        : extractBlogFormulaV2(repos, storeId(req));
      await populateFirstTopicBriefSetBatch(storeId(req), result.formulaSet.id, body.providerMode);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
```

- [ ] **Step 7: Add the extend route (after the `/validate-draft` route, ~line 122)**

```ts
  router.post('/topic-brief-sets/extend', async (req, res, next) => {
    try {
      const body = ExtendTopicBriefSetsBodySchema.parse(req.body ?? {});
      const mode = getTopicBriefSetProviderModeForStore(repos, storeId(req), body.formulaSetId);
      const provider = createTopicBriefSetProviderForMode(mode, topicBriefSetFactoryOptions());
      const result = await extendBlogFormulaV2TopicBriefSets(repos, storeId(req), {
        formulaSetId: body.formulaSetId,
        provider
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd poc-server && npx vitest run test/blogFormulaV2Api.test.ts`
Expected: PASS (all existing + 2 new cases).

- [ ] **Step 9: Type-check the package**

Run: `cd poc-server && npx tsc --noEmit -p tsconfig.json`
Expected: no output (clean).

- [ ] **Step 10: Commit**

```bash
git add poc-server/src/storeLearning/routes/blogFormulaV2.ts poc-server/test/blogFormulaV2Api.test.ts
git commit -m "feat: wire topic brief set first batch and extend route"
```

---

## Task 9: UI — library dropdown + extend button

**Files:**
- Modify: `web/07_마케팅전략룰셋.html` (소재 Brief panel, ~lines 720-733)
- Modify: `web/blog_formula_v2.js`
- Test: `poc-server/test/blogFormulaV2Page.test.ts` (add cases)

- [ ] **Step 1: Write the failing test**

Add to `poc-server/test/blogFormulaV2Page.test.ts`, inside the `describe('Blog Formula V2 static UI lane', ...)` block (before its closing `});`):

```ts
  it('defines the topic brief library dropdown and extend button on the V2 tab', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const formulaSection = extractSection(html, '<!-- Blog Formula V2 -->', '<!-- 유사업체비교 -->');

    expect(formulaSection).toContain('id="v2TopicBriefLibrary"');
    expect(formulaSection).toContain('id="v2TopicBriefExtendButton"');
    expect(formulaSection).toContain('토픽 브리프 라이브러리');
  });

  it('wires the topic brief library to the form and the extend endpoint', () => {
    const js = readFileSync(path.join(webRoot, 'blog_formula_v2.js'), 'utf8');

    expect(js).toContain('fetch(`/api/stores/${storeId}/v2/blog-formula/topic-brief-sets/extend`');
    expect(js).toContain('topicBriefSets');
    expect(js).toContain('topicBriefSetRemainingCount');
    expect(js).toContain('v2TopicBriefLibrary');
    expect(js).toContain('applyTopicBriefSet');
    expect(() => new Function(js)).not.toThrow();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd poc-server && npx vitest run test/blogFormulaV2Page.test.ts`
Expected: FAIL — the new ids/strings are not present.

- [ ] **Step 3: Add the dropdown + extend button to the HTML**

In `web/07_마케팅전략룰셋.html`, replace the 소재 Brief panel head + the opening of the body (lines 721-723):

```html
          <div class="formula-v2-panel-head">소재 Brief</div>
          <div class="formula-v2-panel-body">
            <div class="formula-v2-form">
```

with:

```html
          <div class="formula-v2-panel-head">소재 Brief</div>
          <div class="formula-v2-panel-body">
            <div class="formula-v2-field full">
              <label for="v2TopicBriefLibrary">토픽 브리프 라이브러리</label>
              <select id="v2TopicBriefLibrary" onchange="applyTopicBriefSet(this.value)">
                <option value="">직접 입력</option>
              </select>
            </div>
            <div class="formula-v2-actions" style="margin:8px 0 12px">
              <button type="button" class="btn btn-ghost btn-sm" id="v2TopicBriefExtendButton" style="display:none" onclick="extendTopicBriefSetLibrary()">더 많은 블로그에서 포뮬라 생성</button>
            </div>
            <div class="formula-v2-form">
```

(The extra `<div class="formula-v2-form">` opener replaces the original; the original form's closing `</div>` at line 733 is unchanged.)

- [ ] **Step 4: Add the library state + render/apply/extend logic to `blog_formula_v2.js`**

In `web/blog_formula_v2.js`, add `topicBriefSets: []` to the `state` object (after `latestSamples: []`, line 8):

```js
    latestSamples: [],
    topicBriefSets: []
```

After `topicBriefFromForm()` (ends line 141), add:

```js
  function setInputValue(id, value) {
    const element = field(id);
    if (element) element.value = value ?? '';
  }

  function topicBriefSetSummary(set) {
    return set.mainAngle || set.coreConcern || set.mainKeyword || set.topic;
  }

  function renderTopicBriefLibrary(payload) {
    const select = field('v2TopicBriefLibrary');
    state.topicBriefSets = (payload && payload.topicBriefSets) || [];
    if (select) {
      const counts = {};
      const totals = {};
      state.topicBriefSets.forEach((set) => {
        totals[set.topic] = (totals[set.topic] || 0) + 1;
      });
      const circled = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
      const options = state.topicBriefSets.map((set, index) => {
        counts[set.topic] = (counts[set.topic] || 0) + 1;
        const order = totals[set.topic] > 1 ? ` ${circled[counts[set.topic] - 1] || counts[set.topic]}` : '';
        const label = `${set.topic}${order} · ${topicBriefSetSummary(set)}`;
        return `<option value="${escapeHtml(index)}">${escapeHtml(label)}</option>`;
      });
      select.innerHTML = '<option value="">직접 입력</option>' + options.join('');
    }
    const remaining = (payload && payload.status && payload.status.topicBriefSetRemainingCount) || 0;
    const button = field('v2TopicBriefExtendButton');
    if (button) {
      button.style.display = remaining > 0 ? '' : 'none';
      button.textContent = `더 많은 블로그에서 포뮬라 생성 (남은 ${remaining}건)`;
    }
  }

  function applyTopicBriefSet(indexValue) {
    if (indexValue === '' || indexValue === null || indexValue === undefined) return;
    const set = state.topicBriefSets[Number(indexValue)];
    if (!set) return;
    setInputValue('v2-topic', set.topic);
    setInputValue('v2-main-keyword', set.mainKeyword);
    setInputValue('v2-secondary-keywords', (set.secondaryKeywords || []).join(', '));
    setInputValue('v2-target-reader', set.targetReader || '');
    setInputValue('v2-core-concern', set.coreConcern || '');
    setInputValue('v2-main-angle', set.mainAngle || '');
    setInputValue('v2-must-include', (set.mustInclude || []).join(', '));
    setInputValue('v2-must-avoid', (set.mustAvoid || []).join(', '));
    setInputValue('v2-cta-direction', set.ctaDirection || '');
    setMessage(`토픽 브리프 "${set.topic}"를 소재 Brief에 적용했습니다.`);
  }

  async function extendTopicBriefSetLibrary() {
    const storeId = blogFormulaV2CurrentStoreId();
    const button = field('v2TopicBriefExtendButton');
    if (button) button.disabled = true;
    try {
      setMessage('추가 블로그에서 토픽 브리프를 생성하는 중입니다.');
      const response = await fetch(`/api/stores/${storeId}/v2/blog-formula/topic-brief-sets/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!response.ok) throw new Error('extend failed');
      const result = await response.json();
      renderTopicBriefLibrary({
        topicBriefSets: result.topicBriefSets,
        status: { topicBriefSetRemainingCount: result.remainingCount }
      });
      setMessage(`토픽 브리프 ${result.added.length}건을 추가했습니다. (남은 ${result.remainingCount}건)`);
    } catch {
      setMessage('토픽 브리프 추가 생성에 실패했습니다.');
    } finally {
      if (button) button.disabled = false;
    }
  }
```

In `renderPayload` (line 243), add a call to render the library at the end of the function body:

```js
  function renderPayload(payload) {
    renderStatus(payload);
    renderSourcePosts(payload?.sourcePosts || []);
    renderFormulaCards(payload?.formulaSet);
    renderTopicBriefLibrary(payload);
    if (payload?.latestDraftGeneration?.output) renderDraft(payload.latestDraftGeneration.output);
    if (payload?.latestValidation?.validation) renderValidation(payload.latestValidation.validation);
  }
```

In `extractBlogFormulaV2`, after a successful extract, refresh the library via GET. Replace the success tail (the `setMessage(...); return payload;` near line 396-397) with:

```js
      const model = payload.provider?.model || payload.formulaSet?.model || '-';
      setMessage(`Blog Formula V2 추출이 완료되었습니다. (모델 ${model})`);
      await loadBlogFormulaV2();
      return payload;
```

At the bottom, after the existing `window.validateBlogFormulaV2Draft = ...;` (line 507), expose the new handlers:

```js
  window.applyTopicBriefSet = applyTopicBriefSet;
  window.extendTopicBriefSetLibrary = extendTopicBriefSetLibrary;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd poc-server && npx vitest run test/blogFormulaV2Page.test.ts`
Expected: PASS (all existing + 2 new cases).

- [ ] **Step 6: Run the full suite + type check**

Run: `cd poc-server && npx tsc --noEmit -p tsconfig.json && npx vitest run`
Expected: tsc clean; all test files pass (no regressions).

- [ ] **Step 7: Commit**

```bash
git add web/07_마케팅전략룰셋.html web/blog_formula_v2.js poc-server/test/blogFormulaV2Page.test.ts
git commit -m "feat: add topic brief library dropdown and extend button to V2 UI"
```

---

## Task 10: Handoff doc update

**Files:**
- Modify: `docs/BLOG_FORMULA_V2_HANDOFF.md`

- [ ] **Step 1: Add a "Topic Brief Library" section**

At the end of `docs/BLOG_FORMULA_V2_HANDOFF.md`, add a section documenting:
- Purpose: per-store library of reusable Topic Brief sets mined from owner-blog-post history (1 post = 1 set), grouped by topic in the UI.
- New table `v2_blog_topic_brief_sets` (one row per post per formula set, `UNIQUE(formula_set_id, source_post_id)`).
- SL-F2 call: `topicBriefSetPrompt.ts` + providers (`openAITopicBriefSetProvider`, `safeMockTopicBriefSetProvider`, factory); deterministic path uses `buildHeuristicTopicBriefSets`.
- Batching: first batch of 10 on `/extract` (best-effort, non-fatal); `POST /topic-brief-sets/extend` mines the next 10 by recency, appends/merges, reuses the original provider mode (resolved from the formula run via `getTopicBriefSetProviderModeForStore`).
- Payload: `topicBriefSets` + `status.topicBriefSetRemainingCount`.
- UI: single dropdown (topic + angle summary, same-topic entries numbered ①②③) fills the 소재 Brief form; "더 많은 블로그에서 포뮬라 생성" button shown while remaining > 0.
- Test coverage: list the new test files added in Tasks 1-9.

Write concrete prose (no placeholders), matching the style of the existing "Self-Introduction Pattern Library" section.

- [ ] **Step 2: Commit**

```bash
git add docs/BLOG_FORMULA_V2_HANDOFF.md
git commit -m "docs: document the topic brief library feature"
```

---

## Self-Review

**Spec coverage:**
- Data model (`TopicBriefSetV2` + table + repository) → Tasks 1, 2.
- SL-F2 extraction (prompt, OpenAI + heuristic + safe_mock + factory) → Tasks 3, 4, 5, 6.
- Batching/extend (first batch on extract, next batches via endpoint, provider-mode reuse, best-effort errors) → Tasks 7, 8.
- API (`GET` payload fields, `POST /topic-brief-sets/extend`) → Tasks 7, 8.
- UI (single dropdown with grouped numbering, form auto-fill, extend button by remaining count) → Task 9.
- Rollout/migration (idempotent schema) → Task 1.
- Docs → Task 10.

All spec sections map to tasks.

**Note on a spec deviation (intentional):** the spec said the service `extract*` functions call extend; the plan instead orchestrates the first batch in the `/extract` route (Task 8). Rationale: the deterministic `extractBlogFormulaV2` is synchronous and providers are constructed with factory options that only exist at the route layer; doing it in the route avoids an async ripple across many existing callers and keeps provider construction in one place. The behavioral requirement (first batch auto-populated on extraction) is preserved. Update the spec's "First batch on extraction" bullet to reflect this if strict spec/plan parity is required.

**Type consistency:** `TopicBriefSetCandidate` (no `id`) is produced by providers/heuristic and consumed by `extendBlogFormulaV2TopicBriefSets`, which assigns the persisted id and serializes back to `TopicBriefSetV2` via `serializeTopicBriefSet`. Provider interface (`extractTopicBriefSets`), factory (`createTopicBriefSetProviderForMode`), prompt builder (`buildTopicBriefSetV2PromptInput`), and constants (`TOPIC_BRIEF_SET_BATCH_SIZE`, `BLOG_TOPIC_BRIEF_SET_V2_CALL_ID`) are referenced with identical names across tasks. `getTopicBriefSetProviderModeForStore` returns a mode the factory accepts.

**Placeholder scan:** no TBD/TODO; every code step shows complete code; the only prose-only step is Task 10 (a docs section), which lists exact content to write.
