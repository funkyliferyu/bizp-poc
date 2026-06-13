import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve('..');
const webRoot = path.join(repoRoot, 'web');

function extractSection(html: string, startMarker: string, endMarker: string): string {
  return html.match(new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`))?.[0] ?? '';
}

describe('Blog Formula V2 static UI lane', () => {
  const futureCombinedMode = ['hybrid', 'v1', 'v2'].join('_');

  it('adds a separate Blog Formula V2 tab without mixing V2 controls into V1 writing-style fields', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const writeSection = extractSection(html, '<!-- 글쓰기 스타일 -->', '<!-- Blog Formula V2 -->');
    const formulaSection = extractSection(html, '<!-- Blog Formula V2 -->', '<!-- 유사업체비교 -->');

    expect(html).toContain("showTop('formula-v2',this)");
    expect(html).toContain('블로그 작성 포뮬라');
    expect(html).toContain('id="sec-formula-v2"');
    expect(html).toContain('blog_formula_v2.js');

    expect(writeSection).toContain('data-ruleset-field="titlePatterns"');
    expect(writeSection).not.toContain('v2FormulaStatus');
    expect(formulaSection).toContain('Blog Formula V2');
    expect(formulaSection).toContain('id="v2FormulaStatus"');
    expect(formulaSection).toContain('id="v2FormulaExtractButton"');
    expect(formulaSection).toContain('id="v2RetrievedSamples"');
    expect(formulaSection).toContain('id="v2DraftPreview"');
    expect(formulaSection).toContain('id="v2ValidationPanel"');
    expect(formulaSection).not.toContain('data-ruleset-field=');
    expect(formulaSection).not.toContain('rulesetFieldsByKey');
    expect(formulaSection).not.toContain(futureCombinedMode);
  });

  it('keeps the browser script on poc-server V2 APIs only and avoids provider credentials or external calls', () => {
    const js = readFileSync(path.join(webRoot, 'blog_formula_v2.js'), 'utf8');

    expect(js).toContain('fetch(`/api/stores/${storeId}/v2/blog-formula`)');
    expect(js).toContain('fetch(`/api/stores/${storeId}/v2/blog-formula/extract`');
    expect(js).toContain('fetch(`/api/stores/${storeId}/v2/blog-formula/retrieve-samples`');
    expect(js).toContain('fetch(`/api/stores/${storeId}/v2/blog-formula/generate-draft`');
    expect(js).toContain('fetch(`/api/stores/${storeId}/v2/blog-formula/validate-draft`');
    expect(js).not.toContain('/strategy-ruleset');
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
    expect(js).not.toContain(futureCombinedMode);
    expect(() => new Function(js)).not.toThrow();
  });

  it('renders v2.1 formula blocks including arrays and sequences', () => {
    const js = readFileSync(path.join(webRoot, 'blog_formula_v2.js'), 'utf8');

    expect(js).toContain('titleFormula');
    expect(js).toContain('sequence');
    expect(js).toContain('softPatterns');
    expect(js).toContain('preferredPhrases');
    expect(js).toContain('bannedClaims');
  });

  it('runs the extract button through the server-side openai provider with a progress overlay', () => {
    const js = readFileSync(path.join(webRoot, 'blog_formula_v2.js'), 'utf8');

    // The extract button must ask the poc-server route for the openai provider,
    // not fall through to the instant deterministic path.
    expect(js).toContain("providerMode: 'openai'");
    expect(js).toMatch(/body:\s*JSON\.stringify\(\{\s*providerMode: 'openai'\s*\}\)/);

    // A long (~30-60s) call needs a visible in-progress overlay with an elapsed timer.
    expect(js).toContain('v2ExtractOverlay');
    expect(js).toContain('showExtractOverlay');
    expect(js).toContain('hideExtractOverlay');
    expect(js).toContain('setInterval');

    // The browser still never holds provider credentials.
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });

  it('defines the extract progress overlay element on the V2 tab', () => {
    const html = readFileSync(path.join(webRoot, '07_마케팅전략룰셋.html'), 'utf8');
    const formulaSection = extractSection(html, '<!-- Blog Formula V2 -->', '<!-- 유사업체비교 -->');

    expect(formulaSection).toContain('id="v2ExtractOverlay"');
    expect(formulaSection).toContain('id="v2ExtractOverlayStatus"');
    expect(formulaSection).toContain('id="v2ExtractOverlayElapsed"');
  });
});
