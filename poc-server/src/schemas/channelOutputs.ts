import { z } from 'zod';

export const ChannelOutputsSchema = z.object({
  blog: z.array(
    z.object({
      title: z.string(),
      body: z.string()
    })
  ),
  place: z.array(
    z.object({
      type: z.string(),
      body: z.string()
    })
  ),
  bizchat: z.array(
    z.object({
      messageType: z.string(),
      target: z.string(),
      sendTime: z.string(),
      cta: z.string(),
      body: z.string()
    })
  ),
  chatbot: z.array(
    z.object({
      question: z.string(),
      answer: z.string()
    })
  )
});

export type ChannelOutputs = z.infer<typeof ChannelOutputsSchema>;
