(function () {
  const STORE_ID_KEY = 'bizplanet.storeRegistration.storeId';
  const fieldMap = new Map();
  const sourceMatrixMap = new Map();
  const writingStyleInsightMap = new Map();
  const FIELD_ALIASES = {
    positioning: ['storePositioning'],
    storePositioning: ['positioning'],
    contentKeywords: ['seoKeywords'],
    seoKeywords: ['contentKeywords'],
    reviewStrength: ['keyStrengths'],
    keyStrengths: ['reviewStrength'],
    representativeTreatmentSubjects: ['representativeMenu'],
    representativeMenu: ['representativeTreatmentSubjects']
  };
  const APPLIED_STORE_INFO_FIELDS = new Set(['operatingHours', 'closedDays', 'parking']);
  const HEALTHCARE_CATEGORY_KEYWORDS = ['병원', '의원', '클리닉', '정형외과', '피부과', '치과'];
  const MEDICAL_INDUSTRY_COMMON_RULE = '블로그 하단에 반드시 의료법 관련 내용 포함';
  const MEDICAL_BLOG_FOOTER_COPY = [
    '*본 포스팅은 해당 병원에서 의료정보 제공 및 병원 광고 목적으로 직접 작성한 글이며, <의료법 제 56조 제 1항>을 준수합니다.',
    '*모든 시술은 개인의 피부에 따라 크고 작은 부작용이 발생할 수 있습니다. 반드시 사전에 의료진과 충분한 상담을 진행한 후 시술을 결정하시는 것을 권장드립니다.'
  ].join('\n');
  const PARKING_MANUAL_REQUIRED_TEXT = '수동입력 필요';
  const MISSING_PARKING_TEXTS = new Set([
    '',
    '-',
    PARKING_MANUAL_REQUIRED_TEXT,
    '주차 정보 수집 중',
    '수집/결과 대기',
    '수집/AI 결과 대기'
  ]);
  const BLOG_EVIDENCE_FIELD_KEYS = new Set([
    'storePositioning',
    'positioning',
    'keyStrengths',
    'representativeMenu',
    'representativeTreatmentSubjects',
    'targetCustomers',
    'contentKeywords',
    'seoKeywords'
  ]);
  const REVIEW_EVIDENCE_FIELD_KEYS = new Set(['reviewStrength', 'reviewWeakness']);

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
    const response = await fetch(`/api/stores/${storeId}/strategy-ruleset`);
    return readResponse(response);
  }

  async function loadRulesetVersions(storeId) {
    const response = await fetch(`/api/stores/${storeId}/strategy-ruleset/versions`);
    return readResponse(response);
  }

  async function loadRulesetVersion(storeId, rulesetId) {
    const response = await fetch(`/api/stores/${storeId}/strategy-ruleset/versions/${rulesetId}`);
    return readResponse(response);
  }

  async function restoreRulesetVersion(storeId, rulesetId) {
    const response = await fetch(`/api/stores/${storeId}/strategy-ruleset/versions/${rulesetId}/restore`, {
      method: 'POST'
    });
    return readResponse(response);
  }

  async function saveRulesetField(storeId, fieldKey, userValue) {
    const response = await fetch(`/api/stores/${storeId}/strategy-ruleset/fields/${fieldKey}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userValue })
    });
    return readResponse(response);
  }

  async function resetRulesetField(storeId, fieldKey) {
    const response = await fetch(`/api/stores/${storeId}/strategy-ruleset/fields/${fieldKey}/reset`, {
      method: 'POST'
    });
    return readResponse(response);
  }

  async function loadRulesetEvidence(storeId, fieldKey) {
    const response = await fetch(`/api/stores/${storeId}/strategy-ruleset/fields/${fieldKey}/evidence`);
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

  function sourceLabel(rulesetField) {
    const source = rulesetField.source;
    const sourceStatus = rulesetField.sourceStatus;
    const locked = rulesetField.locked;
    if (locked || source === 'user_edited') return { text: '수정됨', className: 'src-edited' };
    if (sourceStatus === 'direct_fact') return { text: 'Place 수집', className: 'src-place' };
    if (sourceStatus === 'computed') return { text: '서버 산출', className: 'src-ai' };
    if (sourceStatus === 'default_policy' || sourceStatus === 'policy_default') return { text: '기본 정책', className: 'src-ai' };
    if (sourceStatus === 'insufficient_evidence') return { text: '근거 부족', className: 'src-ai' };
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
    label.querySelectorAll('.src-place,.src-ai,.src-edited,.ruleset-lock-badge').forEach((badge) => badge.remove());
    if (isBrandAnalysisRulesetField(element)) return;
    const source = sourceLabel(rulesetField);
    const sourceBadge = document.createElement('span');
    sourceBadge.className = source.className;
    sourceBadge.textContent = source.text;
    if (rulesetField.reason) sourceBadge.title = rulesetField.reason;
    label.append(' ', sourceBadge);
    if (rulesetField.locked) {
      const lockBadge = document.createElement('span');
      lockBadge.className = 'ruleset-lock-badge';
      lockBadge.textContent = 'locked';
      label.append(' ', lockBadge);
    }
  }

  function renderActionRow(element) {
    let row = element.querySelector('.ruleset-action-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'ruleset-action-row';
      element.appendChild(row);
    }
    const includeEvidence = !isWritingStyleRulesetField(element);
    row.innerHTML = [
      '<button type="button" class="ruleset-action-btn" data-ruleset-action="save">저장</button>',
      '<button type="button" class="ruleset-action-btn" data-ruleset-action="reset">초기화</button>',
      includeEvidence
        ? '<button type="button" class="ruleset-action-btn" data-ruleset-action="evidence">근거 보기</button>'
        : '',
      '<span class="ruleset-field-state" data-ruleset-state></span>'
    ].filter(Boolean).join('');
    return row;
  }

  function ensureActionRow(element) {
    return renderActionRow(element);
  }

  function writingStyleInsightForElement(element) {
    const fieldKey = element?.dataset?.rulesetField;
    if (!fieldKey) return null;
    for (const key of fieldCandidatesForKey(fieldKey)) {
      const found = writingStyleInsightMap.get(key);
      if (found) return found;
    }
    return null;
  }

  function isPlaceholderWritingInsight(insight) {
    return insight?.currentValueStatus === 'placeholder' || insight?.currentValueStatus === 'empty';
  }

  function writingStyleDisplayValue(insight, fallbackValue) {
    if (!insight) return fallbackValue || '-';
    if (isPlaceholderWritingInsight(insight)) return insight.placeholderText || fallbackValue || '';
    return insight.currentValue || fallbackValue || '-';
  }

  function applyWritingValueState(valueElement, insight, fallbackValue) {
    const isPlaceholder = isPlaceholderWritingInsight(insight);
    const displayValue = writingStyleDisplayValue(insight, fallbackValue);
    valueElement.textContent = displayValue;
    valueElement.dataset.originalValue = isPlaceholder ? '' : displayValue;
    valueElement.classList.toggle('placeholder-value', isPlaceholder);
    if (isPlaceholder) {
      valueElement.dataset.placeholderValue = 'true';
      valueElement.setAttribute('data-placeholder-value', 'true');
      valueElement.dataset.placeholderText = displayValue;
      return;
    }
    delete valueElement.dataset.placeholderValue;
    valueElement.removeAttribute('data-placeholder-value');
    delete valueElement.dataset.placeholderText;
  }

  function renderWritingStyleSuggestion(element, insight) {
    const suggestion = insight?.aiSuggestion;
    const container = element.querySelector('[data-writing-suggestion]');
    if (!container || !suggestion) return;
    const judgment = suggestion.judgment === 'improve' ? '개선 제안' : '현행유지';
    const judgmentBadge = container.querySelector('.writing-ai-judgment');
    const copy = container.querySelector('[data-ai-suggestion-text]');
    const evidence = container.querySelector('[data-ai-suggestion-evidence]');
    container.dataset.aiJudgment = suggestion.judgment === 'improve' ? 'improve' : 'keep';
    if (judgmentBadge) {
      judgmentBadge.textContent = judgment;
      judgmentBadge.classList.toggle('improve', suggestion.judgment === 'improve');
    }
    if (copy) copy.textContent = suggestion.value || '-';
    if (evidence) {
      const signals = (suggestion.inputSignals || []).slice(0, 3).join(', ');
      evidence.innerHTML = [
        `<strong>근거</strong> ${escapeHtml(suggestion.evidence || '-')}`,
        signals ? `<br><strong>입력값</strong> ${escapeHtml(signals)}` : ''
      ].join('');
    }
  }

  function renderWritingStyleValue(element, valueElement, insight, fallbackValue) {
    if (!isWritingStyleRulesetField(element)) return false;
    applyWritingValueState(valueElement, insight, fallbackValue);
    renderWritingStyleSuggestion(element, insight);
    return true;
  }

  function updateWritingInsightFromField(rulesetField) {
    const existing = writingStyleInsightMap.get(rulesetField.fieldKey);
    if (!existing) return;
    const value = rulesetField.finalValue || rulesetField.aiValue || '';
    const isUserEdited = rulesetField.locked || rulesetField.source === 'user_edited';
    const isPlaceholder = !isUserEdited && existing.placeholderText && value === existing.placeholderText;
    writingStyleInsightMap.set(rulesetField.fieldKey, {
      ...existing,
      currentValue: isPlaceholder ? null : value,
      currentValueStatus: isUserEdited ? 'user_edited' : (isPlaceholder ? 'placeholder' : (value ? 'inferred' : 'empty'))
    });
  }

  function clearPlaceholderForEditing(valueElement) {
    if (valueElement.dataset.placeholderValue !== 'true') return;
    if (valueElement.textContent.trim() !== (valueElement.dataset.placeholderText || '').trim()) return;
    valueElement.textContent = '';
    valueElement.dataset.placeholderValue = 'editing';
    valueElement.removeAttribute('data-placeholder-value');
    valueElement.classList.remove('placeholder-value');
  }

  function restorePlaceholderIfEmpty(valueElement) {
    if (valueElement.dataset.placeholderValue !== 'editing') return;
    if (valueElement.textContent.trim()) return;
    const placeholderText = valueElement.dataset.placeholderText || '';
    valueElement.textContent = placeholderText;
    valueElement.dataset.placeholderValue = 'true';
    valueElement.setAttribute('data-placeholder-value', 'true');
    valueElement.classList.add('placeholder-value');
  }

  function wirePlaceholderEditing() {
    document.addEventListener('focusin', (event) => {
      const valueElement = event.target.closest?.('[data-ruleset-value]');
      if (valueElement) clearPlaceholderForEditing(valueElement);
    });
    document.addEventListener('focusout', (event) => {
      const valueElement = event.target.closest?.('[data-ruleset-value]');
      if (valueElement) restorePlaceholderIfEmpty(valueElement);
    });
  }

  function renderWritingStyleInsights(payload) {
    writingStyleInsightMap.clear();
    (payload.writingStyleInsights || []).forEach((insight) => {
      writingStyleInsightMap.set(insight.fieldKey, insight);
    });
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
    const fallbackValue = rulesetField.finalValue || rulesetField.aiValue || '-';
    const insight = writingStyleInsightForElement(element);
    if (!renderWritingStyleValue(element, value, insight, fallbackValue)) {
      value.textContent = fallbackValue;
      value.dataset.originalValue = value.textContent;
      value.classList.remove('placeholder-value');
      delete value.dataset.placeholderValue;
      value.removeAttribute('data-placeholder-value');
      delete value.dataset.placeholderText;
    }
    value.contentEditable = 'true';
    value.setAttribute('role', 'textbox');
    value.setAttribute('tabindex', '0');
    value.classList.toggle('edited', rulesetField.locked || rulesetField.source === 'user_edited');
    renderKeywordTags(element, value.textContent);
    updateSourceBadge(element, rulesetField);

    renderActionRow(element);
    renderRulesetSourceNote(element, rulesetField.sourceMatrix || matrixForFieldKey(rulesetField.fieldKey));
  }

  function renderRulesetSourceNote(element, matrix) {
    element.querySelectorAll('.ruleset-source-note').forEach((note) => note.remove());
    if (!matrix || !shouldRenderRulesetSourceNote(element)) return;
    const note = document.createElement('div');
    note.className = 'ruleset-source-note';
    note.innerHTML = [
      `<strong>${escapeHtml(sourceTierLabel(matrix.sourceTier))}</strong> · ${escapeHtml(automationLabel(matrix.automationStatus))}`,
      `<br>${escapeHtml(matrix.currentImplementation)}`,
      `<br><strong>개선 제안</strong> ${escapeHtml(matrix.futureSuggestion)}`
    ].join('');
    element.appendChild(note);
  }

  function isStoreInfoRulesetField(element) {
    return Boolean(element?.closest('#sec-store') && element.dataset.rulesetField);
  }

  function isWritingStyleRulesetField(element) {
    return Boolean(element?.closest('#sec-write') && element.dataset.rulesetField);
  }

  function isBrandAnalysisRulesetField(element) {
    return Boolean(element?.closest('#sec-brand') && element.dataset.rulesetField);
  }

  function shouldRenderRulesetSourceNote(element) {
    const fieldKey = element?.dataset.rulesetField;
    if (isStoreInfoRulesetField(element) && APPLIED_STORE_INFO_FIELDS.has(fieldKey)) return false;
    return !isStoreInfoRulesetField(element) && !isBrandAnalysisRulesetField(element) && !isWritingStyleRulesetField(element);
  }

  function directFactValue(storeFacts, fieldKey) {
    if (!storeFacts || !fieldKey) return null;
    return storeFacts[fieldKey] ?? null;
  }

  function representativeTreatmentSubjectsValue(storeFacts) {
    return storeFacts.representativeTreatmentSubjects ?? null;
  }

  function normalizeParkingRulesetValue(value) {
    const text = String(value ?? '').trim();
    return MISSING_PARKING_TEXTS.has(text) ? PARKING_MANUAL_REQUIRED_TEXT : text;
  }

  function isMissingParkingValue(value) {
    return normalizeParkingRulesetValue(value) === PARKING_MANUAL_REQUIRED_TEXT;
  }

  function storeRegistrationParkingHref() {
    const url = new URL('soho_store_register.html', window.location.href);
    url.searchParams.set('storeId', currentStoreId());
    url.searchParams.set('focus', 'parking');
    return `${url.pathname}${url.search}`;
  }

  function goToStoreRegistrationParking() {
    window.location.href = storeRegistrationParkingHref();
  }

  function updateParkingManualAction(element, valueText) {
    const isMissing = isMissingParkingValue(valueText);
    const action = element.querySelector('[data-store-registration-action="parking"]');
    const value = element.querySelector('[data-ruleset-value]');
    if (action) action.hidden = !isMissing;
    if (value) value.classList.toggle('manual-required-text', isMissing);
  }

  function preferredCurrentValue(payload, fieldKey, existingValue) {
    const matrix = matrixForFieldKey(fieldKey);
    const matrixCurrentValue = matrix ? matrix.currentValue : null;
    if (fieldKey === 'representativeTreatmentSubjects') {
      return representativeTreatmentSubjectsValue(payload.storeFacts || {}) ?? matrixCurrentValue ?? existingValue;
    }
    if (APPLIED_STORE_INFO_FIELDS.has(fieldKey)) {
      const nextValue = directFactValue(payload.storeFacts, fieldKey) ?? matrixCurrentValue ?? existingValue;
      return fieldKey === 'parking' ? normalizeParkingRulesetValue(nextValue) : nextValue;
    }
    const rulesetField = findFieldForMatrixRow({ fieldKey });
    if (rulesetField) return rulesetField.finalValue || rulesetField.aiValue || existingValue;
    return matrixCurrentValue ?? directFactValue(payload.storeFacts, fieldKey) ?? existingValue;
  }

  function renderDirectRulesetRow(element, payload) {
    const value = element.querySelector('[data-ruleset-value]');
    const fieldKey = element.dataset.rulesetField;
    if (!value || !fieldKey) return;
    const insight = writingStyleInsightForElement(element);
    const nextValue = preferredCurrentValue(payload, fieldKey, value.textContent);
    if (!renderWritingStyleValue(element, value, insight, nextValue || '-')) {
      value.textContent = nextValue || '-';
      value.dataset.originalValue = value.textContent;
      value.classList.remove('placeholder-value');
      delete value.dataset.placeholderValue;
      value.removeAttribute('data-placeholder-value');
      delete value.dataset.placeholderText;
    }
    if (isWritingStyleRulesetField(element)) {
      element.dataset.loadedFieldKey = fieldKey;
      value.contentEditable = 'true';
      value.setAttribute('role', 'textbox');
      value.setAttribute('tabindex', '0');
      renderActionRow(element);
    }
    if (fieldKey === 'parking') updateParkingManualAction(element, value.textContent);
    renderKeywordTags(element, value.textContent);
    renderRulesetSourceNote(element, matrixForFieldKey(fieldKey));
  }

  function renderStoreFields(payload) {
    const storeFacts = payload.storeFacts || payload.store || {};
    document.querySelectorAll('[data-store-field]').forEach((element) => {
      const value = element.querySelector('.ruleset-val');
      const key = element.dataset.storeField;
      const nextValue = key ? storeFacts[key] : null;
      if (value && nextValue) value.textContent = nextValue;
    });
  }

  function categoryText(payload) {
    return [payload.storeFacts?.category, payload.store?.category]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join(' ');
  }

  function isHealthcareStore(payload) {
    const category = categoryText(payload);
    return HEALTHCARE_CATEGORY_KEYWORDS.some((keyword) => category.includes(keyword));
  }

  function configureIndustryFields(payload) {
    const isHealthcare = isHealthcareStore(payload);
    document.querySelectorAll('[data-industry-field="representativeOffering"]').forEach((field) => {
      const label = field.querySelector('[data-industry-label]');
      field.dataset.rulesetField = 'representativeMenu';
      field.dataset.rulesetAliases = isHealthcare ? 'representativeTreatmentSubjects' : '';
      if (label) label.textContent = isHealthcare ? '대표 진료과목' : '대표 메뉴';
    });
  }

  function setWritingDefaultValue(fieldKey, value) {
    document.querySelectorAll(`[data-ruleset-field="${fieldKey}"]`).forEach((element) => {
      const rulesetField = findFieldForElement(element);
      if (rulesetField?.locked || rulesetField?.source === 'user_edited') return;
      const valueElement = element.querySelector('[data-ruleset-value]');
      if (!valueElement) return;
      valueElement.textContent = value;
      valueElement.dataset.originalValue = value;
      renderKeywordTags(element, value);
    });
  }

  function configureWritingStyleFields(payload) {
    const isHealthcare = isHealthcareStore(payload);
    document.querySelectorAll('[data-healthcare-only]').forEach((element) => {
      element.style.display = isHealthcare ? '' : 'none';
      element.setAttribute('aria-hidden', isHealthcare ? 'false' : 'true');
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

  function versionSourceSummary(sourceCounts) {
    const entries = Object.entries(sourceCounts || {});
    if (entries.length === 0) return '필드 없음';
    return entries
      .slice(0, 3)
      .map(([source, count]) => `${source} ${count}`)
      .join(' · ');
  }

  function renderRulesetVersionPreview(payload) {
    const preview = field('ruleset-version-preview');
    if (!preview) return;
    const ruleset = payload?.ruleset;
    if (!ruleset) {
      preview.innerHTML = '<div class="ruleset-version-preview-head"><div class="ruleset-version-preview-copy"><strong>버전 미리보기</strong>조회할 버전을 선택하세요.</div></div>';
      return;
    }
    const fields = payload.fields || [];
    const restored = ruleset.restoredFromVersion ? ` · v${ruleset.restoredFromVersion}에서 원복` : '';
    const canRestore = ruleset.isCurrent === false;
    const body = [
      `<strong>v${escapeHtml(ruleset.version)} · ${escapeHtml(ruleset.status)}${escapeHtml(restored)}</strong>`,
      `<span class="ruleset-version-meta">필드 ${fields.length}개</span>`,
      payload.analysis?.id ? `<br><span class="ruleset-version-meta">분석 ${escapeHtml(payload.analysis.id)}</span>` : '',
      payload.learningSnapshot?.id ? `<br><span class="ruleset-version-meta">스냅샷 ${escapeHtml(payload.learningSnapshot.id)}</span>` : '',
      '<div style="margin-top:6px">',
      fields
        .slice(0, 3)
        .map((item) => `${escapeHtml(item.fieldKey)}: ${escapeHtml(item.finalValue || item.aiValue || '-')}`)
        .join('<br>'),
      '</div>'
    ].join('');
    preview.innerHTML = `<div class="ruleset-version-preview-head">
      <div class="ruleset-version-preview-copy">${body}</div>
      ${canRestore ? `<button type="button" class="ruleset-version-btn restore" data-ruleset-version-action="restore-preview" data-ruleset-id="${escapeHtml(ruleset.id)}">원복</button>` : ''}
    </div>`;
  }

  function renderRulesetVersionSelect(versions, selectedRulesetId) {
    const select = field('ruleset-version-select');
    if (!select) return;
    const safeVersions = Array.isArray(versions) ? versions : [];
    if (safeVersions.length === 0) {
      select.innerHTML = '<option value="">버전 없음</option>';
      select.disabled = true;
      return;
    }
    select.disabled = false;
    select.innerHTML = safeVersions
      .map((version) => {
        const restored = version.restoredFromVersion ? ` · restored v${version.restoredFromVersion}` : '';
        const current = version.isCurrent ? ' · 현재' : '';
        return `<option value="${escapeHtml(version.id)}">v${escapeHtml(version.version)}${current} · ${escapeHtml(version.status)}${escapeHtml(restored)} · ${escapeHtml(versionSourceSummary(version.sourceCounts))}</option>`;
      })
      .join('');
    select.value = selectedRulesetId || safeVersions.find((version) => version.isCurrent)?.id || safeVersions[0].id;
  }

  function removeEmptyRulesetGuidance() {
    const existing = field('ruleset-empty-guidance');
    if (existing) existing.remove();
  }

  function renderEmptyRulesetGuidance(payload) {
    removeEmptyRulesetGuidance();
    if (payload.ruleset) return;
    const title = document.querySelector('.page-title');
    if (!title) return;
    const storeFacts = payload.storeFacts || {};
    const availableFacts = [
      storeFacts.operatingHours ? '운영시간' : null,
      storeFacts.closedDays ? '휴무' : null,
      storeFacts.parking ? '주차' : null,
      storeFacts.storeIntro ? '소개' : null
    ].filter(Boolean);
    const guidance = document.createElement('div');
    guidance.id = 'ruleset-empty-guidance';
    guidance.className = 'ruleset-source-note';
    guidance.style.margin = '0 0 16px';
    guidance.innerHTML = [
      '<strong>아직 생성된 룰셋이 없습니다.</strong>',
      '<br>수집과 분석을 실행하면 AI가 생성한 마케팅 전략 룰셋을 확인할 수 있습니다.',
      '<br>Place에서 가져온 매장 기본 정보는 아래에서 먼저 확인할 수 있습니다.',
      availableFacts.length ? `<br><strong>확인 가능</strong> ${escapeHtml(availableFacts.join(', '))}` : ''
    ].join('');
    title.insertAdjacentElement('afterend', guidance);
  }

  function currentStoreValue(storeFacts, row) {
    const value = storeFacts?.[row.fieldKey];
    if (value) return String(value);
    return null;
  }

  function currentMatrixValue(payload, row) {
    if (row.currentValue) return String(row.currentValue);
    if (row.section === 'store') return currentStoreValue(payload.storeFacts || {}, row);
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
    renderWritingStyleInsights(payload);
    renderStatus(payload);
    renderEmptyRulesetGuidance(payload);
    renderStoreFields(payload);
    configureIndustryFields(payload);

    document.querySelectorAll('[data-ruleset-field]').forEach((element) => {
      const rulesetField = findFieldForElement(element);
      if (rulesetField) {
        renderRulesetField(element, rulesetField);
      } else {
        renderDirectRulesetRow(element, payload);
      }
    });
    configureWritingStyleFields(payload);
    renderSourceMatrix(payload);
  }

  function fieldValue(element) {
    const valueElement = element.querySelector('[data-ruleset-value]');
    const text = valueElement?.textContent?.trim() || '';
    const placeholderText = valueElement?.dataset?.placeholderText?.trim() || '';
    if (valueElement?.dataset?.placeholderValue === 'true' && text === placeholderText) return '';
    return text;
  }

  function setState(element, message) {
    const state = element.querySelector('[data-ruleset-state]');
    if (!state) return;
    state.textContent = message;
    state.hidden = !message;
  }

  function updateFieldInMemory(rulesetField) {
    fieldMap.set(rulesetField.fieldKey, rulesetField);
  }

  function evidenceSourceMode(payload) {
    if (payload.evidenceSourceMode) return payload.evidenceSourceMode;
    const fieldKey = payload.field?.fieldKey || '';
    if (REVIEW_EVIDENCE_FIELD_KEYS.has(fieldKey)) return 'review';
    if (BLOG_EVIDENCE_FIELD_KEYS.has(fieldKey)) return 'blog';
    return 'mixed';
  }

  function blogEvidenceItems(evidence) {
    const posts = (evidence || [])
      .filter((item) => item.channel === 'blog' && item.sourceType === 'post')
      .slice(0, 5);
    return posts;
  }

  function reviewEvidenceItems(evidence) {
    const reviews = (evidence || [])
      .filter((item) => item.channel === 'place' && item.sourceType === 'review')
      .slice(0, 5);
    return reviews;
  }

  function rationaleText(payload, evidenceItems) {
    const summaries = evidenceItems
      .map((item) => item.analysisSummary || '')
      .map((text) => text.replace(/^.*?산출 근거:\s*/, '').split('수집 근거:')[0].trim())
      .filter(Boolean);
    if (summaries.length > 0) return Array.from(new Set(summaries)).join(' ');
    const fieldValue = payload.field?.finalValue || payload.field?.aiValue || payload.field?.fieldValue;
    return fieldValue || '연결된 근거를 기준으로 산출했습니다.';
  }

  function evidenceReviewTitle(item) {
    return item.title && item.title !== '플레이스 리뷰 요약'
      ? item.title
      : `방문자 리뷰${item.score ? ` · 신뢰도 ${Math.round(item.score * 100)}%` : ''}`;
  }

  function evidenceBlogTitle(item) {
    return item.title ? `블로그 본문 인용 - ${item.title}` : '블로그 본문 인용';
  }

  function quoteText(item, fallbackText) {
    const text = String(item.excerpt || fallbackText || '').trim();
    if (!text) return fallbackText;
    return text.length > 180 ? `${text.slice(0, 180)}...` : text;
  }

  function evidenceCard(item, mode) {
    const isBlog = mode === 'blog';
    const title = isBlog ? evidenceBlogTitle(item) : evidenceReviewTitle(item);
    const fallback = isBlog ? '블로그 본문을 확인할 수 없습니다.' : '리뷰 본문을 확인할 수 없습니다.';
    const body = isBlog ? `“${quoteText(item, fallback)}”` : quoteText(item, fallback);
    return `<div class="evidence-review-card">
      <div class="evidence-review-title">${escapeHtml(title)}</div>
      <div class="evidence-review-body">${escapeHtml(body)}</div>
    </div>`;
  }

  async function handleSave(storeId, element) {
    const fieldKey = element.dataset.loadedFieldKey || element.dataset.rulesetField;
    const userValue = fieldValue(element);
    if (!fieldKey || !userValue) return;
    setState(element, '저장 중');
    const payload = await saveRulesetField(storeId, fieldKey, userValue);
    updateFieldInMemory(payload.field);
    updateWritingInsightFromField(payload.field);
    renderRulesetField(element, payload.field);
    setState(element, '저장됨');
  }

  async function handleReset(storeId, element) {
    const fieldKey = element.dataset.loadedFieldKey || element.dataset.rulesetField;
    if (!fieldKey) return;
    setState(element, '복원 중');
    const payload = await resetRulesetField(storeId, fieldKey);
    updateFieldInMemory(payload.field);
    updateWritingInsightFromField(payload.field);
    renderRulesetField(element, payload.field);
    setState(element, '');
  }

  function showEvidenceModal(payload) {
    const label = payload.field?.sourceMatrix?.label || payload.field?.fieldKey || '선택 항목';
    const mode = evidenceSourceMode(payload);
    const evidenceItems = mode === 'blog' ? blogEvidenceItems(payload.evidence) : reviewEvidenceItems(payload.evidence);
    const emptyText = mode === 'blog' ? '연결된 블로그 근거가 없습니다.' : '연결된 방문자 리뷰가 없습니다.';
    field('benchmarkEvidenceTitle').textContent = `${label} 근거 보기`;
    field('benchmarkEvidenceDesc').textContent = mode === 'blog'
      ? '이 항목 산출에 사용된 블로그 본문 인용과 산출근거입니다.'
      : '이 항목 산출에 사용된 실제 방문자 리뷰와 산출근거입니다.';
    field('benchmarkEvidenceReviews').innerHTML = evidenceItems
      .map((item) => evidenceCard(item, mode))
      .join('') || `<div class="evidence-review-card"><div class="evidence-review-body">${emptyText}</div></div>`;
    field('benchmarkEvidenceRationaleText').textContent = rationaleText(payload, evidenceItems);
    field('benchmarkEvidenceRationale').hidden = false;
    field('benchmarkEvidenceList').innerHTML = '';
    field('modal-benchmark-evidence').style.display = 'flex';
  }

  async function handleEvidence(storeId, element) {
    const fieldKey = element.dataset.rulesetField || element.dataset.loadedFieldKey;
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

  function wireRulesetVersionActions(storeId) {
    document.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-ruleset-version-action]');
      if (!button) return;
      const rulesetId = button.dataset.rulesetId;
      if (!rulesetId) return;
      try {
        if (button.dataset.rulesetVersionAction === 'restore-preview') {
          button.disabled = true;
          button.textContent = '원복 중';
          const restored = await restoreRulesetVersion(storeId, rulesetId);
          renderRuleset(restored);
          renderRulesetVersionPreview(restored);
          const versions = await loadRulesetVersions(storeId);
          renderRulesetVersionSelect(versions.versions || [], restored.ruleset?.id);
        }
      } catch (error) {
        console.warn(error);
        const preview = field('ruleset-version-preview');
        if (preview) preview.innerHTML = '<div class="ruleset-version-preview-head"><div class="ruleset-version-preview-copy"><strong>버전 처리 실패</strong>잠시 후 다시 시도해주세요.</div></div>';
      } finally {
        button.disabled = false;
      }
    });

    field('ruleset-version-select')?.addEventListener('change', async (event) => {
      const rulesetId = event.target.value;
      if (!rulesetId) return;
      try {
        renderRulesetVersionPreview(await loadRulesetVersion(storeId, rulesetId));
      } catch (error) {
        console.warn(error);
        const preview = field('ruleset-version-preview');
        if (preview) preview.innerHTML = '<div class="ruleset-version-preview-head"><div class="ruleset-version-preview-copy"><strong>버전 조회 실패</strong>잠시 후 다시 시도해주세요.</div></div>';
      }
    });
  }

  window.goToStoreRegistrationParking = goToStoreRegistrationParking;

  document.addEventListener('DOMContentLoaded', async () => {
    const storeId = currentStoreId();
    window.localStorage.setItem(STORE_ID_KEY, storeId);
    wireActions(storeId);
    wireRulesetVersionActions(storeId);
    wirePlaceholderEditing();
    try {
      const [ruleset, versions] = await Promise.all([
        loadRuleset(storeId),
        loadRulesetVersions(storeId)
      ]);
      renderRuleset(ruleset);
      renderRulesetVersionSelect(versions.versions || [], ruleset.ruleset?.id);
      renderRulesetVersionPreview(ruleset);
    } catch (error) {
      console.warn(error);
      const status = field('ruleset-status');
      if (status) status.textContent = '로드 실패';
    }
  });
})();
