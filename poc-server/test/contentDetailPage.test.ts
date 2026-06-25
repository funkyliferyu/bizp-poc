import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import express from 'express';
import { chromium } from 'playwright';

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
    expect(js).toContain('provenance.action');
    expect(js).toContain('provenance.inputBudget');
    expect(js).toContain('content-provenance-line');
    expect(js).toContain('payload.contentProvenance');
    expect(js).toContain('payload.seoScore?.provenance');
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });

  it('keeps existing detail APIs while adding the three-step owner review flow', () => {
    const html = readFileSync(path.join(webRoot, '09_AI콘텐츠생성_상세.html'), 'utf8');
    const js = readFileSync(path.join(webRoot, 'content_detail.js'), 'utf8');

    expect(html).toContain('id="content-review-steps"');
    expect(html).toContain('id="review-step-article"');
    expect(html).toContain('id="review-step-assets"');
    expect(html).toContain('id="review-step-publish"');
    expect(html).toContain('id="review-confidence-panel"');
    expect(html).toContain('id="detail-next-assets-btn"');
    expect(html).toContain('id="detail-next-publish-btn"');
    expect(html).toMatch(/id="review-step-publish"[\s\S]*id="openBlogPreviewBtn"/);
    expect(html).not.toMatch(/id="review-step-article"[\s\S]*id="openBlogPreviewBtn"[\s\S]*id="review-step-assets"/);
    expect(js).toContain('function setReviewStep');
    expect(js).toContain('function renderReviewConfidence');
    expect(js).toContain("setReviewStep('article')");
    expect(js).toContain('fetch(`/api/blog-posts/${postId}`)');
    expect(js).toContain('fetch(`/api/blog-posts/${postId}/preview`)');
    expect(js).toContain('fetch(`/api/blog-posts/${postId}/request-publish`');
    expect(js).not.toMatch(/fetch\(['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/);
    expect(js).not.toContain('OPENAI');
    expect(js).not.toContain('NAVER_CLIENT');
  });

  it('trims paragraph excerpts from rendered image prompts in the article and image list', async () => {
    const app = express();
    app.get('/api/blog-posts/post_prompt_trim', (_req, res) => {
      res.json({
        blogPost: {
          id: 'post_prompt_trim',
          status: 'pending_approval',
          title: '슈링크의 효과, 당신이 알아야 할 모든 것',
          createdAt: '2026-06-15T00:00:00.000Z',
          article: null
        },
        article: {
          title: '슈링크의 효과, 당신이 알아야 할 모든 것',
          bodySections: [{ heading: '슈링크 효과와 관리 필요성 상담 전 확인할 점', body: '안녕하세요. 테라스의원 대표원장 권유정입니다.' }]
        },
        mediaAssets: [
          {
            id: 'media_prompt_trim',
            prompt:
              '슈링크 효과 대표 이미지: "슈링크 효과와 관리 필요성 상담 전 확인할 점" 단락의 내용을 표현하는 이미지 설명 - 안녕하세요. 테라스의원 대표원장 권유정입니다.',
            alt: null
          }
        ],
        seoScore: { totalScore: 81, rubric: {} }
      });
    });
    app.use(express.static(webRoot));

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      await page.route('https://fonts.googleapis.com/**', (route) =>
        route.fulfill({ contentType: 'text/css', body: '' })
      );
      await page.goto(`http://127.0.0.1:${port}/09_AI%EC%BD%98%ED%85%90%EC%B8%A0%EC%83%9D%EC%84%B1_%EC%83%81%EC%84%B8.html?postId=post_prompt_trim`, {
        waitUntil: 'domcontentloaded'
      });
      await page.waitForSelector('[data-image-slot="1"]');

      const inlinePrompt = await page.locator('[data-image-slot="1"]').textContent();
      const cardPrompt = await page.locator('#content-image-list .img-card').textContent();

      expect(inlinePrompt).toContain('단락의 내용을 표현하는 이미지 설명');
      expect(cardPrompt).toContain('단락의 내용을 표현하는 이미지 설명');
      expect(inlinePrompt).not.toContain('안녕하세요. 테라스의원');
      expect(cardPrompt).not.toContain('안녕하세요. 테라스의원');
    } finally {
      await browser.close();
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it('renders blog preview without duplicate title or intro and places image slots between full sections', async () => {
    const app = express();
    app.get('/api/blog-posts/post_preview_layout/preview', (_req, res) => {
      res.json({
        preview: {
          title: '울쎄라600샷가격, 성공적인 치료를 위한 중요한 요소는?',
          metaDescription: '검색 결과용 요약 문장입니다.',
          bodySections: [
            {
              heading: '울쎄라 치료의 비용 및 효과 상담 전 확인할 점',
              body: '첫 번째 단락 전체 문장입니다. 중간에 잘리지 않고 마지막 문장까지 보여야 합니다.'
            },
            {
              heading: '울쎄라600샷가격 핵심 안내',
              body: '두 번째 단락 전체 문장입니다. 가격과 상담 기준을 끝까지 설명합니다.'
            }
          ],
          cta: '상담으로 본인에게 맞는 계획을 확인해 주세요.',
          html: '<article><h1>중복되면 안 되는 제목</h1><p>중복 인트로</p></article>',
          mediaAssets: [
            { id: 'media_1', prompt: '대표 이미지: 단락의 내용을 표현하는 이미지 설명 - 불필요한 본문', alt: null },
            { id: 'media_2', prompt: '본문 이미지 2: 단락의 내용을 표현하는 이미지 설명 - 불필요한 본문', alt: null }
          ]
        },
        seoScore: { totalScore: 86 }
      });
    });
    app.get('/api/blog-posts/post_preview_layout', (_req, res) => {
      res.json({
        blogPost: {
          id: 'post_preview_layout',
          status: 'pending_approval',
          title: '울쎄라600샷가격, 성공적인 치료를 위한 중요한 요소는?',
          createdAt: '2026-06-15T00:00:00.000Z',
          article: null
        },
        article: {
          title: '울쎄라600샷가격, 성공적인 치료를 위한 중요한 요소는?',
          bodySections: [{ heading: '상세 본문', body: '상세 본문입니다.' }]
        },
        mediaAssets: [],
        seoScore: { totalScore: 86, rubric: {} }
      });
    });
    app.use(express.static(webRoot));

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      await page.route('https://fonts.googleapis.com/**', (route) =>
        route.fulfill({ contentType: 'text/css', body: '' })
      );
      await page.goto(`http://127.0.0.1:${port}/09_AI%EC%BD%98%ED%85%90%EC%B8%A0%EC%83%9D%EC%84%B1_%EC%83%81%EC%84%B8.html?postId=post_preview_layout`, {
        waitUntil: 'domcontentloaded'
      });
      await page.click('[data-review-step="publish"]');
      await page.click('#openBlogPreviewBtn');
      await page.waitForSelector('#modal-blog-preview[style*="flex"]');

      const titleCount = await page.locator('.blog-preview-article h1').count();
      const duplicateServerTitleCount = await page.locator('#blogPreviewBody h1').count();
      const imageCount = await page.locator('#blogPreviewBody .blog-preview-image').count();
      const bodyText = await page.locator('#blogPreviewBody').textContent();
      const firstImagePosition = await page.locator('#blogPreviewBody > *').evaluateAll((nodes) =>
        nodes.map((node) => Array.from(node.classList).join(' ') || node.tagName.toLowerCase())
      );

      expect(titleCount).toBe(1);
      expect(duplicateServerTitleCount).toBe(0);
      expect(imageCount).toBe(2);
      expect(bodyText).toContain('첫 번째 단락 전체 문장입니다. 중간에 잘리지 않고 마지막 문장까지 보여야 합니다.');
      expect(bodyText).toContain('두 번째 단락 전체 문장입니다. 가격과 상담 기준을 끝까지 설명합니다.');
      expect(bodyText).not.toContain('검색 결과용 요약 문장입니다.');
      expect(firstImagePosition).toEqual([
        'blog-preview-section',
        'blog-preview-image',
        'blog-preview-section',
        'blog-preview-image',
        'blog-preview-cta'
      ]);
    } finally {
      await browser.close();
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it('updates the review confidence SEO summary after rescoring', async () => {
    const app = express();
    app.use(express.json());
    app.get('/api/blog-posts/post_rescore_summary', (_req, res) => {
      res.json({
        blogPost: {
          id: 'post_rescore_summary',
          status: 'pending_approval',
          title: '분당 케이크 맛집 추천',
          createdAt: '2026-06-15T00:00:00.000Z',
          article: null
        },
        article: {
          title: '분당 케이크 맛집 추천',
          bodySections: [{ heading: '본문', body: '상세 본문입니다.' }]
        },
        mediaAssets: [{ id: 'media_1', prompt: '대표 이미지', alt: null }],
        seoScore: { totalScore: 72, rubric: {} }
      });
    });
    app.post('/api/blog-posts/post_rescore_summary/seo-score', (_req, res) => {
      res.json({
        seoScore: {
          totalScore: 91,
          rubric: {},
          provenance: { provider: 'mock', action: 'seo_rescore' }
        }
      });
    });
    app.use(express.static(webRoot));

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      await page.route('https://fonts.googleapis.com/**', (route) =>
        route.fulfill({ contentType: 'text/css', body: '' })
      );
      await page.goto(`http://127.0.0.1:${port}/09_AI%EC%BD%98%ED%85%90%EC%B8%A0%EC%83%9D%EC%84%B1_%EC%83%81%EC%84%B8.html?postId=post_rescore_summary`, {
        waitUntil: 'domcontentloaded'
      });
      await expect.poll(() => page.locator('#review-confidence-seo').textContent()).toBe('72점 · 확인 필요');
      await page.click('[data-review-step="assets"]');
      await page.click('#seo-rescore-btn');
      await expect.poll(() => page.locator('#review-confidence-seo').textContent()).toBe('91점 · 발행 가능');
    } finally {
      await browser.close();
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });
});
