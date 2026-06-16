(function () {
  const tableBody = document.getElementById('db-dashboard-table-body');
  const statusLine = document.getElementById('db-dashboard-status');
  const refreshButton = document.getElementById('db-dashboard-refresh');

  const resetLabels = {
    all: '삭제',
    place: '초기화',
    blog: '초기화',
    ruleset_v1: '초기화',
    ruleset_v2: '초기화',
    rag_info: '초기화',
    rag_reviews: '초기화',
    generated_blog: '초기화'
  };

  const resetTargetNames = {
    all: '전체',
    place: '플레이스',
    blog: '블로그',
    ruleset_v1: '룰셋v1',
    ruleset_v2: '룰셋v2(블로그 작성 포뮬라)',
    rag_info: 'RAG 인포',
    rag_reviews: 'RAG 리뷰',
    generated_blog: '생성 블로그'
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function stateBadge(enabled) {
    return `<span class="state ${enabled ? 'state-ok' : 'state-empty'}">${enabled ? '있음' : '없음'}</span>`;
  }

  function resetButton(target, storeId, dangerClass = 'btn-danger-soft') {
    return `<button class="btn btn-sm ${dangerClass} reset-under-value" type="button" data-reset-target="${target}" data-store-id="${storeId}">${resetLabels[target] || '초기화'}</button>`;
  }

  function metricCell(valueHtml, target, storeId) {
    return `
      <div class="metric-cell">
        <div class="metric-value">${valueHtml}</div>
        ${resetButton(target, storeId)}
      </div>
    `;
  }

  function setStatus(message) {
    if (statusLine) statusLine.textContent = message;
  }

  function renderRows(stores) {
    if (!tableBody) return;
    if (!stores.length) {
      tableBody.innerHTML = '<tr><td colspan="9" class="empty">등록된 스토어가 없습니다.</td></tr>';
      return;
    }
    tableBody.innerHTML = stores
      .map((store) => {
        const storeId = escapeHtml(store.storeId);
        return `
          <tr>
            <td class="delete-cell">
              <button class="btn btn-sm btn-danger-strong" type="button" data-reset-target="all" data-store-id="${storeId}">삭제</button>
            </td>
            <td>
              <div class="store-name">${escapeHtml(store.storeName)}</div>
              <div class="store-id">${storeId}</div>
            </td>
            <td>${metricCell(`<span class="num">${Number(store.learnedPlaceCount ?? 0)}</span>건`, 'place', storeId)}</td>
            <td>${metricCell(`<span class="num">${Number(store.learnedBlogCount ?? 0)}</span>건`, 'blog', storeId)}</td>
            <td>${metricCell(stateBadge(Boolean(store.rulesetV1Exists)), 'ruleset_v1', storeId)}</td>
            <td>${metricCell(stateBadge(Boolean(store.rulesetV2Exists)), 'ruleset_v2', storeId)}</td>
            <td>${metricCell(stateBadge(Boolean(store.ragInfoExists)), 'rag_info', storeId)}</td>
            <td>${metricCell(stateBadge(Boolean(store.ragReviewsExists)), 'rag_reviews', storeId)}</td>
            <td>${metricCell(`<span class="num">${Number(store.generatedBlogPostCount ?? 0)}</span>건`, 'generated_blog', storeId)}</td>
          </tr>
        `;
      })
      .join('');
  }

  async function loadDashboard() {
    setStatus('DB 상태를 불러오는 중입니다.');
    const response = await fetch('/api/store-learning/db-dashboard');
    if (!response.ok) throw new Error(`DB 대시보드를 불러오지 못했습니다. (${response.status})`);
    const payload = await response.json();
    const stores = Array.isArray(payload.stores) ? payload.stores : [];
    renderRows(stores);
    setStatus(`최종 조회: ${new Date().toLocaleString('ko-KR')} · ${stores.length}개 스토어`);
  }

  function confirmReset(storeId, target) {
    if (target === 'all') {
      return window.confirm(`[삭제]\n${storeId} 스토어 등록 자체를 삭제합니다.\n등록 단계부터 다시 진행하기 위한 용도입니다. 계속할까요?`);
    }
    return window.confirm(`${storeId}의 ${resetTargetNames[target] || target} 데이터를 초기화할까요?`);
  }

  async function resetTarget(storeId, target) {
    const response = await fetch('/api/store-learning/db-dashboard/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId, target })
    });
    if (!response.ok) throw new Error(`초기화에 실패했습니다. (${response.status})`);
    return response.json();
  }

  async function handleReset(event) {
    const button = event.target.closest('[data-reset-target]');
    if (!button) return;
    const storeId = button.dataset.storeId;
    const target = button.dataset.resetTarget;
    if (!storeId || !target || !confirmReset(storeId, target)) return;
    button.disabled = true;
    try {
      setStatus(`${storeId} · ${resetTargetNames[target] || target} 초기화 중입니다.`);
      await resetTarget(storeId, target);
      await loadDashboard();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '초기화 중 오류가 발생했습니다.');
    } finally {
      button.disabled = false;
    }
  }

  refreshButton?.addEventListener('click', () => {
    loadDashboard().catch((error) => setStatus(error instanceof Error ? error.message : 'DB 상태를 불러오지 못했습니다.'));
  });
  tableBody?.addEventListener('click', handleReset);
  loadDashboard().catch((error) => {
    renderRows([]);
    setStatus(error instanceof Error ? error.message : 'DB 상태를 불러오지 못했습니다.');
  });
})();
