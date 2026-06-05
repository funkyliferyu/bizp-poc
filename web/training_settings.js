(function () {
  const STORE_ID_KEY = 'bizplanet.storeRegistration.storeId';

  function field(id) {
    return document.getElementById(id);
  }

  function params() {
    return new URLSearchParams(window.location.search);
  }

  function currentStoreId() {
    return params().get('storeId') || window.localStorage.getItem(STORE_ID_KEY) || 'store_demo_cake';
  }

  function numericValue(id) {
    const value = Number(field(id)?.value || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function setSelectValue(id, value) {
    const element = field(id);
    if (!element) return;
    element.value = String(value ?? 0);
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
    return {
      channels: {
        naverBlog: {
          enabled: blog.enabled !== false,
          blogPostLimit: blog.blogPostLimit ?? blog.postLimit ?? 50
        },
        naverPlace: {
          enabled: place.enabled !== false,
          placeReviewLimit: place.placeReviewLimit ?? (place.includeReviews === false ? 0 : 50)
        },
        instagram: {
          enabled: Boolean(instagram.enabled),
          instagramPostLimit: instagram.instagramPostLimit ?? 0
        }
      }
    };
  }

  function applySettings(rawSettings) {
    const settings = normalize(rawSettings);
    setSelectValue('training-blog-limit', settings.channels.naverBlog.blogPostLimit);
    setSelectValue('training-place-review-limit', settings.channels.naverPlace.placeReviewLimit);
    setSelectValue('training-instagram-limit', settings.channels.instagram.instagramPostLimit);
  }

  async function loadStoreChannels(storeId) {
    try {
      const response = await fetch(`/api/stores/${storeId}`);
      if (!response.ok) return;
      const payload = await readResponse(response);
      const placeChannel = (payload.channels || []).find((channel) => channel.channel === 'place');
      if (placeChannel?.sourceUrl && field('training-place-url')) {
        field('training-place-url').value = placeChannel.sourceUrl;
      }
    } catch (error) {
      console.warn(error);
    }
  }

  async function loadSettings() {
    const storeId = currentStoreId();
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
    const instagramPostLimit = numericValue('training-instagram-limit');
    return {
      channels: {
        naverBlog: {
          enabled: numericValue('training-blog-limit') > 0,
          blogPostLimit: numericValue('training-blog-limit')
        },
        naverPlace: {
          enabled: numericValue('training-place-review-limit') > 0,
          placeReviewLimit: numericValue('training-place-review-limit')
        },
        instagram: {
          enabled: instagramPostLimit > 0,
          instagramPostLimit
        }
      }
    };
  }

  async function saveSettings() {
    const storeId = currentStoreId();
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
