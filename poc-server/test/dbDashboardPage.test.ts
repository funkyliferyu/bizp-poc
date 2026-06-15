import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve('..');
const webRoot = path.join(repoRoot, 'web');

describe('SQL DB dashboard page', () => {
  it('provides a static dashboard page wired only to poc-server DB dashboard APIs', () => {
    const htmlPath = path.join(webRoot, 'sql_db_dashboard.html');
    const jsPath = path.join(webRoot, 'sql_db_dashboard.js');

    expect(existsSync(htmlPath)).toBe(true);
    expect(existsSync(jsPath)).toBe(true);

    const html = readFileSync(htmlPath, 'utf8');
    const js = readFileSync(jsPath, 'utf8');

    expect(html).toContain('SQL DB 대시보드');
    expect(html).toContain('id="db-dashboard-table-body"');
    expect(html).toContain('sql_db_dashboard.js');
    expect(html).toContain('<th>삭제</th>');
    expect(html).toContain('<th>플레이스</th>');
    expect(html).toContain('<th>블로그</th>');
    expect(html).not.toContain('<th>학습 플레이스</th>');
    expect(html).not.toContain('<th>학습 블로그</th>');
    expect(html).not.toContain('<th>초기화</th>');
    expect(js).toContain("fetch('/api/store-learning/db-dashboard')");
    expect(js).toContain("fetch('/api/store-learning/db-dashboard/reset'");
    expect(js).toContain("all: '삭제'");
    expect(js).toContain("generated_blog: '초기화'");
    expect(js).toContain('metric-cell');
    expect(js).toContain('data-reset-target="all"');
    expect(js).toContain('스토어 등록 자체를 삭제');
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });
});
