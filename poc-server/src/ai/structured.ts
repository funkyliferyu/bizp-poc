import type { z } from 'zod';

export function validateStructuredOutput<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}
