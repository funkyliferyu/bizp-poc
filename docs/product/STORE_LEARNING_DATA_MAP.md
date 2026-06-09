# Store Learning Data Map

## Purpose

This document is the Milestone 01 baseline for replacing static Store Learning UI samples with persisted Store Learning data.

It maps:

- data already available from recent Naver Place and Naver Blog work;
- browser screens that already call `poc-server` APIs;
- browser screens or screen sections that still contain static mock values;
- source rules for future automatic field population;
- the safest dependency order for later implementation milestones.

This is not a runtime implementation change. It is the planning source for the next Store Learning feature PRs.

## Recent Product PR Inputs

The relevant recent product PRs are:

| PR | Capability | Data now available |
| --- | --- | --- |
| #18 `feat: add owner source provider routing` | Owner-authorized Naver source policy and provider routing metadata | `sourcePolicy`, `sourceKind`, `sourceOwnership`, configured provider metadata, `bodyAvailability` |
| #19 `feat: add rendered naver place import` | Server-side rendered Naver Place profile import | Basic store profile, rendered Place profile metadata, `naverPlaceSnapshot`, `naverPlaceParsed` |
| #20 `feat: add rendered Naver Place review collection` | Server-side rendered Place visitor review collection | Place visitor review collection items, owner reply text, review keywords, media flags, source metadata |
| #21 `feat: add rendered Naver Blog body collection` | Server-side rendered/page Blog body collection | Blog post collection items with title, body text, author/date/tags/image URLs/source URL metadata |
| #23 `feat: harden naver rendered store learning flow` | Provider hardening, metadata UI, RAW/RAG hooks, business-hours sync | Short URL handling, richer Place metadata, RAW viewer, RAG DOCX hooks, weekly business hours, image normalization |

PRs #24 and #25 are Pages/root-entry publication work. They are not product data inputs for this map.

## Source Tiers

### Place Immediate

These fields can be filled from persisted `stores` columns and `stores.metadata.naverPlaceParsed` without new external calls:

| Field group | Current source | Notes |
| --- | --- | --- |
| Store identity | `stores.name`, `stores.category`, `stores.address`, `stores.phone`, `stores.naverPlaceUrl`, `stores.naverPlaceId` | Available after Place import or manual save. |
| Introduction | `naverPlaceParsed.placeIntro`, `naverPlaceParsed.aiSummary`, `stores.description` | Owner intro should be preferred. AI summary can be shown as a labeled secondary signal. |
| Hours | `naverPlaceParsed.weeklyBusinessHours`, scalar open/close/break fields | Weekly rows are the durable source. Scalar fields are display fallbacks. |
| Closed days | `weeklyBusinessHours.closed`, `closedDays` | Should flow into registration and ruleset store-info fields. |
| Parking/facilities | `parking`, `parkingNote`, `facilities`, `paymentInfo`, `conveniences` | Mostly direct display; some labels need normalizing. |
| Links | `homepageUrl`, `externalLinks`, `bookingUrl`, `naverPlaceUrl` | Safe for display as links. |
| Menu | `menuItems`, `menuImageUrls` | Menu names/prices/descriptions are direct. Representative menu selection may need ranking. |
| Photos | `placeImageUrls`, `menuImageUrls` | Already normalized in provider and browser display code. |
| Review stats | `reviewStats.rating`, `visitorReviewCount`, `blogReviewCount`, `visitorTextReviewCount` | Direct counters for dashboard/status/ruleset context. |
| Broadcasts/keywords | `broadcastInfos`, `keywords` | Direct display; AI may later decide which matter for marketing strategy. |
| Raw Place data | `naverPlaceParsed`, `naverPlaceSnapshot`, full `metadata` | Already viewable through `store_raw_data.html`. |

### Blog Parser

These fields can be filled after Blog collection succeeds, without requiring AI judgment:

| Field group | Current source | Notes |
| --- | --- | --- |
| Blog URL | `store_channels.blog.sourceUrl`, training settings payload | Must be stable before collection reliability work. |
| Post identity | `collection_items.channel=blog`, `sourceType=post`, `title`, `sourceUrl` | Already feeds selection and learning status list views. |
| Post body | `collection_items.bodyText` with `metadata.bodyAvailability=rendered_blog_full_body` | Core input for style and SEO analysis. |
| Post metadata | Blog collection item metadata: author, published date, tags, image URLs, blogId, logNo when available | Useful for RAW viewer and rule evidence. |
| Post images | Blog item metadata image URL arrays | Direct inventory; image-style judgment still needs AI. |
| Collection quality | item `status`, `bodyAvailability`, failure reason metadata | Should be exposed in collection progress and RAW viewer. |

### AI Processing

These fields should be generated or summarized by deterministic mock analysis or OpenAI analysis from selected Place/Blog evidence:

| Field group | Existing field key or future field | Inputs | Notes |
| --- | --- | --- | --- |
| Store positioning | `storePositioning` | Place category/address/intro + Blog body + reviews | Already in analyzer output. Needs field mapping to all UI aliases. |
| Key strengths | `keyStrengths`, UI aliases `reviewStrength` | Place reviews + Blog claims + Place intro/menu | Existing field, but UI labels need source clarity. |
| Target customers | `targetCustomers` | Blog topic patterns + review language + category/location | Existing field. |
| Tone and manner | `toneAndManner` | Blog body style + desired safety policy | Existing field. |
| Blog writing style | `blogWritingStyle` | Blog bodies and generated-content constraints | Existing field. |
| SEO keywords | `seoKeywords`, UI alias `contentKeywords` | Blog title/body terms + Place menu/category/location | Existing field. |
| CTA style | `ctaStyle` | Place booking/link availability + Blog endings | Existing field. |
| Image direction | `imageDirection` | Place/menu images + Blog image metadata + category | Existing field. |
| Negative expressions | `negativeExpressions` | Safety policy + generated writing style analysis | Existing field. |
| Review weaknesses | future `reviewWeakness` | Place visitor reviews + AI summarization | UI has hook-like static content but analyzer schema does not yet output this field. |
| Representative menu | future `representativeMenus` or direct Place menu rule | Place menu list + review/blog frequency | Direct Place display is possible; marketing representative choice needs ranking. |
| Color/style rules | future image-style fields | Place images + menu images + AI vision/text proxy | Current UI is static. Requires explicit schema work. |

### Deferred

These should not be treated as available in the current PoC until a later provider or product decision exists:

| Area | Reason |
| --- | --- |
| Instagram actual collection | No real provider path is implemented; current status can be not-connected/mock only. |
| Real Naver Blog publishing | Official write API ended; current scope is approval/manual export/status, not direct publishing. |
| Place owner reply writes | Collection stores owner replies; write automation is out of scope. |
| Competitor collection | `07_마케팅전략룰셋.html` has comparison UI and fixture-style benchmark behavior, but no current real provider contract. |
| Real image generation | Current image generation is placeholder/OpenAI provider-dependent future work. |

## Current API-Backed Screen Map

| Product flow step | Browser files | Existing API/data use | Current state |
| --- | --- | --- | --- |
| 1. Store registration | `web/soho_store_register.html`, `web/soho_store_register.js` | `POST /api/stores/import-place`, `GET/PATCH/POST /api/stores`, `GET/POST /api/stores/:storeId/rag-documents`, `store_raw_data.html` | Strongest Place integration. Still has `사업자번호` as required in browser validation and visible static owner labels. |
| 2. AI training settings | `web/03_AI학습_온보딩.html`, `web/training_settings.js` | `GET /api/stores/:storeId`, `GET/PUT /api/stores/:storeId/training-settings`, `POST /api/stores/:storeId/collection-runs` | API-backed. Source URL persistence exists for Blog and Place. |
| 3. Collection progress | `web/04_AI학습_수집중.html`, `web/collection_progress.js` | `GET /api/collection-runs/:runId`, `GET /api/collection-runs/:runId/items`, `POST /api/collection-runs/:runId/start` | JS renders real items, but HTML has static fallback rows/counters that should be neutralized or replaced in a later milestone. |
| 4. Content selection | `web/05_AI학습_콘텐츠선택.html`, `web/content_selection.js` | `GET /api/collection-runs/:runId/selectable-items`, `PATCH /api/collection-items/:itemId/selection`, `POST /api/analysis-runs` | API-backed. Good candidate for Blog item RAW link after collection contract is stable. |
| 5. Learning status | `web/06_AI학습_현황.html`, `web/learning_status.js` | `GET /api/stores/:storeId/learning-status`, `/blog`, `/place`, `/instagram` | JS renders core lists/counters, but HTML still contains large Place/menu/photo/review/news static fallback sections. Completion semantics need tightening. |
| 6. Marketing ruleset | `web/07_마케팅전략룰셋.html`, `web/ruleset_editor.js` | `GET /api/stores/:storeId/ruleset`, field save/reset/evidence APIs | Some field hooks exist. Many visible values remain static and some UI fields lack analyzer field keys. |
| 7. Blog management | `web/02_블로그관리.html`, `web/blog_posts.js` | `GET /api/stores/:storeId/blog-posts`, `POST /api/stores/:storeId/blog-posts/generate` | API-backed list/generation hooks exist. Static scheduling/status copy remains in HTML. |
| 8. Content detail | `web/09_AI콘텐츠생성_상세.html`, `web/content_detail.js` | `GET /api/blog-posts/:postId`, regenerate text/images, SEO score, preview, request publish | API-backed detail actions exist. HTML has static article/SEO fallback content. |

## Static Mock Inventory And Priority

| Priority | Screen/area | Static examples found | Replacement source | Future milestone |
| --- | --- | --- | --- | --- |
| P0 | Store registration required fields | `사업자번호 *`, `f-biz` in required arrays | Product rule: business number optional | Milestone 02 |
| P0 | Training to collection contract | Blog/Place URL and limits | `store_channels`, training settings, collection plan | Milestone 03 |
| P0 | Blog collection reliability | Need guaranteed collected Blog body items | Rendered/page/RSS/explicit URL provider pipeline | Milestone 04 |
| P1 | Collection progress fallback rows | `48개 수집`, sample cake post rows | `collection_items` from run | Milestone 04/05 |
| P1 | Blog RAW viewer | Only Place RAW sections exist | Collection item aggregation for `channel=blog` | Milestone 05 |
| P1 | Ruleset field table | Static positioning/menu/review weakness/style/color fields | Analyzer output + Place immediate fields + Blog parser data | Milestone 06/07 |
| P1 | Learning status Place tab | Static category/address/menu/photos/review stats/news | `learningStatusService`, `naverPlaceParsed`, collection items | Milestone 08 |
| P2 | Dashboard | `맛있는 떡볶이`, static schedule/status/cards | Store, learning status, blog posts | Later follow-up |
| P2 | Blog management scheduling copy | Static dates and examples | Blog post API + future schedule policy | Later follow-up |
| P2 | Content detail fallback article/SEO | Static cake article and 84 score | Blog post detail API already available | Later follow-up |
| P3 | State variant pages | `06_AI학습_현황_수집실패.html`, `분석실패`, `재학습중` static samples | Either generated from same API or kept as reference-only screens | Decide after main status page stabilizes |

## Screen-Specific Replacement Notes

### Store Registration

Current strengths:

- Place import calls only `poc-server`.
- Saved `naverPlaceParsed` renders Place metadata, menus, images, RAW button, RAG document hooks, and weekly hours.

Next changes:

- Make `사업자번호` optional in visible label and browser validation.
- Keep business number as manual-only metadata if saved; do not try to infer it from Place.
- Use this screen as the authoritative source for saved Store profile edits.

### Training Settings

Current strengths:

- Loads channel source URLs from `GET /api/stores/:storeId`.
- Saves Blog/Place/Instagram/Daangn source URLs and limits to training settings and channels.

Next changes:

- Verify Blog URL source priority is explicit: saved channel URL, then Place external Blog link, then manual entry.
- Keep Daangn/Instagram as stored future inputs only unless providers are added.

### Collection Progress

Current strengths:

- Starts collection run and polls real run/items.
- Uses collected item counts for channel progress.

Next changes:

- Harden Blog collection before changing the UX deeply.
- Replace or remove static fallback rows once provider behavior is stable.
- Show failure reasons from item metadata without leaking provider internals or secrets.

### Content Selection

Current strengths:

- Lists selectable collected items from the selected run.
- Persists user selection before analysis.

Next changes:

- Add Blog RAW access after Blog collection item shape is stable.
- Consider showing body availability badges, such as full body, snippet-only, unavailable.

### Learning Status

Current strengths:

- Calls learning-status APIs for overview, Blog, Place, and Instagram.
- Shows ruleset CTA when a ruleset exists.

Next changes:

- Define learning completion as Blog collection, Place refresh, analysis completion, and ruleset generation.
- Replace remaining static Place/menu/photo/review/news sections with API payload.
- Decide whether state variant HTML files remain reference-only or become API-backed.

### Marketing Ruleset

Current strengths:

- Loads ruleset fields and supports field save/reset/evidence.
- Store name/category/address are already API-populated.

Next changes:

- Add field keys for currently static fields that need automatic values.
- Split direct Place fields from AI ruleset fields:
  - store info is Place/manual data;
  - strategy/style/image fields are AI outputs with evidence;
  - representative menu may start direct from Place then later rank with Blog/review frequency.
- Add a visible or documented field source matrix: current implementation, better future method, note.

### Blog Management And Content Detail

Current strengths:

- Blog management and detail pages already call blog post APIs.
- Regenerate text/images, SEO score, preview, and publish-request hooks exist.

Next changes:

- Treat these as downstream of a stable ruleset.
- Do not prioritize these before Blog collection, analysis, and ruleset mapping are stable.

## Field Source Matrix

| Product field | Current best source | Direct now? | Needs AI? | Notes |
| --- | --- | --- | --- | --- |
| 상호명 | `stores.name` | Yes | No | Place import or manual save. |
| 업종/카테고리 | `stores.category`, `naverPlaceParsed.category` | Yes | No | Category normalization may be needed later. |
| 주소 | `stores.address` | Yes | No | Place import or manual save. |
| 연락처 | `stores.phone` | Yes | No | Direct Place/manual. |
| 사업자번호 | Manual metadata/form value | Optional | No | Must be non-required; not available from Place/Blog. |
| 운영시간 | `weeklyBusinessHours` | Yes | No | Use weekly rows first, scalar summary second. |
| 휴무일 | `weeklyBusinessHours.closed` | Yes | No | Direct. |
| 주차 | `parking`, `parkingNote`, Place facilities | Yes | Maybe | Direct label now; AI may later turn it into copy strategy. |
| 매장 소개 | `placeIntro`, `aiSummary`, `stores.description` | Yes | Maybe | Direct display; AI can summarize for positioning. |
| 대표 메뉴 | `menuItems` | Yes | Maybe | Direct listing now; representative ranking later. |
| 매장 사진 | `placeImageUrls` | Yes | Maybe | Direct display now; style interpretation later. |
| 메뉴판/메뉴 사진 | `menuImageUrls` | Yes | Maybe | Direct display now. |
| 리뷰 지표 | `reviewStats` | Yes | No | Direct counters. |
| 방문자 리뷰 본문 | Place review collection items | Yes after collection | Maybe | Direct display/RAW; AI for strengths/weaknesses. |
| 사장님 답글 | Place review metadata `ownerReplyText` | Yes after collection | Maybe | Useful for tone and CS policy. |
| 블로그 글 제목/본문 | Blog collection items | Yes after collection | Maybe | Direct display/RAW; AI for style/keywords. |
| 블로그 태그/이미지 | Blog item metadata | Yes after collection | Maybe | Useful for RAW and style analysis. |
| 포지셔닝 | Analyzer output `storePositioning` | No | Yes | Existing analyzer field. |
| 업체 주장 강점 | `keyStrengths` | No | Yes | Existing analyzer field. |
| 리뷰 강점 | `keyStrengths` or future `reviewStrength` | Partial | Yes | Current UI aliases overlap. Needs schema decision. |
| 리뷰 약점 | Future `reviewWeakness` | No | Yes | UI has static value; schema should be added later. |
| 타겟 고객 | `targetCustomers` | No | Yes | Existing analyzer field. |
| 콘텐츠 소재 키워드 | `seoKeywords` / `contentKeywords` | Partial | Yes | Existing field and alias. |
| 톤앤매너 | `toneAndManner` | No | Yes | Existing analyzer field. |
| 블로그 문장 스타일 | `blogWritingStyle` | No | Yes | Existing analyzer field. |
| CTA | `ctaStyle` | No | Yes | Existing analyzer field. |
| 이미지 무드 | `imageDirection` | No | Yes | Existing analyzer field. |
| 색상/비율/포맷/해시태그 세부 | Future schema fields | No | Yes | Static UI exists; schema expansion needed. |

## Dependency Order

Future milestones should proceed in this order:

1. Store registration cleanup and business-number optionality.
2. Training settings contract confirmation.
3. Blog collection reliability and fallback behavior.
4. Blog RAW viewer and selectable item evidence improvements.
5. Analyzer/ruleset field-key expansion and source matrix implementation.
6. Ruleset UI replacement.
7. Learning status completion semantics and display replacement.
8. Blog management/content detail downstream cleanup.
9. Dashboard and state-variant/reference screen cleanup.

Do not implement ruleset or learning-status completion before Blog collection reliability is stable. Do not edit `docs/codex/HANDOFF.md` and `docs/codex/VALIDATION.md` from multiple milestone branches at the same time because those files have already been conflict-prone.

## Validation Baseline For This Milestone

This milestone is documentation-only. Required validation:

```bash
test -f docs/codex/MILESTONE_01_DATA_MAP_PLAN.md
test -f docs/product/STORE_LEARNING_DATA_MAP.md
rg -n "Place Immediate|Blog Parser|AI Processing|사업자번호|RAW data|룰셋" docs/codex/MILESTONE_01_DATA_MAP_PLAN.md docs/product/STORE_LEARNING_DATA_MAP.md
git diff --check
```

Full runtime tests are not required for this documentation-only milestone.
