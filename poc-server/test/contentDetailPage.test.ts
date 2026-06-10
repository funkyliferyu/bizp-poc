import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('..');
const webRoot = path.join(repoRoot, 'web');

describe('AI content detail page API wiring', () => {
  it('has stable hooks for generated article, media prompts, SEO, preview, and publish actions', () => {
    const html = readFileSync(path.join(webRoot, '09_AI콘텐츠생성_상세.html'), 'utf8');

    expect(html).toContain('id="content-detail-title"');
    expect(html).toContain('id="content-detail-meta"');
    expect(html).toContain('id="content-provenance-line"');
    expect(html).toContain('id="content-detail-status"');
    expect(html).toContain('id="draftContentBody"');
    expect(html).toContain('id="seo-total-score"');
    expect(html).toContain('id="seoScoreItems"');
    expect(html).toContain('id="content-image-list"');
    expect(html).toContain('id="regenerate-text-btn"');
    expect(html).toContain('id="regenerate-images-btn"');
    expect(html).toContain('id="seo-rescore-btn"');
    expect(html).toContain('id="request-publish-btn"');
    expect(html).toContain('content_detail.js');
  });

  it('calls only poc-server blog detail APIs from browser code', () => {
    const js = readFileSync(path.join(webRoot, 'content_detail.js'), 'utf8');

    expect(js).toContain('fetch(`/api/blog-posts/${postId}`)');
    expect(js).toContain('fetch(`/api/blog-posts/${postId}/regenerate-text`');
    expect(js).toContain('fetch(`/api/blog-posts/${postId}/regenerate-images`');
    expect(js).toContain('fetch(`/api/blog-posts/${postId}/seo-score`');
    expect(js).toContain('fetch(`/api/blog-posts/${postId}/preview`)');
    expect(js).toContain('fetch(`/api/blog-posts/${postId}/request-publish`');
    expect(js).toContain('function renderContentProvenance');
    expect(js).toContain('content-provenance-line');
    expect(js).toContain('payload.contentProvenance');
    expect(js).toContain('payload.seoScore?.provenance');
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });
});
