import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { getRuntimeStatus, probeOpenAIRuntime } from './ai/runtimeHealth.js';
import { createDatabaseConnection } from './db/connection.js';
import { migrateDatabase } from './db/migrate.js';
import { ApprovalPackageSchema } from './schemas/approvalPackage.js';
import { BusinessMemorySchema } from './schemas/businessMemory.js';
import { EventSchema } from './schemas/event.js';
import { createAnalysisRunRoutes } from './storeLearning/routes/analysisRuns.js';
import { createBlogFormulaV2Routes } from './storeLearning/routes/blogFormulaV2.js';
import { createBlogPostRoutes } from './storeLearning/routes/blogPosts.js';
import { createCollectionItemRoutes } from './storeLearning/routes/collectionItems.js';
import { createCollectionRunRoutes } from './storeLearning/routes/collectionRuns.js';
import { createRagDocumentRoutes } from './storeLearning/routes/ragDocuments.js';
import { createStoreLearningReadinessRoutes } from './storeLearning/routes/readiness.js';
import { createStoreRoutes } from './storeLearning/routes/stores.js';
import { buildApprovalPackage } from './workflows/buildApprovalPackage.js';
import { buildBusinessMemory, buildBusinessMemoryWithAI } from './workflows/buildBusinessMemory.js';
import { generateChannelDraftsWithAI } from './workflows/generateChannelDrafts.js';
import { generateTaskGraph } from './workflows/generateTaskGraph.js';
import { decideApprovalPackage } from './workflows/decideApprovalPackage.js';
import { summarizeApprovalHistory } from './workflows/approvalHistory.js';
import { createWatermelonEvent, updateMemoryForWatermelonEvent } from './workflows/runWatermelonEvent.js';
import { listJson, readJson, writeJson } from './storage/fileStore.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '../..');
const webRoot = path.resolve(repoRoot, 'web');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const storeLearningConnection = createDatabaseConnection();
migrateDatabase(storeLearningConnection);
app.use('/api/stores/:storeId/v2/blog-formula', createBlogFormulaV2Routes({ connection: storeLearningConnection }));
app.use('/api/stores', createStoreRoutes({ connection: storeLearningConnection }));
app.use('/api/collection-runs', createCollectionRunRoutes({ connection: storeLearningConnection }));
app.use('/api/collection-items', createCollectionItemRoutes({ connection: storeLearningConnection }));
app.use('/api/analysis-runs', createAnalysisRunRoutes({ connection: storeLearningConnection }));
app.use('/api/blog-posts', createBlogPostRoutes({ connection: storeLearningConnection }));
app.use('/api/stores/:storeId/rag-documents', createRagDocumentRoutes({ connection: storeLearningConnection }));
app.use('/api/store-learning', createStoreLearningReadinessRoutes({ connection: storeLearningConnection }));

const ApprovalDecisionRequestSchema = z.object({
  action: z.enum(['request_revision', 'reject', 'approve']),
  note: z.string().optional(),
  reviewer: z.string().optional()
});

app.get('/api/runtime', (_req, res) => {
  res.json(getRuntimeStatus());
});

app.post('/api/runtime/openai-probe', async (_req, res, next) => {
  try {
    res.json(await probeOpenAIRuntime());
  } catch (error) {
    next(error);
  }
});

app.post('/api/assets/ingest', async (req, res, next) => {
  try {
    const assetId = `asset-${Date.now()}`;
    const asset = {
      assetId,
      businessId: req.body.businessId ?? 'cafe-demo',
      channelUrl: req.body.channelUrl ?? '',
      pastedText: req.body.pastedText ?? '',
      createdAt: new Date().toISOString()
    };
    await writeJson('assets', assetId, asset);
    res.json(asset);
  } catch (error) {
    next(error);
  }
});

app.post('/api/memory/build', async (req, res, next) => {
  try {
    const { memory } = await buildBusinessMemoryWithAI(req.body);
    await writeJson('businesses', memory.businessId, memory);
    res.json(memory);
  } catch (error) {
    next(error);
  }
});

app.get('/api/memory/:businessId', async (req, res, next) => {
  try {
    const memory = BusinessMemorySchema.parse(await readJson('businesses', req.params.businessId));
    res.json(memory);
  } catch (error) {
    next(error);
  }
});

app.post('/api/events/watermelon', async (req, res, next) => {
  try {
    const event = EventSchema.parse(createWatermelonEvent(req.body));
    await writeJson('events', event.eventId, event);
    const memory = BusinessMemorySchema.parse(
      req.body.memory ?? (await readJson('businesses', event.businessId).catch(() => buildBusinessMemory()))
    );
    const updated = updateMemoryForWatermelonEvent(memory, event);
    await writeJson('businesses', event.businessId, updated.memory);
    res.json({ event, businessMemory: updated.memory, memoryChanges: updated.changes });
  } catch (error) {
    next(error);
  }
});

app.post('/api/events/:eventId/run', async (req, res, next) => {
  try {
    const event = EventSchema.parse(await readJson('events', req.params.eventId));
    const memory = BusinessMemorySchema.parse(await readJson('businesses', event.businessId));
    const taskGraph = generateTaskGraph(event);
    const { channelOutputs, trace: channelTrace } = await generateChannelDraftsWithAI(memory, event);
    const generatedAt = new Date().toISOString();
    const approval = buildApprovalPackage({
      memory,
      event,
      memoryChanges: [`${event.menuName} 메뉴 추가`, '7월 할인 이벤트 추가', '챗봇 FAQ 후보 추가'],
      taskGraph,
      channelOutputs,
      generationSteps: [
        memory.generationTrace ?? { name: 'memory', mode: 'mock', generatedAt },
        { name: 'taskGraph', mode: 'deterministic', generatedAt },
        channelTrace,
        { name: 'qualityCheck', mode: 'deterministic', generatedAt }
      ]
    });
    await writeJson('approvals', approval.approvalId, approval);
    res.json(approval);
  } catch (error) {
    next(error);
  }
});

app.get('/api/approvals/:approvalId', async (req, res, next) => {
  try {
    const approval = ApprovalPackageSchema.parse(await readJson('approvals', req.params.approvalId));
    res.json(approval);
  } catch (error) {
    next(error);
  }
});

app.get('/api/approvals', async (_req, res, next) => {
  try {
    const approvals = (await listJson('approvals'))
      .map((approval) => ApprovalPackageSchema.parse(approval));
    res.json({ approvals: summarizeApprovalHistory(approvals) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/approvals/:approvalId/decision', async (req, res, next) => {
  try {
    const body = ApprovalDecisionRequestSchema.parse(req.body);
    const approval = ApprovalPackageSchema.parse(await readJson('approvals', req.params.approvalId));
    const decided = decideApprovalPackage(approval, body);
    await writeJson('approvals', decided.approvalId, decided);
    res.json(decided);
  } catch (error) {
    next(error);
  }
});

app.use(express.static(webRoot));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  res.status(400).json({ error: message });
});

const port = Number(process.env.PORT ?? 5177);
app.listen(port, () => {
  console.log(`Event-to-Operation PoC running at http://localhost:${port}/event_operation_poc.html`);
});
