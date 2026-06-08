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

describe('Blog publish provider boundary', () => {
  let connection: DbConnection;
  let server: ReturnType<express.Express['listen']>;
  let baseUrl: string;

  async function startServer(env: Record<string, string | undefined>) {
    const app = express();
    app.use(express.json());
    app.use('/api/blog-posts', createBlogPostRoutes({ connection, env }));
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    });
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  beforeEach(async () => {
    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    seedDemoStore(connection);
  });

  afterEach(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    connection.close();
  });

  it('stores a manual-export publish request payload without external Naver writes', async () => {
    await startServer({
      NAVER_OWNER_AUTHORIZED: 'true',
      NAVER_BLOG_PUBLISH_PROVIDER: 'manual_export'
    });

    const response = await fetch(`${baseUrl}/api/blog-posts/blog_post_demo_pending_approval/request-publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publishMode: 'scheduled',
        scheduledAt: '2026-06-08T01:00:00.000Z',
        requestedBy: 'store-owner'
      })
    });
    const body = await readJson(response);
    const repos = createStoreLearningRepositories(connection);
    const post = repos.blogPosts.findById('blog_post_demo_pending_approval');
    const article = post?.article as Record<string, unknown>;
    const publishRequest = article.publishRequest as Record<string, unknown>;
    const payload = publishRequest.payload as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.blogPost.status).toBe('publish_requested');
    expect(body.blogPost.scheduledAt).toBe('2026-06-08T01:00:00.000Z');
    expect(post?.status).toBe('publish_requested');
    expect(post?.scheduledAt).toBe('2026-06-08T01:00:00.000Z');
    expect(publishRequest).toEqual(
      expect.objectContaining({
        publishMode: 'scheduled',
        scheduledAt: '2026-06-08T01:00:00.000Z',
        requestedBy: 'store-owner',
        writeAction: 'manual_export_only',
        externalWriteAttempted: false,
        provider: {
          name: 'manualExportBlogPublishProvider',
          mode: 'manual_export'
        }
      })
    );
    expect(payload).toEqual(
      expect.objectContaining({
        title: expect.stringContaining('분당'),
        bodyText: expect.any(String),
        bodyHtml: expect.stringContaining('<article'),
        imagePrompts: expect.any(Array),
        seoKeywords: expect.any(Array)
      })
    );
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('blocks unsupported Naver Blog write provider and leaves the post unchanged', async () => {
    await startServer({
      NAVER_OWNER_AUTHORIZED: 'true',
      NAVER_BLOG_PUBLISH_PROVIDER: 'naver_blog_write'
    });

    const response = await fetch(`${baseUrl}/api/blog-posts/blog_post_demo_pending_approval/request-publish`, {
      method: 'POST'
    });
    const body = await readJson(response);
    const repos = createStoreLearningRepositories(connection);
    const post = repos.blogPosts.findById('blog_post_demo_pending_approval');

    expect(response.status).toBe(400);
    expect(body.error).toContain('Naver Blog write API is not available');
    expect(post?.status).toBe('pending_approval');
    expect((post?.article as Record<string, unknown>).publishRequest).toBeUndefined();
  });
});
