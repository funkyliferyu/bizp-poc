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
});
