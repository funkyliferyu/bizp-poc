# Naver Place Import Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich `soho_store_register.html` from one stored Naver Place snapshot, filling currently available form fields and preserving extra Place data for later Store Learning screens.

**Architecture:** Keep all Naver access server-side in `poc-server`. On first import, store the rendered Place snapshot and parsed enrichment under `stores.metadata_json`; subsequent reads and form population use the saved store metadata instead of re-calling Naver. Freshness/diff refresh is explicitly deferred.

**Tech Stack:** TypeScript, Express, SQLite JSON metadata, Vitest, static HTML/JS.

---

## Scope Rules

- Do not redesign `web/soho_store_register.html`.
- Do not modify `admin/`, `pc-web/`, or Event-to-Operation files.
- Do not add browser-side Naver calls.
- Do not add Naver/OpenAI write actions.
- Preserve mock mode.
- Use `stores.metadata_json` for this step; do not add a new table until snapshot refresh/versioning is required.

## Current Data Flow Decision

Yes: the desired flow is “fetch/render once, save internally, parse/use internally.”

Implementation rule:

1. `POST /api/stores/import-place` may call Naver/provider only when importing a Place URL.
2. The returned `store.metadata` must include:
   - `naverPlaceSnapshot`: raw-ish captured source envelope, intentionally bounded.
   - `naverPlaceParsed`: normalized fields used by UI/learning.
   - `naverPlaceImportedAt`: ISO timestamp.
3. `GET /api/stores/:storeId` must not call Naver. It only returns saved DB data.
4. `web/soho_store_register.js` must populate fields from the saved `store` response.
5. Freshness checks, diffing, re-fetch prompts, and scheduled refresh are future work.

## File Structure

- Modify `poc-server/src/storeLearning/providers/naverPlaceRenderedProvider.ts`
  - Add normalized Place enrichment fields to `RenderedPlaceProfile`.
  - Parse business hours, break time, closed days, parking, homepage/social URL, facilities, menus, menu images, review stats, broadcast info, keywords, and booking URL from Apollo state.
  - Save bounded snapshot/parsed metadata.
- Modify `poc-server/test/naverPlaceRenderedProvider.test.ts`
  - Add fixture assertions for UI-fill fields and metadata-only enrichment.
  - Add cache/no-refetch expectations at route level if route test location is better.
- Modify `web/soho_store_register.js`
  - Populate `f-open`, `f-close`, `f-break1`, `f-break2`, closed day checkboxes, parking radio, and parking note from metadata.
  - Mark autofilled radio/checkbox fields with a class.
  - Keep business number and email manual-only.
- Modify `web/soho_store_register.html`
  - Add only minimal `data-autofill-group` attributes/classes if needed for radio/checkbox background state.
- Modify `poc-server/test/storeRegistrationPage.test.ts`
  - Assert page JS maps new metadata keys and marks imported controls.
- Modify `docs/codex/HANDOFF.md`
  - Add operating notes for stored snapshot reuse and available Place fields.
- Modify `docs/codex/VALIDATION.md`
  - Add validation commands and manual smoke result.

## Data Shape

Store this in `store.metadata`:

```ts
type NaverPlaceParsed = {
  placeIntro: string | null;
  aiSummary: string | null;
  openTime: string | null;
  closeTime: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  closedDays: string[];
  parking: 'y' | 'n' | 'near' | null;
  parkingNote: string | null;
  homepageUrl: string | null;
  homepageType: string | null;
  facilities: string[];
  paymentInfo: string[];
  menuItems: Array<{ name: string; price: string | null; description: string | null }>;
  menuImageUrls: string[];
  placeImageUrls: string[];
  reviewStats: {
    rating: number | null;
    visitorReviewCount: number | null;
    blogReviewCount: number | null;
    visitorTextReviewCount: number | null;
  };
  broadcastInfos: Array<{ channel: string | null; program: string | null; date: string | null; menu: string | null }>;
  keywords: string[];
  bookingUrl: string | null;
};

type NaverPlaceSnapshot = {
  finalUrl: string;
  capturedAt: string;
  renderer: string;
  apolloStateAvailable: boolean;
  bodyTextAvailable: boolean;
  htmlHash: string;
  sourceSize: { htmlBytes: number; bodyTextBytes: number };
  apolloState: {
    base: unknown;
    detail: unknown;
  } | null;
};
```

Do not store the full HTML blob in SQLite in this PR. Store `htmlHash`, source size metadata, and the Apollo `base`/`detail` source records needed to re-parse the current registration/learning fields without another Naver call. If later full offline replay is required, add a separate snapshot table/file store.

## Task 1: Provider Enrichment Parser

**Files:**
- Modify: `poc-server/src/storeLearning/providers/naverPlaceRenderedProvider.ts`
- Test: `poc-server/test/naverPlaceRenderedProvider.test.ts`

- [ ] **Step 1: Write failing provider test**

Add an Apollo fixture detail record with:

```ts
'newBusinessHours({"format":"restaurant"})': [
  {
    __typename: 'NewBusinessHour',
    businessHours: [
      {
        __typename: 'WorkingHoursInfo',
        day: '월',
        businessHours: { start: '11:20', end: '22:00' },
        breakHours: [{ start: '15:00', end: '17:00' }]
      }
    ],
    comingRegularClosedDays: '화'
  }
],
'informationTab({"providerSource":["pbp"]})': {
  __typename: 'InformationTab',
  parkingInfo: {
    __typename: 'InformationParking',
    description: '광진광장공영주차장에 주차 가능합니다.',
    basicParking: null,
    valetParking: null
  },
  facilities: [{ __ref: 'InformationFacilities:13' }],
  keywordList: ['숙성회', '군자횟집']
},
homepages: {
  __typename: 'Homepage',
  repr: {
    __typename: 'HomepageRepr',
    url: 'https://www.instagram.com/forebus_jubong',
    type: '인스타그램'
  }
},
menuImages: [{ __typename: 'MenuImage', imageUrl: 'https://ldb-phinf.pstatic.net/menu.png' }],
broadcastInfos: [{ __typename: 'BroadcastInfo', channel: 'KBS2', program: '2TV생생정보', date: '26.01.09.', menu: '해물조림' }],
'naverBooking({"bookingType":"restaurant"})': {
  __typename: 'PlaceDetailNaverBooking',
  naverBookingUrl: 'https://m.booking.naver.com/booking/6/bizes/1352276'
}
```

Expected assertion:

```ts
expect(profile).toEqual(
  expect.objectContaining({
    openTime: '11:20',
    closeTime: '22:00',
    breakStart: '15:00',
    breakEnd: '17:00',
    closedDays: ['tue'],
    parking: 'near',
    parkingNote: '광진광장공영주차장에 주차 가능합니다.',
    homepageUrl: 'https://www.instagram.com/forebus_jubong',
    homepageType: '인스타그램',
    keywords: ['숙성회', '군자횟집'],
    bookingUrl: 'https://m.booking.naver.com/booking/6/bizes/1352276'
  })
);
```

- [ ] **Step 2: Run failing test**

Run:

```bash
cd poc-server
npm test -- naverPlaceRenderedProvider.test.ts
```

Expected: fail because enrichment fields are not present.

- [ ] **Step 3: Implement minimal parser helpers**

Add helpers:

```ts
function dayValue(koreanDay: string) {
  return ({ 월: 'mon', 화: 'tue', 수: 'wed', 목: 'thu', 금: 'fri', 토: 'sat', 일: 'sun', 공휴일: 'hol' } as const)[
    koreanDay as '월' | '화' | '수' | '목' | '금' | '토' | '일' | '공휴일'
  ] ?? null;
}

function firstTimeRange(value: unknown) {
  const record = asRecord(value);
  const start = cleanText(record?.start ?? record?.from ?? record?.startTime);
  const end = cleanText(record?.end ?? record?.to ?? record?.endTime);
  return start && end ? { start, end } : null;
}
```

Then extract normalized `openTime`, `closeTime`, `breakStart`, `breakEnd`, `closedDays`, `parking`, `parkingNote`, `homepageUrl`, `homepageType`, `keywords`, `bookingUrl`, `menuImageUrls`, `broadcastInfos`, `paymentInfo`, and `reviewStats`.

- [ ] **Step 4: Run provider test**

Run:

```bash
cd poc-server
npm test -- naverPlaceRenderedProvider.test.ts
```

Expected: pass.

## Task 2: Save Snapshot And Parsed Metadata

**Files:**
- Modify: `poc-server/src/storeLearning/providers/naverPlaceRenderedProvider.ts`
- Test: `poc-server/test/naverPlaceRenderedProvider.test.ts`

- [ ] **Step 1: Write failing metadata test**

Add assertion to import test:

```ts
expect(imported.store.metadata).toEqual(
  expect.objectContaining({
    naverPlaceImportedAt: expect.any(String),
    naverPlaceSnapshot: expect.objectContaining({
      finalUrl: placeUrl,
      apolloStateAvailable: true,
      bodyTextAvailable: false,
      htmlHash: expect.any(String)
    }),
    naverPlaceParsed: expect.objectContaining({
      openTime: '11:20',
      closeTime: '22:00',
      parking: 'near',
      homepageUrl: 'https://www.instagram.com/forebus_jubong'
    })
  })
);
```

- [ ] **Step 2: Run failing test**

Run:

```bash
cd poc-server
npm test -- naverPlaceRenderedProvider.test.ts
```

Expected: fail because `naverPlaceSnapshot` and `naverPlaceParsed` are not stored yet.

- [ ] **Step 3: Implement metadata save**

In `importWithNaverPlaceRenderedProvider`, add:

```ts
const apolloStateAvailable = Boolean(extractNaverApolloState(snapshot.html));
const capturedAt = new Date().toISOString();
const naverPlaceParsed = {
  placeIntro: profile.placeIntro,
  aiSummary: profile.aiSummary,
  openTime: profile.openTime,
  closeTime: profile.closeTime,
  breakStart: profile.breakStart,
  breakEnd: profile.breakEnd,
  closedDays: profile.closedDays,
  parking: profile.parking,
  parkingNote: profile.parkingNote,
  homepageUrl: profile.homepageUrl,
  homepageType: profile.homepageType,
  facilities: profile.facilities,
  paymentInfo: profile.paymentInfo,
  menuItems: profile.menuItems,
  menuImageUrls: profile.menuImageUrls,
  placeImageUrls: profile.imageUrls,
  reviewStats: profile.reviewStats,
  broadcastInfos: profile.broadcastInfos,
  keywords: profile.keywords,
  bookingUrl: profile.bookingUrl
};
```

Store `naverPlaceSnapshot`, `naverPlaceParsed`, and `naverPlaceImportedAt` in metadata.

- [ ] **Step 4: Run provider tests**

Run:

```bash
cd poc-server
npm test -- naverPlaceRenderedProvider.test.ts
```

Expected: pass.

## Task 3: Populate Registration Form From Saved Metadata

**Files:**
- Modify: `web/soho_store_register.js`
- Test: `poc-server/test/storeRegistrationPage.test.ts`

- [ ] **Step 1: Write failing page test**

Assert JS contains these mappings:

```ts
expect(js).toContain('const parsedPlace = metadata.naverPlaceParsed || metadata;');
expect(js).toContain("writeInput('f-open', parsedPlace.openTime");
expect(js).toContain("writeInput('f-close', parsedPlace.closeTime");
expect(js).toContain("writeInput('f-break1', parsedPlace.breakStart");
expect(js).toContain("writeInput('f-break2', parsedPlace.breakEnd");
expect(js).toContain('writeClosedDays(parsedPlace.closedDays');
expect(js).toContain('writeParking(parsedPlace.parking');
expect(js).toContain("writeInput('f-parking-note', parsedPlace.parkingNote");
```

- [ ] **Step 2: Run failing test**

Run:

```bash
cd poc-server
npm test -- storeRegistrationPage.test.ts
```

Expected: fail because JS still reads only top-level manual metadata defaults.

- [ ] **Step 3: Implement form population fallback**

In `populateStore(store)`:

```js
const metadata = store.metadata || {};
const parsedPlace = metadata.naverPlaceParsed || metadata;
writeInput('f-open', parsedPlace.openTime || metadata.openTime);
writeInput('f-close', parsedPlace.closeTime || metadata.closeTime);
writeInput('f-break1', parsedPlace.breakStart || metadata.breakStart);
writeInput('f-break2', parsedPlace.breakEnd || metadata.breakEnd);
writeInput('f-parking-note', parsedPlace.parkingNote || metadata.parkingNote);
writeClosedDays(parsedPlace.closedDays || metadata.closedDays);
writeParking(parsedPlace.parking || metadata.parking);
```

Keep `businessNumber` and `email` manual:

```js
writeInput('f-biz', metadata.businessNumber);
writeInput('f-email', metadata.email);
```

- [ ] **Step 4: Run page test**

Run:

```bash
cd poc-server
npm test -- storeRegistrationPage.test.ts
```

Expected: pass.

## Task 4: Autofill Background For Imported Controls

**Files:**
- Modify: `web/soho_store_register.html`
- Modify: `web/soho_store_register.js`
- Test: `poc-server/test/storeRegistrationPage.test.ts`

- [ ] **Step 1: Write failing test**

Assert:

```ts
expect(html).toContain('data-autofill-group="closed-days"');
expect(html).toContain('data-autofill-group="parking"');
expect(js).toContain('markAutofillGroup');
expect(js).toContain("markAutofillGroup('closed-days'");
expect(js).toContain("markAutofillGroup('parking'");
```

- [ ] **Step 2: Run failing test**

Run:

```bash
cd poc-server
npm test -- storeRegistrationPage.test.ts
```

Expected: fail because grouped controls are not marked yet.

- [ ] **Step 3: Add minimal group hooks**

In HTML:

```html
<div class="day-checks" data-autofill-group="closed-days">
...
<div class="radio-group" data-autofill-group="parking">
```

In JS:

```js
function markAutofillGroup(name, active) {
  const element = document.querySelector(`[data-autofill-group="${name}"]`);
  if (!element || !active) return;
  element.classList.add('autofilled');
}
```

Call it when imported values are present:

```js
markAutofillGroup('closed-days', Array.isArray(days) && days.length > 0);
markAutofillGroup('parking', Boolean(parking));
```

- [ ] **Step 4: Run page tests**

Run:

```bash
cd poc-server
npm test -- storeRegistrationPage.test.ts
```

Expected: pass.

## Task 5: Stored Data Reuse Contract

**Files:**
- Modify: `poc-server/test/storeRegistrationApi.test.ts`
- Optional Modify: `poc-server/src/storeLearning/routes/stores.ts`

- [ ] **Step 1: Write no-refetch contract test**

Add a test that imports once, then reads the store:

```ts
const first = await fetch(`${baseUrl}/api/stores/import-place`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ naverPlaceUrl: placeUrl })
});
expect(first.status).toBe(200);

const read = await fetch(`${baseUrl}/api/stores/store_1838952735`);
expect(read.status).toBe(200);
expect(rendererCalls).toHaveLength(1);
```

Use injected renderer endpoint/counter if the test owns route setup.

- [ ] **Step 2: Run API test**

Run:

```bash
cd poc-server
npm test -- storeRegistrationApi.test.ts naverPlaceRenderedProvider.test.ts
```

Expected: pass if current `GET /api/stores/:storeId` already only reads SQLite. If it fails, fix `serializeStore` to avoid provider calls.

## Task 6: Manual Smoke And Docs

**Files:**
- Modify: `docs/codex/HANDOFF.md`
- Modify: `docs/codex/VALIDATION.md`

- [ ] **Step 1: Run focused validation**

Run:

```bash
cd poc-server
npm test -- naverPlaceRenderedProvider.test.ts storeRegistrationPage.test.ts storeRegistrationApi.test.ts
npm run typecheck
```

Expected: all pass.

- [ ] **Step 2: Run full validation**

Run:

```bash
cd poc-server
npm test
npm run naver:verify
npm run demo:store-learning
```

Expected: all pass.

- [ ] **Step 3: Manual browser smoke**

Keep server running:

```bash
cd poc-server
PORT=5177 npm run dev
```

Open:

```text
http://localhost:5177/soho_store_register.html
```

Use:

```text
https://m.place.naver.com/place/1824807602/home
```

Expected:

- Store name, category, phone, address populated.
- Store intro contains Place intro plus `(AI요약정보)`.
- Operation time populated from Place data where available.
- Break time populated where available.
- Closed days checked only if Place data says closed.
- Parking radio set to `인근 유료 주차 가능` when parking text references public/paid nearby parking.
- Parking note contains Place parking guidance.
- Autofilled controls have the existing green background treatment.
- Refreshing the page uses saved store data; it does not call `/api/stores/import-place` again.

- [ ] **Step 4: Update docs**

In `docs/codex/HANDOFF.md`, add:

```md
PLACE-ENRICHMENT-001 stores one imported Naver Place snapshot envelope and parsed enrichment in `stores.metadata_json`. Registration GET flows reuse saved SQLite data and do not re-call Naver. Freshness/diff refresh is deferred.
```

In `docs/codex/VALIDATION.md`, add commands and manual smoke results.

## Commit Plan

Recommended commit:

```bash
git add poc-server/src/storeLearning/providers/naverPlaceRenderedProvider.ts \
  poc-server/test/naverPlaceRenderedProvider.test.ts \
  poc-server/test/storeRegistrationApi.test.ts \
  poc-server/test/storeRegistrationPage.test.ts \
  web/soho_store_register.html \
  web/soho_store_register.js \
  docs/codex/HANDOFF.md \
  docs/codex/VALIDATION.md \
  docs/superpowers/plans/2026-06-09-place-import-enrichment.md
git commit -m "feat: enrich store registration from saved place data"
```

Do not stage `.DS_Store`.

## Self-Review

- Spec coverage: one-time import reuse is covered by Task 2 and Task 5; direct fill fields are covered by Task 1 and Task 3; metadata-only future fields are covered by Task 1 and Task 2; visual autofill treatment is covered by Task 4.
- Placeholder scan: no `TBD` or implementation gaps are intentionally left inside the execution path.
- Type consistency: the plan uses `naverPlaceParsed` and `naverPlaceSnapshot` consistently across provider metadata, API response, and browser population.
