import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('..');
const webRoot = path.join(repoRoot, 'web');

describe('collection raw data static page API wiring', () => {
  it('renders a collection RAW data viewer with Blog evidence tabs', () => {
    const html = readFileSync(path.join(webRoot, 'collection_raw_data.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'collection_raw_data.js'), 'utf8');

    expect(html).toContain('Collection RAW data');
    expect(html).toContain('id="raw-section-tabs"');
    expect(html).toContain('id="raw-json"');
    expect(html).toContain('id="raw-copy-button"');
    expect(html).toContain('collection_raw_data.js');
    expect(js).toContain("key: 'blogItems'");
    expect(js).toContain("key: 'collectedBlogItems'");
    expect(js).toContain("key: 'failedBlogItems'");
    expect(js).toContain("key: 'allItems'");
    expect(js).toContain("key: 'collectionRun'");
    expect(js).toContain('metadata.bodyAvailability');
    expect(js).toContain('metadata.blogSourceDiscovery');
  });

  it('calls only poc-server collection APIs from the RAW viewer', () => {
    const js = readFileSync(path.join(webRoot, 'collection_raw_data.js'), 'utf8');

    expect(js).toContain('fetch(`/api/collection-runs/${runId}`');
    expect(js).toContain('fetch(`/api/collection-runs/${runId}/items`');
    expect(js).toContain('function highlightJson');
    expect(js).toContain('pre.dataset.rawJson = json');
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });
});
