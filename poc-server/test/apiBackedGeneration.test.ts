import { describe, expect, it } from 'vitest';
import { cafeSeedFixture } from '../src/fixtures/cafeSeed.js';
import { watermelonEventFixture } from '../src/fixtures/watermelonEvent.js';
import { buildApprovalPackage } from '../src/workflows/buildApprovalPackage.js';
import { buildBusinessMemoryWithAI } from '../src/workflows/buildBusinessMemory.js';
import { generateChannelDrafts, generateChannelDraftsWithAI } from '../src/workflows/generateChannelDrafts.js';
import { generateTaskGraph } from '../src/workflows/generateTaskGraph.js';

const now = () => '2026-06-02T10:00:00.000Z';

const fakeClient = (parsed: unknown) =>
  ({
    beta: {
      chat: {
        completions: {
          parse: async () => ({
            choices: [{ message: { parsed } }]
          })
        }
      }
    }
  }) as any;

const throwingClient = () =>
  ({
    beta: {
      chat: {
        completions: {
          parse: async () => {
            throw new Error('LLM unavailable');
          }
        }
      }
    }
  }) as any;

describe('API-backed generation traces', () => {
  it('builds business memory through OpenAI when a valid client returns schema output', async () => {
    const parsedMemory = {
      ...cafeSeedFixture,
      business: {
        ...cafeSeedFixture.business,
        name: '라이브 카페',
        address: '서울시 강남구 테스트로 77'
      },
      executionHistory: ['openai extracted channel asset']
    };

    const result = await buildBusinessMemoryWithAI(
      {
        channelUrl: 'https://blog.naver.com/live-cafe',
        pastedText: '업체명: 라이브 카페\n주소: 서울시 강남구 테스트로 77'
      },
      { client: fakeClient(parsedMemory), now }
    );

    expect(result.memory.business.name).toBe('라이브 카페');
    expect(result.memory.generationTrace).toEqual({
      name: 'memory',
      mode: 'openai',
      generatedAt: '2026-06-02T10:00:00.000Z'
    });
    expect(result.trace.mode).toBe('openai');
  });

  it('falls back to mock business memory and records the reason when OpenAI fails', async () => {
    const result = await buildBusinessMemoryWithAI(
      {
        channelUrl: 'https://blog.naver.com/fallback-cafe',
        pastedText: '업체명: 폴백 카페\n주소: 서울시 마포구 폴백로 1'
      },
      { client: throwingClient(), now }
    );

    expect(result.memory.business.name).toBe('폴백 카페');
    expect(result.trace.mode).toBe('mock');
    expect(result.trace.fallbackReason).toContain('LLM unavailable');
    expect(result.memory.generationTrace?.fallbackReason).toContain('LLM unavailable');
  });

  it('generates channel drafts through OpenAI when a valid client returns schema output', async () => {
    const channelOutputs = await generateChannelDrafts(cafeSeedFixture, watermelonEventFixture);

    const result = await generateChannelDraftsWithAI(cafeSeedFixture, watermelonEventFixture, {
      client: fakeClient(channelOutputs),
      now
    });

    expect(result.channelOutputs.blog[0].body).toContain('수박주스');
    expect(result.trace).toEqual({
      name: 'channelDrafts',
      mode: 'openai',
      generatedAt: '2026-06-02T10:00:00.000Z'
    });
  });

  it('summarizes approval package trace as mixed when only some generation steps use OpenAI', async () => {
    const taskGraph = generateTaskGraph(watermelonEventFixture);
    const channelOutputs = await generateChannelDrafts(cafeSeedFixture, watermelonEventFixture);

    const approval = buildApprovalPackage({
      memory: {
        ...cafeSeedFixture,
        generationTrace: {
          name: 'memory',
          mode: 'openai',
          generatedAt: '2026-06-02T10:00:00.000Z'
        }
      },
      event: watermelonEventFixture,
      memoryChanges: ['수박주스 메뉴 추가'],
      taskGraph,
      channelOutputs,
      generationSteps: [
        { name: 'memory', mode: 'openai', generatedAt: '2026-06-02T10:00:00.000Z' },
        { name: 'taskGraph', mode: 'deterministic', generatedAt: '2026-06-02T10:00:00.000Z' },
        {
          name: 'channelDrafts',
          mode: 'mock',
          generatedAt: '2026-06-02T10:00:00.000Z',
          fallbackReason: 'schema validation failed'
        },
        { name: 'qualityCheck', mode: 'deterministic', generatedAt: '2026-06-02T10:00:00.000Z' }
      ]
    });

    expect(approval.trace.mode).toBe('mixed');
    expect(approval.trace.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'memory', mode: 'openai' }),
        expect.objectContaining({ name: 'channelDrafts', mode: 'mock' }),
        expect.objectContaining({ name: 'qualityCheck', mode: 'deterministic' })
      ])
    );
  });
});
