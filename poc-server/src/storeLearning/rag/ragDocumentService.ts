import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DbConnection } from '../../db/connection.js';
import type { ProviderEnv } from '../providers/placeImportTypes.js';
import { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import { createInfoDocxBuffer, createReviewsDocxBuffer } from './docxWriter.js';
import { buildStoreInfoRagDocument } from './storeInfoRagBuilder.js';
import { buildStoreReviewRagDocument } from './reviewRagBuilder.js';
import { refreshPlaceReviewsForRag } from './ragReviewRefresh.js';
import { RAG_REVIEW_LIMIT } from './ragReviewPolicy.js';

export { RAG_REVIEW_LIMIT } from './ragReviewPolicy.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultOutputRoot = path.resolve(dirname, '../../../data/rag-documents');

export type RagDocumentManifest = {
  generatedAt: string;
  storeId: string;
  storeName: string;
  reviewCount: number;
  sourceCollectionRunId: string | null;
  files: {
    info: { path: string; fileName: string; downloadPath: string };
    reviews: { path: string; fileName: string; downloadPath: string };
  };
  warnings: string[];
};

export type RagDocumentServiceOptions = {
  connection: DbConnection;
  outputRoot?: string;
  env?: ProviderEnv;
};

export type GenerateRagDocumentsOptions = {
  refreshReviews?: boolean;
  reviewLimit?: number;
};

export type RagDocumentFileType = 'info' | 'reviews';

function safeFileName(value: string) {
  const cleaned = value
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .trim();
  return cleaned || 'store';
}

function manifestPath(outputRoot: string, storeId: string) {
  return path.join(outputRoot, safeFileName(storeId), 'manifest.json');
}

function latestCollectionRunId(connection: DbConnection, storeId: string): string | null {
  const repos = createStoreLearningRepositories(connection);
  const runs = repos.collectionRuns.listByStoreId(storeId);
  const latest = [...runs].sort((left, right) => {
    const leftTime = Date.parse(left.completedAt ?? left.updatedAt ?? left.createdAt);
    const rightTime = Date.parse(right.completedAt ?? right.updatedAt ?? right.createdAt);
    return rightTime - leftTime;
  })[0];
  return latest?.id ?? null;
}

export function readRagDocumentManifest(options: RagDocumentServiceOptions, storeId: string): RagDocumentManifest | null {
  const outputRoot = options.outputRoot ?? defaultOutputRoot;
  const filePath = manifestPath(outputRoot, storeId);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf8')) as RagDocumentManifest;
}

export function resetRagDocumentFile(
  options: RagDocumentServiceOptions,
  storeId: string,
  documentType: RagDocumentFileType
): RagDocumentManifest | null {
  const outputRoot = options.outputRoot ?? defaultOutputRoot;
  const filePath = manifestPath(outputRoot, storeId);
  const manifest = readRagDocumentManifest(options, storeId);
  if (!manifest) return null;

  const targetPath = manifest.files[documentType].path;
  if (existsSync(targetPath)) rmSync(targetPath, { force: true });

  const hasInfo = existsSync(manifest.files.info.path);
  const hasReviews = existsSync(manifest.files.reviews.path);
  if (!hasInfo && !hasReviews) {
    rmSync(filePath, { force: true });
    return null;
  }

  return manifest;
}

export async function generateRagDocuments(
  options: RagDocumentServiceOptions,
  storeId: string,
  generateOptions: GenerateRagDocumentsOptions = {}
): Promise<RagDocumentManifest> {
  const outputRoot = options.outputRoot ?? defaultOutputRoot;
  const repos = createStoreLearningRepositories(options.connection);
  const store = repos.stores.findById(storeId);
  if (!store) throw new Error(`Store not found: ${storeId}`);

  const requestedReviewLimit = Math.max(
    1,
    Math.min(RAG_REVIEW_LIMIT, Math.floor(generateOptions.reviewLimit ?? RAG_REVIEW_LIMIT))
  );
  const latestRunId = generateOptions.refreshReviews
    ? await refreshPlaceReviewsForRag({
        connection: options.connection,
        storeId,
        reviewLimit: requestedReviewLimit,
        env: options.env
      })
    : latestCollectionRunId(options.connection, storeId);
  const collectionItems = latestRunId
    ? repos.collectionItems.listByRunId(latestRunId)
    : repos.collectionItems.listByStoreId(storeId);
  const infoDocument = buildStoreInfoRagDocument(store);
  const reviewDocument = buildStoreReviewRagDocument({ store, collectionItems, latestRunId });
  const storeDir = path.join(outputRoot, safeFileName(storeId));
  mkdirSync(storeDir, { recursive: true });

  const storeName = safeFileName(store.name);
  const infoFileName = `info_${storeName}.docx`;
  const reviewsFileName = `reviews_${storeName}.docx`;
  const infoFilePath = path.join(storeDir, infoFileName);
  const reviewsFilePath = path.join(storeDir, reviewsFileName);
  writeFileSync(infoFilePath, await createInfoDocxBuffer(infoDocument));
  writeFileSync(reviewsFilePath, await createReviewsDocxBuffer(reviewDocument));

  const warnings = [...infoDocument.warnings, ...reviewDocument.warnings];

  const manifest: RagDocumentManifest = {
    generatedAt: new Date().toISOString(),
    storeId,
    storeName: store.name,
    reviewCount: reviewDocument.includedReviewCount,
    sourceCollectionRunId: latestRunId,
    files: {
      info: {
        path: infoFilePath,
        fileName: infoFileName,
        downloadPath: `/api/stores/${encodeURIComponent(storeId)}/rag-documents/info/download`
      },
      reviews: {
        path: reviewsFilePath,
        fileName: reviewsFileName,
        downloadPath: `/api/stores/${encodeURIComponent(storeId)}/rag-documents/reviews/download`
      }
    },
    warnings
  };
  writeFileSync(manifestPath(outputRoot, storeId), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
