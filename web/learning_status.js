(function () {
  const STORE_ID_KEY = 'bizplanet.storeRegistration.storeId';

  function params() {
    return new URLSearchParams(window.location.search);
  }

  function field(id) {
    return document.getElementById(id);
  }

  function currentStoreId() {
    return params().get('storeId') || window.localStorage.getItem(STORE_ID_KEY) || 'store_demo_cake';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function readResponse(response) {
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(body.error || '요청을 처리하지 못했습니다.');
    }
    return body;
  }

  function formatDate(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '-';
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  }

  function shortDate(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '-';
    return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  }

  function badge(status) {
    if (status === 'analyzed') return '<span class="badge b-green">분석 완료</span>';
    if (status === 'collected') return '<span class="badge b-green">수집 완료</span>';
    if (status === 'not_connected') return '<span class="badge b-gray">미연결</span>';
    if (status === 'empty') return '<span class="badge b-gray">데이터 없음</span>';
    return `<span class="badge b-gray">${escapeHtml(status || '-')}</span>`;
  }

  function rulesetHref(storeId) {
    const url = new URL('07_마케팅전략룰셋.html?', window.location.href);
    url.searchParams.set('storeId', storeId);
    const analysisRunId = params().get('analysisRunId');
    if (analysisRunId) url.searchParams.set('analysisRunId', analysisRunId);
    return `${url.pathname.split('/').pop()}${url.search}`;
  }

  function goToRuleset(storeId) {
    window.location.href = rulesetHref(storeId);
  }

  function wireRulesetNavigation(storeId) {
    [field('learning-ruleset-alert-link'), field('learning-ruleset-card')].forEach((element) => {
      if (!element) return;
      element.addEventListener('click', () => goToRuleset(storeId));
    });
  }

  function renderRulesetEntry(status, storeId) {
    const hasRuleset = Boolean(status.ruleset);
    const alert = field('learning-ruleset-alert');
    const alertLink = field('learning-ruleset-alert-link');
    const card = field('learning-ruleset-card');
    const href = rulesetHref(storeId);
    if (alert) alert.style.display = hasRuleset ? 'flex' : 'none';
    if (alertLink) alertLink.dataset.flowTarget = href;
    if (card) {
      card.disabled = !hasRuleset;
      card.dataset.flowTarget = href;
      card.dataset.flowLabel = '학습 현황: 룰셋 상태';
      card.title = hasRuleset ? '마케팅 전략 룰셋 보기' : '생성된 룰셋이 없습니다';
    }
  }

  function completionStepState(status) {
    if (status === 'complete') return '완료';
    if (status === 'failed') return '확인 필요';
    return '대기';
  }

  function completionStepClass(status) {
    if (status === 'complete') return 'complete';
    if (status === 'failed') return 'failed';
    return 'waiting';
  }

  function completionCount(criterion) {
    if (!criterion) return '';
    if (typeof criterion.version === 'number') return `v${criterion.version}`;
    if (criterion.analysisRunId) return criterion.completedAt ? shortDate(criterion.completedAt) : '실행됨';
    if (typeof criterion.collectedCount === 'number') {
      const selected = typeof criterion.selectedCount === 'number' ? ` · 선택 ${criterion.selectedCount}` : '';
      return `${criterion.collectedCount}개${selected}`;
    }
    return '';
  }

  function renderCompletion(completion) {
    const summary = field('learning-completion-summary');
    const checklist = field('learning-completion-checklist');
    if (!summary || !checklist) return;
    summary.dataset.status = completion?.status || 'unknown';
    field('learning-completion-label').textContent = completion?.label || '학습 상태 확인 중';
    field('learning-completion-message').textContent =
      completion?.message || '수집, 분석, 룰셋 생성 결과를 확인하고 있습니다.';

    const criteria = completion?.criteria || {};
    const rows = [
      criteria.blogCollection,
      criteria.placeProfile,
      criteria.aiAnalysis,
      criteria.marketingRuleset
    ].filter(Boolean);

    checklist.innerHTML = rows
      .map((criterion) => {
        const state = completionStepState(criterion.status);
        const count = completionCount(criterion);
        return `<div class="learning-completion-step ${completionStepClass(criterion.status)}">
          <div class="learning-completion-step-label">${escapeHtml(criterion.label || '-')}</div>
          <div class="learning-completion-step-state">${escapeHtml(state)}${count ? ` · ${escapeHtml(count)}` : ''}</div>
        </div>`;
      })
      .join('');
  }

  function renderOverview(status, storeId) {
    field('learning-last-analyzed').textContent = formatDate(status.lastAnalyzedAt);
    field('learning-next-collection').textContent = formatDate(status.nextCollectionAt);
    field('learning-collection-cycle').textContent = status.collectionCycle || '-';
    field('learning-ruleset-status').innerHTML = status.ruleset
      ? `✓ ${escapeHtml(status.ruleset.statusLabel || status.ruleset.status)}`
      : '미생성';
    renderCompletion(status.completion);
    renderRulesetEntry(status, storeId);
    field('learning-blog-count').textContent = status.channels.blog.collectedCount;
    field('learning-place-count').textContent = status.channels.place.collectedCount;
    field('learning-instagram-count').textContent = status.channels.instagram.collectedCount;
    field('ch-status').innerHTML = `
      <div class="prog-ch-row"><span class="prog-ch-name"><span class="icon-rss" data-icon="rss" data-size="13" data-color="#03C75A"></span> 네이버 블로그</span>${badge(status.channels.blog.status)}</div>
      <div class="prog-ch-row" style="margin-top:6px"><span class="prog-ch-name"><span class="icon-map-pin" data-icon="map-pin" data-size="13" data-color="#03C75A"></span> 네이버 플레이스</span>${badge(status.channels.place.status)}</div>
      <div class="prog-ch-row" style="margin-top:6px"><span class="prog-ch-name"><span class="icon-instagram" data-icon="instagram" data-size="13" data-color="#E1306C"></span> 인스타그램</span>${badge(status.channels.instagram.status)}</div>`;
  }

  function renderBlog(blog) {
    const container = field('learning-blog-list');
    if (!blog.items || blog.items.length === 0) {
      container.innerHTML = '<tr><td colspan="3" class="learning-empty">분석된 블로그 콘텐츠가 없습니다.</td></tr>';
      field('learning-blog-visible').textContent = '0개 표시';
      return;
    }
    const visibleItems = blog.items.slice(0, 10);
    container.innerHTML = visibleItems
      .map((item) => {
        return `<tr>
          <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(item.title || item.summary || '제목 없음')}</td>
          <td>${shortDate(item.collectedAt)}</td>
          <td>${item.selectedForAnalysis ? '선택' : '-'}</td>
        </tr>`;
      })
      .join('');
    field('learning-blog-visible').textContent = `${visibleItems.length} / ${blog.collectedCount}개 표시`;
  }

  function renderPlaceProfile(profile) {
    const container = field('learning-place-profile');
    if (!profile) {
      container.innerHTML = '<div class="learning-empty" style="grid-column:span 2">플레이스 기본 정보가 없습니다.</div>';
      return;
    }
    container.innerHTML = `
      <div style="padding:7px 12px;border-bottom:1px solid #EDF2F7;border-right:1px solid #EDF2F7;font-size:12px;display:flex;gap:8px"><span style="color:#9AA0B4;min-width:56px">항목</span><span>${escapeHtml(profile.title || '플레이스 기본정보')}</span></div>
      <div style="padding:7px 12px;border-bottom:1px solid #EDF2F7;font-size:12px;display:flex;gap:8px"><span style="color:#9AA0B4;min-width:56px">상태</span><span>${profile.selectedForAnalysis ? '분석 포함' : '분석 제외'}</span></div>
      <div style="padding:7px 12px;grid-column:span 2;font-size:12px;display:flex;gap:8px"><span style="color:#9AA0B4;min-width:56px;flex-shrink:0">수집 내용</span><span style="line-height:1.6">${escapeHtml(profile.summary || '-')}</span></div>`;
  }

  function renderPlace(place) {
    renderPlaceProfile(place.profile);
    const keywordContainer = field('learning-review-keywords');
    keywordContainer.innerHTML = (place.reviewKeywords || [])
      .map((keyword) => `<span class="kw-tag">${escapeHtml(keyword)}</span>`)
      .join('');

    const reviewContainer = field('learning-place-reviews');
    if (!place.reviews || place.reviews.length === 0) {
      reviewContainer.innerHTML = '<div class="learning-empty">플레이스 리뷰 데이터가 없습니다.</div>';
      return;
    }
    const visibleReviews = place.reviews.slice(0, 8);
    reviewContainer.innerHTML = visibleReviews
      .map((review) => {
        return `<div class="review-item">
          <div style="font-size:11px;color:#9AA0B4;margin-bottom:4px">${shortDate(review.collectedAt)} · ${review.selectedForAnalysis ? '분석 포함' : '분석 제외'}</div>
          <div style="font-size:12px;color:#1A1A2E;line-height:1.6">${escapeHtml(review.summary || review.title || '-')}</div>
        </div>`;
      })
      .join('');
  }

  function renderInstagram(instagram) {
    const container = field('learning-instagram-list');
    if (!instagram.items || instagram.items.length === 0) {
      container.innerHTML = `<div id="learning-instagram-empty" class="learning-empty" style="grid-column:span 4">${escapeHtml(instagram.message || '인스타그램 수집 콘텐츠가 없습니다.')}</div>`;
      field('learning-instagram-visible').textContent = instagram.status === 'not_connected' ? '미연결' : '0개 표시';
      return;
    }
    container.innerHTML = instagram.items
      .map((item) => {
        return `<div class="insta-card">
          <div class="insta-thumb"><span class="icon-image" data-icon="image" data-size="20" data-color="#9AA0B4"></span></div>
          <div class="insta-info"><div style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px">${escapeHtml(item.title || item.summary || '인스타그램 콘텐츠')}</div><div style="font-size:10px;color:#9AA0B4">${shortDate(item.collectedAt)}</div></div>
        </div>`;
      })
      .join('');
    field('learning-instagram-visible').textContent = `${instagram.items.length} / ${instagram.collectedCount}개 표시`;
  }

  async function loadLearningStatus(storeId) {
    const [statusResponse, blogResponse, placeResponse, instagramResponse] = await Promise.all([
      fetch(`/api/stores/${storeId}/learning-status`),
      fetch(`/api/stores/${storeId}/learning-status/blog`),
      fetch(`/api/stores/${storeId}/learning-status/place`),
      fetch(`/api/stores/${storeId}/learning-status/instagram`)
    ]);
    return Promise.all([
      readResponse(statusResponse),
      readResponse(blogResponse),
      readResponse(placeResponse),
      readResponse(instagramResponse)
    ]);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const storeId = currentStoreId();
    window.localStorage.setItem(STORE_ID_KEY, storeId);
    wireRulesetNavigation(storeId);

    try {
      const [status, blog, place, instagram] = await loadLearningStatus(storeId);
      renderOverview(status, storeId);
      renderBlog(blog);
      renderPlace(place);
      renderInstagram(instagram);
    } catch (error) {
      console.warn(error);
      field('state-area').innerHTML = '<div class="err-banner warning"><div class="err-title">학습 현황을 불러오지 못했습니다</div><div class="err-desc">잠시 후 다시 시도해주세요.</div></div>';
    }
  });
})();
