(function () {
  const STORE_ID_KEY = 'bizplanet.storeRegistration.storeId';
  let latestItems = [];
  let latestStoreId = null;
  let latestRunId = null;
  let analysisInFlight = false;
  let analysisElapsedTimer = null;
  let analysisElapsedStartedAt = null;

  const analysisOverlayStepOrder = ['queued', 'analyzing', 'validating', 'snapshot', 'ruleset', 'navigate'];
  const analysisServerStepToOverlayStep = {
    preparing: 'queued',
    analyzing: 'analyzing',
    validating: 'validating',
    evidence: 'validating',
    snapshot: 'snapshot',
    ruleset: 'ruleset',
    ruleset_fields: 'ruleset',
    completed: 'navigate',
    failed: 'validating'
  };
  const analysisServerStepToCardStep = {
    preparing: 'ready',
    analyzing: 'started',
    validating: 'started',
    evidence: 'started',
    snapshot: 'started',
    ruleset: 'ruleset',
    ruleset_fields: 'ruleset',
    completed: 'navigate',
    failed: 'started'
  };

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

  function evidenceBadges(item) {
    const metadata = item.metadata || {};
    const badges = [];
    const availability = metadata.bodyAvailability;
    if (availability) badges.push(['본문', availability]);
    if (metadata.blogSourceDiscovery) badges.push(['수집', metadata.blogSourceDiscovery]);
    if (item.sourceUrl) badges.push(['출처', 'URL']);
    return badges
      .map(([label, value]) => `<span class="evidence-badge"><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</span>`)
      .join('');
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
        const evidence = evidenceBadges(item);
        return `<tr class="${isSelected(item) ? '' : 'unchecked'}">
          <td class="check-cell">${checkMarkup(item)}</td>
          <td>
            <div class="selection-title-main">${title}</div>
            ${evidence ? `<div class="selection-evidence">${evidence}</div>` : ''}
          </td>
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
    field('selection-analysis-btn').disabled = analysisInFlight || selectedCount === 0;
    field('selection-blog-raw-button').disabled = !latestRunId;
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

  function setAnalysisOverlayVisible(visible) {
    const overlay = field('selection-analysis-overlay');
    if (!overlay) return;
    overlay.classList.toggle('active', Boolean(visible));
    overlay.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  function setAnalysisOverlayStatus(text) {
    const status = field('selection-analysis-overlay-status');
    if (status) status.textContent = text || '분석 실행 중';
  }

  function formatElapsed(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function stopAnalysisElapsedTimer() {
    if (analysisElapsedTimer) window.clearInterval(analysisElapsedTimer);
    analysisElapsedTimer = null;
  }

  function startAnalysisElapsedTimer() {
    stopAnalysisElapsedTimer();
    analysisElapsedStartedAt = Date.now();
    const elapsed = field('selection-analysis-overlay-elapsed');
    const tick = () => {
      if (elapsed && analysisElapsedStartedAt) {
        elapsed.textContent = `경과 ${formatElapsed(Date.now() - analysisElapsedStartedAt)}`;
      }
    };
    tick();
    analysisElapsedTimer = window.setInterval(tick, 1000);
  }

  function setAnalysisOverlayFlow(stepKey, stateText) {
    const activeIndex = analysisOverlayStepOrder.indexOf(stepKey);
    const steps = Array.from(document.querySelectorAll('[data-analysis-overlay-step]'));
    steps.forEach((step) => {
      const key = step.getAttribute('data-analysis-overlay-step');
      const index = analysisOverlayStepOrder.indexOf(key);
      const state = step.querySelector('.analysis-overlay-step-state');
      const isDone = activeIndex >= 0 && index >= 0 && index < activeIndex;
      const isActive = key === stepKey;
      step.classList.toggle('done', isDone);
      step.classList.toggle('active', isActive);
      if (state) {
        if (isDone) state.textContent = '완료';
        else if (isActive) state.textContent = stateText || '진행 중';
        else state.textContent = '대기';
      }
    });
  }

  function setAnalysisStep(stepKey, stateText, overlayStepKey) {
    const progress = field('selection-analysis-progress');
    const steps = Array.from(document.querySelectorAll('[data-analysis-step]'));
    const stepOrder = ['ready', 'queued', 'started', 'ruleset', 'navigate'];
    const activeIndex = stepOrder.indexOf(stepKey);

    if (progress) progress.classList.add('active');
    setAnalysisOverlayStatus(stateText || '진행 중');
    setAnalysisOverlayFlow(overlayStepKey || analysisServerStepToOverlayStep[stepKey] || stepKey, stateText);
    steps.forEach((step) => {
      const key = step.getAttribute('data-analysis-step');
      const index = stepOrder.indexOf(key);
      const state = step.querySelector('.analysis-step-state');
      step.classList.toggle('done', index >= 0 && index < activeIndex);
      step.classList.toggle('active', key === stepKey);
      if (state) {
        if (index >= 0 && index < activeIndex) state.textContent = '완료';
        else if (key === stepKey) state.textContent = stateText || '진행 중';
        else state.textContent = '대기';
      }
    });
  }

  function applyAnalysisProgress(progress) {
    if (!progress || typeof progress !== 'object') return;
    const step = progress.step;
    if (typeof step !== 'string') return;
    const label = typeof progress.label === 'string' ? progress.label : '분석 실행';
    const message = typeof progress.message === 'string' ? progress.message : label;
    const stateText = progress.state === 'done' ? '완료' : label;
    const cardStep = analysisServerStepToCardStep[step] || 'started';
    const overlayStep = analysisServerStepToOverlayStep[step] || 'analyzing';
    setAnalysisStep(cardStep, stateText, overlayStep);
    setAnalysisOverlayStatus(message);
  }

  async function readAnalysisRun(analysisRunId) {
    const response = await fetch(`/api/analysis-runs/${analysisRunId}`);
    return readResponse(response);
  }

  function startAnalysisProgressPolling(analysisRunId) {
    let stopped = false;
    let timer = null;
    const poll = async () => {
      if (stopped) return;
      try {
        const artifacts = await readAnalysisRun(analysisRunId);
        const progress = artifacts.analysisRun?.result?.analysisProgress;
        applyAnalysisProgress(progress);
        const status = artifacts.analysisRun?.status;
        if (['completed', 'failed'].includes(status)) {
          stopped = true;
          if (timer) window.clearInterval(timer);
        }
      } catch (error) {
        console.warn(error);
      }
    };
    poll();
    timer = window.setInterval(poll, 1000);
    return () => {
      stopped = true;
      if (timer) window.clearInterval(timer);
    };
  }

  function setAnalysisError(message) {
    const error = field('selection-analysis-error');
    if (!error) return;
    error.textContent = message;
    error.style.display = message ? 'block' : 'none';
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
    return readResponse(response);
  }

  async function startAnalysisRun(analysisRunId) {
    const response = await fetch(`/api/analysis-runs/${analysisRunId}/start`, {
      method: 'POST'
    });
    return readResponse(response);
  }

  async function runAnalysisFlow() {
    analysisInFlight = true;
    renderCounts();
    setAnalysisError('');
    setAnalysisOverlayVisible(true);
    startAnalysisElapsedTimer();
    setAnalysisStep('ready', '준비 중');
    let stopProgressPolling = null;

    try {
      const payload = await createAnalysisRun();
      const analysisRunId = payload.analysisRunId;
      setAnalysisStep('queued', '선택 저장 완료');
      stopProgressPolling = startAnalysisProgressPolling(analysisRunId);
      setAnalysisStep('started', 'AI 분석 중');
      const started = await startAnalysisRun(analysisRunId);
      stopProgressPolling?.();
      applyAnalysisProgress(started.analysisRun?.result?.analysisProgress);
      setAnalysisStep('started', '분석 완료');
      setAnalysisStep('ruleset', started.marketingRuleset ? '생성 완료' : '확인 중');
      setAnalysisStep('navigate', '이동 중');

      latestStoreId = started.analysisRun?.storeId || latestStoreId;
      if (latestStoreId) window.localStorage.setItem(STORE_ID_KEY, latestStoreId);

      const next = new URL('06_AI학습_현황.html?', window.location.href);
      next.searchParams.set('storeId', latestStoreId);
      next.searchParams.set('analysisRunId', analysisRunId);
      window.location.href = `${next.pathname}${next.search}`;
    } catch (error) {
      analysisInFlight = false;
      renderCounts();
      setAnalysisOverlayVisible(false);
      stopAnalysisElapsedTimer();
      stopProgressPolling?.();
      const message = error instanceof Error ? error.message : '분석 실행을 시작하지 못했습니다.';
      setAnalysisError(message);
      throw error;
    }
  }

  function rawDataUrl() {
    const next = new URL('collection_raw_data.html?', window.location.href);
    next.searchParams.set('runId', latestRunId || '');
    next.searchParams.set('section', 'blogItems');
    return `${next.pathname}${next.search}`;
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
      runAnalysisFlow().catch((error) => {
        alert(error instanceof Error ? error.message : '분석 실행을 시작하지 못했습니다.');
      });
    });
    field('selection-blog-raw-button').disabled = !latestRunId;
    field('selection-blog-raw-button').addEventListener('click', () => {
      window.location.href = rawDataUrl();
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
