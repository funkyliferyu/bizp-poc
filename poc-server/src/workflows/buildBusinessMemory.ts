import { zodResponseFormat } from 'openai/helpers/zod';
import { getOpenAIClient } from '../ai/openaiClient.js';
import { prompts } from '../ai/prompts.js';
import { BusinessMemorySchema, type BusinessMemory, type GenerationStepTrace } from '../schemas/businessMemory.js';
import { cafeSeedFixture } from '../fixtures/cafeSeed.js';

type AssetInput = {
  businessId?: string;
  channelUrl?: string;
  pastedText?: string;
};

type ParseClient = {
  beta: {
    chat: {
      completions: {
        parse: (params: unknown) => Promise<{ choices: Array<{ message: { parsed: unknown } }> }>;
      };
    };
  };
};

type GenerationOptions = {
  client?: ParseClient | null;
  now?: () => string;
};

const nowIso = () => new Date().toISOString();

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function buildBusinessMemory(input: AssetInput = {}): BusinessMemory {
  const text = input.pastedText ?? '';
  const inferredName = text.match(/업체명[:\s]+([^\n]+)/)?.[1]?.trim();
  const inferredAddress = text.match(/주소[:\s]+([^\n]+)/)?.[1]?.trim();

  return BusinessMemorySchema.parse({
    ...cafeSeedFixture,
    businessId: input.businessId ?? cafeSeedFixture.businessId,
    business: {
      ...cafeSeedFixture.business,
      name: inferredName || cafeSeedFixture.business.name,
      address: inferredAddress || cafeSeedFixture.business.address
    },
    executionHistory: [
      ...cafeSeedFixture.executionHistory,
      `asset ingested${input.channelUrl ? `: ${input.channelUrl}` : ''}`
    ]
  });
}

function withTrace(memory: BusinessMemory, trace: GenerationStepTrace): BusinessMemory {
  return BusinessMemorySchema.parse({
    ...memory,
    generationTrace: trace
  });
}

export async function buildBusinessMemoryWithAI(
  input: AssetInput = {},
  options: GenerationOptions = {}
): Promise<{ memory: BusinessMemory; trace: GenerationStepTrace }> {
  const generatedAt = (options.now ?? nowIso)();
  const client = 'client' in options ? options.client : getOpenAIClient();

  if (!client) {
    const trace: GenerationStepTrace = {
      name: 'memory',
      mode: 'mock',
      generatedAt,
      fallbackReason: 'OPENAI_API_KEY is not configured'
    };
    return { memory: withTrace(buildBusinessMemory(input), trace), trace };
  }

  try {
    const completion = await client.beta.chat.completions.parse({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            `${prompts.assetExtractor} Return a complete Korean cafe business memory JSON. ` +
            'Preserve factual channel material, infer only conservative marketing facts, and avoid unsupported claims.'
        },
        {
          role: 'user',
          content: JSON.stringify(
            {
              businessId: input.businessId ?? cafeSeedFixture.businessId,
              channelUrl: input.channelUrl ?? '',
              pastedText: input.pastedText ?? '',
              fallbackShape: cafeSeedFixture
            },
            null,
            2
          )
        }
      ],
      response_format: zodResponseFormat(BusinessMemorySchema.omit({ generationTrace: true }), 'business_memory')
    });

    const parsed = BusinessMemorySchema.omit({ generationTrace: true }).parse(
      completion.choices[0]?.message.parsed
    );
    const trace: GenerationStepTrace = { name: 'memory', mode: 'openai', generatedAt };
    return { memory: withTrace(parsed, trace), trace };
  } catch (error) {
    const trace: GenerationStepTrace = {
      name: 'memory',
      mode: 'mock',
      generatedAt,
      fallbackReason: errorMessage(error)
    };
    return { memory: withTrace(buildBusinessMemory(input), trace), trace };
  }
}
