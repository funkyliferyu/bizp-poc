export type ReviewSampleOptions = {
  seed: string;
  maxCount?: number;
  latestCount?: number;
};

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: string) {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function selectReviewSample<T>(reviews: readonly T[], options: ReviewSampleOptions): T[] {
  const maxCount = options.maxCount ?? 100;
  const latestCount = Math.min(options.latestCount ?? 20, maxCount);
  if (reviews.length <= maxCount) return [...reviews];

  const latest = reviews.slice(0, latestCount);
  const older = reviews.slice(latestCount);
  const olderTargetCount = maxCount - latest.length;
  if (olderTargetCount <= 0) return latest;

  const random = createRandom(options.seed);
  const selectedOlder: T[] = [];
  const selectedIndexes = new Set<number>();
  const segmentSize = older.length / olderTargetCount;

  for (let segmentIndex = 0; segmentIndex < olderTargetCount; segmentIndex += 1) {
    const start = Math.floor(segmentIndex * segmentSize);
    const end = Math.max(start, Math.min(older.length - 1, Math.floor((segmentIndex + 1) * segmentSize) - 1));
    let picked = start + Math.floor(random() * (end - start + 1));
    while (selectedIndexes.has(picked) && picked < older.length - 1) picked += 1;
    while (selectedIndexes.has(picked) && picked > 0) picked -= 1;
    selectedIndexes.add(picked);
    selectedOlder.push(older[picked]);
  }

  return [...latest, ...selectedOlder];
}
