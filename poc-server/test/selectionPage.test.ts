import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('..');
const webRoot = path.join(repoRoot, 'web');

describe('content selection static page API wiring', () => {
  it('loads a page-specific selection script without redesigning the page shell', () => {
    const html = readFileSync(path.join(webRoot, '05_AI학습_콘텐츠선택.html'), 'utf8');

    expect(html).toContain('AI 학습');
    expect(html).toContain('id="selection-blog-list"');
    expect(html).toContain('id="selection-place-list"');
    expect(html).toContain('id="selection-selected-count"');
    expect(html).toContain('id="selection-analysis-btn"');
    expect(html).toContain('id="selection-blog-raw-button"');
    expect(html).toContain('selection-evidence');
    expect(html).toContain('content_selection.js');
  });

  it('calls only poc-server selection APIs from browser code', () => {
    const js = readFileSync(path.join(webRoot, 'content_selection.js'), 'utf8');

    expect(js).toContain('fetch(`/api/collection-runs/${runId}/selectable-items`');
    expect(js).toContain('fetch(`/api/collection-items/${itemId}/selection`');
    expect(js).toContain("fetch('/api/analysis-runs'");
    expect(js).toContain('06_AI학습_현황.html?');
    expect(js).toContain('function evidenceBadges');
    expect(js).toContain('bodyAvailability');
    expect(js).toContain('blogSourceDiscovery');
    expect(js).toContain('collection_raw_data.html?');
    expect(js).toContain("next.searchParams.set('section', 'blogItems')");
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });

  it('shows server-driven analysis progress before moving to learning status', () => {
    const html = readFileSync(path.join(webRoot, '05_AI학습_콘텐츠선택.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'content_selection.js'), 'utf8');

    expect(html).toContain('id="selection-analysis-progress"');
    expect(html).toContain('분석 실행 준비');
    expect(html).toContain('콘텐츠 확정');
    expect(html).toContain('AI 분석');
    expect(html).toContain('룰셋 생성');
    expect(html).toContain('학습 현황 이동');

    expect(js).toContain("fetch('/api/analysis-runs'");
    expect(js).toContain('fetch(`/api/analysis-runs/${analysisRunId}/start`');
    expect(js).toContain('function setAnalysisStep');
    expect(js).toContain("setAnalysisStep('queued'");
    expect(js).toContain("setAnalysisStep('started'");
    expect(js).toContain("setAnalysisStep('ruleset'");
    expect(js).toContain("setAnalysisStep('navigate'");
  });

  it('shows a blocking analysis loading modal while waiting for automatic navigation', () => {
    const html = readFileSync(path.join(webRoot, '05_AI학습_콘텐츠선택.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'content_selection.js'), 'utf8');

    expect(html).toContain('id="selection-analysis-overlay"');
    expect(html).toContain('id="selection-analysis-overlay-status"');
    expect(html).toContain('id="selection-analysis-overlay-elapsed"');
    expect(html).toContain('id="selection-analysis-overlay-flow"');
    expect(html).toContain('결과 검증');
    expect(html).toContain('AI 분석을 실행하고 있습니다');
    expect(html).toContain('시간이 걸릴 수 있습니다');
    expect(html).toContain('완료 후 학습 현황 화면으로 자동 이동합니다');
    expect(html).toContain('잠시만 기다려주세요');
    expect(js).toContain('function setAnalysisOverlayVisible');
    expect(js).toContain('function setAnalysisOverlayStatus');
    expect(js).toContain('function startAnalysisProgressPolling');
    expect(js).toContain('fetch(`/api/analysis-runs/${analysisRunId}`');
    expect(js).toContain('analysisProgress');
    expect(js).toContain('selection-analysis-overlay-elapsed');
    expect(js).toContain('setAnalysisOverlayVisible(true)');
    expect(js).toContain('setAnalysisOverlayStatus(stateText');
    expect(js).toContain("setAnalysisStep('started', 'AI 분석 중')");
    expect(js).toContain('setAnalysisOverlayVisible(false)');
  });
});
