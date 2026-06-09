(function () {
  const DEFAULT_SECTION_QUERY = 'section=naverPlaceParsed';
  const params = new URLSearchParams(window.location.search);
  const storeId = params.get('storeId') || '';
  let currentSection = params.get('section') || 'naverPlaceParsed';
  let currentData = null;

  const sections = [
    { key: 'naverPlaceParsed', label: 'Parsed data', path: ['metadata', 'naverPlaceParsed'] },
    { key: 'naverPlaceSnapshot', label: 'Snapshot', path: ['metadata', 'naverPlaceSnapshot'] },
    { key: 'metadata', label: 'Full metadata', path: ['metadata'] }
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

  function getPath(source, path) {
    return path.reduce((value, key) => {
      if (!value || typeof value !== 'object') return null;
      return value[key] ?? null;
    }, source);
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
    const keys = Object.keys(value);
    const rows = [
      ['유형', Array.isArray(value) ? 'array' : 'object'],
      ['키 개수', keys.length.toLocaleString('ko-KR')],
      ['크기', `${jsonSize(value).toLocaleString('ko-KR')} bytes`]
    ];
    if ('htmlHash' in value) rows.push(['HTML hash', value.htmlHash || '-']);
    if ('sourceSize' in value) rows.push(['Source size', JSON.stringify(value.sourceSize)]);
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
        currentSection = button.getAttribute('data-section') || 'naverPlaceParsed';
        const nextUrl = `store_raw_data.html?storeId=${encodeURIComponent(storeId)}&section=${encodeURIComponent(currentSection)}`;
        window.history.replaceState({}, '', nextUrl);
        renderData();
      });
    });
  }

  function renderData() {
    if (!currentData) return;
    const section = sections.find((item) => item.key === currentSection) || sections[0];
    const value = getPath(currentData.store, section.path) ?? {};
    const json = JSON.stringify(value, null, 2);

    const label = field('raw-store-label');
    if (label) label.textContent = `${currentData.store.name || currentData.store.id} · ${section.label}`;

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

  async function loadStore() {
    if (!storeId) {
      showError('storeId가 없습니다. store_raw_data.html?storeId=... 형식으로 열어주세요.');
      return;
    }
    const response = await fetch(`/api/stores/${storeId}`);
    if (!response.ok) {
      showError(`Store를 찾을 수 없습니다: ${storeId}`);
      return;
    }
    currentData = await response.json();
    if (!sections.some((section) => section.key === currentSection)) currentSection = 'naverPlaceParsed';
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

  loadStore().catch((error) => {
    showError(error instanceof Error ? error.message : 'RAW data를 불러오지 못했습니다.');
  });
})();
