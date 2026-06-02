import { describe, expect, it } from 'vitest';
import { getRuntimeStatus, probeOpenAIRuntime } from '../src/ai/runtimeHealth.js';

const now = () => '2026-06-02T11:00:00.000Z';

describe('OpenAI runtime health', () => {
  it('reports mock mode without exposing secrets when OpenAI is not configured', () => {
    const status = getRuntimeStatus({}, now);

    expect(status).toEqual({
      mode: 'mock',
      openaiConfigured: false,
      model: 'gpt-4o-mini',
      checkedAt: '2026-06-02T11:00:00.000Z'
    });
    expect(JSON.stringify(status)).not.toContain('sk-');
  });

  it('reports openai mode and configured model without exposing the API key', () => {
    const status = getRuntimeStatus(
      {
        OPENAI_API_KEY: 'sk-test-secret',
        OPENAI_MODEL: 'gpt-4.1-mini'
      },
      now
    );

    expect(status).toEqual({
      mode: 'openai',
      openaiConfigured: true,
      model: 'gpt-4.1-mini',
      checkedAt: '2026-06-02T11:00:00.000Z'
    });
    expect(JSON.stringify(status)).not.toContain('sk-test-secret');
  });

  it('skips live probe when OpenAI is not configured', async () => {
    const result = await probeOpenAIRuntime({
      env: {},
      now
    });

    expect(result).toEqual({
      mode: 'mock',
      openaiConfigured: false,
      model: 'gpt-4o-mini',
      checkedAt: '2026-06-02T11:00:00.000Z',
      ok: false,
      message: 'OPENAI_API_KEY is not configured'
    });
  });

  it('checks model access with an injected OpenAI client', async () => {
    const result = await probeOpenAIRuntime({
      env: {
        OPENAI_API_KEY: 'sk-test-secret',
        OPENAI_MODEL: 'gpt-4.1-mini'
      },
      client: {
        models: {
          retrieve: async (model: string) => ({ id: model })
        }
      } as any,
      now
    });

    expect(result).toEqual({
      mode: 'openai',
      openaiConfigured: true,
      model: 'gpt-4.1-mini',
      checkedAt: '2026-06-02T11:00:00.000Z',
      ok: true,
      message: 'OpenAI model access verified'
    });
  });

  it('records probe failure without exposing the API key', async () => {
    const result = await probeOpenAIRuntime({
      env: {
        OPENAI_API_KEY: 'sk-test-secret',
        OPENAI_MODEL: 'gpt-4.1-mini'
      },
      client: {
        models: {
          retrieve: async () => {
            throw new Error('401 invalid_api_key sk-test-secret');
          }
        }
      } as any,
      now
    });

    expect(result.ok).toBe(false);
    expect(result.message).toBe('401 invalid_api_key [redacted]');
    expect(JSON.stringify(result)).not.toContain('sk-test-secret');
  });
});
