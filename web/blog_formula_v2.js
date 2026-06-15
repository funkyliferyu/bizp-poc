(function () {
  const STORE_ID_KEY = 'bizplanet.storeRegistration.storeId';
  const state = {
    formulaSetId: null,
    topicBriefId: null,
    retrievalRunId: null,
    draftGenerationId: null,
    latestSamples: [],
    topicBriefSets: []
  };

  function field(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function blogFormulaV2CurrentStoreId() {
    return new URLSearchParams(window.location.search).get('storeId')
      || window.localStorage.getItem(STORE_ID_KEY)
      || 'store_demo_cake';
  }

  function setText(id, value) {
    const element = field(id);
    if (element) element.textContent = value ?? '-';
  }

  function inputValue(id) {
    return field(id)?.value?.trim?.() ?? '';
  }

  function splitList(value) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('ko-KR', { hour12: false });
  }

  function setMessage(message) {
    setText('v2FormulaMessage', message);
  }

  let overlayElapsedTimer = null;
  let overlayElapsedStartedAt = null;
  let overlayButtonId = null;

  function formatElapsed(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  // Shared progress overlay for the long (~30-60s) openai calls. The extract and
  // draft flows reuse the same #v2ExtractOverlay element with a different title
  // and the button they should disable while the call is in flight.
  function showProgressOverlay(options) {
    const overlay = field('v2ExtractOverlay');
    if (overlay) {
      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
    }
    if (options && options.title) setText('v2OverlayTitle', options.title);
    setText('v2ExtractOverlayStatus', (options && options.status) || 'OpenAI가 분석하고 있습니다.');
    overlayButtonId = (options && options.buttonId) || null;
    const button = overlayButtonId ? field(overlayButtonId) : null;
    if (button) button.disabled = true;
    overlayElapsedStartedAt = Date.now();
    const tick = () => {
      setText('v2ExtractOverlayElapsed', `경과 ${formatElapsed(Date.now() - overlayElapsedStartedAt)}`);
    };
    tick();
    if (overlayElapsedTimer) window.clearInterval(overlayElapsedTimer);
    overlayElapsedTimer = window.setInterval(tick, 1000);
  }

  function hideProgressOverlay() {
    const overlay = field('v2ExtractOverlay');
    if (overlay) {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
    }
    const button = overlayButtonId ? field(overlayButtonId) : null;
    if (button) button.disabled = false;
    overlayButtonId = null;
    if (overlayElapsedTimer) window.clearInterval(overlayElapsedTimer);
    overlayElapsedTimer = null;
    overlayElapsedStartedAt = null;
  }

  function showExtractOverlay(statusText) {
    showProgressOverlay({
      title: 'AI가 블로그 포뮬라를 추출하는 중',
      status: statusText || 'OpenAI가 owner 블로그를 분석하고 있습니다.',
      buttonId: 'v2FormulaExtractButton'
    });
  }

  function hideExtractOverlay() {
    hideProgressOverlay();
  }

  function showDraftOverlay(statusText) {
    showProgressOverlay({
      title: 'AI가 블로그 초안을 생성하는 중',
      status: statusText || 'OpenAI가 포뮬라와 유사 블로그로 초안을 작성하고 있습니다.',
      buttonId: 'v2GenerateButton'
    });
  }

  function hideDraftOverlay() {
    hideProgressOverlay();
  }

  function topicBriefFromForm() {
    return {
      topic: inputValue('v2-topic'),
      mainKeyword: inputValue('v2-main-keyword'),
      secondaryKeywords: splitList(inputValue('v2-secondary-keywords')),
      targetReader: inputValue('v2-target-reader') || null,
      coreConcern: inputValue('v2-core-concern') || null,
      mainAngle: inputValue('v2-main-angle') || null,
      mustInclude: splitList(inputValue('v2-must-include')),
      mustAvoid: splitList(inputValue('v2-must-avoid')),
      ctaDirection: inputValue('v2-cta-direction') || null
    };
  }

  function setInputValue(id, value) {
    const element = field(id);
    if (element) element.value = value ?? '';
  }

  function topicBriefSetSummary(set) {
    return set.mainAngle || set.coreConcern || set.mainKeyword || set.topic;
  }

  function renderTopicBriefLibrary(payload) {
    const select = field('v2TopicBriefLibrary');
    state.topicBriefSets = (payload && payload.topicBriefSets) || [];
    if (select) {
      const counts = {};
      const totals = {};
      state.topicBriefSets.forEach((set) => {
        totals[set.topic] = (totals[set.topic] || 0) + 1;
      });
      const circled = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
      const options = state.topicBriefSets.map((set, index) => {
        counts[set.topic] = (counts[set.topic] || 0) + 1;
        const order = totals[set.topic] > 1 ? ` ${circled[counts[set.topic] - 1] || counts[set.topic]}` : '';
        const label = `${set.topic}${order} · ${topicBriefSetSummary(set)}`;
        return `<option value="${escapeHtml(index)}">${escapeHtml(label)}</option>`;
      });
      select.innerHTML = '<option value="">직접 입력</option>' + options.join('');
    }
    const remaining = (payload && payload.status && payload.status.topicBriefSetRemainingCount) || 0;
    const button = field('v2TopicBriefExtendButton');
    if (button) {
      button.style.display = remaining > 0 ? '' : 'none';
      button.textContent = `더 많은 블로그에서 포뮬라 생성 (남은 ${remaining}건)`;
    }
    // An empty dropdown alone looks broken (e.g. a formula set whose briefs have
    // not been mined yet, or a first-batch that failed server-side). Show an
    // explicit notice telling the user the library is empty and how to fill it.
    const notice = field('v2TopicBriefEmptyNotice');
    if (notice) {
      const isEmpty = state.topicBriefSets.length === 0;
      notice.style.display = isEmpty ? '' : 'none';
      notice.textContent = remaining > 0
        ? "아직 생성된 토픽 브리프가 없습니다. 위 '더 많은 블로그에서 포뮬라 생성' 버튼으로 라이브러리를 채워주세요."
        : '포뮬라를 추출하면 토픽 브리프 라이브러리가 채워집니다.';
    }
  }

  function applyTopicBriefSet(indexValue) {
    if (indexValue === '' || indexValue === null || indexValue === undefined) return;
    const set = state.topicBriefSets[Number(indexValue)];
    if (!set) return;
    setInputValue('v2-topic', set.topic);
    setInputValue('v2-main-keyword', set.mainKeyword);
    setInputValue('v2-secondary-keywords', (set.secondaryKeywords || []).join(', '));
    setInputValue('v2-target-reader', set.targetReader || '');
    setInputValue('v2-core-concern', set.coreConcern || '');
    setInputValue('v2-main-angle', set.mainAngle || '');
    setInputValue('v2-must-include', (set.mustInclude || []).join(', '));
    setInputValue('v2-must-avoid', (set.mustAvoid || []).join(', '));
    setInputValue('v2-cta-direction', set.ctaDirection || '');
    setMessage(`토픽 브리프 "${set.topic}"를 소재 Brief에 적용했습니다.`);
  }

  async function extendTopicBriefSetLibrary() {
    const storeId = blogFormulaV2CurrentStoreId();
    try {
      // SL-F2 can run a slow (~30-60s) server-side openai batch, so reuse the
      // shared progress overlay (spinner + elapsed timer) and let it disable the
      // extend button while the call is in flight.
      showProgressOverlay({
        title: 'AI가 토픽 브리프를 생성하는 중',
        status: '추가 블로그에서 토픽 브리프를 생성하고 있습니다.',
        buttonId: 'v2TopicBriefExtendButton'
      });
      setMessage('추가 블로그에서 토픽 브리프를 생성하는 중입니다.');
      const response = await fetch(`/api/stores/${storeId}/v2/blog-formula/topic-brief-sets/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!response.ok) throw new Error('extend failed');
      const result = await response.json();
      renderTopicBriefLibrary({
        topicBriefSets: result.topicBriefSets,
        status: { topicBriefSetRemainingCount: result.remainingCount }
      });
      setMessage(`토픽 브리프 ${result.added.length}건을 추가했습니다. (남은 ${result.remainingCount}건)`);
    } catch {
      setMessage('토픽 브리프 추가 생성에 실패했습니다.');
    } finally {
      hideProgressOverlay();
    }
  }

  function renderStatus(payload) {
    const formulaSet = payload?.formulaSet;
    const latestDraft = payload?.latestDraftGeneration;
    const latestValidation = payload?.latestValidation;
    setText('v2FormulaStatus', formulaSet?.status || '없음');
    setText('v2FormulaVersion', formulaSet?.version || '-');
    setText('v2FormulaSourceCount', `${payload?.status?.sourceOwnerBlogPostCount ?? 0}개`);
    setText('v2FormulaReviewStatus', latestValidation?.status || payload?.status?.reviewStatus || 'not_validated');
    setText('v2FormulaUpdatedAt', formatDate(formulaSet?.updatedAt));
    setText('v2FormulaModel', formulaSet?.model || payload?.status?.model || 'deterministic-blog-formula-v2');
    setText('v2FormulaIndependence', payload?.independentFromV1 ? 'V1 독립' : '-');
    setText('v2DraftStatus', latestDraft?.status || '-');
    state.formulaSetId = formulaSet?.id || state.formulaSetId;
    state.draftGenerationId = latestDraft?.id || state.draftGenerationId;
  }

  function renderSourcePosts(sourcePosts) {
    const target = field('v2FormulaSourcePosts');
    if (!target) return;
    if (!sourcePosts?.length) {
      target.innerHTML = '<div class="formula-v2-meta">아직 추출에 사용된 소스 블로그가 없습니다.</div>';
      return;
    }
    target.innerHTML = sourcePosts
      .map((post) => `
        <div class="formula-v2-source">
          <div class="formula-v2-source-title">${escapeHtml(post.title || post.collectionItemId)}</div>
          <div class="formula-v2-meta">
            <span class="formula-v2-badge">${escapeHtml(post.sourceKind || 'owner_blog_post')}</span>
            ${escapeHtml(post.charCount ?? 0)}자 · truncated ${escapeHtml(post.isTruncated ? 'Y' : 'N')}
          </div>
          <div class="formula-v2-meta">${escapeHtml(post.sourceUrl || '-')}</div>
          <div class="formula-v2-meta">${escapeHtml((post.usedFor || []).join(', '))}</div>
        </div>
      `)
      .join('');
  }

  function formulaBlockDetail(item) {
    if (!item) return '';
    if (Array.isArray(item.sequence)) return item.sequence.join(' → ');
    if (Array.isArray(item.patterns)) return item.patterns.join(' / ');
    if (Array.isArray(item.softPatterns)) return `${item.primaryStyle || ''} · ${item.softPatterns.join(' / ')}`;
    if (Array.isArray(item.bannedClaims)) {
      return `금지: ${item.bannedClaims.join(', ')} · 필수 고지: ${(item.requiredDisclosures || []).join(', ')}`;
    }
    if (Array.isArray(item.preferredPhrases)) {
      return `${item.persona || ''} · 선호 표현: ${item.preferredPhrases.join(' / ')} · 어미: ${(item.endingStyle || []).join(', ')}`;
    }
    return item.pattern || item.description || '';
  }

  function renderFormulaCard(label, item) {
    const titleName = item.name || item.persona || '';
    const detail = formulaBlockDetail(item);
    const detailLine = item.pattern
      ? `<div class="formula-v2-meta"><strong>Pattern</strong> ${escapeHtml(detail)}</div>`
      : `<div class="formula-v2-meta">${escapeHtml(detail)}</div>`;
    const descriptionLine = item.description ? `<div class="formula-v2-meta">${escapeHtml(item.description)}</div>` : '';
    const titleSuffix = titleName ? ` · ${escapeHtml(titleName)}` : '';
    return `
      <div class="formula-v2-card">
        <div class="formula-v2-card-title">${escapeHtml(label)}${titleSuffix}</div>
        ${descriptionLine}
        ${detailLine}
        <div class="formula-v2-meta">
          <span class="formula-v2-badge">${escapeHtml(item.status)}</span>
          confidence ${escapeHtml(item.confidence)}
        </div>
      </div>
    `;
  }

  function renderFormulaCards(formulaSet) {
    const target = field('v2FormulaCards');
    if (!target) return;
    const formula = formulaSet?.formula || {};
    const entries = [
      ['titleFormula', '제목 공식'],
      ['introFormula', '도입부 공식'],
      ['bodyFormula', '본문 전개 공식'],
      ['headingFormula', '소제목 공식'],
      ['toneAndMannerFormula', '톤앤매너 공식'],
      ['ctaFormula', 'CTA 공식'],
      ['footerFormula', '푸터 공식'],
      ['medicalSafetyFormula', '의료 안전 공식']
    ];
    const cards = entries
      .flatMap(([key, label]) => {
        const item = formula[key];
        if (!item) return [];
        if (Array.isArray(item)) {
          return item.map((entry) => renderFormulaCard(label, entry));
        }
        return [renderFormulaCard(label, item)];
      })
      .filter(Boolean);
    target.innerHTML = cards.length ? cards.join('') : '<div class="formula-v2-meta">포뮬라를 추출하면 표시됩니다.</div>';
  }

  function renderPayload(payload) {
    renderStatus(payload);
    renderSourcePosts(payload?.sourcePosts || []);
    renderFormulaCards(payload?.formulaSet);
    renderTopicBriefLibrary(payload);
    // Render the persisted draft and its compliance comparison on load (not only
    // right after generating), so a reloaded page shows the same panels. Each
    // renderer handles a null argument with its own empty state.
    const draftOutput = payload?.latestDraftGeneration?.output || null;
    renderDraft(draftOutput);
    renderComplianceComparison(draftOutput);
    renderValidation(payload?.latestValidation?.validation || null, {
      hasDraft: Boolean(payload?.latestDraftGeneration)
    });
  }

  function renderSamples(samples) {
    const target = field('v2RetrievedSamples');
    if (!target) return;
    if (!samples?.length) {
      target.innerHTML = '<div class="formula-v2-meta">검색 결과가 없습니다.</div>';
      return;
    }
    target.innerHTML = samples
      .map((sample) => `
        <div class="formula-v2-sample">
          <div class="formula-v2-sample-title">${escapeHtml(sample.rank)}위 ${escapeHtml(sample.title || sample.collectionItemId)}</div>
          <div class="formula-v2-meta">
            score ${escapeHtml(sample.totalScore)} · treatment ${escapeHtml(sample.scoring?.treatmentMatch)}
            · concern ${escapeHtml(sample.scoring?.concernMatch)} · title ${escapeHtml(sample.scoring?.titleMatch)}
          </div>
          <div class="formula-v2-meta">${escapeHtml(sample.whySelected)}</div>
        </div>
      `)
      .join('');
  }

  function renderDraft(output) {
    const target = field('v2DraftPreview');
    if (!target) return;
    if (!output) {
      target.innerHTML = '초안 생성 결과가 없습니다.';
      return;
    }
    target.innerHTML = `
      <div class="formula-v2-card-title">${escapeHtml(output.selectedTitle)}</div>
      <div class="formula-v2-meta">${(output.titleCandidates || []).map((title) => `<span class="formula-v2-badge">${escapeHtml(title)}</span>`).join('')}</div>
      <div class="formula-v2-draft" style="margin-top:10px">${escapeHtml(output.blogDraft)}</div>
    `;
  }

  function yesNo(value) {
    return value ? '예' : '아니오';
  }

  function joinList(value) {
    return Array.isArray(value) && value.length ? value.join(', ') : '-';
  }

  function complianceRow(label, modelValue, serverValue) {
    return `
      <div class="formula-v2-sample">
        <div class="formula-v2-sample-title">${escapeHtml(label)}</div>
        <div class="formula-v2-meta">모델 자가보고: ${escapeHtml(modelValue)}</div>
        <div class="formula-v2-meta">서버 검증: ${escapeHtml(serverValue)}</div>
      </div>
    `;
  }

  // Shows the model's self-reported compliance next to the server-derived
  // authoritative compliance so a human can compare the two.
  function renderComplianceComparison(output) {
    const target = field('v2DraftCompliancePanel');
    if (!target) return;
    if (!output) {
      target.innerHTML = 'OpenAI 초안을 생성하면 모델 자가보고와 서버 검증 결과를 나란히 비교할 수 있습니다.';
      return;
    }
    const server = {
      bannedPhrasesAvoided: output.safetyCheck && output.safetyCheck.bannedPhrasesAvoided,
      requiredDisclosures: (output.safetyCheck && output.safetyCheck.requiredDisclosures) || [],
      appliedBlocks: (output.styleComplianceReport && output.styleComplianceReport.appliedBlocks) || [],
      mainKeywordInTitle: output.seoCheck && output.seoCheck.mainKeywordInTitle,
      mainKeywordInIntro: output.seoCheck && output.seoCheck.mainKeywordInIntro,
      secondaryKeywordsUsed: (output.seoCheck && output.seoCheck.secondaryKeywordsUsed) || []
    };
    const model = output.modelReportedCompliance;
    if (!model) {
      target.innerHTML =
        '<div class="formula-v2-meta">deterministic 초안에는 모델 자가보고가 없어 서버 검증만 표시합니다.</div>'
        + `<div class="formula-v2-meta">금지표현 회피(서버): ${yesNo(server.bannedPhrasesAvoided)}</div>`
        + `<div class="formula-v2-meta">필수 고지(서버): ${escapeHtml(joinList(server.requiredDisclosures))}</div>`;
      return;
    }
    const modelSafety = model.safetyCheck || {};
    const modelStyle = model.styleComplianceReport || {};
    const modelSeo = model.seoCheck || {};
    target.innerHTML = [
      complianceRow('금지표현 회피', yesNo(modelSafety.bannedPhrasesAvoided), yesNo(server.bannedPhrasesAvoided)),
      complianceRow('필수 고지', joinList(modelSafety.requiredDisclosures), joinList(server.requiredDisclosures)),
      complianceRow('적용 포뮬라 블록', joinList(modelStyle.appliedBlocks), joinList(server.appliedBlocks)),
      complianceRow('제목 메인키워드', yesNo(modelSeo.mainKeywordInTitle), yesNo(server.mainKeywordInTitle)),
      complianceRow('도입부 메인키워드', yesNo(modelSeo.mainKeywordInIntro), yesNo(server.mainKeywordInIntro)),
      complianceRow('사용된 서브키워드', joinList(modelSeo.secondaryKeywordsUsed), joinList(server.secondaryKeywordsUsed))
    ].join('');
  }

  function renderValidation(validation, options) {
    const target = field('v2ValidationPanel');
    if (!target) return;
    if (!validation) {
      // Distinguish "no draft yet" from "draft generated but not yet checked":
      // the latter points the user at the separate 초안 검수 step.
      target.innerHTML = options && options.hasDraft
        ? "아직 검수하지 않은 초안입니다. '초안 검수' 버튼을 눌러 검수 결과를 확인하세요."
        : '검수 결과가 없습니다.';
      return;
    }
    target.innerHTML = `
      <div class="formula-v2-meta">
        <span class="formula-v2-badge formula-v2-risk ${escapeHtml(validation.riskLevel)}">${escapeHtml(validation.status)}</span>
        ${escapeHtml(validation.summary)}
      </div>
      <div class="formula-v2-sample-list" style="margin-top:8px">
        ${(validation.issues || []).map((issue) => `
          <div class="formula-v2-sample">
            <div class="formula-v2-sample-title">${escapeHtml(issue.code)} · ${escapeHtml(issue.severity)}</div>
            <div class="formula-v2-meta">${escapeHtml(issue.message)}</div>
            ${issue.evidence ? `<div class="formula-v2-meta">${escapeHtml(issue.evidence)}</div>` : ''}
          </div>
        `).join('') || '<div class="formula-v2-meta">검수 이슈가 없습니다.</div>'}
      </div>
    `;
  }

  async function loadBlogFormulaV2() {
    const storeId = blogFormulaV2CurrentStoreId();
    try {
      const response = await fetch(`/api/stores/${storeId}/v2/blog-formula`);
      if (!response.ok) throw new Error('load failed');
      const payload = await response.json();
      renderPayload(payload);
      setMessage('V2 상태를 불러왔습니다.');
    } catch {
      setMessage('V2 상태를 불러오지 못했습니다.');
    }
  }

  async function extractBlogFormulaV2() {
    const storeId = blogFormulaV2CurrentStoreId();
    try {
      setMessage('OpenAI로 포뮬라를 추출하는 중입니다.');
      showExtractOverlay('OpenAI가 owner 블로그를 분석하고 있습니다.');
      const response = await fetch(`/api/stores/${storeId}/v2/blog-formula/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerMode: 'openai' })
      });
      if (!response.ok) throw new Error('extract failed');
      const payload = await response.json();
      state.formulaSetId = payload.formulaSet?.id || null;
      renderStatus({ formulaSet: payload.formulaSet, sourcePosts: payload.sourcePosts, independentFromV1: true, status: { sourceOwnerBlogPostCount: payload.sourcePosts?.length || 0 } });
      renderSourcePosts(payload.sourcePosts || []);
      renderFormulaCards(payload.formulaSet);
      const model = payload.provider?.model || payload.formulaSet?.model || '-';
      // Refresh first (this repopulates the topic brief library dropdown), then set
      // the informative success message last so loadBlogFormulaV2's generic message
      // does not overwrite it.
      await loadBlogFormulaV2();
      setMessage(`Blog Formula V2 추출이 완료되었습니다. (모델 ${model})`);
      return payload;
    } catch {
      setMessage('포뮬라 추출에 실패했습니다. OpenAI 키와 서버 상태를 확인하세요.');
      return null;
    } finally {
      hideExtractOverlay();
    }
  }

  async function ensureFormulaSet() {
    if (state.formulaSetId) return state.formulaSetId;
    const extracted = await extractBlogFormulaV2();
    return extracted?.formulaSet?.id || null;
  }

  async function retrieveBlogFormulaV2Samples() {
    const storeId = blogFormulaV2CurrentStoreId();
    const formulaSetId = await ensureFormulaSet();
    if (!formulaSetId) return null;
    try {
      setMessage('유사 블로그를 검색하는 중입니다.');
      const response = await fetch(`/api/stores/${storeId}/v2/blog-formula/retrieve-samples`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formulaSetId,
          topicBrief: topicBriefFromForm(),
          maxSamples: 3
        })
      });
      if (!response.ok) throw new Error('retrieve failed');
      const payload = await response.json();
      state.topicBriefId = payload.topicBrief?.id || null;
      state.retrievalRunId = payload.retrievalRun?.id || null;
      state.latestSamples = payload.samples || [];
      renderSamples(state.latestSamples);
      setMessage('유사 블로그 Top 3를 불러왔습니다.');
      return payload;
    } catch {
      setMessage('유사 블로그 검색에 실패했습니다.');
      return null;
    }
  }

  async function generateBlogFormulaV2Draft() {
    const storeId = blogFormulaV2CurrentStoreId();
    if (!state.topicBriefId || !state.retrievalRunId) {
      const retrieved = await retrieveBlogFormulaV2Samples();
      if (!retrieved) return null;
    }
    try {
      setMessage('OpenAI로 V2 초안을 생성하는 중입니다.');
      showDraftOverlay('OpenAI가 포뮬라와 유사 블로그로 초안을 작성하고 있습니다.');
      const response = await fetch(`/api/stores/${storeId}/v2/blog-formula/generate-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formulaSetId: state.formulaSetId,
          topicBriefId: state.topicBriefId,
          retrievalRunId: state.retrievalRunId,
          providerMode: 'openai'
        })
      });
      if (!response.ok) throw new Error('generate failed');
      const payload = await response.json();
      state.draftGenerationId = payload.draftGeneration?.id || null;
      setText('v2DraftStatus', payload.draftGeneration?.status || '-');
      const model = payload.provider?.model || payload.draftGeneration?.model || '-';
      setText('v2FormulaModel', model);
      renderDraft(payload.output);
      renderComplianceComparison(payload.output);
      setMessage(`V2 초안 생성이 완료되었습니다. (모델 ${model})`);
      return payload;
    } catch {
      setMessage('V2 초안 생성에 실패했습니다. OpenAI 키와 서버 상태를 확인하세요.');
      return null;
    } finally {
      hideDraftOverlay();
    }
  }

  async function validateBlogFormulaV2Draft() {
    const storeId = blogFormulaV2CurrentStoreId();
    if (!state.draftGenerationId) {
      const generated = await generateBlogFormulaV2Draft();
      if (!generated) return null;
    }
    try {
      setMessage('초안을 검수하는 중입니다.');
      const response = await fetch(`/api/stores/${storeId}/v2/blog-formula/validate-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftGenerationId: state.draftGenerationId })
      });
      if (!response.ok) throw new Error('validate failed');
      const payload = await response.json();
      renderValidation(payload.validation);
      setText('v2FormulaReviewStatus', payload.validation?.status || '-');
      setMessage('V2 초안 검수가 완료되었습니다.');
      return payload;
    } catch {
      setMessage('초안 검수에 실패했습니다.');
      return null;
    }
  }

  window.loadBlogFormulaV2 = loadBlogFormulaV2;
  window.extractBlogFormulaV2 = extractBlogFormulaV2;
  window.retrieveBlogFormulaV2Samples = retrieveBlogFormulaV2Samples;
  window.generateBlogFormulaV2Draft = generateBlogFormulaV2Draft;
  window.validateBlogFormulaV2Draft = validateBlogFormulaV2Draft;
  window.applyTopicBriefSet = applyTopicBriefSet;
  window.extendTopicBriefSetLibrary = extendTopicBriefSetLibrary;

  document.addEventListener('DOMContentLoaded', () => {
    loadBlogFormulaV2();
  });
})();
