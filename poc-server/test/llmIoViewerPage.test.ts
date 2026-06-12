import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '../..');
const viewerPath = path.join(repoRoot, 'web', 'llm_io_viewer.html');

describe('internal LLM I/O viewer page', () => {
  it('uses the poc-server audit API and renders separated raw and normalized fields', () => {
    const exists = existsSync(viewerPath);

    expect(exists).toBe(true);
    if (!exists) return;

    const html = readFileSync(viewerPath, 'utf8');

    expect(html).toContain('/api/store-learning/llm-audit-logs');
    expect(html).toContain('raw_requested_json');
    expect(html).toContain('raw_parsed_output_json');
    expect(html).toContain('normalized_output_json');
    expect(html).toContain('rawRequestedJson');
    expect(html).toContain('rawParsedOutputJson');
    expect(html).toContain('normalizedOutputJson');
    expect(html).toContain("timeZone: 'Asia/Seoul'");
    expect(html).toContain('formatKoreaTime');
    expect(html).toContain('KST');
    expect(html).not.toMatch(/api\.openai\.com|OPENAI_API_KEY|NAVER_CLIENT_SECRET|dapi\.naver\.com/i);
  });
});
