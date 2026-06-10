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
    expect(html).toContain('/strategy-ruleset/benchmark-evidence');
    expect(html).toContain('/strategy-ruleset/regenerate-preview');
    expect(html).not.toContain("fetch('strategy_benchmark_fixture.json')");
    expect(html).not.toContain('const WRITING_PREVIEWS');
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });

  it('renders remaining source matrix containers and field hooks for currently static ruleset rows', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'ruleset_editor.js'), 'utf8');
    const writeSection = extractSection(html, '<!-- 글쓰기 스타일 -->', '<!-- 이미지 스타일 -->');
    const requiredHooks = [
      'operatingHours',
      'closedDays',
      'phone',
      'parking',
      'storeIntro',
      'primaryColors',
      'accentColors',
      'imageStyle',
      'imageAvoidStyle',
      'instagramImageFormat',
      'instagramImageStyle',
      'instagramOverlayPolicy',
      'blogImageFormat',
      'blogImageStyle',
      'blogOverlayPolicy'
    ];

    expect(html).not.toContain('data-source-matrix-section="store"');
    expect(html).toContain('data-source-matrix-section="brand"');
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
    expect(js).toContain('currentImplementation');
    expect(js).toContain('futureSuggestion');
  });

  it('renders image style as a red common example without visible source notes or matrix', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'ruleset_editor.js'), 'utf8');
    const imageSection = extractSection(html, '<!-- 이미지 스타일 -->', '<!-- 유사업체비교 -->');
    const requiredOrder = [
      'primaryColors',
      'accentColors',
      'imageDirection',
      'imageStyle',
      'imageAvoidStyle',
      'blogImageFormat',
      'blogOverlayPolicy'
    ];

    expect(imageSection).toContain('(공통예시) 이미지 스타일');
    expect(imageSection).toContain('common-example-title');
    expect(html).toContain('.common-example-title{color:#E03131');
    expect(imageSection).not.toContain('data-source-matrix-section="image_common,image_instagram,image_blog"');
    expect(imageSection).not.toContain('자동 입력 기준');
    expect(js).toContain('function isImageStyleRulesetField');
    expect(js).toContain('!isImageStyleRulesetField(element)');

    let previousIndex = -1;
    for (const fieldKey of requiredOrder) {
      const currentIndex = imageSection.indexOf(`data-ruleset-field="${fieldKey}"`);
      expect(currentIndex).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
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
    const writeSection = html.match(/<!-- 글쓰기 스타일 -->[\s\S]*?<!-- 이미지 스타일 -->/)?.[0] ?? '';

    expect(writeSection).toContain('data-writing-style-panel="industry-common-rules"');
    expect(writeSection).toContain('업종공통규칙');
    expect(writeSection).toContain('data-ruleset-field="industryCommonRules"');
    expect(writeSection).toContain('블로그 하단에 반드시 의료법 관련 내용 포함');
    expect(writeSection).toContain('data-writing-required-copy="intro"');
    expect(writeSection).toContain('data-ruleset-field="blogRequiredIntroCopy"');
    expect(writeSection).toContain('data-writing-required-copy="footer"');
    expect(writeSection).toContain('data-ruleset-field="blogRequiredFooterCopy"');
    expect(writeSection).toContain('*본 포스팅은 테라스의원에서 의료정보 제공 및 병원 광고 목적으로 직접 작성한 글이며, &lt;의료법 제 56조 제 1항&gt;을 준수합니다.');
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
    const writeSection = html.match(/<!-- 글쓰기 스타일 -->[\s\S]*?<!-- 이미지 스타일 -->/)?.[0] ?? '';
    const requiredFields = [
      ['blogPurpose', '글의 목적'],
      ['blogWritingStyle', '문장 스타일'],
      ['blogPreferredLength', '선호 길이'],
      ['blogHashtags', '해시태그'],
      ['blogEmojiPolicy', '이모지 사용'],
      ['seoKeywords', 'SEO 키워드'],
      ['ctaStyle', 'CTA']
    ];

    expect(writeSection).toContain('data-writing-style-layout="current-plus-suggestion"');
    expect(writeSection).toContain('data-writing-current');
    expect(writeSection).toContain('data-writing-suggestion');
    expect(writeSection).toContain('AI 제안');
    expect(writeSection).toContain('개선 제안');
    expect(writeSection).toContain('현행유지');
    expect(writeSection).toContain('data-ai-suggestion-text');
    expect(writeSection).toContain('data-ai-suggestion-evidence');
    expect(writeSection).toContain('최소 3개');
    expect(writeSection).toContain('랜덤 선택');
    expect(writeSection).toContain('동일한 문장스타일로 반영');

    for (const [fieldKey, label] of requiredFields) {
      expect(writeSection).toContain(`data-ruleset-field="${fieldKey}"`);
      expect(writeSection).toContain(label);
    }
    expect(js).toContain('function isWritingStyleRulesetField');
    expect(js).toContain('!isWritingStyleRulesetField(element)');
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

  it('documents the only store-info improvement suggestions that are applied', () => {
    const js = readFileSync(path.join(webRoot, 'ruleset_editor.js'), 'utf8');

    expect(js).toContain("const APPLIED_STORE_INFO_FIELDS = new Set(['operatingHours', 'closedDays', 'parking']);");
    expect(js).toContain('function isStoreInfoRulesetField');
    expect(js).toContain('function shouldRenderRulesetSourceNote');
    expect(js).toContain('APPLIED_STORE_INFO_FIELDS.has(fieldKey)');
    expect(js).toContain('!isStoreInfoRulesetField(element)');
  });

  it('marks every reference panel title as a red common example', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const referenceKeys = [
      'positioning',
      'strength',
      'menu',
      'target',
      'contentKeywords',
      'reviewStrength',
      'reviewWeakness'
    ];

    expect(html).toContain("const COMMON_REFERENCE_TITLE_PREFIX = '(공통예시)';");
    expect(html).toContain('.reference-panel-title.common-example{color:#E03131');
    expect(html).toContain('class="reference-panel-title common-example" id="referenceLayerTitle">(공통예시) 항목 참고</div>');
    expect(html).toContain('`${COMMON_REFERENCE_TITLE_PREFIX} ${row.label} 참고`');
    expect(html).toContain("treatmentSubject: 'sameIndustry'");
    expect(html).toContain("rowKey === 'treatmentSubject' ? 'menu'");
    for (const key of referenceKeys) {
      expect(html).toContain(`data-reference-key="${key}"`);
    }
  });

  it('defines industry-aware representative offering behavior for healthcare stores', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'ruleset_editor.js'), 'utf8');

    expect(html).toContain('data-industry-field="representativeOffering"');
    expect(html).toContain('data-default-label="대표 메뉴"');
    expect(html).toContain('data-healthcare-label="대표 진료과목"');
    expect(html).toContain('data-default-reference-key="menu"');
    expect(html).toContain('data-healthcare-reference-key="treatmentSubject"');
    expect(js).toContain("const HEALTHCARE_CATEGORY_KEYWORDS = ['병원', '의원', '클리닉', '정형외과', '피부과', '치과'];");
    expect(js).toContain('function isHealthcareStore');
    expect(js).toContain('function configureIndustryFields');
    expect(js).toContain("field.dataset.rulesetField = isHealthcare ? 'representativeTreatmentSubjects' : 'representativeMenu';");
    expect(js).toContain("button.dataset.referenceKey = isHealthcare ? 'treatmentSubject' : 'menu';");
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
