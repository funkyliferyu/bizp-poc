# Store Learning & Blog Content Automation PoC

## Purpose

The new product flow is the Store Learning & Blog Content Automation PoC. It helps a store register from a Naver Place URL, collect Naver Blog and Naver Place signals, select content for AI analysis, generate an editable marketing strategy ruleset, and manage AI-generated blog posts through approval, preview, SEO scoring, and regeneration actions.

This is not the old Event-to-Operation / watermelon event flow. `README_POC.md` and `web/event_operation_poc.html` are not product source-of-truth files for this work.

## Flow

1. Store registration from Naver Place URL.
2. AI training settings using Naver Blog and Naver Place.
3. Collection run progress screen.
4. Select collected content for analysis.
5. AI learning status screen with Blog, Place, Instagram tabs.
6. Editable marketing strategy ruleset.
7. Blog management showing AI-generated approval-pending posts.
8. AI content detail showing generated article, images, preview, SEO score, and regeneration actions.

## Product Rules

- Browser pages must call `poc-server` APIs only.
- Browser pages must not call Naver, OpenAI, or provider services directly.
- Naver/OpenAI credentials must stay server-side.
- Mock mode must work without external keys.
- Real Naver collection must run through provider adapters.
- Official Naver APIs are limited. Full Naver Blog body collection and Naver Place reviews require a separate provider/fallback design.
- LLM outputs must use Zod schemas and structured validation before being saved.
- Use SQLite as the local PoC DB, with a repository layer that can later move to Postgres.
- Keep existing Event-to-Operation files untouched.
- Do not modify `admin/` or `pc-web/`.
- Do not redesign existing HTML pages in this docs-only PR.

## Static Web Screen Responsibility Map

Future browser wiring should keep these files as static screens first and bind them to `poc-server` APIs later. The table maps every existing HTML file in `web/` to its future API/data responsibility.

| Static file | Current role | Future API/data responsibility |
| --- | --- | --- |
| `web/index.html` | Framed BizPlanet prototype shell. | Load `nav.html` and the selected `main` page only. No product data fetches except optional shell runtime status from `GET /api/runtime`. |
| `web/nav.html` | Sidebar navigation for agency, store, and marketing screens. | Navigation-only. May call `GET /api/stores/:storeId/summary` later for lightweight badges, but must not own product data. |
| `web/agency_dashboard.html` | Agency dashboard overview. | Future agency aggregation endpoint such as `GET /api/agency/dashboard`; outside first Store Learning behavior implementation. |
| `web/agency_member_biz.html` | Agency business account management. | Future account/admin service data such as `GET /api/agency/businesses`; out of scope for this PoC except selecting a store context. |
| `web/agency_member_staff.html` | Agency staff management. | Future staff management endpoint; out of scope for Store Learning PoC data. |
| `web/agency_list.html` | Agency store list and issue monitoring. | Future store list from `GET /api/agency/stores`, including learning status, blog approval counts, and issue flags. |
| `web/soho_dashboard.html` | Store-side dashboard. | Future store summary from `GET /api/stores/:storeId/dashboard`, including learning state and pending blog content counts. |
| `web/soho_member.html` | Store-side member/staff screen copy. | Future staff/member endpoint; out of scope for Store Learning PoC data. |
| `web/soho_store_register.html` | Store information registration with Naver Place URL entry. | Primary step 1. Use `POST /api/stores/from-place-url` to resolve a Place URL through provider adapters, then `PUT /api/stores/:storeId` for editable store fields, documents, and images. |
| `web/01_대시보드_온보딩전.html` | Marketing dashboard before AI learning. | Read onboarding state from `GET /api/stores/:storeId/learning-status`; link to learning settings when no successful analysis exists. |
| `web/01_대시보드.html` | Marketing dashboard after AI learning. | Read dashboard KPIs, strategy summary, recent generated posts, and learning status from `GET /api/stores/:storeId/marketing-dashboard`. |
| `web/02_블로그관리.html` | Blog management list with approval-pending and published rows. | Step 7. Use `GET /api/stores/:storeId/blog-posts?status=pending_approval,publish_requested,published,draft` and update post workflow actions through blog post APIs. |
| `web/03_AI학습_온보딩.html` | AI learning settings for Naver Blog, Naver Place, keywords, and store materials. | Step 2. Use `GET /api/stores/:storeId/learning-settings` and `PUT /api/stores/:storeId/learning-settings`; start collection with `POST /api/stores/:storeId/collection-runs`. |
| `web/04_AI학습_수집중.html` | Collection run progress and transition to content selection. | Step 3. Use `GET /api/collection-runs/:runId` for channel progress, errors, collected counts, and next action eligibility. |
| `web/05_AI학습_콘텐츠선택.html` | Select collected Blog/Place items for analysis. | Step 4. Use `GET /api/collection-runs/:runId/items`, `PUT /api/collection-runs/:runId/selections`, and `POST /api/collection-runs/:runId/analyze`. |
| `web/06_AI학습_현황.html` | Successful AI learning status with Blog, Place, Instagram tabs. | Step 5. Use `GET /api/stores/:storeId/learning-status` and `GET /api/stores/:storeId/learning-sources?channel=blog|place|instagram`. Instagram remains mock/manual until provider scope is defined. |
| `web/06_AI학습_현황_수집실패.html` | Collection failure state. | Read failed run details from `GET /api/collection-runs/:runId`; retry failed channels with `POST /api/collection-runs/:runId/retry`. |
| `web/06_AI학습_현황_분석실패.html` | Analysis/ruleset generation failure state. | Read analysis job failure from `GET /api/analysis-jobs/:jobId`; retry ruleset generation with `POST /api/analysis-jobs/:jobId/retry`. |
| `web/06_AI학습_현황_재학습중.html` | Relearning in-progress state. | Read active run and analysis progress from `GET /api/stores/:storeId/learning-status`; keep polling through server APIs only. |
| `web/07_마케팅전략룰셋.html` | Editable marketing strategy ruleset and competitor evidence UI. | Step 6. Use `GET /api/stores/:storeId/strategy-ruleset`, `PUT /api/stores/:storeId/strategy-ruleset`, `POST /api/stores/:storeId/strategy-ruleset/regenerate-preview`, and provider-backed benchmark evidence endpoints. Replace `strategy_benchmark_fixture.json` with API data during implementation. |
| `web/08_AI콘텐츠생성_목록.html` | AI content generation list. | Future generated content queue from `GET /api/stores/:storeId/content-generations`; can feed blog detail pages but is secondary to blog management. |
| `web/09_AI콘텐츠생성_상세.html` | AI content detail with article, images, preview, SEO score, and actions. | Step 8. Use `GET /api/blog-posts/:postId`, `PUT /api/blog-posts/:postId/draft`, `POST /api/blog-posts/:postId/regenerate-article`, `POST /api/blog-posts/:postId/regenerate-images`, `POST /api/blog-posts/:postId/seo-score`, and publish request endpoints. |
| `web/10_블로그_발행대기_상세.html` | Blog publish-request detail for pending publishing. | Use `GET /api/blog-posts/:postId`, `POST /api/blog-posts/:postId/copy-payload`, and `POST /api/blog-posts/:postId/mark-published` when agency workflow is simulated. |
| `web/11_블로그_발행완료_상세.html` | Published blog post detail. | Use `GET /api/blog-posts/:postId` with published URL, published timestamp, final article, selected images, SEO score, and external blog link. |
| `web/event_operation_poc.html` | Legacy Event-to-Operation / watermelon event PoC. | Out of scope for the new flow. No new Store Learning API ownership. Keep untouched and do not use as product source of truth. |

## Open Product Decisions

- Which Naver collection providers are approved for full blog body and Place review collection.
- Whether Instagram is mock-only for this PoC or requires a separate provider adapter.
- Whether publishing is simulated as approval workflow only or integrated with a publishing partner.
- Which SEO scoring rubric is deterministic, LLM-assisted, or hybrid.

