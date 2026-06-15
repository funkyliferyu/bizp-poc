import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('..');
const webRoot = path.join(repoRoot, 'web');

describe('blog post list page API wiring', () => {
  it('connects blog management and AI content list pages to shared blog post JS', () => {
    const blogManagement = readFileSync(path.join(webRoot, '02_블로그관리.html'), 'utf8');
    const contentList = readFileSync(path.join(webRoot, '08_AI콘텐츠생성_목록.html'), 'utf8');

    expect(blogManagement).toContain('id="blog-post-list"');
    expect(blogManagement).toContain('id="blog-pending-count"');
    expect(blogManagement).toContain('blog_posts.js');
    expect(contentList).toContain('id="ai-content-list"');
    expect(contentList).toContain('id="ai-content-pending-count"');
    expect(contentList).toContain('id="blog-generate-btn"');
    expect(contentList).toContain('blog_posts.js');
  });

  it('calls only poc-server blog post APIs from browser code', () => {
    const js = readFileSync(path.join(webRoot, 'blog_posts.js'), 'utf8');

    expect(js).toContain('fetch(`/api/stores/${storeId}/blog-posts`)');
    expect(js).toContain('fetch(`/api/stores/${storeId}/blog-posts/generate`');
    expect(js).toContain('09_AI콘텐츠생성_상세.html?postId=${post.id}');
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });

  it('renders pending approval CTA and generation source hooks on Blog management lists', () => {
    const blogManagement = readFileSync(path.join(webRoot, '02_블로그관리.html'), 'utf8');
    const contentList = readFileSync(path.join(webRoot, '08_AI콘텐츠생성_목록.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'blog_posts.js'), 'utf8');

    expect(blogManagement).toContain('id="blog-pending-alert"');
    expect(blogManagement).toContain('id="blog-pending-action"');
    expect(contentList).toContain('id="ai-content-source-note"');
    expect(js).toContain('payload.summary');
    expect(js).toContain('firstPendingApprovalHref');
    expect(js).toContain('generationSource');
    expect(js).toContain('data-generation-source');
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });

  it('wires the Blog management V2 batch generation button and progress modal to poc-server APIs', () => {
    const blogManagement = readFileSync(path.join(webRoot, '02_블로그관리.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'blog_posts.js'), 'utf8');

    expect(blogManagement).toContain('id="blog-v2-batch-generate-btn"');
    expect(blogManagement).toContain('생성배치 실행');
    expect(blogManagement).toContain('id="blog-v2-batch-modal"');
    expect(blogManagement).toContain('id="blog-v2-batch-steps"');
    expect(blogManagement).toContain('id="blog-v2-batch-modal-close"');
    expect(js).toContain('blog-v2-batch-generate-btn');
    expect(js).toContain('blog-v2-batch-modal-close');
    expect(js).toContain('fetch(`/api/stores/${storeId}/blog-posts/v2-batch-candidates`)');
    expect(js).toContain('fetch(`/api/stores/${storeId}/blog-posts/generate-from-v2-formula`');
    expect(js).toContain("providerMode: 'openai'");
    expect(js).toContain('1/3');
    expect(js).toContain('3/3');
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });
});
