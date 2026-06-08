import type { StoreChannel } from '../../repositories/store_channels.js';
import type { Store } from '../../repositories/stores.js';
import { configuredBlogProvider, configuredPlaceProvider } from '../providers/ownerSourcePolicy.js';
import type { JsonRecord, ProviderEnv } from '../providers/placeImportTypes.js';
import {
  renderNaverPlacePage,
  type RenderedPlaceSnapshot
} from '../providers/naverPlaceRenderedProvider.js';
import type { CollectionPlan, CollectionProvider, CollectionProviderItemDraft } from './collectionProviders.js';
import { createMockCollectionProvider } from './mockCollectionProvider.js';
import { createNaverSearchCollectionProvider } from './naverSearchCollectionProvider.js';

export type RenderedBlogSnapshot = RenderedPlaceSnapshot;

export type NaverBlogRenderer = (url: string, env: ProviderEnv) => Promise<RenderedBlogSnapshot>;

export type RenderedBlogPost = {
  blogId: string | null;
  logNo: string | null;
  title: string | null;
  authorName: string | null;
  publishedAt: string | null;
  sourceUrl: string | null;
  bodyText: string | null;
  tags: string[];
  imageUrls: string[];
};

const RESTRICTED_MARKERS = [
  '서비스 이용이 제한되었습니다',
  '과도한 접근 요청으로 서비스 이용이 제한되었습니다',
  '잠시 후 다시 시도해주세요'
];

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_match, number: string) => String.fromCodePoint(parseInt(number, 10)));
}

function cleanText(value: unknown) {
  if (value === null || value === undefined) return null;
  const cleaned = decodeHtmlEntities(String(value))
    .replace(/\u001c/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
}

function stripTags(value: string) {
  return cleanText(
    value
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(?:br|\/p|\/div|\/section|\/h[1-6]|\/li|\/article)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );
}

function attribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'));
  return cleanText(match?.[1]);
}

function metaMap(html: string) {
  const values = new Map<string, string>();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const key = attribute(tag, 'property') ?? attribute(tag, 'name');
    const content = attribute(tag, 'content');
    if (key && content) values.set(key, content);
  }
  return values;
}

function isRestrictedSnapshot(snapshot: RenderedBlogSnapshot) {
  const text = `${snapshot.bodyText ?? ''}\n${snapshot.html}`;
  return RESTRICTED_MARKERS.some((marker) => text.includes(marker));
}

function naverBlogUrl(value: string | null) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'blog.naver.com' && host !== 'm.blog.naver.com') return null;
    return url;
  } catch {
    return null;
  }
}

function firstPathSegment(url: URL) {
  return url.pathname.split('/').filter(Boolean)[0] ?? null;
}

function postParamsFrom(value: string | null) {
  const url = naverBlogUrl(value);
  if (!url) return null;

  const queryBlogId = cleanText(url.searchParams.get('blogId'));
  const queryLogNo = cleanText(url.searchParams.get('logNo'));
  if (queryBlogId && queryLogNo) return { blogId: queryBlogId, logNo: queryLogNo };

  const [blogId, logNo] = url.pathname.split('/').filter(Boolean);
  if (blogId && logNo && /^\d{5,}$/.test(logNo)) return { blogId, logNo };
  return null;
}

export function toNaverBlogPostUrl(value: string | null) {
  const params = postParamsFrom(value);
  if (!params) return null;
  const url = new URL('https://m.blog.naver.com/PostView.naver');
  url.searchParams.set('blogId', params.blogId);
  url.searchParams.set('logNo', params.logNo);
  return url.toString();
}

export function toNaverBlogListUrl(value: string | null) {
  const url = naverBlogUrl(value);
  if (!url) return null;

  const blogId = cleanText(url.searchParams.get('blogId')) ?? firstPathSegment(url);
  if (!blogId) return null;
  const listUrl = new URL('https://m.blog.naver.com/PostList.naver');
  listUrl.searchParams.set('blogId', blogId);
  return listUrl.toString();
}

function imageUrlsFrom(html: string) {
  const urls = new Set<string>();
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const src = attribute(match[0], 'src');
    if (src && /^https?:\/\//i.test(src)) urls.add(src);
  }
  return Array.from(urls);
}

function textFromMarkedBlock(html: string, marker: string) {
  const match = html.match(new RegExp(`<[^>]*${marker}[^>]*>([\\s\\S]*?)<\\/(?:div|section|article)>`, 'i'));
  return stripTags(match?.[1] ?? '');
}

function textFromClass(html: string, className: string) {
  const match = html.match(new RegExp(`<[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i'));
  return stripTags(match?.[1] ?? '');
}

function articleBlock(html: string) {
  return html.match(/<article\b[^>]*data-blog-post\b[^>]*>[\s\S]*?<\/article>/i)?.[0] ?? html;
}

function titleFrom(html: string, metas: Map<string, string>, firstTag: string) {
  const dataTitle = attribute(firstTag, 'data-title');
  if (dataTitle) return dataTitle;
  const heading = textFromClass(html, 'se-title-text') ?? textFromClass(html, 'title');
  if (heading) return heading;
  return cleanText(metas.get('og:title'))?.replace(/\s*:\s*네이버\s*블로그.*$/i, '').trim() ?? null;
}

function tagsFrom(html: string) {
  const tags = new Set<string>();
  for (const match of html.matchAll(/<[^>]*data-blog-tag(?:=["'][^"']*["'])?[^>]*>([\s\S]*?)<\/[^>]+>/gi)) {
    const attr = attribute(match[0], 'data-blog-tag');
    const tag = cleanText(attr && attr !== 'true' ? attr : stripTags(match[1]));
    if (tag) tags.add(tag.replace(/^#/, ''));
  }
  return Array.from(tags);
}

function bodyFrom(html: string, bodyText: string | null) {
  return (
    textFromMarkedBlock(html, 'data-blog-body') ??
    textFromClass(html, 'se-main-container') ??
    textFromClass(html, 'post_ct') ??
    textFromClass(html, 'post-view') ??
    cleanText(bodyText)
  );
}

export function extractRenderedBlogPost(input: {
  html: string;
  bodyText: string | null;
  finalUrl: string;
}): RenderedBlogPost {
  const block = articleBlock(input.html);
  const firstTag = block.match(/^<\w+\b[^>]*>/)?.[0] ?? '';
  const metas = metaMap(input.html);
  const params = postParamsFrom(input.finalUrl) ?? postParamsFrom(attribute(firstTag, 'data-source-url'));

  return {
    blogId: attribute(firstTag, 'data-blog-id') ?? params?.blogId ?? null,
    logNo: attribute(firstTag, 'data-log-no') ?? params?.logNo ?? null,
    title: titleFrom(block, metas, firstTag),
    authorName: attribute(firstTag, 'data-author-name'),
    publishedAt:
      attribute(firstTag, 'data-published-at') ??
      cleanText(metas.get('article:published_time')) ??
      cleanText(metas.get('pubdate')),
    sourceUrl: attribute(firstTag, 'data-source-url') ?? input.finalUrl,
    bodyText: bodyFrom(block, input.bodyText),
    tags: tagsFrom(block),
    imageUrls: imageUrlsFrom(block)
  };
}

export function extractRenderedBlogPostLinks(input: { html: string; finalUrl: string }) {
  const urls = new Set<string>();
  for (const match of input.html.matchAll(/<a\b[^>]*>/gi)) {
    const rawHref = attribute(match[0], 'href') ?? attribute(match[0], 'data-blog-post-link');
    if (!rawHref) continue;
    let absolute: string;
    try {
      absolute = new URL(rawHref, input.finalUrl).toString();
    } catch {
      continue;
    }
    const postUrl = toNaverBlogPostUrl(absolute);
    if (postUrl) urls.add(postUrl);
  }
  return Array.from(urls);
}

async function renderWithEndpoint(url: string, env: ProviderEnv): Promise<RenderedBlogSnapshot | null> {
  const endpointValue = env.NAVER_BLOG_RENDERER_ENDPOINT;
  if (!endpointValue) return null;
  const endpoint = new URL(endpointValue);
  endpoint.searchParams.set('url', url);
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Naver Blog renderer endpoint failed with HTTP ${response.status}`);
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const payload = (await response.json()) as Partial<RenderedBlogSnapshot>;
    return {
      finalUrl: payload.finalUrl ?? url,
      html: payload.html ?? '',
      bodyText: payload.bodyText ?? null
    };
  }
  return {
    finalUrl: response.url || url,
    html: await response.text(),
    bodyText: null
  };
}

export async function renderNaverBlogPage(url: string, env: ProviderEnv): Promise<RenderedBlogSnapshot> {
  const endpointSnapshot = await renderWithEndpoint(url, env);
  if (endpointSnapshot) return endpointSnapshot;
  return renderNaverPlacePage(url, {
    ...env,
    NAVER_PLACE_RENDERER_ENDPOINT: env.NAVER_PLACE_RENDERER_ENDPOINT
  });
}

export function isRenderedBlogCollectionProvider(env: ProviderEnv) {
  const blogProvider = configuredBlogProvider(env);
  return blogProvider === 'rendered' || blogProvider === 'page';
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function configuredBlogSourceUrl(env: ProviderEnv, store: Store, storeChannels: StoreChannel[] = []) {
  if (env.NAVER_BLOG_URL?.trim()) return env.NAVER_BLOG_URL.trim();
  const blogChannel = storeChannels.find((channel) => channel.channel === 'blog' && channel.sourceUrl);
  if (blogChannel?.sourceUrl) return blogChannel.sourceUrl;
  const metadata = asRecord(store.metadata);
  const metadataUrl = metadata.naverBlogUrl ?? metadata.blogUrl;
  return typeof metadataUrl === 'string' && metadataUrl.trim() ? metadataUrl.trim() : null;
}

function explicitPostUrls(env: ProviderEnv) {
  return (env.NAVER_BLOG_POST_URLS ?? '')
    .split(',')
    .map((value) => toNaverBlogPostUrl(value.trim()))
    .filter((value): value is string => Boolean(value));
}

function failedBlogItems(plan: CollectionPlan, sourceUrl: string | null, reason: string, startOrdinal = 1) {
  const items: CollectionProviderItemDraft[] = [];
  for (let index = startOrdinal; index <= plan.blogPostLimit; index += 1) {
    items.push({
      channel: 'blog',
      sourceType: 'post',
      status: 'failed',
      sourceUrl,
      title: `네이버 블로그 본문 ${index} 수집 보류`,
      bodyText: null,
      metadata: {
        provider: 'naverBlogRenderedCollectionProvider',
        providerMode: 'real',
        bodyAvailability: 'unavailable',
        reason,
        ordinal: index
      }
    });
  }
  return items;
}

async function postUrlsForSource(
  env: ProviderEnv,
  sourceUrl: string,
  limit: number,
  renderer: NaverBlogRenderer
) {
  const explicitUrls = explicitPostUrls(env);
  if (explicitUrls.length > 0) return explicitUrls.slice(0, limit);

  const directPostUrl = toNaverBlogPostUrl(sourceUrl);
  if (directPostUrl) return [directPostUrl];

  const listUrl = toNaverBlogListUrl(sourceUrl);
  if (!listUrl) return [];
  const snapshot = await renderer(listUrl, env);
  if (isRestrictedSnapshot(snapshot)) {
    throw new Error('Naver Blog rendered request was restricted by Naver.');
  }
  return extractRenderedBlogPostLinks({
    html: snapshot.html,
    finalUrl: snapshot.finalUrl || listUrl
  }).slice(0, limit);
}

export async function collectRenderedBlogItems(context: {
  env: ProviderEnv;
  plan: CollectionPlan;
  store: Store;
  storeChannels?: StoreChannel[];
  renderer?: NaverBlogRenderer;
}) {
  const { env, plan, store, storeChannels = [], renderer = renderNaverBlogPage } = context;
  if (plan.blogPostLimit <= 0) return [];

  const sourceUrl = configuredBlogSourceUrl(env, store, storeChannels);
  if (!sourceUrl) return failedBlogItems(plan, null, 'store_missing_naver_blog_url');

  const postUrls = await postUrlsForSource(env, sourceUrl, plan.blogPostLimit, renderer);
  if (postUrls.length === 0) {
    return failedBlogItems(plan, sourceUrl, 'rendered_blog_post_links_not_found');
  }

  const items: CollectionProviderItemDraft[] = [];
  for (const [index, postUrl] of postUrls.entries()) {
    const snapshot = await renderer(postUrl, env);
    if (isRestrictedSnapshot(snapshot)) {
      throw new Error('Naver Blog rendered request was restricted by Naver.');
    }
    const post = extractRenderedBlogPost({
      html: snapshot.html,
      bodyText: snapshot.bodyText,
      finalUrl: snapshot.finalUrl || postUrl
    });
    if (!post.bodyText) {
      items.push(...failedBlogItems(plan, postUrl, 'rendered_blog_body_not_found', index + 1).slice(0, 1));
      continue;
    }
    const canonicalSourceUrl = toNaverBlogPostUrl(post.sourceUrl) ?? toNaverBlogPostUrl(postUrl) ?? post.sourceUrl;
    items.push({
      channel: 'blog',
      sourceType: 'post',
      sourceUrl: canonicalSourceUrl,
      title: post.title ?? `네이버 블로그 글 ${index + 1}`,
      bodyText: post.bodyText,
      metadata: {
        provider: 'naverBlogRenderedCollectionProvider',
        providerMode: 'real',
        bodyAvailability: 'rendered_blog_full_body',
        blogId: post.blogId,
        logNo: post.logNo,
        authorName: post.authorName,
        publishedAt: post.publishedAt,
        tags: post.tags,
        imageUrls: post.imageUrls,
        ordinal: index + 1,
        blogSourceUrl: sourceUrl
      }
    });
  }

  if (items.length < plan.blogPostLimit) {
    return [
      ...items,
      ...failedBlogItems(plan, sourceUrl, 'rendered_blog_post_not_found', items.length + 1)
    ];
  }
  return items;
}

async function collectPlaceFallbackItems(env: ProviderEnv, plan: CollectionPlan, store: Store) {
  if (!plan.includePlaceProfile && plan.placeReviewLimit <= 0) return [];
  const placePlan = {
    blogPostLimit: 0,
    includePlaceProfile: plan.includePlaceProfile,
    placeReviewLimit: plan.placeReviewLimit
  };
  if (configuredPlaceProvider(env) === 'official_search' && env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET) {
    return createNaverSearchCollectionProvider().collect({
      env,
      plan: placePlan,
      store
    });
  }
  return createMockCollectionProvider().collect({
    env,
    plan: placePlan,
    store
  });
}

export function createNaverBlogRenderedCollectionProvider(
  renderer: NaverBlogRenderer = renderNaverBlogPage
): CollectionProvider {
  return {
    name: 'naverBlogRenderedCollectionProvider',
    mode: 'real',
    async collect({ env, plan, store, storeChannels }) {
      const [blogItems, placeItems] = await Promise.all([
        collectRenderedBlogItems({ env, plan, store, storeChannels, renderer }),
        collectPlaceFallbackItems(env, plan, store)
      ]);
      return [...blogItems, ...placeItems];
    }
  };
}
