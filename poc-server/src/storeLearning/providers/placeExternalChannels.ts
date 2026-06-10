export type StoreExternalChannelName = 'blog' | 'instagram' | 'daangn' | 'youtube' | 'tiktok';

export type StoreExternalChannel = {
  channel: StoreExternalChannelName;
  label: string;
  url: string;
};

const CHANNEL_LABELS: Record<StoreExternalChannelName, string> = {
  blog: '블로그',
  instagram: '인스타그램',
  daangn: '당근',
  youtube: '유튜브',
  tiktok: '틱톡'
};

function cleanText(value: unknown) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned || null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function urlFrom(value: unknown) {
  if (typeof value === 'string') return cleanText(value);
  const record = asRecord(value);
  if (!record) return null;
  return cleanText(record.url ?? record.landingUrl ?? record.href ?? record.link ?? record.sourceUrl);
}

function labelFrom(value: unknown, channel: StoreExternalChannelName) {
  const record = asRecord(value);
  const label = record
    ? cleanText(record.label ?? record.type ?? record.typeI18n ?? record.name ?? record.iconName ?? record.title)
    : null;
  return label ?? CHANNEL_LABELS[channel];
}

function channelFromHost(hostname: string): StoreExternalChannelName | null {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'blog.naver.com' || host === 'm.blog.naver.com') return 'blog';
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') return 'youtube';
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok';
  if (host === 'daangn.com' || host.endsWith('.daangn.com') || host === 'karrotmarket.com' || host.endsWith('.karrotmarket.com')) {
    return 'daangn';
  }
  return null;
}

export function normalizeExternalChannelLink(input: unknown): StoreExternalChannel | null {
  const rawUrl = urlFrom(input);
  if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) return null;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const channel = channelFromHost(parsed.hostname);
  if (!channel) return null;

  return {
    channel,
    label: labelFrom(input, channel),
    url: rawUrl
  };
}

export function dedupeExternalChannelLinks(links: Array<StoreExternalChannel | null | undefined>) {
  const seen = new Set<string>();
  const deduped: StoreExternalChannel[] = [];
  for (const link of links) {
    if (!link) continue;
    const key = `${link.channel}:${link.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(link);
  }
  return deduped;
}

export function extractExternalChannelLinks(values: unknown) {
  const links: StoreExternalChannel[] = [];

  function collect(value: unknown, depth = 0) {
    if (depth > 5 || value === null || value === undefined) return;
    const normalized = normalizeExternalChannelLink(value);
    if (normalized) links.push(normalized);

    if (Array.isArray(value)) {
      value.forEach((item) => collect(item, depth + 1));
      return;
    }

    const record = asRecord(value);
    if (!record) return;
    for (const nested of Object.values(record)) collect(nested, depth + 1);
  }

  collect(values);
  return dedupeExternalChannelLinks(links);
}
