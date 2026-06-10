export type CollectionIdentityInput = {
  channel: string;
  sourceType: string;
  sourceUrl?: string | null;
  title?: string | null;
};

function cleanText(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

function normalizeTitle(value: string | null | undefined) {
  const text = cleanText(value);
  return text ? text.replace(/\s+/g, ' ').toLocaleLowerCase('ko-KR') : null;
}

function normalizeGenericUrl(value: string | null | undefined) {
  const text = cleanText(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }
    const params = [...url.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      const keyOrder = leftKey.localeCompare(rightKey);
      return keyOrder === 0 ? leftValue.localeCompare(rightValue) : keyOrder;
    });
    url.search = '';
    params.forEach(([key, paramValue]) => url.searchParams.append(key, paramValue));
    return url.toString();
  } catch {
    return text.toLocaleLowerCase('ko-KR');
  }
}

export function canonicalBlogSourceUrl(value: string | null | undefined) {
  const text = cleanText(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase().replace(/^m\./, '');
    if (host !== 'blog.naver.com') return normalizeGenericUrl(text);

    const segments = url.pathname.split('/').filter(Boolean);
    const queryBlogId = cleanText(url.searchParams.get('blogId'));
    const queryLogNo = cleanText(url.searchParams.get('logNo'));
    const pathBlogId = segments[0] && segments[0] !== 'PostView.naver' ? segments[0] : null;
    const pathLogNo = pathBlogId && segments[1] ? segments[1] : null;
    const blogId = queryBlogId ?? pathBlogId;
    const logNo = queryLogNo ?? pathLogNo;

    if (blogId && logNo) {
      return `https://blog.naver.com/${encodeURIComponent(blogId)}/${encodeURIComponent(logNo)}`;
    }
    return normalizeGenericUrl(text);
  } catch {
    return normalizeGenericUrl(text);
  }
}

export function collectionItemIdentity(input: CollectionIdentityInput) {
  if (input.channel === 'blog' && input.sourceType === 'post') {
    const urlKey = canonicalBlogSourceUrl(input.sourceUrl);
    if (urlKey) return `blog:post:url:${urlKey}`;
    const titleKey = normalizeTitle(input.title);
    return titleKey ? `blog:post:title:${titleKey}` : null;
  }

  if (input.channel === 'place' && input.sourceType === 'review') {
    const urlKey = normalizeGenericUrl(input.sourceUrl);
    return urlKey ? `place:review:url:${urlKey}` : null;
  }

  return null;
}
