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

    expect(js).toContain("const STORE_ID_KEY = 'bizplanet.storeRegistration.storeId'");
    expect(js).toContain("const LEGACY_STORE_ID_KEY = 'storeLearningStoreId'");
    expect(js).toContain("params.get('storeId')");
    expect(js).toContain('window.localStorage.getItem(STORE_ID_KEY)');
    expect(js).toContain('window.localStorage.getItem(LEGACY_STORE_ID_KEY)');
    expect(js).toContain('window.localStorage.setItem(STORE_ID_KEY, storeId)');
    expect(js).toContain('fetch(`/api/stores/${storeId}/blog-posts?source=blog_formula_v2`)');
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
    expect(js).toContain('apiLinkedPosts');
    expect(js).toContain("generationSource?.type === 'blog_formula_v2'");
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

    expect(blogManagement).toContain('최종 업데이트: <strong id="blog-auto-last-updated"');
    expect(blogManagement).toContain('id="blog-auto-next-run"');
    expect(blogManagement).toContain('id="blog-auto-next-run-input"');
    expect(blogManagement).not.toContain('성과 데이터 마지막 업데이트');
    expect(js).toContain('AUTO_GENERATION_INTERVAL_DAYS = 14');
    expect(js).toContain('formatAutoDate');
    expect(js).toContain('updateAutoGenerationSchedule');
    expect(blogManagement).toContain('id="blog-v2-batch-generate-btn"');
    expect(blogManagement).toContain('생성배치 실행');
    expect(blogManagement).toContain('id="blog-v2-batch-modal"');
    expect(blogManagement).toContain('id="blog-v2-batch-steps"');
    expect(blogManagement).toContain('id="blog-v2-batch-modal-close"');
    expect(blogManagement).toContain('id="blog-v2-batch-spinner"');
    expect(blogManagement).toContain('id="blog-v2-batch-elapsed"');
    expect(js).toContain('blog-v2-batch-generate-btn');
    expect(js).toContain('blog-v2-batch-modal-close');
    expect(js).toContain('fetch(`/api/stores/${storeId}/blog-posts?source=blog_formula_v2`)');
    expect(js).toContain('blog-v2-batch-elapsed');
    expect(js).toContain('startBatchTimer');
    expect(js).toContain('stopBatchTimer');
    expect(js).toContain('apiLinkedPosts');
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
