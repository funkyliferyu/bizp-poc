import { z } from 'zod';

export const EventSchema = z.object({
  eventId: z.string(),
  businessId: z.string(),
  eventType: z.literal('new_menu_discount'),
  menuName: z.string(),
  description: z.string(),
  discount: z.object({
    amount: z.number(),
    unit: z.literal('KRW')
  }),
  period: z.object({
    startDate: z.string(),
    endDate: z.string()
  }),
  images: z.array(z.string()),
  approvalRequired: z.boolean()
});

export type EventInput = z.infer<typeof EventSchema>;
