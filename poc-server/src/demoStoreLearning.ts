import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabaseConnection } from './db/connection.js';
import { migrateDatabase } from './db/migrate.js';
import { createStoreLearningRepositories } from './repositories/storeLearningRepositories.js';
import { seedDemoStore } from './seedStoreLearning.js';

export function runStoreLearningDemo() {
  const connection = createDatabaseConnection();
  try {
    migrateDatabase(connection);
    const seed = seedDemoStore(connection);
    const repos = createStoreLearningRepositories(connection);
    const store = repos.stores.findById(seed.storeId);
    const blogPost = repos.blogPosts.findById(seed.blogPostId);

    return {
      database: connection.filename,
      store,
      channels: repos.storeChannels.listByStoreId(seed.storeId),
      collectionItems: repos.collectionItems.listByRunId(seed.collectionRunId),
      rulesets: repos.marketingRulesets.listByStoreId(seed.storeId),
      blogPost,
      mediaAssets: repos.mediaAssets.listByBlogPostId(seed.blogPostId),
      seoScores: repos.seoScores.listByBlogPostId(seed.blogPostId),
      auditEvents: repos.auditEvents.listByStoreId(seed.storeId)
    };
  } finally {
    connection.close();
  }
}

function isCliInvocation() {
  return process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
}

if (isCliInvocation()) {
  const result = runStoreLearningDemo();
  console.log(
    [
      'Store Learning demo seeded',
      `database=${result.database}`,
      `store=${result.store?.name ?? 'unknown'}`,
      `channels=${result.channels.length}`,
      `collectionItems=${result.collectionItems.length}`,
      `blogPostStatus=${result.blogPost?.status ?? 'unknown'}`,
      `seoScore=${result.seoScores[0]?.score ?? 'n/a'}`
    ].join('\n')
  );
}
