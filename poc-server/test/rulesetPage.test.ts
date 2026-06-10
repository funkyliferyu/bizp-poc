import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('..');
const webRoot = path.join(repoRoot, 'web');

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

  it('renders source matrix containers and field hooks for currently static ruleset rows', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'ruleset_editor.js'), 'utf8');
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

    expect(html).toContain('data-source-matrix-section="store"');
    expect(html).toContain('data-source-matrix-section="brand"');
    expect(html).toContain('data-source-matrix-section="write_common,write_instagram,write_blog"');
    expect(html).toContain('data-source-matrix-section="image_common,image_instagram,image_blog"');
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

  it('labels direct store facts as Place collected values instead of AI generated values', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const storeSection = html.match(/<!-- 매장 정보 -->[\s\S]*?<!-- 우리 매장 분석 -->/)?.[0] ?? '';

    expect(storeSection).toContain('Place 수집');
    expect(storeSection).not.toContain('AI 수집');
    expect(storeSection).not.toContain('AI 분석');
  });
});
