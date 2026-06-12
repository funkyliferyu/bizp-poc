(function () {
  const STORE_ID_KEY = 'bizplanet.storeRegistration.storeId';
  const PLACE_REVIEW_COLLAPSED_LIMIT = 5;
  const PLACE_REVIEW_EXPANDED_LIMIT = 20;
  const RULESET_RELEARN_ASSET_GUIDANCE = '현재 에셋 데이터가 부족해 룰셋 재학습을 실행할 수 없습니다.';
  let latestLearningStatus = null;
  let latestBlogStatus = null;
  let latestPlaceStatus = null;
  let latestPlaceReviews = [];
  let placeReviewsExpanded = false;
  let placeReviewPage = 0;
  let analysisElapsedTimer = null;
  let analysisElapsedStartedAt = null;

  const analysisOverlayStepOrder = ['queued', 'analyzing', 'validating', 'snapshot', 'ruleset', 'completed'];
  const analysisServerStepToOverlayStep = {
    preparing: 'queued',
    analyzing: 'analyzing',
    validating: 'validating',
    evidence: 'validating',
    snapshot: 'snapshot',
    ruleset: 'ruleset',
    ruleset_fields: 'ruleset',
    completed: 'completed',
    failed: 'validating'
  };

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

  function setAnalysisOverlayVisible(visible) {
    const overlay = field('learning-analysis-overlay');
    if (!overlay) return;
    overlay.classList.toggle('active', visible);
    overlay.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  function setAnalysisOverlayStatus(text) {
    const status = field('learning-analysis-overlay-status');
    if (status) status.textContent = text || '진행 중';
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
    const elapsed = field('learning-analysis-overlay-elapsed');
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
    const steps = Array.from(document.querySelectorAll('[data-learning-overlay-step]'));
    steps.forEach((step) => {
      const key = step.getAttribute('data-learning-overlay-step');
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

  function applyAnalysisProgress(progress) {
    if (!progress || typeof progress !== 'object') return;
    const step = progress.step;
    if (typeof step !== 'string') return;
    const label = typeof progress.label === 'string' ? progress.label : '분석 실행';
    const message = typeof progress.message === 'string' ? progress.message : label;
    const stateText = progress.state === 'done' ? '완료' : label;
    setAnalysisOverlayFlow(analysisServerStepToOverlayStep[step] || 'analyzing', stateText);
    setAnalysisOverlayStatus(message);
  }

  function formatDate(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '-';
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  }

  function formatDateTime(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '-';
    const datePart = formatDate(value);
    const timePart = [
      date.getHours(),
      date.getMinutes(),
      date.getSeconds()
    ].map((item) => String(item).padStart(2, '0')).join(':');
    return `${datePart} ${timePart}`;
  }

  function shortDate(value) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      const compact = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
      if (compact) return `${compact[2]}.${compact[3]}`;
      const separated = trimmed.match(/^(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
      if (separated) return `${separated[2].padStart(2, '0')}.${separated[3].padStart(2, '0')}`;
    }
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '-';
    return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  }

  function blogPublishedDate(item) {
    return item.publishedAt || null;
  }

  function firstText(...values) {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return '';
  }

  function formatCount(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('ko-KR') : '-';
  }

  function openExternalUrl(url) {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
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

  async function createCollectionRun(storeId) {
    const response = await fetch(`/api/stores/${storeId}/collection-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    return readResponse(response);
  }

  function goToCollectionProgress(storeId, runId) {
    window.localStorage.setItem(STORE_ID_KEY, storeId);
    const next = new URL('04_AI학습_수집중.html?', window.location.href);
    next.searchParams.set('storeId', storeId);
    next.searchParams.set('runId', runId);
    window.location.href = `${next.pathname}${next.search}`;
  }

  function collectedAssetIds(blog, place) {
    const ids = [
      ...(Array.isArray(blog?.items) ? blog.items.map((item) => item.id) : []),
      place?.profile?.id,
      ...(Array.isArray(place?.reviews) ? place.reviews.map((review) => review.id) : [])
    ];
    return Array.from(new Set(ids.filter(Boolean)));
  }

  function hasExistingRulesetAssets() {
    return Boolean(latestLearningStatus?.relearnEligibility?.latestCollectionRunId) &&
      collectedAssetIds(latestBlogStatus, latestPlaceStatus).length > 0;
  }

  async function createRulesetRelearnAnalysisRun(storeId) {
    const collectionRunId = latestLearningStatus?.relearnEligibility?.latestCollectionRunId;
    const selectedItemIds = collectedAssetIds(latestBlogStatus, latestPlaceStatus);
    if (!collectionRunId || selectedItemIds.length === 0) {
      throw new Error(RULESET_RELEARN_ASSET_GUIDANCE);
    }
    const response = await fetch(`/api/analysis-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId,
        collectionRunId,
        selectedItemIds,
        forceRulesetRelearn: true
      })
    });
    return readResponse(response);
  }

  async function startAnalysisRun(analysisRunId) {
    const response = await fetch(`/api/analysis-runs/${analysisRunId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return readResponse(response);
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
        applyAnalysisProgress(artifacts.analysisRun?.result?.analysisProgress);
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

  function applyRelearnEligibility(eligibility) {
    const button = field('learning-ruleset-relearn-btn');
    if (!button || !eligibility) return;
    const hasAssets = hasExistingRulesetAssets();
    button.disabled = !hasAssets;
    button.classList.toggle('is-disabled', !hasAssets);
    button.title = hasAssets ? '현재 에셋 데이터로 룰셋 재학습' : RULESET_RELEARN_ASSET_GUIDANCE;
    button.textContent = '룰셋 재학습';
  }

  async function startNewContentCollection(storeId, button) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '수집 준비 중';
    try {
      const payload = await createCollectionRun(storeId);
      const runId = payload.collectionRunId || payload.collectionRun?.id;
      if (!runId) throw new Error('수집 실행 정보를 생성하지 못했습니다.');
      goToCollectionProgress(storeId, runId);
    } catch (error) {
      button.disabled = false;
      button.textContent = originalText;
      throw error;
    }
  }

  async function startRulesetRelearn(storeId, button) {
    const originalText = button.textContent;
    let stopProgressPolling = null;
    button.disabled = true;
    button.textContent = '룰셋 재학습 중';
    try {
      const payload = await createRulesetRelearnAnalysisRun(storeId);
      const analysisRunId = payload.analysisRunId || payload.analysisRun?.id;
      if (!analysisRunId) throw new Error('분석 실행 정보를 생성하지 못했습니다.');
      setAnalysisOverlayVisible(true);
      startAnalysisElapsedTimer();
      setAnalysisOverlayStatus('현재 에셋을 확정하는 중입니다');
      setAnalysisOverlayFlow('queued', '확정 중');
      stopProgressPolling = startAnalysisProgressPolling(analysisRunId);
      setAnalysisOverlayStatus('AI 분석을 시작했습니다');
      setAnalysisOverlayFlow('analyzing', 'AI 분석 중');
      const started = await startAnalysisRun(analysisRunId);
      stopProgressPolling?.();
      applyAnalysisProgress(started.analysisRun?.result?.analysisProgress);
      setAnalysisOverlayStatus('룰셋 재학습이 완료되었습니다');
      setAnalysisOverlayFlow('completed', '완료');
      await reloadLearningStatus(storeId);
      window.setTimeout(() => {
        setAnalysisOverlayVisible(false);
        stopAnalysisElapsedTimer();
      }, 700);
    } catch (error) {
      stopProgressPolling?.();
      stopAnalysisElapsedTimer();
      setAnalysisOverlayVisible(false);
      button.disabled = false;
      button.textContent = originalText;
      throw error;
    }
  }

  function wireRelearn(storeId) {
    const collectionButton = field('learning-collect-new-content-btn');
    if (collectionButton) {
      collectionButton.addEventListener('click', () => {
        startNewContentCollection(storeId, collectionButton).catch((error) => {
          alert(error instanceof Error ? error.message : '신규 콘텐츠 수집을 시작하지 못했습니다.');
        });
      });
    }
    const rulesetButton = field('learning-ruleset-relearn-btn');
    if (rulesetButton) {
      rulesetButton.addEventListener('click', () => {
        startRulesetRelearn(storeId, rulesetButton).catch((error) => {
          alert(error instanceof Error ? error.message : '룰셋 재학습을 시작하지 못했습니다.');
        });
      });
    }
  }

  function wireRulesetNavigation(storeId) {
    [field('learning-ruleset-alert-link'), field('learning-ruleset-card')].forEach((element) => {
      if (!element) return;
      element.addEventListener('click', () => goToRuleset(storeId));
    });
  }

  function wireExternalLinks() {
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const blogSource = target.closest('[data-blog-source-url]');
      if (blogSource) {
        event.preventDefault();
        openExternalUrl(blogSource.getAttribute('data-blog-source-url'));
        return;
      }
      const placePhoto = target.closest('[data-place-photo-url]');
      if (placePhoto) {
        event.preventDefault();
        openExternalUrl(placePhoto.getAttribute('data-place-photo-url'));
      }
    });
  }

  function wirePlaceReviewControls() {
    const expandButton = field('learning-review-expand');
    const prevButton = field('learning-review-prev');
    const nextButton = field('learning-review-next');
    if (!expandButton || !prevButton || !nextButton) return;
    expandButton.addEventListener('click', () => {
      placeReviewsExpanded = !placeReviewsExpanded;
      placeReviewPage = 0;
      renderPlaceReviews(latestPlaceReviews);
    });
    prevButton.addEventListener('click', () => {
      placeReviewPage = Math.max(placeReviewPage - 1, 0);
      renderPlaceReviews(latestPlaceReviews);
    });
    nextButton.addEventListener('click', () => {
      placeReviewPage += 1;
      renderPlaceReviews(latestPlaceReviews);
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

  function renderAnalysisProvenance(provenance) {
    const container = field('learning-analysis-provenance');
    if (!container) return;
    const providerParts = [provenance?.provider || provenance?.mode, provenance?.model].filter(Boolean);
    const omittedItemCount = Number(provenance?.omittedItemCount || 0);
    const omittedBlogItemCount = Number(provenance?.omittedBlogItemCount || 0);
    const omittedReviewItemCount = Number(provenance?.omittedReviewItemCount || 0);
    const blogItemLimit = Number(provenance?.blogItemLimit || 0);
    const reviewItemLimit = Number(provenance?.reviewItemLimit || 0);
    const hasBudgetNote = omittedItemCount > 0 || provenance?.promptBudgetReason === 'body_truncated_to_budget';
    if (providerParts.length === 0 && !hasBudgetNote) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }
    const providerText = providerParts.length ? `<strong>분석 출처</strong> ${escapeHtml(providerParts.join(' · '))}` : '';
    const limitParts = [];
    if (omittedBlogItemCount > 0 && blogItemLimit > 0) limitParts.push(`블로그 소스 최대 ${blogItemLimit}개`);
    if (omittedReviewItemCount > 0 && reviewItemLimit > 0) limitParts.push(`리뷰 최대 ${reviewItemLimit}개`);
    const budgetText =
      hasBudgetNote && limitParts.length > 0
        ? `개발 버전에서는 ${limitParts.join(', ')}만 분석 입력에 포함됩니다.`
        : hasBudgetNote
          ? '분석 입력 예산에 맞춰 일부 본문은 요약/제외되었습니다.'
          : '';
    container.innerHTML = [providerText, budgetText].filter(Boolean).map((text) => `<span>${text}</span>`).join(' · ');
    container.style.display = 'block';
  }

  function renderOverview(status, storeId) {
    field('learning-last-analyzed').textContent = formatDateTime(status.lastAnalyzedAt);
    field('learning-next-collection').textContent = formatDate(status.nextCollectionAt);
    field('learning-collection-cycle').textContent = status.collectionCycle || '-';
    field('learning-ruleset-status').innerHTML = status.ruleset
      ? `✓ ${escapeHtml(status.ruleset.statusLabel || status.ruleset.status)}`
      : '미생성';
    renderCompletion(status.completion);
    renderAnalysisProvenance(status.analysis?.provenance);
    renderRulesetEntry(status, storeId);
    applyRelearnEligibility(status.relearnEligibility);
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
        const rowAttrs = item.sourceUrl
          ? ` class="learning-blog-row" data-blog-source-url="${escapeHtml(item.sourceUrl)}" title="블로그 새 탭 열기"`
          : '';
        return `<tr${rowAttrs}>
          <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(item.title || item.summary || '제목 없음')}</td>
          <td>${shortDate(blogPublishedDate(item))}</td>
          <td>${formatCount(item.viewCount)}</td>
        </tr>`;
      })
      .join('');
    field('learning-blog-visible').textContent = `${visibleItems.length} / ${blog.collectedCount}개 표시`;
  }

  function renderFactRow(label, value, full) {
    const text = Array.isArray(value) ? value.filter(Boolean).join('<br>') : firstText(value);
    if (!text) return '';
    return `<div class="place-fact${full ? ' full' : ''}">
      <span class="place-fact-label">${escapeHtml(label)}</span>
      <span style="line-height:1.6">${Array.isArray(value) ? value.map(escapeHtml).join('<br>') : escapeHtml(text)}</span>
    </div>`;
  }

  function parkingText(facts) {
    if (!facts) return '';
    if (facts.parkingNote) return facts.parkingNote;
    if (facts.parking === 'free') return '무료 주차';
    if (facts.parking === 'available') return '주차 가능';
    if (facts.parking === 'near') return '인근 주차';
    return firstText(facts.parking);
  }

  function renderPlaceFacts(profile) {
    const container = field('learning-place-facts');
    if (!container) return;
    if (!profile) {
      container.innerHTML = '<div class="learning-empty" style="grid-column:span 2;padding:12px">플레이스 기본 정보가 없습니다.</div>';
      return;
    }
    const facts = profile.facts || {};
    const rows = [
      renderFactRow('항목', profile.title || '플레이스 기본정보'),
      renderFactRow('업종', facts.category),
      renderFactRow('주소', facts.address, true),
      renderFactRow('전화', facts.phone),
      renderFactRow('영업시간', facts.operatingHours, true),
      renderFactRow('휴무', facts.closedDays),
      renderFactRow('주차', parkingText(facts), true),
      renderFactRow('소개', facts.introduction || profile.summary, true)
    ].filter(Boolean);
    container.innerHTML = rows.length
      ? rows.join('')
      : '<div class="learning-empty" style="grid-column:span 2;padding:12px">표시할 플레이스 기본 정보가 없습니다.</div>';
  }

  function industryItemText(item) {
    if (typeof item === 'string') return item;
    return firstText(item?.name, item?.title, item?.label, item?.subject, item?.description);
  }

  function renderIndustryChip(item) {
    const text = industryItemText(item);
    return text ? `<span class="kw-tag">${escapeHtml(text)}</span>` : '';
  }

  function renderMenuRow(item) {
    const name = firstText(item?.name, item?.title, item?.label);
    const price = firstText(item?.price);
    const description = firstText(item?.description, item?.summary);
    return `<tr>
      <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(name || '-')}</td>
      <td style="width:110px">${escapeHtml(price || description || '-')}</td>
    </tr>`;
  }

  function renderPlaceIndustrySections(profile) {
    const container = field('learning-place-industry-sections');
    if (!container) return;
    const sections = profile?.industrySections || [];
    if (sections.length === 0) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }
    container.hidden = false;
    container.innerHTML = sections
      .map((section) => {
        const items = Array.isArray(section.items) ? section.items : [];
        const label = section.label || (section.type === 'menu' ? '메뉴' : '업종 정보');
        const count = items.length ? ` · ${items.length}개` : '';
        if (section.type === 'menu') {
          return `<hr class="divider">
            <div class="sec-title">${escapeHtml(label)} <span style="font-size:11px;color:#9AA0B4;font-weight:400">${escapeHtml(count)}</span></div>
            <table class="tbl" style="table-layout:fixed;margin-bottom:4px">
              <thead><tr><th>항목</th><th style="width:110px">가격/설명</th></tr></thead>
              <tbody>${items.map(renderMenuRow).join('')}</tbody>
            </table>`;
        }
        return `<hr class="divider">
          <div class="sec-title">${escapeHtml(label)} <span style="font-size:11px;color:#9AA0B4;font-weight:400">${escapeHtml(count)}</span></div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">${items.map(renderIndustryChip).join('')}</div>`;
      })
      .join('');
  }

  function renderPhotoGrid(sectionId, gridId, countId, urls, moreUrl) {
    const section = field(sectionId);
    const grid = field(gridId);
    const count = field(countId);
    const safeUrls = Array.isArray(urls) ? urls.filter(Boolean) : [];
    if (!section || !grid || !count) return;
    if (safeUrls.length === 0 && !moreUrl) {
      section.hidden = true;
      grid.innerHTML = '';
      count.textContent = '';
      return;
    }
    section.hidden = false;
    count.textContent = safeUrls.length ? `· ${safeUrls.length}장` : '· 플레이스에서 확인';
    const visibleUrls = safeUrls.slice(0, 4);
    const remaining = Math.max(safeUrls.length - visibleUrls.length, 0);
    const images = visibleUrls
      .map((url) => `<div class="photo-thumb"><img src="${escapeHtml(url)}" alt=""></div>`)
      .join('');
    const moreTile = moreUrl
      ? `<div class="photo-thumb"><button type="button" class="photo-more-btn" data-place-photo-url="${escapeHtml(moreUrl)}">${remaining > 0 ? `+${remaining}` : '사진 탭'}</button></div>`
      : '';
    grid.innerHTML = `${images}${moreTile}`;
  }

  function renderPlacePhotos(photos) {
    renderPhotoGrid('learning-place-photos', 'learning-place-photos-grid', 'learning-place-photos-count', photos?.place, photos?.placeMoreUrl);
    renderPhotoGrid('learning-visitor-photos', 'learning-visitor-photos-grid', 'learning-visitor-photos-count', photos?.visitor, photos?.visitorMoreUrl);
  }

  function reviewMeta(review) {
    const date = firstText(review.reviewDate, shortDate(review.collectedAt));
    const collectedAt = review.reviewDate && review.collectedAt ? `수집 ${shortDate(review.collectedAt)}` : '';
    const reviewer = firstText(review.reviewerName);
    const rating = typeof review.rating === 'number' ? `${review.rating}점` : '';
    const selected = review.selectedForAnalysis ? '분석 포함' : '분석 제외';
    return [date, collectedAt, reviewer, rating, selected].filter(Boolean).join(' · ');
  }

  function renderPlaceReviews(reviews) {
    latestPlaceReviews = Array.isArray(reviews) ? reviews : [];
    const reviewContainer = field('learning-place-reviews');
    const controls = field('learning-review-controls');
    const count = field('learning-review-count');
    const range = field('learning-review-range');
    const expandButton = field('learning-review-expand');
    const prevButton = field('learning-review-prev');
    const nextButton = field('learning-review-next');
    if (!reviewContainer || !controls || !count || !range || !expandButton || !prevButton || !nextButton) return;

    const total = latestPlaceReviews.length;
    count.textContent = total ? `· ${total}개` : '· 0개';
    if (total === 0) {
      reviewContainer.innerHTML = '<div class="learning-empty">플레이스 리뷰 데이터가 없습니다.</div>';
      controls.style.display = 'none';
      return;
    }

    controls.style.display = 'flex';
    const limit = placeReviewsExpanded ? PLACE_REVIEW_EXPANDED_LIMIT : PLACE_REVIEW_COLLAPSED_LIMIT;
    const maxPage = placeReviewsExpanded ? Math.max(Math.ceil(total / limit) - 1, 0) : 0;
    placeReviewPage = Math.min(placeReviewPage, maxPage);
    const start = placeReviewPage * limit;
    const visibleReviews = latestPlaceReviews.slice(start, start + limit);
    reviewContainer.innerHTML = visibleReviews
      .map((review) => {
        const photos = Array.isArray(review.photoUrls) && review.photoUrls.length
          ? `<div style="display:flex;gap:6px;margin-top:8px">${review.photoUrls.slice(0, 4).map((url) => `<div class="photo-thumb" style="width:42px;height:42px;aspect-ratio:auto"><img src="${escapeHtml(url)}" alt=""></div>`).join('')}</div>`
          : '';
        return `<div class="review-item">
          <div style="font-size:11px;color:#9AA0B4;margin-bottom:4px">${escapeHtml(reviewMeta(review))}</div>
          <div style="font-size:12px;color:#1A1A2E;line-height:1.6">${escapeHtml(review.summary || review.title || '-')}</div>
          ${photos}
        </div>`;
      })
      .join('');

    const end = Math.min(start + visibleReviews.length, total);
    range.textContent = placeReviewsExpanded ? `${start + 1}-${end} / ${total}개 표시` : `${end} / ${total}개 표시`;
    expandButton.textContent = placeReviewsExpanded ? '접기' : '펼치기';
    expandButton.disabled = total <= PLACE_REVIEW_COLLAPSED_LIMIT;
    prevButton.disabled = !placeReviewsExpanded || placeReviewPage === 0;
    nextButton.disabled = !placeReviewsExpanded || placeReviewPage >= maxPage;
  }

  function renderPlaceNews(items) {
    const newsItems = Array.isArray(items) ? items : [];
    field('learning-place-news').style.display = newsItems.length === 0 ? 'none' : 'block';
    field('learning-place-news').hidden = newsItems.length === 0;
    const count = field('learning-place-news-count');
    const list = field('learning-place-news-list');
    if (!list || !count) return;
    count.textContent = `· ${newsItems.length}개`;
    list.innerHTML = newsItems
      .map((item) => {
        const text = firstText(item.title, item.content, item.summary, item.name, item.description);
        const date = shortDate(firstText(item.publishedAt, item.date, item.createdAt, item.updatedAt));
        return `<tr>
          <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(text || '-')}</td>
          <td>${escapeHtml(date)}</td>
        </tr>`;
      })
      .join('');
  }

  function renderPlace(place) {
    renderPlaceFacts(place.profile);
    renderPlaceIndustrySections(place.profile);
    renderPlacePhotos(place.photos || {});
    const keywordContainer = field('learning-review-keywords');
    keywordContainer.innerHTML = (place.reviewKeywords || [])
      .map((keyword) => `<span class="kw-tag">${escapeHtml(keyword)}</span>`)
      .join('');
    placeReviewsExpanded = false;
    placeReviewPage = 0;
    renderPlaceReviews(place.reviews || []);
    renderPlaceNews(place.newsItems || []);
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

  async function reloadLearningStatus(storeId) {
    const [status, blog, place, instagram] = await loadLearningStatus(storeId);
    latestLearningStatus = status;
    latestBlogStatus = blog;
    latestPlaceStatus = place;
    renderOverview(status, storeId);
    renderBlog(blog);
    renderPlace(place);
    renderInstagram(instagram);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const storeId = currentStoreId();
    window.localStorage.setItem(STORE_ID_KEY, storeId);
    wireRulesetNavigation(storeId);
    wireRelearn(storeId);
    wireExternalLinks();
    wirePlaceReviewControls();

    try {
      await reloadLearningStatus(storeId);
    } catch (error) {
      console.warn(error);
      field('state-area').innerHTML = '<div class="err-banner warning"><div class="err-title">학습 현황을 불러오지 못했습니다</div><div class="err-desc">잠시 후 다시 시도해주세요.</div></div>';
    }
  });
})();
