(function () {
  const params = new URLSearchParams(window.location.search);
  const runId = params.get('runId') || '';
  let currentSection = params.get('section') || 'blogItems';
  let currentData = null;

  const sections = [
    { key: 'blogItems', label: 'Blog items', value: (data) => blogItems(data.items).map(blogEvidence) },
    {
      key: 'collectedBlogItems',
      label: 'Collected Blog',
      value: (data) => blogItems(data.items).filter((item) => item.status === 'collected').map(blogEvidence)
    },
    {
      key: 'failedBlogItems',
      label: 'Failed Blog',
      value: (data) => blogItems(data.items).filter((item) => item.status === 'failed').map(blogEvidence)
    },
    { key: 'allItems', label: 'All items', value: (data) => data.items },
    { key: 'collectionRun', label: 'Collection run', value: (data) => data.collectionRun }
  ];

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

  function highlightJson(json) {
    return escapeHtml(json).replace(
      /(&quot;(?:\\.|[^\\])*?&quot;)(\s*:)?|\b(true|false)\b|\b(null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|([{}\[\],])/g,
      (match, quoted, colon, bool, nil, punctuation) => {
        if (quoted) {
          const className = colon ? 'json-key' : 'json-string';
          const suffix = colon ? '<span class="json-punctuation">:</span>' : '';
          return `<span class="${className}">${quoted}</span>${suffix}`;
        }
        if (bool) return `<span class="json-boolean">${bool}</span>`;
        if (nil) return `<span class="json-null">${nil}</span>`;
        if (punctuation) return `<span class="json-punctuation">${punctuation}</span>`;
        return `<span class="json-number">${match}</span>`;
      }
    );
  }

  function blogItems(items) {
    return (items || []).filter((item) => item.channel === 'blog' || item.sourceType === 'post');
  }

  function blogEvidence(item) {
    const metadata = item.metadata || {};
    return {
      id: item.id,
      status: item.status,
      title: item.title,
      sourceUrl: item.sourceUrl,
      bodyAvailability: metadata.bodyAvailability || null,
      blogSourceDiscovery: metadata.blogSourceDiscovery || null,
      sourceKind: metadata.sourceKind || null,
      sourceOwnership: metadata.sourceOwnership || null,
      bodyLength: item.bodyText ? item.bodyText.length : 0,
      bodyText: item.bodyText,
      metadata
    };
  }

  function jsonSize(value) {
    return new Blob([JSON.stringify(value ?? null)]).size;
  }

  function summarize(value) {
    if (!value || typeof value !== 'object') {
      return [
        ['유형', value === null ? 'null' : typeof value],
        ['크기', `${jsonSize(value).toLocaleString('ko-KR')} bytes`]
      ];
    }
    const items = Array.isArray(value) ? value : [];
    const rows = [
      ['유형', Array.isArray(value) ? 'array' : 'object'],
      ['항목 수', Array.isArray(value) ? items.length.toLocaleString('ko-KR') : Object.keys(value).length.toLocaleString('ko-KR')],
      ['크기', `${jsonSize(value).toLocaleString('ko-KR')} bytes`]
    ];
    if (Array.isArray(value)) {
      rows.push(['수집 완료', items.filter((item) => item.status === 'collected').length.toLocaleString('ko-KR')]);
      rows.push(['수집 실패', items.filter((item) => item.status === 'failed').length.toLocaleString('ko-KR')]);
    }
    return rows;
  }

  function showError(message) {
    const error = field('raw-error');
    const card = field('raw-card');
    if (error) {
      error.hidden = false;
      error.textContent = message;
    }
    if (card) card.hidden = true;
  }

  function renderTabs() {
    const container = field('raw-section-tabs');
    if (!container) return;
    container.innerHTML = sections
      .map(
        (section) =>
          `<button type="button" class="raw-tab${section.key === currentSection ? ' active' : ''}" data-section="${escapeHtml(section.key)}">${escapeHtml(section.label)}</button>`
      )
      .join('');
    container.querySelectorAll('[data-section]').forEach((button) => {
      button.addEventListener('click', () => {
        currentSection = button.getAttribute('data-section') || 'blogItems';
        const nextUrl = `collection_raw_data.html?runId=${encodeURIComponent(runId)}&section=${encodeURIComponent(currentSection)}`;
        window.history.replaceState({}, '', nextUrl);
        renderData();
      });
    });
  }

  function renderData() {
    if (!currentData) return;
    const section = sections.find((item) => item.key === currentSection) || sections[0];
    const value = section.value(currentData) ?? {};
    const json = JSON.stringify(value, null, 2);

    const label = field('raw-store-label');
    if (label) label.textContent = `${currentData.collectionRun.storeId || currentData.collectionRun.id} · ${section.label}`;

    const summary = field('raw-summary');
    if (summary) {
      summary.innerHTML = summarize(value)
        .map(([key, rowValue]) => `<div class="summary-row"><span>${escapeHtml(key)}</span><strong>${escapeHtml(rowValue)}</strong></div>`)
        .join('');
    }

    const pre = field('raw-json');
    if (pre) {
      pre.dataset.rawJson = json;
      pre.innerHTML = highlightJson(json);
    }
    renderTabs();
  }

  async function readResponse(response) {
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(body.error || 'RAW data를 불러오지 못했습니다.');
    return body;
  }

  async function loadCollection() {
    if (!runId) {
      showError('runId가 없습니다. collection_raw_data.html?runId=... 형식으로 열어주세요.');
      return;
    }
    const [runPayload, itemsPayload] = await Promise.all([
      fetch(`/api/collection-runs/${runId}`).then(readResponse),
      fetch(`/api/collection-runs/${runId}/items`).then(readResponse)
    ]);
    currentData = {
      collectionRun: runPayload.collectionRun,
      items: itemsPayload.collectionItems || []
    };
    if (!sections.some((section) => section.key === currentSection)) currentSection = 'blogItems';
    renderData();
  }

  async function copyRawData() {
    const pre = field('raw-json');
    const text = pre?.dataset.rawJson || pre?.textContent || '';
    if (!text) return;
    await navigator.clipboard.writeText(text);
    const button = field('raw-copy-button');
    if (!button) return;
    const previous = button.textContent;
    button.textContent = '복사됨';
    window.setTimeout(() => {
      button.textContent = previous || '복사';
    }, 1200);
  }

  field('raw-copy-button')?.addEventListener('click', () => {
    copyRawData().catch((error) => {
      console.warn(error);
    });
  });

  loadCollection().catch((error) => {
    showError(error instanceof Error ? error.message : 'RAW data를 불러오지 못했습니다.');
  });
})();
