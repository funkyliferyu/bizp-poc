import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { seedDemoStore } from '../src/seedStoreLearning.js';
import { createBlogPostRoutes } from '../src/storeLearning/routes/blogPosts.js';

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

describe('content detail API', () => {
  let connection: DbConnection;
  let server: ReturnType<express.Express['listen']>;
  let baseUrl: string;

  beforeEach(() => {
    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    seedDemoStore(connection);

    const app = express();
    app.use(express.json());
    app.use('/api/blog-posts', createBlogPostRoutes({ connection }));
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    });
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    connection.close();
  });

  it('returns detail data with article, media prompts, and itemized SEO feedback', async () => {
    const response = await fetch(`${baseUrl}/api/blog-posts/blog_post_demo_pending_approval`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.blogPost).toMatchObject({
      id: 'blog_post_demo_pending_approval',
      status: 'pending_approval',
      title: expect.stringContaining('분당')
    });
    expect(body.article.bodyText).toContain('정자동');
    expect(body.mediaAssets[0]).toMatchObject({
      blogPostId: 'blog_post_demo_pending_approval',
      prompt: expect.any(String)
    });
    expect(body.seoScore).toMatchObject({
      totalScore: expect.any(Number),
      rubric: expect.objectContaining({
        titleKeyword: expect.any(Object),
        bodyKeyword: expect.any(Object),
        metaDescription: expect.any(Object),
        readability: expect.any(Object),
        imageAltPrompt: expect.any(Object),
        cta: expect.any(Object)
      })
    });
  });

  it('regenerates text deterministically and updates revision metadata plus SEO score', async () => {
    const response = await fetch(`${baseUrl}/api/blog-posts/blog_post_demo_pending_approval/regenerate-text`, {
      method: 'POST'
    });
    const body = await readJson(response);
    const repos = createStoreLearningRepositories(connection);
    const post = repos.blogPosts.findById('blog_post_demo_pending_approval');
    const scores = repos.seoScores.listByBlogPostId('blog_post_demo_pending_approval');

    expect(response.status).toBe(200);
    expect(body.blogPost.status).toBe('pending_approval');
    expect(body.blogPost.article.bodySections).toHaveLength(3);
    expect(body.blogPost.article.revisions.at(-1)).toMatchObject({
      type: 'text',
      generator: 'mock_ruleset_blog_generator'
    });
    expect(post?.title).toBe(body.blogPost.title);
    expect(scores.at(-1)?.totalScore).toBe(body.seoScore.totalScore);
  });

  it('regenerates image prompts without calling image providers', async () => {
    const response = await fetch(`${baseUrl}/api/blog-posts/blog_post_demo_pending_approval/regenerate-images`, {
      method: 'POST'
    });
    const body = await readJson(response);
    const repos = createStoreLearningRepositories(connection);
    const mediaAssets = repos.mediaAssets.listByBlogPostId('blog_post_demo_pending_approval');

    expect(response.status).toBe(200);
    expect(body.mediaAssets).toHaveLength(3);
    expect(body.mediaAssets.map((asset: { status: string }) => asset.status)).toEqual([
      'placeholder',
      'placeholder',
      'placeholder'
    ]);
    expect(body.mediaAssets[0].prompt).toContain('재생성');
    expect(mediaAssets[0].prompt).toBe(body.mediaAssets[0].prompt);
  });

  it('rescoring, preview, and publish request update the detail state', async () => {
    const scoreResponse = await fetch(`${baseUrl}/api/blog-posts/blog_post_demo_pending_approval/seo-score`, {
      method: 'POST'
    });
    const scoreBody = await readJson(scoreResponse);
    expect(scoreResponse.status).toBe(200);
    expect(scoreBody.seoScore.totalScore).toBeGreaterThanOrEqual(60);
    expect(Object.keys(scoreBody.seoScore.rubric)).toEqual([
      'titleKeyword',
      'bodyKeyword',
      'metaDescription',
      'readability',
      'imageAltPrompt',
      'cta'
    ]);

    const previewResponse = await fetch(`${baseUrl}/api/blog-posts/blog_post_demo_pending_approval/preview`);
    const previewBody = await readJson(previewResponse);
    expect(previewResponse.status).toBe(200);
    expect(previewBody.preview.html).toContain('<article');
    expect(previewBody.preview.title).toContain('분당');

    const publishResponse = await fetch(`${baseUrl}/api/blog-posts/blog_post_demo_pending_approval/request-publish`, {
      method: 'POST'
    });
    const publishBody = await readJson(publishResponse);
    const repos = createStoreLearningRepositories(connection);
    expect(publishResponse.status).toBe(200);
    expect(publishBody.blogPost.status).toBe('publish_requested');
    expect(repos.blogPosts.findById('blog_post_demo_pending_approval')?.status).toBe('publish_requested');
  });
});
