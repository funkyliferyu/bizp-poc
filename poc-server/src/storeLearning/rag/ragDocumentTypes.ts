import { z } from 'zod';

export const StoreInfoSectionSchema = z.object({
  title: z.string().min(1),
  lines: z.array(z.string().min(1))
});

export const StoreInfoRagDocumentSchema = z.object({
  storeId: z.string().min(1),
  storeName: z.string().min(1),
  title: z.string().min(1),
  generatedAt: z.string().min(1),
  sections: z.array(StoreInfoSectionSchema),
  warnings: z.array(z.string()).default([])
});

export const StoreReviewEntrySchema = z.object({
  ordinal: z.number().int().positive(),
  reviewId: z.string().min(1),
  reviewerName: z.string().nullable(),
  reviewDate: z.string().nullable(),
  rating: z.number().nullable(),
  bodyText: z.string().min(1),
  ownerReplyText: z.string().nullable(),
  replyStatus: z.enum(['replied', 'not_replied']),
  sourceUrl: z.string().nullable(),
  keywords: z.array(z.string()).default([])
});

export const StoreReviewRagDocumentSchema = z.object({
  storeId: z.string().min(1),
  storeName: z.string().min(1),
  title: z.string().min(1),
  generatedAt: z.string().min(1),
  totalCollectedReviews: z.number().int().nonnegative(),
  includedReviewCount: z.number().int().nonnegative(),
  samplingStrategy: z.string().min(1),
  entries: z.array(StoreReviewEntrySchema),
  warnings: z.array(z.string()).default([])
});

export type StoreInfoSection = z.infer<typeof StoreInfoSectionSchema>;
export type StoreInfoRagDocument = z.infer<typeof StoreInfoRagDocumentSchema>;
export type StoreReviewEntry = z.infer<typeof StoreReviewEntrySchema>;
export type StoreReviewRagDocument = z.infer<typeof StoreReviewRagDocumentSchema>;
