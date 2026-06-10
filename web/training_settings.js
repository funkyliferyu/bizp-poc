(function () {
  const STORE_ID_KEY = 'bizplanet.storeRegistration.storeId';
  let storeChannelSources = { blog: null, place: null, instagram: null, daangn: null, youtube: null, tiktok: null };

  function field(id) {
    return document.getElementById(id);
  }

  function params() {
    return new URLSearchParams(window.location.search);
  }

  function currentStoreId() {
    return params().get('storeId') || window.localStorage.getItem(STORE_ID_KEY) || '';
  }

  function numericValue(id) {
    const value = Number(field(id)?.value || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function textValue(id) {
    const value = field(id)?.value?.trim();
    return value || null;
  }

  function setSelectValue(id, value) {
    const element = field(id);
    if (!element) return;
    element.value = String(value ?? 0);
  }

  function setTextValue(id, value) {
    const element = field(id);
    if (!element) return;
    element.value = value || '';
  }

  function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function asArray(value) {
    if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined && item !== '');
    if (value === null || value === undefined || value === '') return [];
    return [value];
  }

  function cleanText(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function channelSource(payload, channelName) {
    const channel = (payload.channels || []).find((item) => item.channel === channelName);
    return cleanText(channel?.sourceUrl);
  }

  function linkUrl(item) {
    if (typeof item === 'string') return cleanText(item);
    const record = asRecord(item);
    return cleanText(record.url || record.href || record.link || record.sourceUrl);
  }

  function firstUrlMatching(values, pattern) {
    return asArray(values)
      .map(linkUrl)
      .find((url) => url && pattern.test(url)) || null;
  }

  function homepageCandidates(parsedPlace) {
    return [
      parsedPlace.homepageUrl,
      parsedPlace.homepage,
      parsedPlace.bookingUrl,
      ...asArray(parsedPlace.homepageLinks || parsedPlace.homepages || parsedPlace.externalLinks),
      ...asArray(parsedPlace.externalChannelLinks),
      ...asArray(asRecord(parsedPlace.naverPlaceParsed).externalChannelLinks)
    ];
  }

  function deriveStoreChannelSources(payload) {
    const store = asRecord(payload.store);
    const metadata = asRecord(store.metadata);
    const parsedPlace = asRecord(metadata.naverPlaceParsed || metadata);
    const homepageUrls = [...homepageCandidates(parsedPlace), ...asArray(metadata.externalChannelLinks)];

    return {
      blog:
        channelSource(payload, 'blog') ||
        cleanText(metadata.naverBlogUrl || metadata.blogUrl) ||
        firstUrlMatching(homepageUrls, /(^|\/\/)(m\.)?blog\.naver\.com\//i),
      place: channelSource(payload, 'place') || cleanText(store.naverPlaceUrl),
      instagram:
        channelSource(payload, 'instagram') ||
        cleanText(metadata.instagramUrl) ||
        firstUrlMatching(homepageUrls, /(^|\/\/)(www\.)?instagram\.com\//i),
      daangn:
        channelSource(payload, 'daangn') ||
        cleanText(metadata.daangnUrl) ||
        firstUrlMatching(homepageUrls, /(^|\/\/)(www\.)?(daangn|karrotmarket)\.com\//i),
      youtube:
        channelSource(payload, 'youtube') ||
        cleanText(metadata.youtubeUrl) ||
        firstUrlMatching(homepageUrls, /(^|\/\/)(www\.)?(youtube\.com|youtu\.be)\//i),
      tiktok:
        channelSource(payload, 'tiktok') ||
        cleanText(metadata.tiktokUrl) ||
        firstUrlMatching(homepageUrls, /(^|\/\/)(www\.)?tiktok\.com\//i)
    };
  }

  function setChannelStatus(channel, connected) {
    const badge = field(`training-${channel}-status`);
    if (!badge) return;
    badge.textContent = connected ? '자동 불러옴' : '미등록';
    badge.classList.toggle('b-blue', Boolean(connected));
    badge.classList.toggle('b-gray', !connected);
  }

  function setFutureProviderStatus(channel, connected) {
    const badge = field(`training-${channel}-status`);
    if (!badge) return;
    badge.textContent = connected ? '준비중' : '미등록';
    badge.classList.toggle('b-blue', Boolean(connected));
    badge.classList.toggle('b-gray', !connected);
  }

  function updateChannelStatuses() {
    setChannelStatus('blog', Boolean(textValue('training-blog-url')));
    setChannelStatus('place', Boolean(textValue('training-place-url')));
    setFutureProviderStatus('instagram', Boolean(textValue('training-instagram-url')));
    setFutureProviderStatus('daangn', Boolean(textValue('training-daangn-url')));
    setFutureProviderStatus('youtube', Boolean(textValue('training-youtube-url')));
    setFutureProviderStatus('tiktok', Boolean(textValue('training-tiktok-url')));
  }

  function materialTag(label, value) {
    return `<span style="display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border:1px solid #E2E8F0;border-radius:6px;font-size:12px;color:#4A5568;background:#F7F8FA"><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</span>`;
  }

  function renderTrainingMaterials(payload) {
    const container = field('training-material-list');
    if (!container) return;

    const store = asRecord(payload?.store);
    const metadata = asRecord(store.metadata);
    const parsedPlace = asRecord(metadata.naverPlaceParsed || metadata);
    const materials = [];
    const placeIntro = cleanText(parsedPlace.placeIntro || store.description);
    const menuItems = asArray(parsedPlace.menuItems);
    const menuImageUrls = asArray(parsedPlace.menuImageUrls);
    const placeImageUrls = [...asArray(parsedPlace.placeImageUrls), ...asArray(parsedPlace.imageUrls)];

    if (placeIntro) materials.push(['소개', placeIntro.length > 28 ? `${placeIntro.slice(0, 28)}...` : placeIntro]);
    if (menuItems.length) materials.push(['메뉴', `${menuItems.length.toLocaleString('ko-KR')}개`]);
    if (menuImageUrls.length) materials.push(['메뉴 사진', `${menuImageUrls.length.toLocaleString('ko-KR')}장`]);
    if (placeImageUrls.length) materials.push(['플레이스 사진', `${placeImageUrls.length.toLocaleString('ko-KR')}장`]);

    container.innerHTML = materials.length
      ? materials.map(([label, value]) => materialTag(label, value)).join('')
      : '<span style="font-size:12px;color:#9AA0B4">매장정보에서 확인된 소개 자료가 없습니다.</span>';
  }

  function renderTrainingKeywords(payload) {
    const container = field('training-keyword-list');
    if (!container) return;

    const store = asRecord(payload?.store);
    const metadata = asRecord(store.metadata);
    const parsedPlace = asRecord(metadata.naverPlaceParsed || metadata);
    const keywords = asArray(parsedPlace.keywords)
      .map(cleanText)
      .filter(Boolean);

    container.innerHTML = keywords.length
      ? keywords.map((keyword) => `<span class="tag-item">${escapeHtml(keyword)} <span class="tag-remove">×</span></span>`).join('')
      : '<span style="font-size:12px;color:#9AA0B4">매장정보에서 확인된 대표 키워드가 없습니다.</span>';
  }

  async function readResponse(response) {
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(body.error || '요청을 처리하지 못했습니다.');
    }
    return body;
  }

  function normalize(settings) {
    const channels = settings?.channels || {};
    const blog = channels.naverBlog || channels.blog || {};
    const place = channels.naverPlace || channels.place || {};
    const instagram = channels.instagram || {};
    const daangn = channels.daangn || {};
    const youtube = channels.youtube || {};
    const tiktok = channels.tiktok || {};
    return {
      channels: {
        naverBlog: {
          enabled: blog.enabled !== false,
          blogPostLimit: blog.blogPostLimit ?? blog.postLimit ?? 50,
          sourceUrl: blog.sourceUrl || null
        },
        naverPlace: {
          enabled: place.enabled !== false,
          placeReviewLimit: place.placeReviewLimit ?? (place.includeReviews === false ? 0 : 50),
          sourceUrl: place.sourceUrl || null
        },
        instagram: {
          enabled: Boolean(instagram.enabled),
          instagramPostLimit: instagram.instagramPostLimit ?? 0,
          sourceUrl: instagram.sourceUrl || null
        },
        daangn: {
          enabled: Boolean(daangn.enabled),
          daangnPostLimit: daangn.daangnPostLimit ?? 0,
          sourceUrl: daangn.sourceUrl || null
        },
        youtube: {
          enabled: false,
          sourceUrl: youtube.sourceUrl || null
        },
        tiktok: {
          enabled: false,
          sourceUrl: tiktok.sourceUrl || null
        }
      }
    };
  }

  function applySettings(rawSettings) {
    const settings = normalize(rawSettings);
    setSelectValue('training-blog-limit', settings.channels.naverBlog.blogPostLimit);
    setSelectValue('training-place-review-limit', settings.channels.naverPlace.placeReviewLimit);
    setSelectValue('training-instagram-limit', 0);
    setSelectValue('training-daangn-limit', 0);
    setTextValue('training-blog-url', settings.channels.naverBlog.sourceUrl || storeChannelSources.blog);
    setTextValue('training-place-url', settings.channels.naverPlace.sourceUrl || storeChannelSources.place);
    setTextValue('training-instagram-url', settings.channels.instagram.sourceUrl || storeChannelSources.instagram);
    setTextValue('training-daangn-url', settings.channels.daangn.sourceUrl || storeChannelSources.daangn);
    setTextValue('training-youtube-url', settings.channels.youtube.sourceUrl || storeChannelSources.youtube);
    setTextValue('training-tiktok-url', settings.channels.tiktok.sourceUrl || storeChannelSources.tiktok);
    updateChannelStatuses();
  }

  function applyStoreSnapshot(payload) {
    storeChannelSources = deriveStoreChannelSources(payload);
    setTextValue('training-blog-url', storeChannelSources.blog);
    setTextValue('training-place-url', storeChannelSources.place);
    setTextValue('training-instagram-url', storeChannelSources.instagram);
    setTextValue('training-daangn-url', storeChannelSources.daangn);
    setTextValue('training-youtube-url', storeChannelSources.youtube);
    setTextValue('training-tiktok-url', storeChannelSources.tiktok);
    renderTrainingMaterials(payload);
    renderTrainingKeywords(payload);
    updateChannelStatuses();
  }

  async function loadStoreChannels(storeId) {
    try {
      const response = await fetch(`/api/stores/${storeId}`);
      if (!response.ok) return;
      const payload = await readResponse(response);
      applyStoreSnapshot(payload);
    } catch (error) {
      console.warn(error);
    }
  }

  async function loadSettings() {
    const storeId = currentStoreId();
    renderTrainingMaterials(null);
    renderTrainingKeywords(null);
    updateChannelStatuses();
    if (!storeId) return;
    window.localStorage.setItem(STORE_ID_KEY, storeId);
    await loadStoreChannels(storeId);

    try {
      const response = await fetch(`/api/stores/${storeId}/training-settings`);
      const payload = await readResponse(response);
      applySettings(payload.settings?.settings);
    } catch (error) {
      console.warn(error);
    }
  }

  function collectSettings() {
    return {
      channels: {
        naverBlog: {
          enabled: numericValue('training-blog-limit') > 0,
          blogPostLimit: numericValue('training-blog-limit'),
          sourceUrl: textValue('training-blog-url')
        },
        naverPlace: {
          enabled: numericValue('training-place-review-limit') > 0,
          placeReviewLimit: numericValue('training-place-review-limit'),
          sourceUrl: textValue('training-place-url')
        },
        instagram: {
          enabled: false,
          instagramPostLimit: 0,
          sourceUrl: textValue('training-instagram-url')
        },
        daangn: {
          enabled: false,
          daangnPostLimit: numericValue('training-daangn-limit'),
          sourceUrl: textValue('training-daangn-url')
        },
        youtube: {
          enabled: false,
          sourceUrl: textValue('training-youtube-url')
        },
        tiktok: {
          enabled: false,
          sourceUrl: textValue('training-tiktok-url')
        }
      }
    };
  }

  async function saveSettings() {
    const storeId = currentStoreId();
    if (!storeId) throw new Error('먼저 매장 정보를 등록해주세요.');
    const response = await fetch(`/api/stores/${storeId}/training-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectSettings())
    });
    return readResponse(response);
  }

  async function startCollectionRun() {
    const storeId = currentStoreId();
    await saveSettings();
    const response = await fetch(`/api/stores/${storeId}/collection-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const payload = await readResponse(response);
    const next = new URL('04_AI학습_수집중.html?', window.location.href);
    next.searchParams.set('runId', payload.collectionRunId);
    next.searchParams.set('storeId', storeId);
    window.location.href = `${next.pathname}${next.search}`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    field('training-save-btn')?.addEventListener('click', async () => {
      try {
        await saveSettings();
        alert('AI 학습 설정을 저장했습니다.');
      } catch (error) {
        alert(error instanceof Error ? error.message : '설정을 저장하지 못했습니다.');
      }
    });
    field('training-start-btn')?.addEventListener('click', async () => {
      try {
        await startCollectionRun();
      } catch (error) {
        alert(error instanceof Error ? error.message : '수집 실행을 시작하지 못했습니다.');
      }
    });
  });
})();
