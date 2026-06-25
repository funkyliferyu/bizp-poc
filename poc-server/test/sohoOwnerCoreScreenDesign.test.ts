import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('..');
const webRoot = path.join(repoRoot, 'web');

function readWeb(file: string) {
  return readFileSync(path.join(webRoot, file), 'utf8');
}

describe('Soho owner core screen redesign contracts', () => {
  it('turns the marketing dashboard into a today-work triage surface', () => {
    const html = readWeb('01_대시보드.html');

    expect(html).toContain('id="owner-today-work"');
    expect(html).toContain('오늘 먼저 할 일');
    expect(html).toContain('id="owner-primary-action-card"');
    expect(html).toContain('id="owner-learning-health"');
    expect(html).toContain('id="owner-blog-queue-preview"');
    expect(html).toContain('id="owner-monthly-summary"');
    expect(html).toContain('data-flow-target="02_블로그관리.html"');
    expect(html).toContain('data-flow-label="다음: 블로그 검토"');
  });

  it('turns blog management into a review queue before a full operations table', () => {
    const html = readWeb('02_블로그관리.html');

    expect(html).toContain('id="blog-review-queue"');
    expect(html).toContain('id="blog-review-queue-title"');
    expect(html).toContain('검토할 블로그 글');
    expect(html).toContain('id="blog-review-empty"');
    expect(html).toContain('id="blog-review-primary-action"');
    expect(html).toContain('id="blog-auto-generation-summary"');
    expect(html).toContain('id="blog-post-list"');
    expect(html).toContain('blog_posts.js');
  });

  it('turns content detail into a three-step review surface', () => {
    const html = readWeb('09_AI콘텐츠생성_상세.html');

    expect(html).toContain('id="content-review-steps"');
    expect(html).toContain('data-review-step="article"');
    expect(html).toContain('data-review-step="assets"');
    expect(html).toContain('data-review-step="publish"');
    expect(html).toContain('id="review-step-article"');
    expect(html).toContain('id="review-step-assets"');
    expect(html).toContain('id="review-step-publish"');
    expect(html).toContain('id="review-confidence-panel"');
    expect(html).toContain('글 내용 확인');
    expect(html).toContain('이미지와 SEO 확인');
    expect(html).toContain('발행 요청');
  });
});
