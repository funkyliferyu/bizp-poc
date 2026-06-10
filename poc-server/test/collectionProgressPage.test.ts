import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('..');
const webRoot = path.join(repoRoot, 'web');

describe('collection progress static page API wiring', () => {
  it('loads a page-specific collection progress script without redesigning the page shell', () => {
    const html = readFileSync(path.join(webRoot, '04_AI학습_수집중.html'), 'utf8');

    expect(html).toContain('AI 학습');
    expect(html).toContain('id="collection-progress-status"');
    expect(html).toContain('id="collection-item-list"');
    expect(html).toContain('id="collection-next-btn"');
    expect(html).toContain('id="collection-blog-raw-button"');
    expect(html).toContain('collection_raw_data.html?runId=');
    expect(html).toContain('collection_progress.js');
  });

  it('polls only poc-server collection run APIs from browser code', () => {
    const js = readFileSync(path.join(webRoot, 'collection_progress.js'), 'utf8');

    expect(js).toContain('fetch(`/api/collection-runs/${runId}`');
    expect(js).toContain('fetch(`/api/collection-runs/${runId}/items`');
    expect(js).toContain('fetch(`/api/collection-runs/${runId}/start`');
    expect(js).toContain('05_AI학습_콘텐츠선택.html?');
    expect(js).toContain('function rawDataUrl');
    expect(js).toContain('collection_raw_data.html?');
    expect(js).toContain("next.searchParams.set('section', 'blogItems')");
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });

  it('renders requested-limit dashboard hooks without static mock review rows', () => {
    const html = readFileSync(path.join(webRoot, '04_AI학습_수집중.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'collection_progress.js'), 'utf8');

    expect(html).toContain('id="collection-summary-blog"');
    expect(html).toContain('id="collection-summary-place"');
    expect(html).toContain('id="collection-summary-instagram"');
    expect(html).toContain('id="collection-summary-overall"');
    expect(html).toContain('수집완료 콘텐츠 내역');
    expect(html).toContain('수집 완료된 콘텐츠입니다. 충분한 레퍼런스 콘텐츠가 확보되었는지 확인하세요.');
    expect(html).toContain('id="collection-review-expand"');
    expect(html).toContain('id="collection-review-prev"');
    expect(html).toContain('id="collection-review-next"');
    expect(html).not.toContain('수집 중 (23 / 50)');
    expect(html).not.toContain('AI 작성 의심 콘텐츠 안내');
    expect(html).not.toContain('class="check-cell"');
    expect(html).not.toContain('fake-check');
    expect(html).not.toContain('성남 케이크 맛집 :: 분당 베이커리 솔직 후기');

    expect(js).toContain('function requestedTargetForChannel');
    expect(js).toContain('REVIEW_COLLAPSED_LIMIT = 10');
    expect(js).toContain('REVIEW_PAGE_SIZE = 50');
    expect(js).toContain("field('collection-review-expand')");
    expect(js).toContain("field('collection-review-prev')");
    expect(js).toContain("field('collection-review-next')");
  });

  it('explains whether the user should wait or can leave on collection progress states', () => {
    const html = readFileSync(path.join(webRoot, '04_AI학습_수집중.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'collection_progress.js'), 'utf8');

    expect(html).toContain('id="collection-progress-guidance"');
    expect(js).toContain('이 화면에서 기다리면 진행 상황이 자동으로 갱신됩니다.');
    expect(js).toContain('페이지를 벗어나도 백그라운드에서 수집은 계속 진행됩니다.');
    expect(js).toContain('현재 수집은 종료되었습니다. 이 화면에서 더 기다려도 추가 수집은 진행되지 않습니다.');
    expect(js).toContain('가져올 수 있는 모든 항목이 수집되었습니다.');
  });

  it('treats source-exhausted Blog and Place collections as fully collected in the dashboard', () => {
    const js = readFileSync(path.join(webRoot, 'collection_progress.js'), 'utf8');

    expect(js).toContain('function availableTargetForChannel');
    expect(js).toContain('function displayTargetForChannel');
    expect(js).toContain('function isAllAvailableCollected');
    expect(js).toContain('전체 블로그 수집 완료');
    expect(js).toContain('전체 리뷰 수집 완료');
    expect(js).toContain('가져올 수 있는 모든 항목이 수집되었습니다.');
    expect(js).not.toContain('<strong>일부 항목만 수집되었습니다.</strong>');
  });

  it('renders no-change collection delta guidance for cached content reuse', () => {
    const js = readFileSync(path.join(webRoot, 'collection_progress.js'), 'utf8');

    expect(js).toContain('function collectionDelta');
    expect(js).toContain('function hasNoMeaningfulChanges');
    expect(js).toContain('신규 수집 0개');
    expect(js).toContain('새로 가져올 항목이 존재하지 않습니다.');
    expect(js).toContain('새로 분석할 콘텐츠가 없습니다.');
    expect(js).toContain("field('collection-next-btn').disabled = !terminal || noMeaningfulChanges");
  });
});
