(function () {
  const STORAGE_KEY = 'bizplanetFlowGuide';
  const ON = 'on';
  const OFF = 'off';
  let fallbackState = ON;

  const flowCss = `
    [data-flow-guide="on"] [data-flow-target] {
      outline: 2px solid #3B5BDB !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 4px rgba(59, 91, 219, .12) !important;
      position: relative !important;
    }
    [data-flow-guide="on"] [data-flow-target]::after {
      content: attr(data-flow-label);
      position: absolute;
      left: 8px;
      top: -20px;
      z-index: 9999;
      max-width: 220px;
      padding: 2px 7px;
      border-radius: 999px;
      background: #3B5BDB;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      line-height: 1.4;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(15, 20, 32, .18);
    }
    [data-flow-guide="on"] tr[data-flow-target] {
      outline-offset: -2px !important;
      box-shadow: inset 0 0 0 2px #3B5BDB !important;
    }
    [data-flow-guide="off"] [data-flow-target] {
      outline: none !important;
      box-shadow: none !important;
    }
    .flow-guide-toggle {
      position: fixed;
      top: 9px;
      right: 14px;
      z-index: 5000;
      height: 32px;
      padding: 0 12px;
      border: 1px solid #BAC8FF;
      border-radius: 999px;
      background: #fff;
      color: #3B5BDB;
      font-family: 'Noto Sans KR', sans-serif;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(15, 20, 32, .12);
    }
    .flow-guide-toggle[data-state="off"] {
      border-color: #E2E8F0;
      color: #4A5568;
      background: #F7F8FA;
    }
  `;

  function getState() {
    try {
      return window.localStorage?.getItem(STORAGE_KEY) === OFF ? OFF : ON;
    } catch {
      return fallbackState;
    }
  }

  function setState(state) {
    fallbackState = state;
    try {
      window.localStorage?.setItem(STORAGE_KEY, state);
    } catch {
      // Some embedded preview contexts disable localStorage; keep the toggle usable in memory.
    }
    applyToAllDocuments();
  }

  function injectStyle(doc) {
    if (!doc || doc.getElementById('flow-guide-style')) return;
    const style = doc.createElement('style');
    style.id = 'flow-guide-style';
    style.textContent = flowCss;
    doc.head.appendChild(style);
  }

  function applyState(doc) {
    if (!doc?.documentElement) return;
    injectStyle(doc);
    doc.documentElement.setAttribute('data-flow-guide', getState());
  }

  function frameDocument(name) {
    const frame = document.querySelector(`iframe[name="${name}"]`);
    try {
      return frame?.contentDocument ?? null;
    } catch {
      return null;
    }
  }

  function applyToAllDocuments() {
    applyState(document);
    applyState(frameDocument('nav'));
    applyState(frameDocument('main'));
    syncNavActive();
    updateToggle();
  }

  function currentMainFile() {
    const mainFrame = document.querySelector('iframe[name="main"]');
    try {
      return decodeURIComponent(mainFrame?.contentWindow?.location.pathname.split('/').pop() ?? '');
    } catch {
      return '';
    }
  }

  function setRefOpen(navDoc, open) {
    const links = navDoc?.getElementById('ref-links');
    const arrow = navDoc?.getElementById('ref-arrow');
    if (!links) return;
    links.style.display = open ? 'block' : 'none';
    if (arrow) {
      arrow.setAttribute('data-icon', open ? 'chevron-down' : 'chevron-right');
      if (open) {
        arrow.innerHTML = '<polyline points="6 9 12 15 18 9"/>';
      } else {
        arrow.innerHTML = '<polyline points="9 18 15 12 9 6"/>';
      }
    }
  }

  function syncNavActive() {
    const navDoc = frameDocument('nav');
    const current = currentMainFile();
    if (!navDoc || !current) return;

    const links = [...navDoc.querySelectorAll('a.sb-item[href]')];
    links.forEach((link) => link.classList.remove('active'));

    const active = links.find((link) => link.getAttribute('href') === current);
    if (!active) return;

    active.classList.add('active');
    setRefOpen(navDoc, Boolean(active.closest('#ref-links')));
  }

  function updateToggle() {
    const button = document.getElementById('flowGuideToggle');
    if (!button) return;
    const state = getState();
    button.dataset.state = state;
    button.textContent = `플로우 표시 ${state === ON ? 'ON' : 'OFF'}`;
  }

  function createToggle() {
    if (document.getElementById('flowGuideToggle')) return;
    const button = document.createElement('button');
    button.id = 'flowGuideToggle';
    button.className = 'flow-guide-toggle';
    button.type = 'button';
    button.addEventListener('click', () => {
      setState(getState() === ON ? OFF : ON);
    });
    document.body.appendChild(button);
  }

  window.addEventListener('DOMContentLoaded', () => {
    createToggle();
    applyToAllDocuments();
    document.querySelectorAll('iframe').forEach((frame) => {
      frame.addEventListener('load', () => {
        window.setTimeout(applyToAllDocuments, 50);
      });
    });
  });
})();
