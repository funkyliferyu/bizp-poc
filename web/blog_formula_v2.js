(function () {
  const STORE_ID_KEY = 'bizplanet.storeRegistration.storeId';
  const state = {
    formulaSetId: null,
    topicBriefId: null,
    retrievalRunId: null,
    draftGenerationId: null,
    latestSamples: []
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
    if (payload?.latestDraftGeneration?.output) renderDraft(payload.latestDraftGeneration.output);
    if (payload?.latestValidation?.validation) renderValidation(payload.latestValidation.validation);
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

  function renderValidation(validation) {
    const target = field('v2ValidationPanel');
    if (!target) return;
    if (!validation) {
      target.innerHTML = '검수 결과가 없습니다.';
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
      setMessage('포뮬라를 추출하는 중입니다.');
      const response = await fetch(`/api/stores/${storeId}/v2/blog-formula/extract`, { method: 'POST' });
      if (!response.ok) throw new Error('extract failed');
      const payload = await response.json();
      state.formulaSetId = payload.formulaSet?.id || null;
      renderStatus({ formulaSet: payload.formulaSet, sourcePosts: payload.sourcePosts, independentFromV1: true, status: { sourceOwnerBlogPostCount: payload.sourcePosts?.length || 0 } });
      renderSourcePosts(payload.sourcePosts || []);
      renderFormulaCards(payload.formulaSet);
      setMessage('Blog Formula V2 추출이 완료되었습니다.');
      return payload;
    } catch {
      setMessage('포뮬라 추출에 실패했습니다.');
      return null;
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
      setMessage('V2 초안을 생성하는 중입니다.');
      const response = await fetch(`/api/stores/${storeId}/v2/blog-formula/generate-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formulaSetId: state.formulaSetId,
          topicBriefId: state.topicBriefId,
          retrievalRunId: state.retrievalRunId
        })
      });
      if (!response.ok) throw new Error('generate failed');
      const payload = await response.json();
      state.draftGenerationId = payload.draftGeneration?.id || null;
      setText('v2DraftStatus', payload.draftGeneration?.status || '-');
      renderDraft(payload.output);
      setMessage('V2 초안 생성이 완료되었습니다.');
      return payload;
    } catch {
      setMessage('V2 초안 생성에 실패했습니다.');
      return null;
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

  document.addEventListener('DOMContentLoaded', () => {
    loadBlogFormulaV2();
  });
})();
