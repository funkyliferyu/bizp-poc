(function () {
  const STORE_ID_KEY = 'bizplanet.storeRegistration.storeId';
  const LEGACY_STORE_ID_KEY = 'storeLearningStoreId';
  const params = new URLSearchParams(window.location.search);
  const storeId =
    params.get('storeId') ||
    window.localStorage.getItem(STORE_ID_KEY) ||
    window.localStorage.getItem(LEGACY_STORE_ID_KEY) ||
    'store_demo_cake';

  window.localStorage.setItem(STORE_ID_KEY, storeId);

  const blogList = document.getElementById('blog-post-list');
  const aiContentList = document.getElementById('ai-content-list');
  const blogPendingCount = document.getElementById('blog-pending-count');
  const blogPendingAlert = document.getElementById('blog-pending-alert');
  const blogPendingAction = document.getElementById('blog-pending-action');
  const aiContentPendingCount = document.getElementById('ai-content-pending-count');
  const aiContentSourceNote = document.getElementById('ai-content-source-note');
  const autoLastUpdated = document.getElementById('blog-auto-last-updated');
  const autoGenerateCount = document.getElementById('blog-auto-generate-count');
  const autoGenerateCountInput = document.getElementById('blog-auto-generate-count-input');
  const autoNextRun = document.getElementById('blog-auto-next-run');
  const autoNextRunInput = document.getElementById('blog-auto-next-run-input');
  const generateButton = document.getElementById('blog-generate-btn');
  const v2BatchButton = document.getElementById('blog-v2-batch-generate-btn');
  const v2BatchModal = document.getElementById('blog-v2-batch-modal');
  const v2BatchModalDesc = document.getElementById('blog-v2-batch-modal-desc');
  const v2BatchSteps = document.getElementById('blog-v2-batch-steps');
  const v2BatchModalClose = document.getElementById('blog-v2-batch-modal-close');
  const v2BatchSpinner = document.getElementById('blog-v2-batch-spinner');
  const v2BatchElapsed = document.getElementById('blog-v2-batch-elapsed');
  const AUTO_GENERATION_INTERVAL_DAYS = 14;
  const AUTO_GENERATION_MIN_COUNT = 1;
  const AUTO_GENERATION_MAX_COUNT = 10;
  let batchStartedAt = 0;
  let batchTimer = null;

  if (!blogList && !aiContentList && !generateButton) return;

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function statusLabel(status) {
    if (status === 'pending_approval') return '승인 대기';
    if (status === 'publish_requested') return '발행 요청';
    if (status === 'published') return '발행완료';
    if (status === 'cancelled') return '취소';
    return status || '대기';
  }

  function statusClass(status) {
    if (status === 'pending_approval') return 'b-orange';
    if (status === 'published' || status === 'publish_requested') return 'b-green';
    if (status === 'cancelled') return 'b-gray';
    return 'b-blue';
  }

  function scoreClass(score) {
    if (score == null) return 'b-gray';
    if (score >= 80) return 'b-green';
    if (score >= 70) return 'b-yellow';
    return 'b-gray';
  }

  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  }

  function formatShortDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  }

  function postDetailUrl(post) {
    return `09_AI콘텐츠생성_상세.html?postId=${post.id}`;
  }

  function generationSourceLabel(post) {
    return post.generationSource?.label || (post.generatedFromRulesetId ? '마케팅 룰셋 기반' : 'AI 생성');
  }

  function generationSourceType(post) {
    return post.generationSource?.type || (post.generatedFromRulesetId ? 'ruleset' : 'unknown');
  }

  function generationSourceLine(post) {
    const label = generationSourceLabel(post);
    const ruleset = post.generationSource?.rulesetId || post.generatedFromRulesetId;
    return `<div style="font-size:11px;color:#6B7280;margin-top:3px">${escapeHtml(label)}${ruleset ? ` · ${escapeHtml(ruleset)}` : ''}</div>`;
  }

  function emptyRow(colspan, message) {
    return `<tr><td class="td-empty" colspan="${colspan}" style="text-align:center;padding:24px">${escapeHtml(message)}</td></tr>`;
  }

  function formatAutoDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  }

  function addDays(value, days) {
    const date = new Date(value.getTime());
    date.setDate(date.getDate() + days);
    return date;
  }

  function latestPostDate(posts) {
    const timestamps = posts
      .map((post) => new Date(post.createdAt || post.updatedAt || '').getTime())
      .filter((timestamp) => Number.isFinite(timestamp));
    return timestamps.length ? new Date(Math.max(...timestamps)) : new Date();
  }

  function updateAutoGenerationSchedule(posts) {
    const lastUpdated = latestPostDate(posts);
    const nextRun = addDays(lastUpdated, AUTO_GENERATION_INTERVAL_DAYS);
    const lastUpdatedText = formatAutoDate(lastUpdated);
    const nextRunText = formatAutoDate(nextRun);
    if (autoLastUpdated) autoLastUpdated.textContent = lastUpdatedText;
    if (autoNextRun) autoNextRun.textContent = nextRunText;
    if (autoNextRunInput) autoNextRunInput.value = nextRunText;
  }

  function clampAutoGenerationCount(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) return 2;
    return Math.min(AUTO_GENERATION_MAX_COUNT, Math.max(AUTO_GENERATION_MIN_COUNT, parsed));
  }

  function currentAutoGenerationCount() {
    return clampAutoGenerationCount(autoGenerateCountInput ? autoGenerateCountInput.value : 2);
  }

  function syncAutoGenerationCount() {
    const count = currentAutoGenerationCount();
    if (autoGenerateCountInput) autoGenerateCountInput.value = String(count);
    if (autoGenerateCount) autoGenerateCount.textContent = `${count}건`;
    return count;
  }

  function elapsedLabel(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function updateBatchElapsed() {
    if (v2BatchElapsed && batchStartedAt) v2BatchElapsed.textContent = elapsedLabel(Date.now() - batchStartedAt);
  }

  function startBatchTimer() {
    batchStartedAt = Date.now();
    if (v2BatchSpinner) v2BatchSpinner.style.display = 'inline-block';
    updateBatchElapsed();
    window.clearInterval(batchTimer);
    batchTimer = window.setInterval(updateBatchElapsed, 1000);
  }

  function stopBatchTimer() {
    window.clearInterval(batchTimer);
    batchTimer = null;
    updateBatchElapsed();
    if (v2BatchSpinner) v2BatchSpinner.style.display = 'none';
  }

  function setBatchModal(open, message, closable = false) {
    if (v2BatchModal) v2BatchModal.style.display = open ? 'flex' : 'none';
    if (v2BatchModalDesc) v2BatchModalDesc.textContent = message || '';
    if (v2BatchModalClose) v2BatchModalClose.style.display = open && closable ? 'inline-flex' : 'none';
  }

  function renderBatchSteps(candidates, activeIndex, completedIds, targetCount) {
    if (!v2BatchSteps) return;
    v2BatchSteps.innerHTML = candidates
      .map((candidate, index) => {
        const done = completedIds.has(candidate.id);
        const active = index === activeIndex;
        const label = done ? '완료' : active ? '생성 중' : '대기';
        const color = done ? '#2F9E44' : active ? '#3B5BDB' : '#6B7280';
        return `
          <div class="auto-gen-chip" data-topic-brief-set-id="${escapeHtml(candidate.id)}" style="justify-content:space-between;height:auto;min-height:28px">
            <span>${escapeHtml(`${index + 1}/${targetCount}`)} ${escapeHtml(candidate.topic || candidate.mainKeyword || '토픽')}</span>
            <strong style="color:${color}">${label}</strong>
          </div>
        `;
      })
      .join('');
  }

  function renderBlogManagement(posts) {
    if (!blogList) return;
    if (!posts.length) {
      blogList.innerHTML = emptyRow(7, '승인 대기 블로그 초안이 없습니다.');
      return;
    }

    blogList.innerHTML = posts
      .map(
        (post) => `
          <tr onclick="location.href='${postDetailUrl(post)}'" style="cursor:pointer" data-blog-post-id="${escapeHtml(post.id)}" data-generation-source="${escapeHtml(generationSourceType(post))}">
            <td class="td-link" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${escapeHtml(post.title)}
              <span style="margin-left:4px" class="icon-external-link" data-icon="external-link" data-size="11" data-color="#9AA0B4"></span>
              ${generationSourceLine(post)}
            </td>
            <td><span class="badge b-blue">AI 자동</span></td>
            <td><span class="badge ${statusClass(post.status)}">${statusLabel(post.status)}</span></td>
            <td class="td-empty">-</td>
            <td class="td-empty">-</td>
            <td><span class="badge ${scoreClass(post.seoScore)}" style="font-size:10px">${post.seoScore ?? '-'}점</span></td>
            <td>${formatShortDate(post.publishedAt || post.scheduledAt || post.createdAt)}</td>
          </tr>
        `
      )
      .join('');
  }

  function renderAiContentList(posts) {
    if (!aiContentList) return;
    if (!posts.length) {
      aiContentList.innerHTML = emptyRow(4, '생성된 AI 블로그 초안이 없습니다.');
      return;
    }

    aiContentList.innerHTML = posts
      .map(
        (post) => `
          <tr onclick="location.href='${postDetailUrl(post)}'" style="cursor:pointer" data-blog-post-id="${escapeHtml(post.id)}" data-generation-source="${escapeHtml(generationSourceType(post))}">
            <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" class="td-link">${escapeHtml(post.title)}${generationSourceLine(post)}</td>
            <td><span class="badge ${statusClass(post.status)}">${statusLabel(post.status)}</span></td>
            <td><span class="badge ${scoreClass(post.seoScore)}" style="font-size:10px">${post.seoScore ?? '-'}점</span></td>
            <td>${formatDate(post.createdAt)}</td>
          </tr>
        `
      )
      .join('');
  }

  function updateCounts(count) {
    if (blogPendingCount) blogPendingCount.textContent = `승인 대기 ${count}건`;
    if (aiContentPendingCount) aiContentPendingCount.textContent = `${count}건`;
  }

  function updateSummary(summary, posts) {
    const count = summary?.pendingApprovalCount ?? posts.filter((post) => post.status === 'pending_approval').length;
    const firstPendingApprovalHref =
      summary?.firstPendingApprovalHref || postDetailUrl(posts.find((post) => post.status === 'pending_approval') || {});
    updateCounts(count);

    if (blogPendingAlert) blogPendingAlert.style.display = count > 0 ? 'flex' : 'none';
    if (blogPendingAction && count > 0) {
      blogPendingAction.onclick = () => {
        window.location.href = firstPendingApprovalHref;
      };
      blogPendingAction.dataset.flowTarget = firstPendingApprovalHref;
    }
    if (aiContentSourceNote) {
      const generatedCount = summary?.generatedDraftCount ?? posts.filter((post) => post.generationSource?.type !== 'manual').length;
      aiContentSourceNote.textContent =
        generatedCount > 0
          ? `Blog Formula V2 연동 생성 초안 ${generatedCount}건`
          : 'Blog Formula V2 연동 생성 초안이 없습니다.';
    }
  }

  async function loadPosts() {
    try {
      const response = await fetch(`/api/stores/${storeId}/blog-posts?source=blog_formula_v2`);
      if (!response.ok) throw new Error(`블로그 목록을 불러오지 못했습니다. (${response.status})`);
      const payload = await response.json();
      const posts = Array.isArray(payload.posts) ? payload.posts : [];
      const apiLinkedPosts = posts.filter((post) => post.generationSource?.type === 'blog_formula_v2');
      updateAutoGenerationSchedule(apiLinkedPosts);
      renderBlogManagement(apiLinkedPosts);
      renderAiContentList(apiLinkedPosts);
      updateSummary(null, apiLinkedPosts);
    } catch (error) {
      updateAutoGenerationSchedule([]);
      const message = error instanceof Error ? error.message : '블로그 목록을 불러오지 못했습니다.';
      if (blogList) blogList.innerHTML = emptyRow(7, message);
      if (aiContentList) aiContentList.innerHTML = emptyRow(4, message);
    }
  }

  async function loadV2BatchCandidates(targetCount) {
    const response = await fetch(`/api/stores/${storeId}/blog-posts/v2-batch-candidates?limit=${targetCount}`);
    if (!response.ok) throw new Error(`토픽 브리프 후보를 불러오지 못했습니다. (${response.status})`);
    const payload = await response.json();
    return Array.isArray(payload.topicBriefSets) ? payload.topicBriefSets.slice(0, targetCount) : [];
  }

  async function generateV2Batch() {
    const completedIds = new Set();
    const targetCount = syncAutoGenerationCount();
    const originalText = v2BatchButton ? v2BatchButton.textContent : '';
    if (v2BatchButton) {
      v2BatchButton.disabled = true;
      v2BatchButton.textContent = '생성 중';
    }
    startBatchTimer();
    try {
      setBatchModal(true, '토픽 브리프를 확인하고 있습니다.');
      const candidates = await loadV2BatchCandidates(targetCount);
      if (candidates.length < targetCount) {
        renderBatchSteps(candidates, -1, completedIds, targetCount);
        stopBatchTimer();
        setBatchModal(true, `생성 가능한 토픽 브리프가 ${targetCount}건 미만입니다. 블로그 작성 포뮬라 탭에서 토픽 브리프를 먼저 생성해 주세요.`, true);
        return;
      }
      for (let index = 0; index < targetCount; index += 1) {
        renderBatchSteps(candidates, index, completedIds, targetCount);
        setBatchModal(true, `${index + 1}/${targetCount} 블로그 초안을 생성하고 있습니다.`);
        const response = await fetch(`/api/stores/${storeId}/blog-posts/generate-from-v2-formula`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topicBriefSetId: candidates[index].id, providerMode: 'openai' })
        });
        if (!response.ok) throw new Error(`${index + 1}번째 블로그 초안을 생성하지 못했습니다. (${response.status})`);
        completedIds.add(candidates[index].id);
      }
      renderBatchSteps(candidates, -1, completedIds, targetCount);
      stopBatchTimer();
      setBatchModal(true, `${targetCount}/${targetCount} 블로그 초안 생성이 완료되었습니다. 목록을 새로고침합니다.`);
      await loadPosts();
      window.setTimeout(() => setBatchModal(false, ''), 800);
    } catch (error) {
      stopBatchTimer();
      setBatchModal(true, error instanceof Error ? error.message : '생성배치 실행에 실패했습니다.', true);
    } finally {
      if (v2BatchButton) {
        v2BatchButton.disabled = false;
        v2BatchButton.textContent = originalText;
      }
    }
  }

  if (generateButton) {
    generateButton.addEventListener('click', async () => {
      generateButton.disabled = true;
      const originalText = generateButton.textContent;
      generateButton.textContent = '생성 중';
      try {
        const response = await fetch(`/api/stores/${storeId}/blog-posts/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error(`블로그 초안을 생성하지 못했습니다. (${response.status})`);
        await loadPosts();
      } catch (error) {
        const message = error instanceof Error ? error.message : '블로그 초안을 생성하지 못했습니다.';
        if (aiContentList) aiContentList.innerHTML = emptyRow(4, message);
      } finally {
        generateButton.disabled = false;
        generateButton.textContent = originalText;
      }
    });
  }

  if (v2BatchButton) {
    v2BatchButton.addEventListener('click', generateV2Batch);
  }
  if (v2BatchModalClose) {
    v2BatchModalClose.addEventListener('click', () => setBatchModal(false, ''));
  }
  if (autoGenerateCountInput) {
    autoGenerateCountInput.addEventListener('input', syncAutoGenerationCount);
    autoGenerateCountInput.addEventListener('change', syncAutoGenerationCount);
  }

  document.addEventListener('DOMContentLoaded', () => {
    syncAutoGenerationCount();
    loadPosts();
  });
})();
