import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('..');
const webRoot = path.join(repoRoot, 'web');

function readWeb(file: string) {
  return readFileSync(path.join(webRoot, file), 'utf8');
}

function readRepo(file: string) {
  return readFileSync(path.join(repoRoot, file), 'utf8');
}

function htmlFiles() {
  return readdirSync(webRoot).filter((file) => file.endsWith('.html'));
}

function stripComments(text: string) {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

type IndustryCategory = {
  name: string;
  children?: IndustryCategory[];
  items?: string[];
};

type IndustryLeaf = {
  item: string;
  path: string[];
};

type BenchmarkCandidate = {
  name: string;
  basisTags: string[];
  evidence: string[];
};

type BenchmarkComparisonRow = {
  key: string;
  label: string;
  ourStore: string;
  benchmark: string;
  gap: string;
  recommendation: string;
  evidence: string[];
};

type BenchmarkType = {
  id: string;
  label: string;
  candidateCount: number;
  reviewCount: number;
  keywordCount: number;
  candidates: BenchmarkCandidate[];
  comparison: BenchmarkComparisonRow[];
};

type BenchmarkFixture = {
  defaultType: string;
  benchmarkTypes: BenchmarkType[];
};

function collectIndustryLeaves(categories: IndustryCategory[], path: string[] = []): IndustryLeaf[] {
  return categories.flatMap((category) => {
    const nextPath = [...path, category.name];
    const childLeaves = category.children ? collectIndustryLeaves(category.children, nextPath) : [];
    const itemLeaves = category.items?.map((item) => ({ item, path: [...nextPath, item] })) ?? [];
    return [...childLeaves, ...itemLeaves];
  });
}

describe('web static flow connectivity', () => {
  it('keeps the flow analysis and execution plan documents available', () => {
    expect(existsSync(path.join(repoRoot, 'docs/flow-analysis/2026-06-02-web-static-flow-analysis.md'))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'docs/superpowers/plans/2026-06-02-web-static-flow-connectivity.md'))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'docs/flow-analysis/2026-06-02-marketing-strategy-ruleset-benchmark-analysis.md'))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'docs/superpowers/plans/2026-06-02-marketing-strategy-ruleset-benchmark.md'))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'docs/confirmation/2026-06-02-api-backed-poc-checkpoints.md'))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'docs/superpowers/specs/2026-06-02-api-backed-event-operation-poc-design.md'))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'docs/superpowers/plans/2026-06-02-api-backed-event-operation-poc.md'))).toBe(true);
  });

  it('points every local web html reference at an existing file', () => {
    const missing: string[] = [];

    for (const file of htmlFiles()) {
      const text = readWeb(file);
      const refs = [
        ...text.matchAll(/\b(?:href|src)=["']([^"']+\.html)(?:#[^"']*)?["']/g),
        ...text.matchAll(/location\.href\s*=\s*["']([^"']+\.html)(?:#[^"']*)?["']/g)
      ].map((match) => match[1]);

      for (const ref of refs) {
        const target = path.normalize(path.join(webRoot, ref));
        if (!existsSync(target)) {
          missing.push(`${file} -> ${ref}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('marks every LNB item as a visible flow target', () => {
    const nav = readWeb('nav.html');
    const links = [...nav.matchAll(/<a\s+href=["']([^"']+\.html)["'][^>]*>/g)];

    expect(links.length).toBeGreaterThan(0);
    for (const [tag, href] of links) {
      expect(tag, href).toContain(`data-flow-target="${href}"`);
      expect(tag, href).toContain('data-flow-label=');
    }
  });

  it('marks the agreed core journeys with data-flow targets', () => {
    const requiredMarkers = [
      ['01_대시보드_온보딩전.html', '03_AI학습_온보딩.html'],
      ['03_AI학습_온보딩.html', '04_AI학습_수집중.html'],
      ['04_AI학습_수집중.html', '05_AI학습_콘텐츠선택.html'],
      ['05_AI학습_콘텐츠선택.html', '06_AI학습_현황.html'],
      ['02_블로그관리.html', '09_AI콘텐츠생성_상세.html'],
      ['09_AI콘텐츠생성_상세.html', '10_블로그_발행대기_상세.html'],
      ['10_블로그_발행대기_상세.html', '11_블로그_발행완료_상세.html'],
      ['11_블로그_발행완료_상세.html', '02_블로그관리.html'],
      ['agency_dashboard.html', 'agency_list.html'],
      ['soho_dashboard.html', 'soho_store_register.html'],
      ['soho_dashboard.html', '02_블로그관리.html'],
      ['soho_dashboard.html', '07_마케팅전략룰셋.html'],
      ['event_operation_poc.html', 'api:runtime-probe'],
      ['event_operation_poc.html', 'api:approval-history'],
      ['event_operation_poc.html', 'api:approval-decision']
    ] as const;

    for (const [file, target] of requiredMarkers) {
      expect(readWeb(file), `${file} should mark ${target}`).toContain(`data-flow-target="${target}"`);
    }
  });

  it('loads a reversible flow guide toggle from the frame shell', () => {
    expect(readWeb('index.html')).toContain('flow-guide.js');
    const guide = readFileSync(path.join(webRoot, 'flow-guide.js'), 'utf8');
    expect(guide).toContain('bizplanetFlowGuide');
    expect(guide).toContain('플로우 표시');
    expect(guide).toContain('data-flow-guide="on"');
  });

  it('enhances top breadcrumbs into clickable navigation targets', () => {
    const icons = readFileSync(path.join(webRoot, 'icons.js'), 'utf8');
    expect(icons).toContain('breadcrumbRouteMap');
    expect(icons).toContain('enhanceBreadcrumbNavigation');
    expect(icons).toContain('data-flow-label');

    const mappedRefs = [...icons.matchAll(/'([^']+\.html)'/g)].map((match) => match[1]);
    const missing = mappedRefs.filter((ref) => !existsSync(path.join(webRoot, ref)));
    expect(missing).toEqual([]);
  });

  it('routes marketing-channel root breadcrumbs to the onboarding entry', () => {
    const icons = readFileSync(path.join(webRoot, 'icons.js'), 'utf8');

    expect(icons).toContain("['마케팅 채널관리', '01_대시보드_온보딩전.html']");
    expect(icons).not.toContain("['마케팅 채널관리', '01_대시보드.html']");
  });

  it('preserves icon IDs needed by LNB navigation controls', () => {
    const nav = readWeb('nav.html');
    const icons = readFileSync(path.join(webRoot, 'icons.js'), 'utf8');

    expect(nav).toContain('id="ref-arrow"');
    expect(icons).toContain('preservedAttrs');
    expect(icons).toContain("['id', 'class', 'aria-hidden', 'role']");
  });

  it('connects the no-store dashboard registration CTA to store registration', () => {
    const dashboard = readWeb('soho_dashboard.html');
    const noStoreSection = dashboard.match(/<div id="state-no-store"[\s\S]*?<\/div><!-- \/state-no-store -->/)?.[0] ?? '';

    expect(noStoreSection).toContain('매장 등록하기');
    expect(noStoreSection).toContain("location.href='soho_store_register.html'");
    expect(noStoreSection).toContain('data-flow-target="soho_store_register.html"');
    expect(noStoreSection).toContain('data-flow-label="다음: 매장 정보 등록"');
  });

  it('shows manual-entry guidance before the industry field in store registration', () => {
    const register = readWeb('soho_store_register.html');
    const basicSection = register.match(/<!-- 기본 정보 -->[\s\S]*?<!-- \/기본 정보 -->/)?.[0] ?? '';

    expect(basicSection).toContain('운영 중인 네이버 플레이스가 없는 경우');
    expect(basicSection).toContain('수동으로 입력해주세요');
    expect(basicSection).toContain('해당 정보를 기반으로 네이버 플레이스 초기 설정용 문구를 생성할 수 있습니다.');
    expect(basicSection).not.toContain('네이버 플레이스 URL이 준비되면 상단 불러오기 기능으로 정보를 다시 채우거나 수정할 수 있어요.');
    expect(basicSection.indexOf('운영 중인 네이버 플레이스가 없는 경우')).toBeGreaterThan(-1);
    expect(basicSection.indexOf('운영 중인 네이버 플레이스가 없는 경우')).toBeLessThan(basicSection.indexOf('<label>업종'));
  });

  it('loads store industries from an external hierarchical industry list', () => {
    const register = readWeb('soho_store_register.html');
    const listPath = path.join(webRoot, 'industry_categories.json');
    const categories = JSON.parse(readFileSync(listPath, 'utf8')) as IndustryCategory[];
    const leaves = collectIndustryLeaves(categories);
    const leafNames = leaves.map(({ item }) => item);

    expect(register).toContain('industry_categories.json');
    expect(register).toContain('loadIndustryOptions');
    expect(register).not.toContain('<option>음식점</option>');
    expect(register).not.toContain('<option>카페·베이커리</option>');
    expect(categories.length).toBeGreaterThanOrEqual(7);
    expect(leaves.length).toBeGreaterThanOrEqual(70);
    expect(leaves.every(({ path: leafPath }) => leafPath.length === 3)).toBe(true);
    expect(leafNames).toEqual(expect.arrayContaining([
      '오마카세',
      '한정식',
      '고깃집',
      '카페',
      '베이커리',
      '북카페',
      '피부관리',
      '네일',
      '속눈썹',
      '사진관',
      '펜션',
      '풀빌라',
      '글램핑',
      '손세차',
      '에어컨청소',
      '누수탐지'
    ]));
  });

  it('shows the requested store contact, operating-hours, and parking fields', () => {
    const register = readWeb('soho_store_register.html');
    const basicSection = register.match(/<!-- 기본 정보 -->[\s\S]*?<!-- \/기본 정보 -->/)?.[0] ?? '';

    expect(basicSection).toContain('<label>매장 대표 연락처 <span class="req">*</span></label>');
    expect(basicSection).not.toContain('<label>대표 연락처 <span class="req">*</span></label>');
    expect(basicSection).toContain('요일별 운영시간 설정');
    expect(basicSection).toContain('class="field-inline-action"');
    expect(basicSection).toContain('id="f-parking-note"');
    expect(basicSection).toContain('placeholder="발렛파킹(비용유무), 주차지원 방식, 인근 유료 주차장 안내"');
  });

  it('keeps the store dashboard strategy aligned to the tteokbokki store', () => {
    const dashboard = readWeb('soho_dashboard.html');
    const strategySection = dashboard.match(/<!-- 마케팅 전략 현황 -->[\s\S]*?<!-- 매장 정보 -->/)?.[0] ?? '';

    expect(strategySection).toContain('홍대 상권 즉석 떡볶이 전문점');
    expect(strategySection).toContain('매콤달콤 양념');
    expect(strategySection).toContain('홍대 떡볶이');
    expect(strategySection).toContain('즉석떡볶이');
    expect(strategySection).toContain('튀김 세트');
    expect(strategySection).not.toContain('케이크');
    expect(strategySection).not.toContain('레터링케이크');
    expect(strategySection).not.toContain('커스텀케이크');
  });

  it('offers a concrete three-store switcher on the store dashboard', () => {
    const dashboard = readWeb('soho_dashboard.html');
    const switcher = dashboard.match(/<div class="store-switcher"[\s\S]*?<!-- \/store-switcher -->/)?.[0] ?? '';

    expect(dashboard).toContain('toggleStoreMenu');
    expect(dashboard).toContain('selectStore');
    expect(switcher).toContain('data-store-count="3"');
    expect(switcher).toContain('id="storeMenu"');
    expect(switcher.match(/class="store-option(?: active)?"/g)?.length ?? 0).toBe(3);
    expect(switcher).toContain('맛있는 떡볶이 홍대점');
    expect(switcher).toContain('맛있는 떡볶이 분당점');
    expect(switcher).toContain('맛있는 떡볶이 수지점');
  });

  it('routes the store dashboard marketing-channel card through the onboarding entry', () => {
    const dashboard = readWeb('soho_dashboard.html');
    const marketingCard = dashboard.match(/<a class="svc-card"[^>]*>[\s\S]*?<div class="svc-card-name">마케팅채널관리<\/div>[\s\S]*?<\/a>/)?.[0] ?? '';

    expect(marketingCard).toContain('href="01_대시보드_온보딩전.html"');
    expect(marketingCard).toContain('data-flow-target="01_대시보드_온보딩전.html"');
    expect(marketingCard).toContain('data-flow-label="다음: 마케팅 채널관리 진입"');
    expect(marketingCard).not.toContain('href="01_대시보드.html"');
  });

  it('moves content generation operation settings from AI learning to blog management', () => {
    const onboarding = readWeb('03_AI학습_온보딩.html');
    const blog = readWeb('02_블로그관리.html');

    expect(onboarding).not.toContain('콘텐츠 생성 설정');
    expect(onboarding).not.toContain('name="publish_mode"');
    expect(onboarding).not.toContain('자동 발행 요청');
    expect(onboarding).not.toContain('승인 후 발행 요청');
    expect(onboarding).toContain('수집 주기');
    expect(onboarding).toContain('매장 대표 키워드');

    expect(blog).toContain('id="blogAutoGenerationSettings"');
    expect(blog).toContain('자동 생성 설정');
    expect(blog).toContain('자동 생성 주기');
    expect(blog).toContain('다음 생성 예정일');
    expect(blog).toContain('생성 개수');
    expect(blog).toContain('name="blog_publish_mode"');
    expect(blog).toContain('승인 후 발행 요청');
    expect(blog).toContain('자동 발행 요청');
    expect(blog).toContain('생성 완료 알림');
    expect(blog).toContain('콘텐츠 생성과 발행 요청 방식은 블로그 관리에서 설정합니다.');
  });

  it('defines benchmark criteria data for strategy ruleset comparison', () => {
    const fixturePath = path.join(webRoot, 'strategy_benchmark_fixture.json');
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as BenchmarkFixture;
    const typeIds = fixture.benchmarkTypes.map((type) => type.id);
    const requiredRows = ['positioning', 'menu', 'target', 'contentKeywords', 'reviewStrength', 'reviewWeakness'];

    expect(fixture.defaultType).toBe('recommended');
    expect(typeIds).toEqual(['recommended', 'sameIndustry', 'nearby', 'keywordTop', 'custom']);
    for (const type of fixture.benchmarkTypes) {
      expect(type.candidateCount).toBeGreaterThanOrEqual(3);
      expect(type.reviewCount).toBeGreaterThan(0);
      expect(type.keywordCount).toBeGreaterThan(0);
      expect(type.candidates.length).toBeGreaterThanOrEqual(3);
      expect(type.candidates.every((candidate) => candidate.basisTags.length > 0 && candidate.evidence.length > 0)).toBe(true);
      expect(type.comparison.map((row) => row.key)).toEqual(requiredRows);
      expect(type.comparison.every((row) => row.ourStore && row.benchmark && row.gap && row.recommendation && row.evidence.length > 0)).toBe(true);
    }
  });

  it('keeps our-store analysis focused and uses a right reference layer for item examples', () => {
    const ruleset = readWeb('07_마케팅전략룰셋.html');
    const brandSection = ruleset.match(/<!-- 우리 매장 분석 -->[\s\S]*?<!-- 글쓰기 스타일 -->/)?.[0] ?? '';

    expect(ruleset).toContain('strategy_benchmark_fixture.json');
    expect(ruleset).toContain('loadBenchmarkFixture');
    expect(ruleset).toContain('showReferenceLayer');
    expect(brandSection).toContain('class="analysis-focus-layout"');
    expect(brandSection).toContain('id="storeAnalysisReferencePanel"');
    expect(brandSection).toContain('id="referenceLayerTitle"');
    expect(brandSection).toContain('id="referenceLayerBody"');
    expect(brandSection).toContain('data-reference-key="positioning"');
    expect(brandSection).toContain('data-reference-key="menu"');
    expect(brandSection).toContain('data-reference-key="target"');
    expect(brandSection).toContain('data-reference-key="contentKeywords"');
    expect(brandSection).toContain('data-reference-key="reviewStrength"');
    expect(brandSection).toContain('data-reference-key="reviewWeakness"');
    expect(brandSection).toContain('포지셔닝');
    expect(brandSection).toContain('콘텐츠 소재 키워드');
    expect(brandSection).not.toContain('비교 기준 설정');
    expect(brandSection).not.toContain('id="benchmarkCandidateList"');
    expect(brandSection).not.toContain('id="benchmarkComparisonBody"');
  });

  it('shows multiple positioning reference candidates with name-distance-industry cards', () => {
    const ruleset = readWeb('07_마케팅전략룰셋.html');
    const fixture = JSON.parse(readFileSync(path.join(webRoot, 'strategy_benchmark_fixture.json'), 'utf8')) as BenchmarkFixture;
    const recommended = fixture.benchmarkTypes.find((type) => type.id === 'recommended');
    const positioning = recommended?.comparison.find((row) => row.key === 'positioning');

    expect(recommended?.candidates.length).toBeGreaterThanOrEqual(3);
    expect(positioning?.ourStore).toBe('분당·수지 지역 케이크 전문점');
    expect(recommended?.candidates[0]).toMatchObject({
      name: '케이크랩',
      location: '정자역 600m',
      category: '케이크전문점'
    });
    expect(ruleset).toContain('id="referenceCandidateList"');
    expect(ruleset).toContain('class="reference-candidate-card"');
    expect(ruleset).toContain('reference-candidate-meta');
    expect(ruleset).toContain('${escapeHtml(candidate.name)} · ${escapeHtml(candidate.location)} · ${escapeHtml(candidate.category)}');
    expect(ruleset).toContain('type.candidates.map');
    expect(ruleset).not.toContain("${candidate.category || '비교 후보'} · ${candidate.location || type.scope}");
  });

  it('moves similar-business comparison into its own tab with single-company and full comparison views', () => {
    const ruleset = readWeb('07_마케팅전략룰셋.html');
    const compareSection = ruleset.match(/<!-- 유사업체비교 -->[\s\S]*?<!-- 저장 모달 -->/)?.[0] ?? '';

    expect(ruleset).toContain("showTop('compare',this)");
    expect(ruleset).toContain('유사업체비교');
    expect(compareSection).toContain('id="sec-compare"');
    expect(compareSection).toContain('data-benchmark-panel');
    expect(compareSection).toContain('비교 유형');
    expect(compareSection).toContain('비교 업체 선택');
    expect(compareSection).toContain('id="comparisonTypeList"');
    expect(compareSection).toContain('id="comparisonCompanyList"');
    expect(compareSection).toContain('id="selectedCompanyComparison"');
    expect(compareSection).toContain('모두 비교');
    expect(ruleset).toContain('selectComparisonType');
    expect(ruleset).toContain('selectComparisonCompany');
    expect(ruleset).toContain('renderComparisonWorkspace');
    expect(ruleset).toContain('openFullComparison');
    expect(ruleset).toContain('id="modal-full-comparison"');
    expect(ruleset).toContain('id="fullComparisonBody"');
    expect(ruleset).toContain('id="modal-benchmark-evidence"');
  });

  it('shows a separate regeneratable writing preview block that combines style and store analysis signals', () => {
    const ruleset = readWeb('07_마케팅전략룰셋.html');
    const writeSection = ruleset.match(/<!-- 글쓰기 스타일 -->[\s\S]*?<!-- 이미지 스타일 -->/)?.[0] ?? '';

    expect(writeSection).toContain('id="writingStylePreview"');
    expect(writeSection).toContain('class="card writing-preview-card"');
    expect(writeSection).toContain('스타일·매장 분석 결합 미리보기');
    expect(writeSection).toContain('다시 생성하기');
    expect(writeSection).toContain('id="regenerateWritingPreviewBtn"');
    expect(writeSection).toContain('id="writingPreviewVariantLabel"');
    expect(writeSection).toContain('id="writingPreviewChannel"');
    expect(writeSection).toContain('id="writingPreviewBody"');
    expect(writeSection).toContain('id="writingPreviewMeta"');
    expect(writeSection).toContain('id="writingPreviewInputs"');
    expect(writeSection).toContain('결합되는 우리 매장 분석');
    expect(writeSection).toContain('포지셔닝');
    expect(writeSection).toContain('대표 메뉴');
    expect(writeSection).toContain('주 타겟층');
    expect(writeSection).toContain('리뷰 강점');
    expect(writeSection).toContain('리뷰 약점');
    expect(writeSection).toContain('# 전체 글 예시는 LLM API 연동 및 프롬프트 테스트 단계에서 업데이트합니다.');
    expect(ruleset).toContain('const WRITING_PREVIEWS');
    expect(ruleset).toContain('variants: [');
    expect(ruleset).toContain('let activeWritingChannel');
    expect(ruleset).toContain('let writingPreviewIndexes');
    expect(ruleset).toContain('renderWritingPreview');
    expect(ruleset).toContain('regenerateWritingPreview');
    expect(ruleset).toContain("renderWritingPreview(id)");
    expect(ruleset).toContain("common: {");
    expect(ruleset).toContain("insta: {");
    expect(ruleset).toContain("blog: {");
    expect(ruleset).toContain('특별한 날을 더 특별하게');
    expect(ruleset).toContain('분당 딸기 생크림 케이크 예약 안내');
    expect(ruleset).toContain('#분당케이크 #수지케이크 #레터링케이크');
  });

  it('shows detailed SEO scoring, image slots, and a fullscreen blog preview in AI content detail', () => {
    const detail = readWeb('09_AI콘텐츠생성_상세.html');

    expect(detail).toContain('id="seoScoreBreakdown"');
    expect(detail).toContain('SEO 세부 평가');
    expect(detail).toContain('제목 키워드');
    expect(detail).toContain('본문 키워드');
    expect(detail).toContain('메타 설명');
    expect(detail).toContain('이미지 ALT');
    expect(detail).toContain('가독성');
    expect(detail).toContain('[이미지1 배치]');
    expect(detail).toContain('[이미지2 배치]');
    expect(detail).toContain('class="content-image-slot"');
    expect(detail).toContain('id="openBlogPreviewBtn"');
    expect(detail).toContain('블로그 적용 미리보기');
    expect(detail).toContain('openBlogPreview');
    expect(detail).toContain('renderBlogPreview');
    expect(detail).toContain('id="modal-blog-preview"');
    expect(detail).toContain('class="modal blog-preview-modal"');
    expect(detail).toContain('id="blogPreviewBody"');
    expect(detail).toContain('id="blogPreviewImages"');
    expect(detail).toContain('closeBlogPreview');
  });

  it('labels Bizchat message capacity as reservation availability, not credits', () => {
    const dashboard = readWeb('soho_dashboard.html');
    const bizchatCard = dashboard.match(/<div class="svc-card-name">비즈챗<\/div>[\s\S]*?<\/a>/)?.[0] ?? '';

    expect(bizchatCard).toContain('발송 예약 가능');
    expect(bizchatCard).not.toContain('잔여 크레딧');
  });

  it('marks project-owner-only UI notes with a hash prefix while keeping PoC labels explicit', () => {
    const dashboard = readWeb('soho_dashboard.html');
    const fixture = readWeb('strategy_benchmark_fixture.json');
    const payment = readRepo('admin/21_결제내역.html');
    const faq = readRepo('admin/30_FAQ관리.html');
    const launchReadOnlyPages = [
      'admin/11_마케팅룰셋관리.html',
      'admin/12_프롬프트AI정책관리_마케팅.html',
      'admin/14_템플릿관리.html',
      'admin/15_프롬프트AI정책관리_비즈챗.html'
    ];

    expect(dashboard).toContain('# 화면 상태 전환 (기획 확인용)');
    expect(dashboard).not.toContain('▶ 화면 상태 전환 (기획 확인용)');
    expect(payment).toContain('# PG 연동 전 수동 처리');
    expect(payment).not.toContain('TBD: PG 연동 완료 후 자동화 예정');
    expect(faq).toContain('# 런칭 단계: 정적 FAQ 제공');
    expect(faq).not.toContain('런칭: 정적 FAQ 제공');
    expect(fixture).toContain('우선 기준으로 봅니다. # 현재는 정적 예시 후보로 동작합니다.');
    expect(fixture).not.toContain('우선 기준으로 봅니다. 현재는 정적 예시 후보로 동작합니다.');

    for (const file of launchReadOnlyPages) {
      const text = readRepo(file);
      expect(text, file).toContain('# 런칭 단계: 조회 전용');
      expect(text, file).not.toContain('런칭: 조회 Only');
    }

    expect(readWeb('event_operation_poc.html')).toContain('Event-to-Operation PoC');
    expect(readWeb('event_operation_poc.html')).toContain('mock mode ready');
    expect(readWeb('nav.html')).toContain('data-flow-label="LNB: 랜딩 PoC"');
  });

  it('keeps API-backed PoC runtime and trace indicators visible in the static UI', () => {
    const poc = readWeb('event_operation_poc.html');

    expect(poc).toContain('/api/runtime');
    expect(poc).toContain('/api/runtime/openai-probe');
    expect(poc).toContain('/api/approvals');
    expect(poc).toContain('generationTrace');
    expect(poc).toContain('trace?.steps');
    expect(poc).toContain('id="traceBox"');
    expect(poc).toContain('id="probeRuntimeBtn"');
    expect(poc).toContain('id="approvalHistoryList"');
  });

  it('does not over-mark non-flow controls or reintroduce the PoC sidebar', () => {
    const blog = stripComments(readWeb('02_블로그관리.html'));
    expect(blog).not.toMatch(/data-flow-target="[^"]+"[^>]*>\s*검색\s*</);
    expect(blog).not.toMatch(/data-flow-target="[^"]+"[^>]*>\s*초기화\s*</);

    const markerCount = htmlFiles()
      .filter((file) => file !== 'nav.html')
      .reduce((count, file) => count + (readWeb(file).match(/data-flow-target=/g)?.length ?? 0), 0);
    expect(markerCount).toBeLessThanOrEqual(45);
    expect(readWeb('event_operation_poc.html')).not.toContain('<aside class="sidebar">');
  });
});
