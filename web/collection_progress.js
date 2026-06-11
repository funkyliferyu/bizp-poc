(function () {
  const POLL_INTERVAL_MS = 500;
  const REVIEW_COLLAPSED_LIMIT = 10;
  const REVIEW_PAGE_SIZE = 50;

  let pollTimer = null;
  let latestStoreId = null;
  let latestRunId = null;
  let latestItems = [];
  let reviewExpanded = false;
  let reviewPage = 0;

  function params() {
    return new URLSearchParams(window.location.search);
  }

  function field(id) {
    return document.getElementById(id);
  }

  function asRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value;
  }

  function asNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  function optionalNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

  function sourceLabel(item) {
    if (item.sourceType === 'post') return '네이버 블로그';
    if (item.sourceType === 'profile') return '플레이스 기본정보';
    if (item.sourceType === 'review') return '플레이스 리뷰';
    if (item.channel === 'instagram') return '인스타그램';
    return item.channel || item.sourceType || '-';
  }

  function statusMarkup(status, text) {
    if (status === 'collected' || status === 'completed') {
      return `<span class="s-done">${escapeHtml(text)}</span>`;
    }
    if (status === 'collecting') {
      return `<span class="s-ing"><span class="spinner" style="width:10px;height:10px;border-width:1.5px"></span> ${escapeHtml(text)}</span>`;
    }
    if (status === 'failed') {
      return `<span class="badge b-red">${escapeHtml(text)}</span>`;
    }
    return `<span class="s-wait">${escapeHtml(text)}</span>`;
  }

  function readSummary(run) {
    return asRecord(run?.summary);
  }

  function collectionDelta(run) {
    return asRecord(readSummary(run).collectionDelta);
  }

  function hasNoMeaningfulChanges(run) {
    return collectionDelta(run).hasMeaningfulChanges === false;
  }

  function channelDelta(run, channel) {
    const byChannel = asRecord(collectionDelta(run).byChannel);
    return asRecord(byChannel[channel]);
  }

  function channelHasNoNewItems(run, channel) {
    if (channel === 'overall') return false;
    if (!['completed', 'partial_completed'].includes(run.status)) return false;
    const delta = channelDelta(run, channel);
    const newCount = asNumber(delta.new);
    const changedCount = asNumber(delta.changed);
    const reusableCount = asNumber(delta.duplicate) + asNumber(delta.unchanged);
    return newCount === 0 && changedCount === 0 && reusableCount > 0;
  }

  function hasChannelNoNewItems(run) {
    return ['blog', 'place', 'instagram'].some((channel) => channelHasNoNewItems(run, channel));
  }

  function channelNoNewDescription(channel) {
    if (channel === 'blog') {
      return '새로 가져올 항목이 존재하지 않습니다. 기존 블로그 글을 재사용합니다.';
    }
    if (channel === 'place') {
      return '새로 가져올 항목이 존재하지 않습니다. 기존 플레이스 리뷰와 기본정보를 재사용합니다.';
    }
    return '새로 가져올 항목이 존재하지 않습니다. 기존 수집 콘텐츠를 재사용합니다.';
  }

  function requestedTargetForChannel(run, channel) {
    const summary = readSummary(run);
    const requestedLimits = asRecord(summary.requestedLimits);
    const channelPlan = asRecord(summary.channelPlan);

    if (channel === 'blog') {
      const plan = asRecord(channelPlan.naverBlog);
      return plan.enabled === false ? 0 : asNumber(requestedLimits.blogPostLimit);
    }
    if (channel === 'place') {
      const plan = asRecord(channelPlan.naverPlace);
      if (plan.enabled === false) return 0;
      const reviewLimit = asNumber(requestedLimits.placeReviewLimit);
      return reviewLimit > 0 ? reviewLimit + 1 : 1;
    }
    if (channel === 'instagram') {
      const plan = asRecord(channelPlan.instagram);
      return plan.enabled === true ? asNumber(requestedLimits.instagramPostLimit) : 0;
    }
    if (channel === 'overall') {
      return requestedTargetForChannel(run, 'blog') +
        requestedTargetForChannel(run, 'place') +
        requestedTargetForChannel(run, 'instagram');
    }
    return 0;
  }

  function availableTargetForChannel(run, channel) {
    const summary = readSummary(run);
    const availableCounts = asRecord(summary.availableCounts);

    if (channel === 'blog') {
      return optionalNumber(availableCounts.blogPosts);
    }
    if (channel === 'place') {
      const reviewTarget = optionalNumber(availableCounts.placeReviews);
      if (reviewTarget === null) return null;
      return requestedTargetForChannel(run, 'place') > 0 ? reviewTarget + 1 : reviewTarget;
    }
    if (channel === 'instagram') {
      return optionalNumber(availableCounts.instagramPosts);
    }
    if (channel === 'overall') {
      return ['blog', 'place', 'instagram'].reduce((total, item) => {
        const availableTarget = availableTargetForChannel(run, item);
        return total + (availableTarget === null ? requestedTargetForChannel(run, item) : availableTarget);
      }, 0);
    }
    return null;
  }

  function displayTargetForChannel(run, items, channel) {
    const requested = requestedTargetForChannel(run, channel);
    const available = availableTargetForChannel(run, channel);
    const collected = collectedForChannel(items, channel);
    if (available !== null && available >= 0 && available < requested) return available;
    if (run.status === 'completed' && collected > 0 && collected < requested) return collected;
    return requested;
  }

  function sourceUrlForChannel(run, channel) {
    const sourceUrls = asRecord(readSummary(run).sourceUrls);
    if (channel === 'blog') return sourceUrls.naverBlog || '';
    if (channel === 'place') return sourceUrls.naverPlace || '';
    return sourceUrls[channel] || '';
  }

  function itemCounts(items) {
    return {
      blogCollected: items.filter((item) => item.sourceType === 'post' && item.status === 'collected').length,
      placeCollected: items.filter((item) => item.channel === 'place' && item.status === 'collected').length,
      instagramCollected: items.filter((item) => item.channel === 'instagram' && item.status === 'collected').length,
      collected: items.filter((item) => item.status === 'collected').length,
      total: items.length
    };
  }

  function collectedForChannel(items, channel) {
    if (channel === 'blog') return itemCounts(items).blogCollected;
    if (channel === 'place') return itemCounts(items).placeCollected;
    if (channel === 'instagram') return itemCounts(items).instagramCollected;
    return itemCounts(items).collected;
  }

  function channelStatus(run, items, channel) {
    const requested = requestedTargetForChannel(run, channel);
    const target = displayTargetForChannel(run, items, channel);
    const collected = collectedForChannel(items, channel);
    const hasSourceUrl = Boolean(sourceUrlForChannel(run, channel));
    const terminal = ['completed', 'partial_completed', 'failed'].includes(run.status);
    const sourceExhausted = target > 0 && target < requested;
    const exhaustedLabel = {
      blog: '전체 블로그 수집 완료',
      place: '전체 리뷰 수집 완료',
      overall: '가져올 수 있는 항목 완료'
    }[channel] || '전체 수집 완료';

    if (target === 0 && hasSourceUrl) return { status: 'pending', label: '준비중' };
    if (target === 0) return { status: 'pending', label: '수집 안 함' };
    if (channelHasNoNewItems(run, channel)) return { status: 'completed', label: '신규 항목 없음' };
    if (collected >= target && target > 0) return { status: 'completed', label: sourceExhausted ? exhaustedLabel : '완료' };
    if (run.status === 'completed' && collected > 0) return { status: 'completed', label: sourceExhausted ? exhaustedLabel : '완료' };
    if (run.status === 'failed') return { status: 'failed', label: '실패' };
    if (terminal && collected > 0) return { status: 'partial_completed', label: '일부 완료' };
    if (run.status === 'collecting') return { status: 'collecting', label: '수집 중' };
    return { status: 'pending', label: '대기' };
  }

  function countTextFor(_run, collected, target) {
    return `${collected} / ${target}`;
  }

  function channelCountTextFor(run, channel, collected, target) {
    if (channelHasNoNewItems(run, channel)) return '신규 0개';
    return countTextFor(run, collected, target);
  }

  function isAllAvailableCollected(run, items) {
    if (run.status === 'failed') return false;
    if (!['completed', 'partial_completed'].includes(run.status)) return false;
    const counts = itemCounts(items);
    const target = displayTargetForChannel(run, items, 'overall');
    return target > 0 && counts.collected >= target;
  }

  function sourceDescription(run, channel) {
    if (channelHasNoNewItems(run, channel)) return channelNoNewDescription(channel);
    const url = sourceUrlForChannel(run, channel);
    if (!url) return '등록된 URL이 없습니다.';
    return url;
  }

  function renderSummaryCard(id, options) {
    const card = field(id);
    if (!card) return;
    card.innerHTML = `
      <div class="collection-summary-head">
        <span class="collection-summary-name">
          <span data-icon="${escapeHtml(options.icon)}" data-size="14" data-color="${escapeHtml(options.color)}"></span>
          ${escapeHtml(options.label)}
        </span>
        ${statusMarkup(options.status.status, options.status.label)}
      </div>
      <div class="collection-summary-count">${escapeHtml(options.countText)}</div>
      <div class="collection-summary-sub">${escapeHtml(options.description)}</div>
    `;
  }

  function renderSummary(run, items) {
    const counts = itemCounts(items);
    const blogTarget = displayTargetForChannel(run, items, 'blog');
    const placeTarget = displayTargetForChannel(run, items, 'place');
    const instagramTarget = displayTargetForChannel(run, items, 'instagram');
    const overallTarget = displayTargetForChannel(run, items, 'overall');
    const allAvailableCollected = isAllAvailableCollected(run, items);

    renderSummaryCard('collection-summary-overall', {
      label: '전체 진행',
      icon: 'loader',
      color: '#3B5BDB',
      status: channelStatus(run, items, 'overall'),
      countText: countTextFor(run, counts.collected, overallTarget || counts.total),
      description: allAvailableCollected ? '가져올 수 있는 모든 항목이 수집되었습니다.' : '페이지를 벗어나도 백그라운드에서 수집은 계속 진행됩니다.'
    });
    renderSummaryCard('collection-summary-blog', {
      label: '네이버 블로그',
      icon: 'rss',
      color: '#03C75A',
      status: channelStatus(run, items, 'blog'),
      countText: channelCountTextFor(run, 'blog', counts.blogCollected, blogTarget),
      description: sourceDescription(run, 'blog')
    });
    renderSummaryCard('collection-summary-place', {
      label: '네이버 플레이스',
      icon: 'map-pin',
      color: '#03C75A',
      status: channelStatus(run, items, 'place'),
      countText: channelCountTextFor(run, 'place', counts.placeCollected, placeTarget),
      description: sourceDescription(run, 'place')
    });
    renderSummaryCard('collection-summary-instagram', {
      label: '인스타그램',
      icon: 'instagram',
      color: '#E1306C',
      status: channelStatus(run, items, 'instagram'),
      countText: channelCountTextFor(run, 'instagram', counts.instagramCollected, instagramTarget),
      description: sourceDescription(run, 'instagram')
    });

    if (window.BizIcons?.render) window.BizIcons.render();
  }

  async function readResponse(response) {
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(body.error || '요청을 처리하지 못했습니다.');
    }
    return body;
  }

  function renderRun(run, items) {
    const counts = itemCounts(items);
    const progressCard = field('progress-card');
    const status = field('collection-progress-status');
    const guidance = field('collection-progress-guidance');
    const terminal = ['completed', 'partial_completed', 'failed'].includes(run.status);
    const allAvailableCollected = isAllAvailableCollected(run, items);
    const overallTarget = displayTargetForChannel(run, items, 'overall') || counts.total;
    const noMeaningfulChanges = hasNoMeaningfulChanges(run);

    if (terminal && noMeaningfulChanges) {
      progressCard.style.background = '#EBFBEE';
      progressCard.style.borderColor = '#8CE99A';
      status.innerHTML = '수집 완료 <span class="progress-meta" id="collection-progress-meta">신규 수집 0개</span>';
      guidance.innerHTML = '<strong>새로 가져올 항목이 존재하지 않습니다.</strong> 기존 수집 콘텐츠와 플레이스 정보가 최신 상태입니다. 분석할 콘텐츠 선택 화면에서 기존 수집 콘텐츠를 확인하세요.';
    } else if (run.status === 'completed' || allAvailableCollected) {
      progressCard.style.background = '#EBFBEE';
      progressCard.style.borderColor = '#8CE99A';
      status.innerHTML = `수집 완료 <span class="progress-meta" id="collection-progress-meta">총 ${counts.collected}개 수집됨</span>`;
      guidance.innerHTML = hasChannelNoNewItems(run)
        ? '<strong>가져올 수 있는 모든 신규 항목이 수집되었습니다.</strong> 일부 채널은 새로 가져올 항목이 존재하지 않아 기존 수집 콘텐츠를 재사용합니다.'
        : '<strong>가져올 수 있는 모든 항목이 수집되었습니다.</strong> 이 화면에서 결과를 확인한 뒤 다음 단계로 이동하세요.';
    } else if (run.status === 'partial_completed') {
      progressCard.style.background = '#FFF9DB';
      progressCard.style.borderColor = '#FFD43B';
      status.innerHTML = `일부 수집 완료 <span class="progress-meta" id="collection-progress-meta">총 ${counts.collected}개 수집됨</span>`;
      guidance.innerHTML = '<strong>일부 항목 수집에 실패했습니다.</strong> 현재 수집은 종료되었습니다. 이 화면에서 더 기다려도 추가 수집은 진행되지 않습니다. 수집된 콘텐츠를 확인한 뒤 다음 단계로 이동하거나 설정을 조정해 다시 실행하세요.';
    } else if (run.status === 'failed') {
      progressCard.style.background = '#FFF5F5';
      progressCard.style.borderColor = '#FFA8A8';
      status.innerHTML = `수집 실패 <span class="progress-meta" id="collection-progress-meta">다시 시도해주세요</span>`;
      guidance.innerHTML = '<strong>수집이 실패했습니다.</strong> 현재 수집은 종료되었습니다. 설정과 provider 상태를 확인한 뒤 다시 실행하세요.';
    } else {
      progressCard.style.background = '#F7F8FA';
      progressCard.style.borderColor = '#E2E8F0';
      status.innerHTML = `<span class="spinner"></span> ${statusLabel(run.status)} <span class="progress-meta" id="collection-progress-meta">완료 ${counts.collected} / ${overallTarget}</span>`;
      guidance.innerHTML = '<strong>수집 실행 중입니다.</strong> 이 화면에서 기다리면 진행 상황이 자동으로 갱신됩니다. 페이지를 벗어나도 백그라운드에서 수집은 계속 진행됩니다.';
    }

    renderSummary(run, items);
    field('collection-ready-count').textContent =
      terminal && noMeaningfulChanges
        ? '새로 가져올 항목이 존재하지 않습니다.'
        : terminal ? `${counts.collected}개 수집됨` : `수집 중 ${counts.collected} / ${overallTarget}`;
    field('content-select').style.display = terminal ? 'block' : 'none';
    field('collection-next-btn').disabled = !terminal;
    field('collection-next-btn').title = '';
    field('collection-blog-raw-button').disabled = !latestRunId;
  }

  function renderItems(items) {
    const container = field('collection-item-list');
    const visibleItems = items
      .filter((item) => item.status === 'collected' || item.status === 'collecting')
      .slice(-6);

    container.innerHTML = visibleItems
      .map((item) => {
        return `<div class="collection-item-row">
          <span class="collection-item-title">${escapeHtml(item.title || sourceLabel(item))}</span>
          ${statusMarkup(item.status, statusLabel(item.status))}
        </div>`;
      })
      .join('');
  }

  function itemDate(item) {
    const metadata = asRecord(item.metadata);
    const raw = item.sourceType === 'post'
      ? blogPublishedDate(item)
      : metadata.reviewDate || metadata.createdAt || metadata.updatedAt || null;
    if (!raw) return '-';
    const value = String(raw);
    if (/^\d{8}$/.test(value)) return `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10).replace(/-/g, '.');
    return value;
  }

  function blogPublishedDate(item) {
    const metadata = asRecord(item?.metadata);
    return metadata.publishedAt || metadata.postDate || metadata.postdate || metadata.publishedDate || metadata.datePublished || null;
  }

  function collectedReviewItems() {
    return latestItems.filter((item) => item.status === 'collected');
  }

  function renderReviewItems() {
    const items = collectedReviewItems();
    const list = field('collection-review-list');
    const count = field('collection-review-count');
    const range = field('collection-review-range');
    const expand = field('collection-review-expand');
    const prev = field('collection-review-prev');
    const next = field('collection-review-next');
    const limit = reviewExpanded ? REVIEW_PAGE_SIZE : REVIEW_COLLAPSED_LIMIT;
    const maxPage = Math.max(0, Math.ceil(items.length / REVIEW_PAGE_SIZE) - 1);

    if (!reviewExpanded) reviewPage = 0;
    if (reviewPage > maxPage) reviewPage = maxPage;

    const start = reviewExpanded ? reviewPage * REVIEW_PAGE_SIZE : 0;
    const visible = items.slice(start, start + limit);
    const end = start + visible.length;

    count.textContent = `${items.length.toLocaleString('ko-KR')}개 수집`;
    range.textContent = `${end.toLocaleString('ko-KR')} / ${items.length.toLocaleString('ko-KR')}개 표시`;

    if (items.length === 0) {
      list.innerHTML = '<tr><td colspan="4" class="collection-empty">수집 완료된 콘텐츠가 없습니다.</td></tr>';
    } else {
      list.innerHTML = visible
        .map((item) => `
          <tr>
            <td class="collection-source-cell">${escapeHtml(sourceLabel(item))}</td>
            <td class="collection-title-cell">${escapeHtml(item.title || item.bodyText || sourceLabel(item))}</td>
            <td class="collection-date-cell">${escapeHtml(itemDate(item))}</td>
            <td class="collection-status-cell">${statusMarkup(item.status, statusLabel(item.status))}</td>
          </tr>
        `)
        .join('');
    }

    expand.disabled = items.length <= REVIEW_COLLAPSED_LIMIT;
    expand.textContent = reviewExpanded ? '접기' : '펼치기';
    prev.disabled = !reviewExpanded || reviewPage <= 0;
    next.disabled = !reviewExpanded || reviewPage >= maxPage;
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
    latestItems = itemsPayload.collectionItems || [];
    latestStoreId = latestStoreId || run.storeId;
    renderRun(run, latestItems);
    renderItems(latestItems);
    renderReviewItems();

    if (run.status === 'completed' || run.status === 'partial_completed' || run.status === 'failed') {
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

  function rawDataUrl() {
    const next = new URL('collection_raw_data.html?', window.location.href);
    next.searchParams.set('runId', latestRunId || '');
    next.searchParams.set('section', 'blogItems');
    return `${next.pathname}${next.search}`;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    latestRunId = params().get('runId');
    latestStoreId = params().get('storeId');
    field('collection-blog-raw-button').disabled = !latestRunId;
    field('collection-blog-raw-button').addEventListener('click', () => {
      window.location.href = rawDataUrl();
    });
    field('collection-next-btn').addEventListener('click', () => {
      window.location.href = nextUrl();
    });
    field('collection-review-expand').addEventListener('click', () => {
      reviewExpanded = !reviewExpanded;
      reviewPage = 0;
      renderReviewItems();
    });
    field('collection-review-prev').addEventListener('click', () => {
      reviewPage = Math.max(0, reviewPage - 1);
      renderReviewItems();
    });
    field('collection-review-next').addEventListener('click', () => {
      reviewPage += 1;
      renderReviewItems();
    });

    if (!latestRunId) {
      field('collection-progress-status').textContent = '수집 실행 정보를 찾을 수 없습니다';
      renderReviewItems();
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
