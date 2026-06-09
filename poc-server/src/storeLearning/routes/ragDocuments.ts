import express from 'express';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import type { DbConnection } from '../../db/connection.js';
import type { ProviderEnv } from '../providers/placeImportTypes.js';
import {
  generateRagDocuments,
  readRagDocumentManifest,
  type RagDocumentManifest,
  type RagDocumentServiceOptions
} from '../rag/ragDocumentService.js';

type RagDocumentRouteOptions = RagDocumentServiceOptions & {
  connection: DbConnection;
  env?: ProviderEnv;
};

const GenerateRagDocumentsRequestSchema = z.object({
  refreshReviews: z.boolean().optional().default(false),
  reviewLimit: z.number().int().positive().optional().default(100)
});

function storeIdFrom(req: express.Request) {
  return (req.params as Record<string, string>).storeId;
}

function toPublicManifest(manifest: RagDocumentManifest) {
  return {
    generatedAt: manifest.generatedAt,
    storeId: manifest.storeId,
    storeName: manifest.storeName,
    reviewCount: manifest.reviewCount,
    sourceCollectionRunId: manifest.sourceCollectionRunId,
    files: {
      info: {
        fileName: manifest.files.info.fileName,
        downloadPath: manifest.files.info.downloadPath
      },
      reviews: {
        fileName: manifest.files.reviews.fileName,
        downloadPath: manifest.files.reviews.downloadPath
      }
    },
    warnings: manifest.warnings
  };
}

export function createRagDocumentRoutes(options: RagDocumentRouteOptions) {
  const router = express.Router({ mergeParams: true });

  router.post('/generate', async (req, res, next) => {
    try {
      const body = GenerateRagDocumentsRequestSchema.parse(req.body ?? {});
      const manifest = await generateRagDocuments(options, storeIdFrom(req), {
        refreshReviews: body.refreshReviews,
        reviewLimit: body.reviewLimit
      });
      res.json({ manifest: toPublicManifest(manifest) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/', (req, res, next) => {
    try {
      const manifest = readRagDocumentManifest(options, storeIdFrom(req));
      if (!manifest) {
        res.status(404).json({ error: 'RAG documents have not been generated for this store.' });
        return;
      }
      res.json({ manifest: toPublicManifest(manifest) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/info/download', (req, res, next) => {
    try {
      const manifest = readRagDocumentManifest(options, storeIdFrom(req));
      if (!manifest || !existsSync(manifest.files.info.path)) {
        res.status(404).json({ error: 'Info RAG document has not been generated.' });
        return;
      }
      res.download(manifest.files.info.path);
    } catch (error) {
      next(error);
    }
  });

  router.get('/reviews/download', (req, res, next) => {
    try {
      const manifest = readRagDocumentManifest(options, storeIdFrom(req));
      if (!manifest || !existsSync(manifest.files.reviews.path)) {
        res.status(404).json({ error: 'Reviews RAG document has not been generated.' });
        return;
      }
      res.download(manifest.files.reviews.path);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
