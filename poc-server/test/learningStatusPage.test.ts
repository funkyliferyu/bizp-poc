import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('..');
const webRoot = path.join(repoRoot, 'web');

describe('learning status static page API wiring', () => {
  it('loads a page-specific learning status script without redesigning the page shell', () => {
    const html = readFileSync(path.join(webRoot, '06_AI학습_현황.html'), 'utf8');

    expect(html).toContain('AI 학습');
    expect(html).toContain('id="learning-last-analyzed"');
    expect(html).toContain('id="learning-ruleset-alert"');
    expect(html).toContain('id="learning-ruleset-alert-link"');
    expect(html).toContain('id="learning-ruleset-card"');
    expect(html).toContain('id="learning-ruleset-status"');
    expect(html).toContain('id="learning-blog-list"');
    expect(html).toContain('id="learning-place-profile"');
    expect(html).toContain('id="learning-place-reviews"');
    expect(html).toContain('id="learning-instagram-empty"');
    expect(html).toContain('learning_status.js');
  });

  it('calls only poc-server learning status APIs from browser code', () => {
    const js = readFileSync(path.join(webRoot, 'learning_status.js'), 'utf8');

    expect(js).toContain('fetch(`/api/stores/${storeId}/learning-status`)');
    expect(js).toContain('fetch(`/api/stores/${storeId}/learning-status/blog`)');
    expect(js).toContain('fetch(`/api/stores/${storeId}/learning-status/place`)');
    expect(js).toContain('fetch(`/api/stores/${storeId}/learning-status/instagram`)');
    expect(js).toContain('07_마케팅전략룰셋.html?');
    expect(js).toContain('wireRulesetNavigation(storeId)');
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });

  it('renders API-backed completion result hooks without provider calls', () => {
    const html = readFileSync(path.join(webRoot, '06_AI학습_현황.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'learning_status.js'), 'utf8');

    expect(html).toContain('id="learning-completion-summary"');
    expect(html).toContain('id="learning-completion-label"');
    expect(html).toContain('id="learning-completion-message"');
    expect(html).toContain('id="learning-completion-checklist"');
    expect(html).toContain('id="learning-analysis-provenance"');
    expect(html).toContain('id="learning-next-collection"');
    expect(html).toContain('id="learning-collection-cycle"');

    expect(js).toContain('function renderCompletion');
    expect(js).toContain('function renderAnalysisProvenance');
    expect(js).toContain('status.analysis?.provenance');
    expect(js).toContain('learning-analysis-provenance');
    expect(js).toContain('분석 입력 예산에 맞춰 일부 본문은 요약/제외되었습니다.');
    expect(js).toContain('개발 버전에서는 ${limitParts.join');
    expect(js).toContain('리뷰 최대 ${reviewItemLimit}개');
    expect(js).toContain('omittedBlogItemCount');
    expect(js).toContain('omittedReviewItemCount');
    expect(js).toContain('blogItemLimit');
    expect(js).toContain('reviewItemLimit');
    expect(js).toContain('status.completion');
    expect(js).toContain('learning-completion-checklist');
    expect(js).toContain('learning-next-collection');
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });

  it('creates a new collection run before relearn navigation', () => {
    const html = readFileSync(path.join(webRoot, '06_AI학습_현황.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'learning_status.js'), 'utf8');

    expect(html).toContain('id="learning-relearn-btn"');
    expect(html).not.toContain('onclick="location.href=\'04_AI학습_수집중.html\'"');

    expect(js).toContain('function createCollectionRun');
    expect(js).toContain('fetch(`/api/stores/${storeId}/collection-runs`');
    expect(js).toContain("method: 'POST'");
    expect(js).toContain('function goToCollectionProgress');
    expect(js).toContain('04_AI학습_수집중.html?');
    expect(js).toContain("next.searchParams.set('storeId', storeId)");
    expect(js).toContain("next.searchParams.set('runId', runId)");
    expect(js).toContain("window.localStorage.setItem(STORE_ID_KEY, storeId)");
  });

  it('dims the relearn button when new evidence thresholds are not met', () => {
    const js = readFileSync(path.join(webRoot, 'learning_status.js'), 'utf8');

    expect(js).toContain('function applyRelearnEligibility');
    expect(js).toContain('status.relearnEligibility');
    expect(js).toContain('재학습을 위해서는 블로그 3개, 리뷰 10개 이상의 신규 에셋이 필요합니다.');
    expect(js).toContain('button.disabled = !eligibility.allowed');
    expect(js).toContain('button.classList.toggle(\'is-disabled\', !eligibility.allowed)');
  });

  it('renders Blog rows as source links with published date and view count fields', () => {
    const js = readFileSync(path.join(webRoot, 'learning_status.js'), 'utf8');

    expect(js).toContain('data-blog-source-url');
    expect(js).toContain('learning-blog-row');
    expect(js).toContain("window.open(url, '_blank', 'noopener,noreferrer')");
    expect(js).toContain('blogPublishedDate(item)');
    expect(js).toContain('item.viewCount');
    expect(js).toContain('[.-](\\d{1,2})[.-](\\d{1,2})');
    expect(js).not.toContain('source-open-btn');
    expect(js).not.toContain('>열기</button>');
    expect(js).not.toContain("item.selectedForAnalysis ? '선택' : '-'");
  });

  it('renders Place dynamic sections and interactions without static placeholders', () => {
    const html = readFileSync(path.join(webRoot, '06_AI학습_현황.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'learning_status.js'), 'utf8');

    expect(html).toContain('id="learning-place-facts"');
    expect(html).toContain('id="learning-place-industry-sections"');
    expect(html).toContain('id="learning-place-photos"');
    expect(html).toContain('id="learning-visitor-photos"');
    expect(html).toContain('id="learning-review-controls"');
    expect(html).toContain('id="learning-review-expand"');
    expect(html).toContain('id="learning-review-prev"');
    expect(html).toContain('id="learning-review-next"');
    expect(html).toContain('id="learning-place-news"');
    expect(html).not.toContain('커스텀 레터링 케이크');
    expect(html).not.toContain('어버이날 특별 케이크 사전 주문 받습니다');

    expect(js).toContain('function renderPlaceFacts');
    expect(js).toContain('function renderPlaceIndustrySections');
    expect(js).toContain('function renderPlacePhotos');
    expect(js).toContain('function renderPlaceReviews');
    expect(js).toContain('function renderPlaceNews');
    expect(js).toContain('PLACE_REVIEW_COLLAPSED_LIMIT = 5');
    expect(js).toContain('PLACE_REVIEW_EXPANDED_LIMIT = 20');
    expect(js).toContain("window.open(url, '_blank', 'noopener,noreferrer')");
    expect(js).toContain("field('learning-place-news').style.display = newsItems.length === 0 ? 'none' : 'block'");
    expect(js).not.toContain('PLACE_REVIEW_COLLAPSED_LIMIT = 2');
  });
});
