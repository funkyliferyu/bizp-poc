import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type BenchmarkFixture = {
  defaultType: string;
  benchmarkTypes: unknown[];
};

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../web/strategy_benchmark_fixture.json'
);

function readBenchmarkFixture(): BenchmarkFixture {
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as BenchmarkFixture;
}

export function buildRulesetBenchmarkPayload(storeId: string) {
  const fixture = readBenchmarkFixture();
  return {
    storeId,
    provider: {
      name: 'mockRulesetBenchmarkProvider',
      mode: 'mock'
    },
    ...fixture
  };
}
