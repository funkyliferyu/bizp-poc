(function () {
  const POLL_INTERVAL_MS = 500;
  let pollTimer = null;
  let latestStoreId = null;
  let latestRunId = null;

  function params() {
    return new URLSearchParams(window.location.search);
  }

  function field(id) {
    return document.getElementById(id);
  }

  function statusLabel(status) {
    return {
      queued: '대기 중',
      collecting: '수집 중',
      partial_completed: '일부 완료',
      completed: '수집 완료',
      failed: '수집 실패',
      pending: '대기 중',
      collected: '완료'
    }[status] || status;
  }

  async function readResponse(response) {
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(body.error || '요청을 처리하지 못했습니다.');
    }
    return body;
  }

  function itemCounts(items) {
    return {
      blogTotal: items.filter((item) => item.sourceType === 'post').length,
      blogCollected: items.filter((item) => item.sourceType === 'post' && item.status === 'collected').length,
      placeTotal: items.filter((item) => item.channel === 'place').length,
      placeCollected: items.filter((item) => item.channel === 'place' && item.status === 'collected').length,
      collected: items.filter((item) => item.status === 'collected').length,
      total: items.length
    };
  }

  function statusMarkup(status, text) {
    if (status === 'collected' || status === 'completed') {
      return `<span class="s-done">${text}</span>`;
    }
    if (status === 'collecting') {
      return `<span class="s-ing"><span class="spinner" style="width:10px;height:10px;border-width:1.5px"></span> ${text}</span>`;
    }
    return `<span class="s-wait">${text}</span>`;
  }

  function renderChannelRows(run, items) {
    const counts = itemCounts(items);
    const blogStatus = counts.blogTotal > 0 && counts.blogCollected === counts.blogTotal ? 'completed' : run.status;
    const placeStatus = counts.placeTotal > 0 && counts.placeCollected === counts.placeTotal ? 'completed' : run.status;

    field('row-blog').querySelector('.s-ing, .s-wait, .s-done').outerHTML = statusMarkup(
      blogStatus,
      `수집 ${counts.blogCollected} / ${counts.blogTotal}`
    );
    field('row-place').querySelector('.s-ing, .s-wait, .s-done').outerHTML = statusMarkup(
      placeStatus,
      `수집 ${counts.placeCollected} / ${counts.placeTotal}`
    );
    field('row-insta').querySelector('.s-ing, .s-wait, .s-done').outerHTML = statusMarkup('pending', '대기 중');
  }

  function renderRun(run, items) {
    const counts = itemCounts(items);
    const progressCard = field('progress-card');
    const status = field('collection-progress-status');
    const meta = field('collection-progress-meta');

    if (run.status === 'completed') {
      progressCard.style.background = '#EBFBEE';
      progressCard.style.borderColor = '#8CE99A';
      status.innerHTML = `수집 완료 <span class="progress-meta" id="collection-progress-meta">총 ${counts.collected}개 수집됨</span>`;
    } else if (run.status === 'failed') {
      progressCard.style.background = '#FFF5F5';
      progressCard.style.borderColor = '#FFA8A8';
      status.innerHTML = `수집 실패 <span class="progress-meta" id="collection-progress-meta">다시 시도해주세요</span>`;
    } else {
      status.innerHTML = `<span class="spinner"></span> ${statusLabel(run.status)} <span class="progress-meta" id="collection-progress-meta">완료 ${counts.collected} / ${counts.total}</span>`;
    }

    if (meta) meta.textContent = `완료 ${counts.collected} / ${counts.total}`;
    renderChannelRows(run, items);

    field('collection-ready-count').textContent =
      run.status === 'completed' ? `${counts.collected}개 수집됨` : `수집 중 ${counts.collected} / ${counts.total}`;
    field('content-select').style.display = run.status === 'completed' ? 'block' : 'none';
    field('collection-next-btn').disabled = run.status !== 'completed';
  }

  function renderItems(items) {
    const container = field('collection-item-list');
    const visibleItems = items.filter((item) => item.status === 'collected' || item.status === 'collecting').slice(-8);
    container.innerHTML = visibleItems
      .map((item) => {
        return `<div class="collection-item-row">
          <span class="collection-item-title">${item.title || item.sourceType}</span>
          ${statusMarkup(item.status, statusLabel(item.status))}
        </div>`;
      })
      .join('');
  }

  async function fetchRun(runId) {
    const response = await fetch(`/api/collection-runs/${runId}`);
    return readResponse(response);
  }

  async function fetchItems(runId) {
    const response = await fetch(`/api/collection-runs/${runId}/items`);
    return readResponse(response);
  }

  async function startRun(runId) {
    const response = await fetch(`/api/collection-runs/${runId}/start`, { method: 'POST' });
    return readResponse(response);
  }

  async function poll() {
    if (!latestRunId) return;
    const [runPayload, itemsPayload] = await Promise.all([fetchRun(latestRunId), fetchItems(latestRunId)]);
    const run = runPayload.collectionRun;
    const items = itemsPayload.collectionItems || [];
    latestStoreId = latestStoreId || run.storeId;
    renderRun(run, items);
    renderItems(items);

    if (run.status === 'completed' || run.status === 'failed') {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function nextUrl() {
    const next = new URL('05_AI학습_콘텐츠선택.html?', window.location.href);
    next.searchParams.set('storeId', latestStoreId || params().get('storeId') || '');
    next.searchParams.set('runId', latestRunId || '');
    return `${next.pathname}${next.search}`;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    latestRunId = params().get('runId');
    latestStoreId = params().get('storeId');
    field('collection-next-btn').addEventListener('click', () => {
      window.location.href = nextUrl();
    });

    if (!latestRunId) {
      field('collection-progress-status').textContent = '수집 실행 정보를 찾을 수 없습니다';
      return;
    }

    try {
      await startRun(latestRunId);
      await poll();
      pollTimer = window.setInterval(() => {
        poll().catch((error) => console.warn(error));
      }, POLL_INTERVAL_MS);
    } catch (error) {
      console.warn(error);
      field('collection-progress-status').textContent = '수집 상태를 불러오지 못했습니다';
    }
  });
})();
