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
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });
});
