import { z } from 'zod';

export const ChannelSchema = z.enum(['blog', 'place', 'bizchat', 'chatbot']);

export const TaskGraphSchema = z.object({
  eventId: z.string(),
  tasks: z.array(
    z.object({
      id: z.string(),
      channel: ChannelSchema,
      title: z.string(),
      description: z.string(),
      approvalRequired: z.boolean()
    })
  )
});

export type Channel = z.infer<typeof ChannelSchema>;
export type TaskGraph = z.infer<typeof TaskGraphSchema>;
