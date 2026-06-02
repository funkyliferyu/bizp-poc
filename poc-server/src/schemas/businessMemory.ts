import { z } from 'zod';

export const GenerationStepTraceSchema = z.object({
  name: z.string(),
  mode: z.enum(['mock', 'openai', 'deterministic']),
  generatedAt: z.string().optional(),
  fallbackReason: z.string().optional()
});

export const MenuSchema = z.object({
  name: z.string(),
  category: z.string(),
  price: z.number().nullable(),
  status: z.enum(['active', 'planned', 'paused'])
});

export const BusinessMemorySchema = z.object({
  businessId: z.string(),
  business: z.object({
    name: z.string(),
    category: z.string(),
    address: z.string(),
    tone: z.string()
  }),
  menus: z.array(MenuSchema),
  brandVoice: z.object({
    style: z.array(z.string()),
    forbidden: z.array(z.string())
  }),
  marketingAngles: z.array(z.string()),
  faq: z.array(
    z.object({
      question: z.string(),
      answer: z.string()
    })
  ),
  channelSop: z.object({
    blog: z.string(),
    place: z.string(),
    bizchat: z.string(),
    chatbot: z.string()
  }),
  executionHistory: z.array(z.string()),
  generationTrace: GenerationStepTraceSchema.optional()
});

export type GenerationStepTrace = z.infer<typeof GenerationStepTraceSchema>;
export type BusinessMemory = z.infer<typeof BusinessMemorySchema>;
