import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('..');
const webRoot = path.join(repoRoot, 'web');

function extractSection(html: string, startMarker: string, endMarker: string): string {
  return html.match(new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`))?.[0] ?? '';
}

describe('marketing ruleset static page API wiring', () => {
  it('loads a page-specific ruleset script and exposes editable field hooks', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');

    expect(html).toContain('마케팅 전략 룰셋');
    expect(html).toContain('id="ruleset-status"');
    expect(html).toContain('data-ruleset-field="positioning"');
    expect(html).toContain('data-ruleset-field="contentKeywords"');
    expect(html).toContain('data-ruleset-value');
    expect(html).toContain('ruleset_editor.js');
  });

  it('calls only poc-server ruleset APIs from browser code', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'ruleset_editor.js'), 'utf8');

    expect(js).toContain('fetch(`/api/stores/${storeId}/strategy-ruleset`)');
    expect(js).toContain('fetch(`/api/stores/${storeId}/strategy-ruleset/fields/${fieldKey}`');
    expect(js).toContain('fetch(`/api/stores/${storeId}/strategy-ruleset/fields/${fieldKey}/reset`');
    expect(js).toContain('fetch(`/api/stores/${storeId}/strategy-ruleset/fields/${fieldKey}/evidence`)');
    expect(js).not.toContain('fetch(`/api/stores/${storeId}/ruleset`)');
    expect(() => new Function(js)).not.toThrow();
    expect(html).toContain('/strategy-ruleset/benchmark-evidence');
    expect(html).not.toContain('/strategy-ruleset/regenerate-preview');
    expect(html).not.toContain("fetch('strategy_benchmark_fixture.json')");
    expect(html).not.toContain('const WRITING_PREVIEWS');
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });

  it('renders a compact title-level ruleset version selector and restores only from the preview', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'ruleset_editor.js'), 'utf8');

    expect(html).toContain('id="ruleset-status"');
    expect(html).toContain('id="ruleset-version-select"');
    expect(html).toContain('id="ruleset-version-preview"');
    expect(html).not.toContain('id="ruleset-version-panel"');
    expect(html).not.toContain('룰셋 버전</div>');

    expect(js).toContain('function loadRulesetVersions');
    expect(js).toContain('function loadRulesetVersion');
    expect(js).toContain('function restoreRulesetVersion');
    expect(js).toContain('function renderRulesetVersionSelect');
    expect(js).toContain('function renderRulesetVersionPreview');
    expect(js).toContain('fetch(`/api/stores/${storeId}/strategy-ruleset/versions`)');
    expect(js).toContain('fetch(`/api/stores/${storeId}/strategy-ruleset/versions/${rulesetId}`)');
    expect(js).toContain('fetch(`/api/stores/${storeId}/strategy-ruleset/versions/${rulesetId}/restore`');
    expect(js).toContain("field('ruleset-version-select')");
    expect(js).toContain('data-ruleset-version-action="restore-preview"');
    expect(js).not.toContain('data-ruleset-version-action="view"');
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });

  it('renders API-backed field hooks without visible automatic-input matrices in cleaned tabs', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'ruleset_editor.js'), 'utf8');
    const writeSection = extractSection(html, '<!-- 글쓰기 스타일 -->', '<!-- 유사업체비교 -->');
    const requiredHooks = [
      'operatingHours',
      'closedDays',
      'phone',
      'parking',
      'storeIntro'
    ];

    expect(html).not.toContain('data-source-matrix-section="store"');
    expect(html).not.toContain('data-source-matrix-section="brand"');
    expect(html).not.toContain('data-source-matrix-section="image_common,image_instagram,image_blog"');
    expect(writeSection).not.toContain('data-source-matrix-section="write_common,write_instagram,write_blog"');
    expect(writeSection).not.toContain('자동 입력 기준');
    for (const fieldKey of requiredHooks) {
      expect(html).toContain(`data-ruleset-field="${fieldKey}"`);
    }
    expect(js).toContain('function renderSourceMatrix');
    expect(js).toContain('payload.sourceMatrix');
    expect(js).toContain('payload.storeFacts');
    expect(js).toContain('matrix.currentValue');
  });

  it('cleans up the our-store-analysis tab for product-facing editing', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'ruleset_editor.js'), 'utf8');
    const brandSection = extractSection(html, '<!-- 우리 매장 분석 -->', '<!-- 글쓰기 스타일 -->');

    expect(brandSection).toContain('우리 매장 분석');
    expect(brandSection).not.toContain('data-source-matrix-section="brand"');
    expect(brandSection).not.toContain('자동 입력 기준');
    expect(brandSection).not.toContain('AI 처리');
    expect(brandSection).not.toContain('AI 판단');
    expect(brandSection).not.toContain('개선 제안');
    expect(js).toContain('function isBrandAnalysisRulesetField');
    expect(js).toContain('!isBrandAnalysisRulesetField(element)');
    expect(js).not.toContain('AI 원값');
    expect(js).toContain('초기화');
  });

  it('keeps static store and brand mock data aligned with the demo cake store', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const storeSection = extractSection(html, '<!-- 매장 정보 -->', '<!-- 우리 매장 분석 -->');
    const brandSection = extractSection(html, '<!-- 우리 매장 분석 -->', '<!-- 글쓰기 스타일 -->');

    expect(storeSection).toContain('분당 케이크하우스');
    expect(storeSection).toContain('커스텀 케이크');
    expect(storeSection).toContain('경기도 성남시 분당구 정자동');
    expect(storeSection).not.toContain('분당 베이커리');
    expect(brandSection).toContain('분당 당일 제작 커스텀 케이크 전문점');
    expect(brandSection).toContain('당일 제작 상담, 커스텀 디자인, 친절한 픽업 안내');
    expect(brandSection).toContain('레터링 케이크, 딸기 생크림 케이크, 커스텀 기념일 케이크');
    expect(brandSection).toContain('기념일 케이크 고객, 레터링 케이크 예약 고객, 정자동 픽업 고객');
    expect(brandSection).toContain('주차 공간이 협소할 수 있어 픽업 시간과 이동 동선을 미리 안내해야 함');
  });

  it('removes deferred Instagram and image style controls from the active ruleset UI', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'ruleset_editor.js'), 'utf8');
    const removedFieldKeys = [
      'instagramPurpose',
      'instagramWritingStyle',
      'instagramPreferredLength',
      'instagramHashtags',
      'instagramEmojiPolicy',
      'primaryColors',
      'accentColors',
      'imageDirection',
      'imageStyle',
      'imageAvoidStyle',
      'instagramImageFormat',
      'instagramImageStyle',
      'instagramOverlayPolicy',
      'blogImageFormat',
      'blogImageStyle',
      'blogOverlayPolicy'
    ];

    expect(html).not.toContain('<!-- 이미지 스타일 -->');
    expect(html).not.toContain('id="top-img"');
    expect(html).not.toContain('id="sec-img"');
    expect(html).not.toContain('(공통예시) 이미지 스타일');
    expect(html).not.toContain('data-source-matrix-section="image_common,image_instagram,image_blog"');
    expect(html).not.toContain('id="write-insta"');
    expect(html).not.toContain('인스타그램');
    expect(js).not.toContain('function isImageStyleRulesetField');
    expect(js).not.toContain('!isImageStyleRulesetField(element)');
    for (const fieldKey of removedFieldKeys) {
      expect(html).not.toContain(`data-ruleset-field="${fieldKey}"`);
    }
  });

  it('labels similar comparison as a red common example without external provider calls', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'ruleset_editor.js'), 'utf8');
    const compareSection = extractSection(html, '<!-- 유사업체비교 -->', '<!-- 저장 모달 -->');

    expect(compareSection).toContain('(공통예시) 유사업체비교');
    expect(compareSection).toContain('common-example-title');
    expect(html).toContain('.common-example-title{color:#E03131');
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
    expect(js).not.toContain('competitorDiscovery');
  });

  it('adds healthcare industry-common writing rules and required blog copy controls', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'ruleset_editor.js'), 'utf8');
    const writeSection = html.match(/<!-- 글쓰기 스타일 -->[\s\S]*?<!-- 유사업체비교 -->/)?.[0] ?? '';

    expect(writeSection).toContain('data-writing-style-panel="industry-common-rules"');
    expect(writeSection).toContain('업종공통규칙');
    expect(writeSection).toContain('data-ruleset-field="industryCommonRules"');
    expect(writeSection).toContain('블로그 하단에 반드시 의료법 관련 내용 포함');
    expect(writeSection).toContain('data-writing-required-copy="intro"');
    expect(writeSection).toContain('data-ruleset-field="blogRequiredIntroCopy"');
    expect(writeSection).toContain('data-writing-required-copy="footer"');
    expect(writeSection).toContain('data-ruleset-field="blogRequiredFooterCopy"');
    expect(writeSection).toContain('*본 포스팅은 해당 병원에서 의료정보 제공 및 병원 광고 목적으로 직접 작성한 글이며, &lt;의료법 제 56조 제 1항&gt;을 준수합니다.');
    expect(writeSection).not.toContain('*본 포스팅은 테라스의원에서 의료정보 제공 및 병원 광고 목적으로 직접 작성한 글이며');
    expect(writeSection).toContain('*모든 시술은 개인의 피부에 따라 크고 작은 부작용이 발생할 수 있습니다. 반드시 사전에 의료진과 충분한 상담을 진행한 후 시술을 결정하시는 것을 권장드립니다.');
    expect(writeSection).toContain('대표원장 소개, 전문의 이력, 진료 철학처럼 모든 블로그 인트로에 반복 포함할 문구');
    expect(writeSection).toContain('자격·진료시간·연락처·의료법 고지처럼 모든 블로그 푸터에 반복 포함할 문구');
    expect(writeSection).toContain('data-healthcare-only');
    expect(writeSection).not.toContain('캐치프레이즈 <span class="src-edited">수정됨</span></div><div class="ruleset-val edited" data-ruleset-value>특별한 날을 더 특별하게 / 분당에서 제일 예쁜 케이크');
    expect(js).toContain('const MEDICAL_INDUSTRY_COMMON_RULE =');
    expect(js).toContain('const MEDICAL_BLOG_FOOTER_COPY =');
    expect(js).toContain('function configureWritingStyleFields');
    expect(js).toContain('isHealthcareStore(payload)');
    expect(js).toContain("document.querySelectorAll('[data-healthcare-only]')");
  });

  it('renders writing style as editable current values with conservative AI suggestions', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'ruleset_editor.js'), 'utf8');
    const writeSection = html.match(/<!-- 글쓰기 스타일 -->[\s\S]*?<!-- 유사업체비교 -->/)?.[0] ?? '';
    const requiredFields = [
      ['blogPurpose', '글의 목적'],
      ['keywordMap', '소재-키워드 맵'],
      ['titlePatterns', '제목 패턴'],
      ['introPattern', '도입부 패턴'],
      ['bodyOutlinePattern', '본문 전개 구조'],
      ['headingPattern', '소제목 패턴'],
      ['blogWritingStyle', '문장 스타일'],
      ['blogPreferredLength', '선호 길이'],
      ['blogHashtags', '해시태그'],
      ['blogEmojiPolicy', '기호/이모지 정책'],
      ['seoKeywords', 'SEO 키워드'],
      ['seoPlacementPolicy', '키워드 배치 정책'],
      ['ctaStyle', 'CTA'],
      ['catchphrase', '브랜드 표현 후보'],
      ['humorLevel', '개그 레벨'],
      ['trendSensitivity', '트렌드 민감도'],
      ['industryCommonRules', '업종공통규칙'],
      ['blogRequiredIntroCopy', '필수 인트로 문구'],
      ['blogRequiredFooterCopy', '필수 푸터 문구']
    ];

    expect(writeSection).toContain('data-writing-style-layout="current-plus-suggestion"');
    expect(writeSection).toContain('data-writing-channel="blog"');
    expect(writeSection).toContain('>블로그</div>');
    expect(writeSection).not.toContain('>공통</div>');
    expect(writeSection).not.toContain('>인스타그램</div>');
    expect(writeSection).toContain('data-writing-current');
    expect(writeSection).toContain('data-writing-suggestion');
    expect(writeSection).toContain('서버 산출 제안');
    expect(writeSection).not.toContain('AI 제안');
    expect(writeSection).toContain('개선 제안');
    expect(writeSection).toContain('현행유지');
    expect(writeSection).toContain('data-ai-suggestion-text');
    expect(writeSection).toContain('data-ai-suggestion-evidence');
    expect(writeSection).toContain('최소 3개');
    expect(writeSection).toContain('랜덤 선택');
    expect(writeSection).toContain('동일한 문장스타일로 반영');
    expect(writeSection).not.toContain('공통 캐치프레이즈');
    expect(writeSection).not.toContain('상위노출 보장');
    expect(writeSection).not.toContain('네이버 알고리즘 보장');

    for (const [fieldKey, label] of requiredFields) {
      expect(writeSection).toContain(`data-ruleset-field="${fieldKey}"`);
      expect(writeSection).toContain(label);
    }
    expect(writeSection).not.toContain('근거 보기');
    expect(js).toContain('function isWritingStyleRulesetField');
    expect(js).toContain('function renderActionRow');
    expect(js).toContain('includeEvidence');
    expect(js).toContain('data-ruleset-action="reset">초기화</button>');
    expect(js).toContain('<span class="ruleset-field-state" data-ruleset-state></span>');
    expect(js).not.toContain('data-ruleset-state>수정 가능</span>');
    expect(js).not.toContain("state.textContent = rulesetField.locked ? '수정값 고정' : '초기화'");
    expect(js).not.toContain("state.textContent = '초기화'");
    expect(js).toContain('function renderWritingStyleInsights');
    expect(js).toContain('payload.writingStyleInsights');
    expect(js).toContain('sourceStatus');
    expect(js).toContain('서버 산출');
    expect(js).toContain('근거 부족');
    expect(js).toContain('data-placeholder-value');
    expect(js).toContain('placeholderText');
  });

  it('keeps static writing-style mock data aligned with the Blog-only LLM contract', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const writeSection = html.match(/<!-- 글쓰기 스타일 -->[\s\S]*?<!-- 유사업체비교 -->/)?.[0] ?? '';

    expect(writeSection).toContain('분당 케이크 예약: 분당 케이크, 예약, 픽업');
    expect(writeSection).toContain('레터링 케이크 주문 전 체크리스트');
    expect(writeSection).toContain('본문 700-1,000자, 소제목 3-5개, CTA 포함');
    expect(writeSection).toContain('#분당케이크 #레터링케이크 #커스텀케이크 #당일제작케이크');
    expect(writeSection).toContain('분당 케이크, 레터링 케이크, 정자동 케이크, 당일 제작 케이크');
    expect(writeSection).toContain('예약 가능 여부와 픽업 시간을 확인하도록 부드럽게 유도');
    expect(writeSection).toContain('낮음 — 가벼운 언어 유희만 허용');
    expect(writeSection).toContain('중간 — 시즌과 기념일 트렌드만 선별 반영');
    expect(writeSection).toContain('전국 최고, 무조건 가능, 효능 보장, 과장된 원조 표현');
    expect(writeSection).not.toContain('#인천정형외과');
    expect(writeSection).not.toContain('서구정형외과');
    expect(writeSection).not.toContain('정형외과 진료');
    expect(writeSection).not.toContain('사진 8장');
  });

  it('renders blog evidence for analysis fields and review evidence for review fields', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'ruleset_editor.js'), 'utf8');

    expect(html).toContain('id="benchmarkEvidenceReviews"');
    expect(html).toContain('id="benchmarkEvidenceRationale"');
    expect(html).toContain('id="benchmarkEvidenceRationaleText"');

    expect(js).toContain('const BLOG_EVIDENCE_FIELD_KEYS');
    expect(js).toContain('const REVIEW_EVIDENCE_FIELD_KEYS');
    expect(js).toContain('function evidenceSourceMode');
    expect(js).toContain('function blogEvidenceItems');
    expect(js).toContain(".filter((item) => item.channel === 'blog' && item.sourceType === 'post')");
    expect(js).toContain('function reviewEvidenceItems');
    expect(js).toContain(".filter((item) => item.channel === 'place' && item.sourceType === 'review')");
    expect(js).toContain('.slice(0, 5)');
    expect(js).toContain('function rationaleText');
    expect(js).toContain("replace(/^.*?산출 근거:\\s*/");
    expect(js).toContain("split('수집 근거:')[0]");
    expect(js).toContain('블로그 본문 인용');
    expect(js).toContain('실제 방문자 리뷰');
    expect(js).toContain('benchmarkEvidenceReviews');
    expect(js).toContain('benchmarkEvidenceRationaleText');
    expect(js).not.toContain('리뷰 약점 산출 근거');
  });

  it('removes the automatic input criteria block from the store info tab', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const storeSection = html.match(/<!-- 매장 정보 -->[\s\S]*?<!-- 우리 매장 분석 -->/)?.[0] ?? '';

    expect(storeSection).toContain('data-ruleset-field="operatingHours"');
    expect(storeSection).toContain('data-ruleset-field="closedDays"');
    expect(storeSection).toContain('data-ruleset-field="parking"');
    expect(storeSection).not.toContain('data-source-matrix-section');
    expect(storeSection).not.toContain('자동 입력 기준');
  });

  it('shows missing parking as manual input with a store registration action', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'ruleset_editor.js'), 'utf8');
    const storeSection = html.match(/<!-- 매장 정보 -->[\s\S]*?<!-- 우리 매장 분석 -->/)?.[0] ?? '';

    expect(storeSection).not.toContain('주차 정보 수집 중');
    expect(storeSection).toContain('data-manual-required-field="parking"');
    expect(storeSection).toContain('수동입력 필요');
    expect(storeSection).toContain('data-store-registration-action="parking"');
    expect(storeSection).toContain('매장정보에서 입력하기');
    expect(js).toContain("const PARKING_MANUAL_REQUIRED_TEXT = '수동입력 필요';");
    expect(js).toContain('function normalizeParkingRulesetValue');
    expect(js).toContain('function updateParkingManualAction');
    expect(js).toContain('function storeRegistrationParkingHref');
    expect(js).toContain("url.searchParams.set('storeId', currentStoreId())");
    expect(js).toContain("url.searchParams.set('focus', 'parking')");
    expect(js).toContain('window.goToStoreRegistrationParking = goToStoreRegistrationParking');
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
  });

  it('documents the only store-info improvement suggestions that are applied', () => {
    const js = readFileSync(path.join(webRoot, 'ruleset_editor.js'), 'utf8');

    expect(js).toContain("const APPLIED_STORE_INFO_FIELDS = new Set(['operatingHours', 'closedDays', 'parking']);");
    expect(js).toContain('function isStoreInfoRulesetField');
    expect(js).toContain('function shouldRenderRulesetSourceNote');
    expect(js).toContain('APPLIED_STORE_INFO_FIELDS.has(fieldKey)');
    expect(js).toContain('!isStoreInfoRulesetField(element)');
  });

  it('removes reference buttons and common-example reference panels from store analysis', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'ruleset_editor.js'), 'utf8');
    const brandSection = html.match(/<!-- 우리 매장 분석 -->[\s\S]*?<!-- 글쓰기 스타일 -->/)?.[0] ?? '';

    expect(brandSection).not.toContain('reference-btn');
    expect(brandSection).not.toContain('storeAnalysisReferencePanel');
    expect(brandSection).not.toContain('referenceLayerTitle');
    expect(brandSection).not.toContain('참고</button>');
    expect(brandSection).not.toContain('(공통예시)');
    expect(html).not.toContain('COMMON_REFERENCE_TITLE_PREFIX');
    expect(html).not.toContain('REFERENCE_TYPE_BY_ROW_KEY');
    expect(html).not.toContain('showReferenceLayer');
    expect(html).not.toContain('data-reference-key');
    expect(js).not.toContain('referenceKey');
  });

  it('defines industry-aware representative offering behavior for healthcare stores', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'ruleset_editor.js'), 'utf8');

    expect(html).toContain('data-industry-field="representativeOffering"');
    expect(html).toContain('data-default-label="대표 메뉴"');
    expect(html).toContain('data-healthcare-label="대표 진료과목"');
    expect(html).not.toContain('data-default-reference-key');
    expect(html).not.toContain('data-healthcare-reference-key');
    expect(js).toContain("const HEALTHCARE_CATEGORY_KEYWORDS = ['병원', '의원', '클리닉', '정형외과', '피부과', '치과'];");
    expect(js).toContain('function isHealthcareStore');
    expect(js).toContain('function configureIndustryFields');
    expect(js).toContain("field.dataset.rulesetField = 'representativeMenu';");
    expect(js).toContain("field.dataset.rulesetAliases = isHealthcare ? 'representativeTreatmentSubjects' : '';");
    expect(js).toContain('function representativeTreatmentSubjectsValue');
    expect(js).toContain('storeFacts.representativeTreatmentSubjects');
    expect(js).not.toContain("field.dataset.rulesetField = isHealthcare ? 'representativeTreatmentSubjects' : 'representativeMenu';");
    expect(js).not.toContain('referenceKey');
    expect(js).toContain("label.textContent = isHealthcare ? '대표 진료과목' : '대표 메뉴';");
  });

  it('labels direct store facts as Place collected values instead of AI generated values', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const storeSection = html.match(/<!-- 매장 정보 -->[\s\S]*?<!-- 우리 매장 분석 -->/)?.[0] ?? '';

    expect(storeSection).toContain('Place 수집');
    expect(storeSection).not.toContain('AI 수집');
    expect(storeSection).not.toContain('AI 분석');
  });

  it('shows clear guidance when a newly imported store has no generated ruleset yet', () => {
    const js = readFileSync(path.join(webRoot, 'ruleset_editor.js'), 'utf8');

    expect(js).toContain('function renderEmptyRulesetGuidance');
    expect(js).toContain('수집과 분석을 실행하면 AI가 생성한 마케팅 전략 룰셋을 확인할 수 있습니다.');
    expect(js).toContain('Place에서 가져온 매장 기본 정보는 아래에서 먼저 확인할 수 있습니다.');
    expect(js).toContain('payload.ruleset');
    expect(js).toContain('strategy-ruleset');
  });
});
