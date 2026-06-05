import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('..');
const webRoot = path.join(repoRoot, 'web');

describe('store registration static page API wiring', () => {
  it('loads a page-specific store registration script without redesigning the page shell', () => {
    const html = readFileSync(path.join(webRoot, 'soho_store_register.html'), 'utf8');

    expect(html).toContain('id="place-url"');
    expect(html).toContain('id="f-name"');
    expect(html).toContain('id="f-addr1"');
    expect(html).toContain('id="f-desc"');
    expect(html).toContain('soho_store_register.js');
  });

  it('calls only poc-server store APIs from browser code', () => {
    const js = readFileSync(path.join(webRoot, 'soho_store_register.js'), 'utf8');

    expect(js).toContain("fetch('/api/stores/import-place'");
    expect(js).toContain("fetch('/api/stores'");
    expect(js).toContain('fetch(`/api/stores/${storeId}`');
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });
});

