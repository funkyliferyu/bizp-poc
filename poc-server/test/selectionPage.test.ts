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
    expect(html).toContain('content_selection.js');
  });

  it('calls only poc-server selection APIs from browser code', () => {
    const js = readFileSync(path.join(webRoot, 'content_selection.js'), 'utf8');

    expect(js).toContain('fetch(`/api/collection-runs/${runId}/selectable-items`');
    expect(js).toContain('fetch(`/api/collection-items/${itemId}/selection`');
    expect(js).toContain("fetch('/api/analysis-runs'");
    expect(js).toContain('06_AI학습_현황.html?');
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });
});
