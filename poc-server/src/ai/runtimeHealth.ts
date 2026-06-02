import { getOpenAIClient } from './openaiClient.js';

type RuntimeEnv = Partial<Pick<NodeJS.ProcessEnv, 'OPENAI_API_KEY' | 'OPENAI_MODEL'>>;

type ModelProbeClient = {
  models: {
    retrieve: (model: string) => Promise<unknown>;
  };
};

type RuntimeStatus = {
  mode: 'mock' | 'openai';
  openaiConfigured: boolean;
  model: string;
  checkedAt: string;
};

type RuntimeProbe = RuntimeStatus & {
  ok: boolean;
  message: string;
};

const DEFAULT_MODEL = 'gpt-4o-mini';
const nowIso = () => new Date().toISOString();

function redactSecrets(message: string) {
  return message.replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]');
}

export function getRuntimeStatus(env: RuntimeEnv = process.env, now: () => string = nowIso): RuntimeStatus {
  const openaiConfigured = Boolean(env.OPENAI_API_KEY);

  return {
    mode: openaiConfigured ? 'openai' : 'mock',
    openaiConfigured,
    model: env.OPENAI_MODEL ?? DEFAULT_MODEL,
    checkedAt: now()
  };
}

export async function probeOpenAIRuntime(params: {
  env?: RuntimeEnv;
  client?: ModelProbeClient | null;
  now?: () => string;
} = {}): Promise<RuntimeProbe> {
  const env = params.env ?? process.env;
  const status = getRuntimeStatus(env, params.now);

  if (!status.openaiConfigured) {
    return {
      ...status,
      ok: false,
      message: 'OPENAI_API_KEY is not configured'
    };
  }

  const client = 'client' in params ? params.client : getOpenAIClient();
  if (!client) {
    return {
      ...status,
      ok: false,
      message: 'OpenAI client is unavailable'
    };
  }

  try {
    await client.models.retrieve(status.model);
    return {
      ...status,
      ok: true,
      message: 'OpenAI model access verified'
    };
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    return {
      ...status,
      ok: false,
      message: redactSecrets(rawMessage)
    };
  }
}
