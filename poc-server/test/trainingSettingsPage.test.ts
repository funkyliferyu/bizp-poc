import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('..');
const webRoot = path.join(repoRoot, 'web');

describe('AI training onboarding page API wiring', () => {
  it('loads a page-specific training settings script without redesigning the page shell', () => {
    const html = readFileSync(path.join(webRoot, '03_AI학습_온보딩.html'), 'utf8');

    expect(html).toContain('AI 학습 설정');
    expect(html).toContain('id="training-blog-limit"');
    expect(html).toContain('id="training-place-review-limit"');
    expect(html).toContain('id="training-instagram-limit"');
    expect(html).toContain('training_settings.js');
  });

  it('calls only poc-server training and collection APIs from browser code', () => {
    const js = readFileSync(path.join(webRoot, 'training_settings.js'), 'utf8');

    expect(js).toContain('fetch(`/api/stores/${storeId}/training-settings`');
    expect(js).toContain('fetch(`/api/stores/${storeId}/collection-runs`');
    expect(js).toContain('04_AI학습_수집중.html?');
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });
});
