import { z } from 'zod';
import type { JsonRecord, ProviderEnv } from '../providers/placeImportTypes.js';

export const BlogPublishRequestSchema = z
  .object({
    publishMode: z.enum(['immediate', 'scheduled']).optional().default('immediate'),
    scheduledAt: z.string().datetime().nullable().optional(),
    requestedBy: z.string().trim().min(1).max(120).optional()
  })
  .superRefine((value, ctx) => {
    if (value.publishMode === 'scheduled' && !value.scheduledAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduledAt'],
        message: 'scheduledAt is required when publishMode is scheduled.'
      });
    }
  });

const BlogPublishPayloadSchema = z.object({
  postId: z.string().min(1),
  storeId: z.string().min(1),
  storeName: z.string().min(1),
  title: z.string().min(1),
  metaDescription: z.string(),
  bodyText: z.string().min(1),
  bodyHtml: z.string().min(1),
  cta: z.string(),
  seoKeywords: z.array(z.string()),
  imagePrompts: z.array(z.string()),
  mediaAssets: z.array(z.record(z.unknown())),
  seoScore: z.record(z.unknown()).nullable(),
  publishMode: z.enum(['immediate', 'scheduled']),
  scheduledAt: z.string().nullable(),
  requestedBy: z.string().nullable()
});

export type BlogPublishRequest = z.infer<typeof BlogPublishRequestSchema>;
export type BlogPublishPayload = z.infer<typeof BlogPublishPayloadSchema>;
export type BlogPublishProviderMode = 'local_status' | 'manual_export' | 'real';

export type BlogPublishProviderResult = {
  status: 'accepted';
  provider: {
    name: string;
    mode: BlogPublishProviderMode;
  };
  writeAction: 'local_status_only' | 'manual_export_only';
  externalWriteAttempted: false;
  externalRequestId: string | null;
  payload: BlogPublishPayload;
  notes: string[];
};

export type BlogPublishContext = {
  env: ProviderEnv;
  request: BlogPublishRequest;
  store: {
    id: string;
    name: string;
  };
  post: {
    id: string;
    storeId: string;
    title: string;
  };
  article: {
    metaDescription: string;
    bodyText: string;
    cta: string;
    seoKeywords: string[];
  };
  preview: {
    html: string;
  };
  mediaAssets: JsonRecord[];
  seoScore: JsonRecord | null;
};

export type BlogPublishProvider = {
  name: string;
  mode: BlogPublishProviderMode;
  requestPublish(context: BlogPublishContext): Promise<BlogPublishProviderResult>;
};

export type BlogPublishProviderConfig = 'local_status' | 'manual_export' | 'naver_blog_write';

export function configuredBlogPublishProvider(env: ProviderEnv): BlogPublishProviderConfig {
  const value = env.NAVER_BLOG_PUBLISH_PROVIDER?.trim();
  if (value === 'manual_export' || value === 'naver_blog_write' || value === 'local_status') return value;
  return 'local_status';
}

function payloadFromContext(context: BlogPublishContext) {
  const imagePrompts = context.mediaAssets
    .map((asset) => {
      const prompt = asset.prompt;
      return typeof prompt === 'string' ? prompt : '';
    })
    .filter(Boolean);

  return BlogPublishPayloadSchema.parse({
    postId: context.post.id,
    storeId: context.store.id,
    storeName: context.store.name,
    title: context.post.title,
    metaDescription: context.article.metaDescription,
    bodyText: context.article.bodyText,
    bodyHtml: context.preview.html,
    cta: context.article.cta,
    seoKeywords: context.article.seoKeywords,
    imagePrompts,
    mediaAssets: context.mediaAssets,
    seoScore: context.seoScore,
    publishMode: context.request.publishMode,
    scheduledAt: context.request.scheduledAt ?? null,
    requestedBy: context.request.requestedBy ?? null
  });
}

function acceptedResult(
  context: BlogPublishContext,
  provider: { name: string; mode: BlogPublishProviderMode },
  writeAction: BlogPublishProviderResult['writeAction'],
  notes: string[]
): BlogPublishProviderResult {
  return {
    status: 'accepted',
    provider,
    writeAction,
    externalWriteAttempted: false,
    externalRequestId: null,
    payload: payloadFromContext(context),
    notes
  };
}

function createLocalStatusBlogPublishProvider(): BlogPublishProvider {
  return {
    name: 'localStatusBlogPublishProvider',
    mode: 'local_status',
    async requestPublish(context) {
      return acceptedResult(
        context,
        { name: 'localStatusBlogPublishProvider', mode: 'local_status' },
        'local_status_only',
        ['Stored local publish_requested state only. No external Naver write was attempted.']
      );
    }
  };
}

function createManualExportBlogPublishProvider(): BlogPublishProvider {
  return {
    name: 'manualExportBlogPublishProvider',
    mode: 'manual_export',
    async requestPublish(context) {
      return acceptedResult(
        context,
        { name: 'manualExportBlogPublishProvider', mode: 'manual_export' },
        'manual_export_only',
        ['Prepared a manual export payload for owner-approved Naver Blog publishing. No external Naver write was attempted.']
      );
    }
  };
}

function createUnsupportedNaverBlogWriteProvider(): BlogPublishProvider {
  return {
    name: 'unsupportedNaverBlogWriteProvider',
    mode: 'real',
    async requestPublish() {
      throw new Error(
        'Naver Blog write API is not available as an official Open API. Use manual_export or an approved server-side publishing partner adapter.'
      );
    }
  };
}

export function createBlogPublishProvider(env: ProviderEnv): BlogPublishProvider {
  const provider = configuredBlogPublishProvider(env);
  if (provider === 'manual_export') return createManualExportBlogPublishProvider();
  if (provider === 'naver_blog_write') return createUnsupportedNaverBlogWriteProvider();
  return createLocalStatusBlogPublishProvider();
}
