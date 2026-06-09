(function () {
  const STORE_ID_KEY = 'bizplanet.storeRegistration.storeId';
  const fieldMap = new Map();
  const sourceMatrixMap = new Map();
  const FIELD_ALIASES = {
    positioning: ['storePositioning'],
    storePositioning: ['positioning'],
    contentKeywords: ['seoKeywords'],
    seoKeywords: ['contentKeywords'],
    reviewStrength: ['keyStrengths'],
    keyStrengths: ['reviewStrength']
  };

  function params() {
    return new URLSearchParams(window.location.search);
  }

  function currentStoreId() {
    return params().get('storeId') || window.localStorage.getItem(STORE_ID_KEY) || 'store_demo_cake';
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

  async function loadRuleset(storeId) {
    const response = await fetch(`/api/stores/${storeId}/ruleset`);
    return readResponse(response);
  }

  async function saveRulesetField(storeId, fieldKey, userValue) {
    const response = await fetch(`/api/stores/${storeId}/ruleset/fields/${fieldKey}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userValue })
    });
    return readResponse(response);
  }

  async function resetRulesetField(storeId, fieldKey) {
    const response = await fetch(`/api/stores/${storeId}/ruleset/fields/${fieldKey}/reset`, {
      method: 'POST'
    });
    return readResponse(response);
  }

  async function loadRulesetEvidence(storeId, fieldKey) {
    const response = await fetch(`/api/stores/${storeId}/ruleset/fields/${fieldKey}/evidence`);
    return readResponse(response);
  }

  function fieldCandidates(element) {
    return [element.dataset.rulesetField, ...(element.dataset.rulesetAliases || '').split(',')]
      .map((item) => item?.trim())
      .filter(Boolean);
  }

  function findFieldForElement(element) {
    for (const key of fieldCandidates(element)) {
      const found = fieldMap.get(key);
      if (found) return found;
    }
    return null;
  }

  function fieldCandidatesForKey(fieldKey) {
    return [fieldKey, ...(FIELD_ALIASES[fieldKey] || [])].filter(Boolean);
  }

  function findFieldForMatrixRow(row) {
    for (const key of fieldCandidatesForKey(row.fieldKey)) {
      const found = fieldMap.get(key);
      if (found) return found;
    }
    return null;
  }

  function matrixForFieldKey(fieldKey) {
    for (const key of fieldCandidatesForKey(fieldKey)) {
      const found = sourceMatrixMap.get(key);
      if (found) return found;
    }
    return null;
  }

  function sourceLabel(source, locked) {
    if (locked || source === 'user_edited') return { text: '수정됨', className: 'src-edited' };
    return { text: 'AI 분석', className: 'src-ai' };
  }

  function sourceTierLabel(sourceTier) {
    const labels = {
      place_direct: 'Place 직접',
      manual_only: '수동 입력',
      blog_parser: 'Blog 파싱',
      place_then_ai: 'Place+AI',
      ai_processing: 'AI 처리'
    };
    return labels[sourceTier] || sourceTier || '-';
  }

  function automationLabel(status) {
    const labels = {
      available_now: '바로 적용',
      parser_ready: '파서 적용',
      ai_processing: 'AI 판단',
      deferred: '후속'
    };
    return labels[status] || status || '-';
  }

  function sourceChipClass(row) {
    if (row.sourceTier === 'place_direct') return 'direct';
    if (row.sourceTier === 'manual_only') return 'manual';
    if (row.automationStatus === 'deferred') return 'wait';
    return '';
  }

  function updateSourceBadge(element, rulesetField) {
    const label = element.querySelector('.ruleset-label');
    if (!label) return;
    label.querySelectorAll('.src-ai,.src-edited,.ruleset-lock-badge').forEach((badge) => badge.remove());
    const source = sourceLabel(rulesetField.source, rulesetField.locked);
    const sourceBadge = document.createElement('span');
    sourceBadge.className = source.className;
    sourceBadge.textContent = source.text;
    label.append(' ', sourceBadge);
    if (rulesetField.locked) {
      const lockBadge = document.createElement('span');
      lockBadge.className = 'ruleset-lock-badge';
      lockBadge.textContent = 'locked';
      label.append(' ', lockBadge);
    }
  }

  function ensureActionRow(element) {
    let row = element.querySelector('.ruleset-action-row');
    if (row) return row;
    row = document.createElement('div');
    row.className = 'ruleset-action-row';
    row.innerHTML = [
      '<button type="button" class="ruleset-action-btn" data-ruleset-action="save">저장</button>',
      '<button type="button" class="ruleset-action-btn" data-ruleset-action="reset">AI 원값</button>',
      '<button type="button" class="ruleset-action-btn" data-ruleset-action="evidence">근거 보기</button>',
      '<span class="ruleset-field-state" data-ruleset-state>수정 가능</span>'
    ].join('');
    element.appendChild(row);
    return row;
  }

  function renderKeywordTags(element, value) {
    const container = element.querySelector('.benchmark-tags');
    if (!container) return;
    container.innerHTML = String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8)
      .map((item) => `<span class="benchmark-tag">${escapeHtml(item)}</span>`)
      .join('');
  }

  function renderRulesetField(element, rulesetField) {
    const value = element.querySelector('[data-ruleset-value]');
    if (!value) return;
    element.dataset.loadedFieldKey = rulesetField.fieldKey;
    value.textContent = rulesetField.finalValue || rulesetField.aiValue || '-';
    value.dataset.originalValue = value.textContent;
    value.contentEditable = 'true';
    value.setAttribute('role', 'textbox');
    value.setAttribute('tabindex', '0');
    value.classList.toggle('edited', rulesetField.locked || rulesetField.source === 'user_edited');
    renderKeywordTags(element, value.textContent);
    updateSourceBadge(element, rulesetField);

    const row = ensureActionRow(element);
    const state = row.querySelector('[data-ruleset-state]');
    if (state) state.textContent = rulesetField.locked ? '수정값 고정' : 'AI 원값';
    renderRulesetSourceNote(element, rulesetField.sourceMatrix || matrixForFieldKey(rulesetField.fieldKey));
  }

  function renderRulesetSourceNote(element, matrix) {
    element.querySelectorAll('.ruleset-source-note').forEach((note) => note.remove());
    if (!matrix) return;
    const note = document.createElement('div');
    note.className = 'ruleset-source-note';
    note.innerHTML = [
      `<strong>${escapeHtml(sourceTierLabel(matrix.sourceTier))}</strong> · ${escapeHtml(automationLabel(matrix.automationStatus))}`,
      `<br>${escapeHtml(matrix.currentImplementation)}`,
      `<br><strong>개선 제안</strong> ${escapeHtml(matrix.futureSuggestion)}`
    ].join('');
    element.appendChild(note);
  }

  function renderStoreFields(store) {
    document.querySelectorAll('[data-store-field]').forEach((element) => {
      const value = element.querySelector('.ruleset-val');
      const key = element.dataset.storeField;
      if (value && key && store[key]) value.textContent = store[key];
    });
  }

  function renderStatus(payload) {
    const status = field('ruleset-status');
    if (!status) return;
    if (!payload.ruleset) {
      status.textContent = '룰셋 없음';
      return;
    }
    status.textContent = `v${payload.ruleset.version} · ${payload.ruleset.status}`;
  }

  function currentStoreValue(store, row) {
    const value = store?.[row.fieldKey];
    if (value) return String(value);
    if (row.fieldKey === 'storeIntro') return store?.description || null;
    return null;
  }

  function currentMatrixValue(payload, row) {
    if (row.section === 'store') return currentStoreValue(payload.store || {}, row);
    const rulesetField = findFieldForMatrixRow(row);
    return rulesetField?.finalValue || rulesetField?.aiValue || null;
  }

  function sourceMatrixSections(value) {
    return String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function renderSourceMatrix(payload) {
    document.querySelectorAll('[data-source-matrix-section]').forEach((container) => {
      const sections = sourceMatrixSections(container.dataset.sourceMatrixSection);
      const rows = (payload.sourceMatrix || []).filter((row) => sections.includes(row.section));
      container.innerHTML = [
        '<div class="ruleset-source-matrix-head">',
        '<div class="ruleset-source-matrix-title">자동 입력 기준</div>',
        `<div class="ruleset-source-matrix-count">${rows.length}개 항목</div>`,
        '</div>',
        '<table class="ruleset-source-matrix-table" aria-label="룰셋 자동 입력 기준">',
        '<thead><tr><th>항목</th><th>현재 값</th><th>소스/상태</th><th>현재 구현</th><th>개선 제안</th></tr></thead>',
        '<tbody>',
        rows
          .map((row) => {
            const value = currentMatrixValue(payload, row);
            const chipClass = sourceChipClass(row);
            return [
              '<tr>',
              `<td><strong>${escapeHtml(row.label)}</strong><span class="source-field-key">${escapeHtml(row.fieldKey)}</span></td>`,
              `<td><span class="${value ? 'source-current-value' : 'source-muted'}">${escapeHtml(value || '수집/AI 결과 대기')}</span></td>`,
              '<td>',
              '<div class="source-chip-row">',
              `<span class="source-chip ${chipClass}">${escapeHtml(sourceTierLabel(row.sourceTier))}</span>`,
              `<span class="source-chip ${row.automationStatus === 'deferred' ? 'wait' : ''}">${escapeHtml(automationLabel(row.automationStatus))}</span>`,
              '</div>',
              '</td>',
              `<td>${escapeHtml(row.currentImplementation)}</td>`,
              `<td>${escapeHtml(row.futureSuggestion)}</td>`,
              '</tr>'
            ].join('');
          })
          .join(''),
        '</tbody></table>'
      ].join('');
    });
  }

  function renderRuleset(payload) {
    fieldMap.clear();
    sourceMatrixMap.clear();
    (payload.fields || []).forEach((rulesetField) => fieldMap.set(rulesetField.fieldKey, rulesetField));
    (payload.sourceMatrix || []).forEach((row) => sourceMatrixMap.set(row.fieldKey, row));
    renderStatus(payload);
    renderStoreFields(payload.store || {});

    document.querySelectorAll('[data-ruleset-field]').forEach((element) => {
      const rulesetField = findFieldForElement(element);
      if (rulesetField) renderRulesetField(element, rulesetField);
    });
    renderSourceMatrix(payload);
  }

  function fieldValue(element) {
    return element.querySelector('[data-ruleset-value]')?.textContent?.trim() || '';
  }

  function setState(element, message) {
    const state = element.querySelector('[data-ruleset-state]');
    if (state) state.textContent = message;
  }

  function updateFieldInMemory(rulesetField) {
    fieldMap.set(rulesetField.fieldKey, rulesetField);
  }

  async function handleSave(storeId, element) {
    const fieldKey = element.dataset.loadedFieldKey || element.dataset.rulesetField;
    const userValue = fieldValue(element);
    if (!fieldKey || !userValue) return;
    setState(element, '저장 중');
    const payload = await saveRulesetField(storeId, fieldKey, userValue);
    updateFieldInMemory(payload.field);
    renderRulesetField(element, payload.field);
    setState(element, '저장됨');
  }

  async function handleReset(storeId, element) {
    const fieldKey = element.dataset.loadedFieldKey || element.dataset.rulesetField;
    if (!fieldKey) return;
    setState(element, '복원 중');
    const payload = await resetRulesetField(storeId, fieldKey);
    updateFieldInMemory(payload.field);
    renderRulesetField(element, payload.field);
    setState(element, 'AI 원값');
  }

  function showEvidenceModal(payload) {
    field('benchmarkEvidenceTitle').textContent = `${payload.field.fieldKey} 근거 보기`;
    field('benchmarkEvidenceDesc').textContent = '룰셋 필드와 연결된 수집 콘텐츠 근거입니다.';
    field('benchmarkEvidenceList').innerHTML = (payload.evidence || [])
      .map((item) => {
        const summary = item.analysisSummary || item.excerpt || '-';
        return `<li><strong>${escapeHtml(item.title || item.collectionItemId)}</strong><br>${escapeHtml(summary)}</li>`;
      })
      .join('') || '<li>연결된 근거가 없습니다.</li>';
    field('modal-benchmark-evidence').style.display = 'flex';
  }

  async function handleEvidence(storeId, element) {
    const fieldKey = element.dataset.loadedFieldKey || element.dataset.rulesetField;
    if (!fieldKey) return;
    const payload = await loadRulesetEvidence(storeId, fieldKey);
    showEvidenceModal(payload);
  }

  function wireActions(storeId) {
    document.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-ruleset-action]');
      if (!button) return;
      const element = button.closest('[data-ruleset-field]');
      if (!element) return;
      try {
        if (button.dataset.rulesetAction === 'save') await handleSave(storeId, element);
        if (button.dataset.rulesetAction === 'reset') await handleReset(storeId, element);
        if (button.dataset.rulesetAction === 'evidence') await handleEvidence(storeId, element);
      } catch (error) {
        console.warn(error);
        setState(element, '처리 실패');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const storeId = currentStoreId();
    window.localStorage.setItem(STORE_ID_KEY, storeId);
    wireActions(storeId);
    try {
      renderRuleset(await loadRuleset(storeId));
    } catch (error) {
      console.warn(error);
      const status = field('ruleset-status');
      if (status) status.textContent = '로드 실패';
    }
  });
})();
