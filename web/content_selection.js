(function () {
  const STORE_ID_KEY = 'bizplanet.storeRegistration.storeId';
  let latestItems = [];
  let latestStoreId = null;
  let latestRunId = null;

  function params() {
    return new URLSearchParams(window.location.search);
  }

  function field(id) {
    return document.getElementById(id);
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

  function currentStoreId() {
    return params().get('storeId') || window.localStorage.getItem(STORE_ID_KEY) || 'store_demo_cake';
  }

  function currentRunId() {
    return params().get('runId');
  }

  function isSelected(item) {
    return Number(item.selectedForAnalysis) === 1;
  }

  function checkMarkup(item) {
    const checked = isSelected(item);
    return `<button type="button" class="fake-check${checked ? ' on' : ''}" data-item-id="${escapeHtml(item.id)}" aria-label="선택" aria-pressed="${checked}" style="margin:0 auto;padding:0;background:${checked ? '#3B5BDB' : '#fff'}">${checked ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>' : ''}</button>`;
  }

  function dateLabel(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '-';
    return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  }

  function sourceLabel(item) {
    if (item.sourceType === 'profile') return '매장정보';
    if (item.sourceType === 'review') return '리뷰';
    return '블로그';
  }

  function qualityBadges(item) {
    const flags = item.qualityFlags || [];
    if (!flags.includes('ai_suspected')) return '';
    return ' <span class="ai-suspect">AI 작성 의심</span>';
  }

  function renderBlogItems(items) {
    const container = field('selection-blog-list');
    if (items.length === 0) {
      container.innerHTML = '<tr><td colspan="4" class="selection-empty">수집된 블로그 글이 없습니다.</td></tr>';
      field('selection-blog-visible-count').textContent = '0개 표시';
      return;
    }

    container.innerHTML = items
      .map((item) => {
        const title = `${escapeHtml(item.title || '제목 없음')}${qualityBadges(item)}`;
        return `<tr class="${isSelected(item) ? '' : 'unchecked'}">
          <td class="check-cell">${checkMarkup(item)}</td>
          <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${title}</td>
          <td>${dateLabel(item.createdAt)}</td>
          <td>${escapeHtml(item.metadata?.views ?? '-')}</td>
        </tr>`;
      })
      .join('');
    field('selection-blog-visible-count').textContent = `${items.length} / ${items.length}개 표시`;
  }

  function renderPlaceItems(items) {
    const container = field('selection-place-list');
    if (items.length === 0) {
      container.innerHTML = '<div class="selection-empty">수집된 플레이스 항목이 없습니다.</div>';
      return;
    }

    container.innerHTML = items
      .map((item) => {
        return `<div class="selection-place-row ${isSelected(item) ? '' : 'unchecked'}">
          ${checkMarkup(item)}
          <div class="selection-place-title">${escapeHtml(item.title || sourceLabel(item))}${qualityBadges(item)}</div>
          <div class="selection-meta">${sourceLabel(item)}</div>
        </div>`;
      })
      .join('');
  }

  function renderCounts() {
    const blogItems = latestItems.filter((item) => item.channel === 'blog');
    const placeItems = latestItems.filter((item) => item.channel === 'place');
    const selectedCount = latestItems.filter(isSelected).length;

    field('selection-blog-count').textContent = `· ${blogItems.length}개 수집`;
    field('selection-place-count').textContent = `· ${placeItems.length}개 수집`;
    field('selection-selected-count').textContent = `${selectedCount}개 선택됨`;
    field('selection-analysis-btn').disabled = selectedCount === 0;
  }

  function render() {
    renderBlogItems(latestItems.filter((item) => item.channel === 'blog'));
    renderPlaceItems(latestItems.filter((item) => item.channel === 'place'));
    renderCounts();
  }

  async function loadItems(runId) {
    const response = await fetch(`/api/collection-runs/${runId}/selectable-items`);
    const payload = await readResponse(response);
    latestStoreId = payload.storeId || latestStoreId;
    latestItems = payload.items || [];
    render();
  }

  async function patchSelection(itemId, selected) {
    const response = await fetch(`/api/collection-items/${itemId}/selection`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selected,
        selectionReason: 'manual_content_selection'
      })
    });
    const payload = await readResponse(response);
    latestItems = latestItems.map((item) => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        selectedForAnalysis: payload.collectionItem.selectedForAnalysis,
        selectionReason: payload.collectionItem.selectionReason,
        selectedAt: payload.collectionItem.selectedAt
      };
    });
    render();
  }

  async function createAnalysisRun() {
    const selectedItemIds = latestItems.filter(isSelected).map((item) => item.id);
    const response = await fetch('/api/analysis-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: latestStoreId,
        collectionRunId: latestRunId,
        selectedItemIds
      })
    });
    const payload = await readResponse(response);
    const next = new URL('06_AI학습_현황.html?', window.location.href);
    next.searchParams.set('storeId', latestStoreId);
    next.searchParams.set('analysisRunId', payload.analysisRunId);
    window.location.href = `${next.pathname}${next.search}`;
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-item-id]') : null;
    if (!target) return;
    const itemId = target.getAttribute('data-item-id');
    const item = latestItems.find((candidate) => candidate.id === itemId);
    if (!item) return;
    patchSelection(item.id, !isSelected(item)).catch((error) => {
      alert(error instanceof Error ? error.message : '선택 상태를 저장하지 못했습니다.');
    });
  });

  document.addEventListener('DOMContentLoaded', async () => {
    latestStoreId = currentStoreId();
    latestRunId = currentRunId();
    window.localStorage.setItem(STORE_ID_KEY, latestStoreId);

    field('selection-analysis-btn').addEventListener('click', () => {
      createAnalysisRun().catch((error) => {
        alert(error instanceof Error ? error.message : '분석 실행을 시작하지 못했습니다.');
      });
    });

    if (!latestRunId) {
      field('selection-blog-list').innerHTML = '<tr><td colspan="4" class="selection-empty">수집 실행 정보를 찾을 수 없습니다.</td></tr>';
      field('selection-place-list').innerHTML = '<div class="selection-empty">수집 실행 정보를 찾을 수 없습니다.</div>';
      return;
    }

    try {
      await loadItems(latestRunId);
    } catch (error) {
      console.warn(error);
      field('selection-blog-list').innerHTML = '<tr><td colspan="4" class="selection-empty">수집 콘텐츠를 불러오지 못했습니다.</td></tr>';
      field('selection-place-list').innerHTML = '<div class="selection-empty">수집 콘텐츠를 불러오지 못했습니다.</div>';
    }
  });
})();
