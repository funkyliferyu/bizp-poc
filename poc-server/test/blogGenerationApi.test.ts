import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { seedDemoStore } from '../src/seedStoreLearning.js';
import { createBlogPostRoutes } from '../src/storeLearning/routes/blogPosts.js';
import { createStoreRoutes } from '../src/storeLearning/routes/stores.js';

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

describe('ruleset based blog generation API', () => {
  let connection: DbConnection;
  let server: ReturnType<express.Express['listen']>;
  let baseUrl: string;

  beforeEach(() => {
    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    seedDemoStore(connection);

    const app = express();
    app.use(express.json());
    app.use('/api/stores', createStoreRoutes({ connection, env: {} }));
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

  it('generates an approval-pending blog post from the latest marketing ruleset', async () => {
    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/blog-posts/generate`, {
      method: 'POST'
    });
    const body = await readJson(response);
    const repos = createStoreLearningRepositories(connection);
    const post = repos.blogPosts.findById(body.blogPost.id);
    const generation = repos.contentGenerations.findById(body.contentGeneration.id);
    const mediaAssets = repos.mediaAssets.listByBlogPostId(body.blogPost.id);
    const seoScores = repos.seoScores.listByBlogPostId(body.blogPost.id);

    expect(response.status).toBe(200);
    expect(body.blogPost).toMatchObject({
      status: 'pending_approval',
      generatedFromRulesetId: expect.any(String),
      title: expect.stringContaining('분당')
    });
    expect(body.blogPost.article).toMatchObject({
      metaDescription: expect.any(String),
      bodySections: expect.arrayContaining([expect.objectContaining({ heading: expect.any(String) })]),
      seoKeywords: expect.arrayContaining(['분당 케이크']),
      cta: expect.any(String),
      generatedFromRulesetId: body.blogPost.generatedFromRulesetId
    });
    expect(generation).toMatchObject({
      storeId: 'store_demo_cake',
      rulesetId: body.blogPost.generatedFromRulesetId,
      status: 'generated',
      contentType: 'blog_post'
    });
    expect(post).toMatchObject({
      status: 'pending_approval',
      contentGenerationId: generation?.id,
      title: body.blogPost.title
    });
    expect(mediaAssets).toHaveLength(3);
    expect(mediaAssets.map((asset) => asset.status)).toEqual(['placeholder', 'placeholder', 'placeholder']);
    expect(seoScores[0]).toMatchObject({
      status: 'scored',
      score: expect.any(Number)
    });
    expect(seoScores[0].score).toBeGreaterThanOrEqual(70);
  });

  it('lists approval-pending blog posts and returns generated detail data', async () => {
    const generatedResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/blog-posts/generate`, {
      method: 'POST'
    });
    const generated = await readJson(generatedResponse);

    const listResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/blog-posts`);
    const list = await readJson(listResponse);
    expect(listResponse.status).toBe(200);
    expect(list.posts.map((post: { id: string }) => post.id)).toContain(generated.blogPost.id);
    expect(list.posts.find((post: { id: string }) => post.id === generated.blogPost.id)).toMatchObject({
      status: 'pending_approval',
      seoScore: expect.any(Number),
      generatedFromRulesetId: generated.blogPost.generatedFromRulesetId
    });

    const detailResponse = await fetch(`${baseUrl}/api/blog-posts/${generated.blogPost.id}`);
    const detail = await readJson(detailResponse);
    expect(detailResponse.status).toBe(200);
    expect(detail.blogPost).toMatchObject({
      id: generated.blogPost.id,
      status: 'pending_approval',
      article: expect.objectContaining({
        bodySections: expect.any(Array),
        seoKeywords: expect.any(Array)
      })
    });
    expect(detail.mediaAssets).toHaveLength(3);
    expect(detail.seoScore.score).toBeGreaterThanOrEqual(70);
    expect(detail.contentGeneration.id).toBe(generated.contentGeneration.id);
  });
});
