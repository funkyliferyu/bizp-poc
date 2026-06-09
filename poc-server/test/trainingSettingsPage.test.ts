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
    expect(html).toContain('id="training-daangn-url"');
    expect(html).toContain('id="training-daangn-limit"');
    expect(html).toContain('id="training-blog-status"');
    expect(html).toContain('id="training-place-status"');
    expect(html).toContain('id="training-instagram-status"');
    expect(html).toContain('id="training-daangn-status"');
    expect(html).toContain('id="training-material-list"');
    expect(html).toContain('id="training-keyword-list"');
    expect(html.match(/value="1">최근 1개/g)?.length).toBeGreaterThanOrEqual(4);
    expect(html.match(/value="10">최근 10개/g)?.length).toBeGreaterThanOrEqual(4);
    expect(html).not.toContain('mybakery2024');
    expect(html).not.toContain('https://naver.me/xxxxxx');
    expect(html).not.toContain('브랜드소개서.pdf');
    expect(html).not.toContain('분당 케이크');
    expect(html).toContain('training_settings.js');
  });

  it('calls only poc-server training and collection APIs from browser code', () => {
    const js = readFileSync(path.join(webRoot, 'training_settings.js'), 'utf8');

    expect(js).toContain('fetch(`/api/stores/${storeId}/training-settings`');
    expect(js).toContain('fetch(`/api/stores/${storeId}/collection-runs`');
    expect(js).toContain('04_AI학습_수집중.html?');
    expect(js).toContain("sourceUrl: textValue('training-blog-url')");
    expect(js).toContain("daangnPostLimit: numericValue('training-daangn-limit')");
    expect(js).toContain('function deriveStoreChannelSources');
    expect(js).toContain('function applyStoreSnapshot');
    expect(js).toContain('function setChannelStatus');
    expect(js).toContain('function renderTrainingMaterials');
    expect(js).toContain('function renderTrainingKeywords');
    expect(js).toContain("channelSource(payload, 'blog') ||");
    expect(js).toContain('firstUrlMatching(homepageUrls, /(^|\\/\\/)(m\\.)?blog\\.naver\\.com\\//i)');
    expect(js).toContain("setTextValue('training-blog-url', settings.channels.naverBlog.sourceUrl || storeChannelSources.blog)");
    expect(js).toContain('await saveSettings();');
    expect(js).toContain('body: JSON.stringify({})');
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });
});
