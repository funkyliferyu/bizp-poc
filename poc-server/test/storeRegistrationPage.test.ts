import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('..');
const webRoot = path.join(repoRoot, 'web');

describe('store registration static page API wiring', () => {
  it('loads a page-specific store registration script without redesigning the page shell', () => {
    const html = readFileSync(path.join(webRoot, 'soho_store_register.html'), 'utf8');

    expect(html).toContain('id="place-url"');
    expect(html).toContain('id="f-name"');
    expect(html).toContain('id="f-addr1"');
    expect(html).toContain('id="f-desc"');
    expect(html).toContain('id="place-fetch-btn"');
    expect(html).toContain('id="store-submit-btn"');
    expect(html).toContain('soho_store_register.js');
  });

  it('exposes saved Naver Place raw data through a server-backed viewer only', () => {
    const html = readFileSync(path.join(webRoot, 'soho_store_register.html'), 'utf8');
    const rawHtml = readFileSync(path.join(webRoot, 'store_raw_data.html'), 'utf8');
    const rawJs = readFileSync(path.join(webRoot, 'store_raw_data.js'), 'utf8');

    expect(html).toContain('id="raw-data-button"');
    expect(html).toContain('id="rag-generate-button"');
    expect(html).toContain('id="rag-doc-status"');
    expect(html).toContain('id="rag-info-download"');
    expect(html).toContain('id="rag-reviews-download"');
    expect(html).toContain('store_raw_data.html?storeId=');
    expect(html).toMatch(/id="place-metadata-section"[\s\S]*form-section-header[\s\S]*id="raw-data-button"/);
    expect(rawHtml).toContain('id="raw-section-tabs"');
    expect(rawHtml).toContain('id="raw-json"');
    expect(rawHtml).toContain('json-key');
    expect(rawHtml).toContain('json-string');
    expect(rawHtml).toContain('json-number');
    expect(rawHtml).toContain('json-null');
    expect(rawHtml).toContain('store_raw_data.js');
    expect(rawJs).toContain('section=naverPlaceParsed');
    expect(rawJs).toContain('function highlightJson');
    expect(rawJs).toContain('pre.innerHTML = highlightJson(json)');
    expect(rawJs).toContain('pre.dataset.rawJson = json');
    expect(rawJs).toContain('naverPlaceSnapshot');
    expect(rawJs).toContain('fetch(`/api/stores/${storeId}`');
    expect(rawJs).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(rawJs).not.toContain('sqlite3');
    expect(rawJs).not.toContain('NAVER_CLIENT');
    expect(rawJs).not.toContain('OPENAI');
  });

  it('calls only poc-server store APIs from browser code', () => {
    const js = readFileSync(path.join(webRoot, 'soho_store_register.js'), 'utf8');

    expect(js).toContain("fetch('/api/stores/import-place'");
    expect(js).toContain("fetch('/api/stores'");
    expect(js).toContain('fetch(`/api/stores/${storeId}`');
    expect(js).toContain('fetch(`/api/stores/${currentStoreId}/rag-documents/generate`');
    expect(js).toContain('fetch(`/api/stores/${currentStoreId}/rag-documents`');
    expect(js).toContain('refreshReviews: true');
    expect(js).toContain('reviewLimit: 100');
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });

  it('opens an existing store from query params and can focus the parking controls', () => {
    const html = readFileSync(path.join(webRoot, 'soho_store_register.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'soho_store_register.js'), 'utf8');

    expect(html).toContain('data-autofill-group="parking"');
    expect(html).toContain('id="f-parking-note"');
    expect(js).toContain('function params');
    expect(js).toContain('function initialStoreId');
    expect(js).toContain("params().get('storeId')");
    expect(js).toContain("window.localStorage.getItem(STORAGE_KEY)");
    expect(js).toContain("window.localStorage.setItem(STORAGE_KEY, storeId)");
    expect(js).toContain('function focusStoreRegistrationSection');
    expect(js).toContain("params().get('focus') === 'parking'");
    expect(js).toContain("focusStoreRegistrationSection('parking')");
    expect(js).toContain('scrollIntoView');
    expect(js).toContain("field('f-parking-note')");
    expect(js).toContain('fetch(`/api/stores/${storeId}`');
  });

  it('shows button-level loading state for slower store registration actions', () => {
    const js = readFileSync(path.join(webRoot, 'soho_store_register.js'), 'utf8');

    expect(js).toContain('function setButtonBusy');
    expect(js).toContain('class="spinner"');
    expect(js).toContain("setButtonBusy(field('place-fetch-btn'), true");
    expect(js).toContain("setButtonBusy(field('store-submit-btn'), true");
  });

  it('shows a post-save action modal that can jump to AI training settings', () => {
    const html = readFileSync(path.join(webRoot, 'soho_store_register.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'soho_store_register.js'), 'utf8');

    expect(html).toContain('id="store-save-modal"');
    expect(html).toContain('id="go-training-settings-btn"');
    expect(html).toContain('AI 학습 설정으로 바로가기');
    expect(js).toContain('function showStoreSaveModal');
    expect(js).toContain('function goToTrainingSettings');
    expect(js).toContain('03_AI학습_온보딩.html');
    expect(js).toContain('showStoreSaveModal()');
    expect(js).not.toContain("alert('매장이 등록됐어요! AI 학습을 시작할 수 있어요.')");
  });

  it('treats business number as optional in browser validation', () => {
    const html = readFileSync(path.join(webRoot, 'soho_store_register.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'soho_store_register.js'), 'utf8');

    expect(html).toContain('<label>사업자번호</label>');
    expect(html).not.toContain('<label>사업자번호 <span class="req">*</span></label>');
    expect(js).toContain("const required = ['f-type', 'f-name', 'f-tel', 'f-addr1', 'f-open', 'f-close']");
    expect(js).not.toContain("const required = ['f-type', 'f-name', 'f-biz'");
    expect(html).not.toContain("const required = ['f-type', 'f-name', 'f-biz'");
  });

  it('keeps imported Place categories visible even when the category is not in the static list', () => {
    const js = readFileSync(path.join(webRoot, 'soho_store_register.js'), 'utf8');

    expect(js).toContain('data-imported-category');
    expect(js).toContain('불러온 업종');
  });

  it('populates registration fields from saved Naver Place parsed metadata', () => {
    const js = readFileSync(path.join(webRoot, 'soho_store_register.js'), 'utf8');

    expect(js).toContain('let currentStore');
    expect(js).toContain('const parsedPlace = metadata.naverPlaceParsed || metadata;');
    expect(js).toContain('renderPlaceMetadata(metadata)');
    expect(js).toContain('renderMenuSection(parsedPlace)');
    expect(js).toContain("writeCategory(store.category");
    expect(js).toContain("writeInput('f-desc', store.description");
    expect(js).toContain("writeInput('f-open', parsedPlace.openTime");
    expect(js).toContain("writeInput('f-close', parsedPlace.closeTime");
    expect(js).toContain("writeInput('f-break1', parsedPlace.breakStart");
    expect(js).toContain("writeInput('f-break2', parsedPlace.breakEnd");
    expect(js).toContain('writeClosedDays(parsedPlace.closedDays');
    expect(js).toContain('writeWeeklyBusinessHours(parsedPlace');
    expect(js).toContain('writeParking(parsedPlace.parking');
    expect(js).toContain("writeInput('f-parking-note', parsedPlace.parkingNote");
  });

  it('supports editing day-specific business hours in a modal from imported Place data', () => {
    const html = readFileSync(path.join(webRoot, 'soho_store_register.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'soho_store_register.js'), 'utf8');

    expect(html).toContain('id="business-hours-config-btn"');
    expect(html).toContain('onclick="openBusinessHoursModal()"');
    expect(html).toContain('id="business-hours-modal"');
    expect(html).toContain('id="business-hours-rows"');
    expect(html).toContain('saveBusinessHoursModal()');
    expect(js).toContain('let currentWeeklyBusinessHours');
    expect(js).toContain('function normalizeWeeklyBusinessHours');
    expect(js).toContain('function writeWeeklyBusinessHours');
    expect(js).toContain('function renderBusinessHoursModalRows');
    expect(js).toContain('function openBusinessHoursModal');
    expect(js).toContain('function saveBusinessHoursModal');
    expect(js).toContain('weeklyBusinessHours: currentWeeklyBusinessHours');
  });

  it('keeps main business hour fields and day-specific modal rows logically synchronized', () => {
    const html = readFileSync(path.join(webRoot, 'soho_store_register.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'soho_store_register.js'), 'utf8');

    expect(html).toContain('id="business-hours-sync-message"');
    expect(html).toContain('*요일별 운영시간 설정 필요');
    expect(js).toContain('function hasDifferingWeeklyBusinessHours');
    expect(js).toContain('function syncWeeklyBusinessHoursFromMainFields');
    expect(js).toContain('function applyWeeklyBusinessHoursSummaryToMainFields');
    expect(js).toContain('function refreshBusinessHoursSyncState');
    expect(js).toContain('요일별 상이');
    expect(js).toContain('businessHoursAreDiffering');
    expect(js).toContain('syncWeeklyBusinessHoursFromMainFields();');
    expect(js).toContain('applyWeeklyBusinessHoursSummaryToMainFields(currentWeeklyBusinessHours);');
    expect(js).toContain("field('business-hours-sync-message')");
  });

  it('marks imported checkbox and radio groups with the existing autofill treatment', () => {
    const html = readFileSync(path.join(webRoot, 'soho_store_register.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'soho_store_register.js'), 'utf8');

    expect(html).toMatch(/textarea\.autofilled[\s\S]*background:#F8FFF9/);
    expect(html).toContain('data-autofill-group="closed-days"');
    expect(html).toContain('data-autofill-group="parking"');
    expect(js).toContain('function markAutofillGroup');
    expect(js).toContain("markAutofillGroup('closed-days'");
    expect(js).toContain("markAutofillGroup('parking'");
  });

  it('includes raw Naver fish-sashimi categories in the static industry list', () => {
    const categories = JSON.parse(readFileSync(path.join(webRoot, 'industry_categories.json'), 'utf8')) as Array<{
      name: string;
      children: Array<{ name: string; items: string[] }>;
    }>;
    const restaurant = categories.find((category) => category.name === '음식점');
    const japanese = restaurant?.children.find((child) => child.name === '일식');

    expect(japanese?.items).toContain('생선회');
  });

  it('renders Naver Place metadata and menu sections from saved metadata', () => {
    const html = readFileSync(path.join(webRoot, 'soho_store_register.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'soho_store_register.js'), 'utf8');

    expect(html).toContain('id="place-metadata-section"');
    expect(html).toContain('id="place-links-list"');
    expect(html).toContain('id="place-facilities"');
    expect(html).toContain('id="place-booking"');
    expect(html).toContain('id="place-review-stats"');
    expect(html).toContain('id="place-broadcasts"');
    expect(html).toContain('id="place-keywords"');
    expect(html).toContain('id="place-hospital-panel"');
    expect(html).toContain('id="place-hospital-info"');
    expect(html).toContain('id="place-menu-section"');
    expect(html).toContain('id="place-menu-count"');
    expect(html).toContain('id="place-menu-images"');
    expect(html).toContain('id="place-menu-list"');
    expect(html).toContain('id="place-menu-toggle"');
    expect(html).toContain('id="menu-image-viewer"');
    expect(html).toContain('id="menu-image-viewer-img"');
    expect(html).toContain('id="menu-image-viewer-counter"');
    expect(js).toContain('function normalizeLinks');
    expect(js).toContain('function renderChips');
    expect(js).toContain('function renderReviewStats');
    expect(js).toContain('function renderBroadcastInfos');
    expect(js).toContain('function renderHospitalInfo');
    expect(js).toContain('function renderMenuSection');
    expect(js).toContain('function openMenuImageViewer');
    expect(js).toContain('function closeMenuImageViewer');
    expect(js).toContain('function stepMenuImageViewer');
    expect(js).toContain('data-menu-image-index');
    expect(js).toContain('onclick="openMenuImageViewer');
    expect(js).toContain('menuItems.slice(0, menuExpanded ? menuItems.length : 5)');
    expect(js).toContain('menuImageUrls.slice(0, 4)');
    expect(js).toContain('메뉴 전체보기');
  });

  it('renders imported external channel links in the registration metadata panel', () => {
    const js = readFileSync(path.join(webRoot, 'soho_store_register.js'), 'utf8');

    expect(js).toContain('function channelLinkLabel');
    expect(js).toContain('externalChannelLinks');
    expect(js).toContain('asRecord(parsedPlace.naverPlaceParsed).externalChannelLinks');
    expect(js).toContain('record.landingUrl');
    expect(js).toContain('record.sourceUrl');
    expect(js).toContain("blog: '블로그'");
    expect(js).toContain("instagram: '인스타그램'");
    expect(js).toContain("daangn: '당근'");
    expect(js).toContain("youtube: '유튜브'");
    expect(js).toContain("tiktok: '틱톡'");
  });

  it('surfaces imported Place assets and generated RAG documents inside the upload section', () => {
    const html = readFileSync(path.join(webRoot, 'soho_store_register.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'soho_store_register.js'), 'utf8');

    expect(html).toContain('자료 업로드');
    expect(html).not.toContain('기존 자료 업로드');
    expect(html).toContain('id="place-photo-source-panel"');
    expect(html).toContain('id="place-photo-source-images"');
    expect(html).toContain('네이버 플레이스에서 가져온 매장 사진');
    expect(html).toContain('id="place-menu-source-panel"');
    expect(html).toContain('id="place-menu-source-images"');
    expect(html).toContain('네이버 플레이스에서 가져온 메뉴판 이미지');
    expect(html).toContain('id="rag-doc-source-panel"');
    expect(html).toContain('id="rag-doc-source-info"');
    expect(html).toContain('id="rag-doc-source-reviews"');
    expect(html).toContain('RAG용 생성 문서');

    expect(js).toContain('function renderUploadSourceAssets');
    expect(js).toContain('function renderSourceImagePanel');
    expect(js).toContain('function normalizePlaceImageUrls');
    expect(js).toContain('icon_default_profile');
    expect(js).toContain('search.pstatic.net/common');
    expect(js).toContain('placeImageUrls');
    expect(js).toContain("'place-photo-source-panel'");
    expect(js).toContain("'place-menu-source-panel'");
    expect(js).toContain("setRagLink('rag-doc-source-info'");
    expect(js).toContain("setRagLink('rag-doc-source-reviews'");
    expect(js).toContain('function openSourceImageViewer');
    expect(js).toContain('window.openSourceImageViewer = openSourceImageViewer');
  });

  it('shows separate RAG review collection and document generation progress messages', () => {
    const js = readFileSync(path.join(webRoot, 'soho_store_register.js'), 'utf8');

    expect(js).toContain('네이버플레이스 리뷰를 가져오는 중입니다.');
    expect(js).toContain('RAG 문서를 생성하는 중입니다.');
    expect(js).toContain('ragPhaseTimer');
    expect(js).toContain('manifest.warnings');
  });

  it('labels generated RAG documents as chatbot-ready materials with action-oriented empty guidance', () => {
    const html = readFileSync(path.join(webRoot, 'soho_store_register.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'soho_store_register.js'), 'utf8');
    const emptyMessage = '업체에 최적화된 응답을 제공하기 위해 RAG 용 문서를 생성해주세요.';

    expect(html).toContain('챗봇용 RAG 문서 생성');
    expect(html).toContain(emptyMessage);
    expect(js).toContain(emptyMessage);
    expect(html).not.toMatch(/>\s*RAG 문서 생성\s*</);
    expect(html).not.toContain('아직 생성된 RAG 문서가 없습니다.');
    expect(js).not.toContain('아직 생성된 RAG 문서가 없습니다.');
  });
});
