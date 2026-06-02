function icon(name, size=14, color='currentColor'){
  const s = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0"`;
  const paths = {
    'layout-dashboard': '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    'brain': '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>',
    'sliders': '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    'sparkles': '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>',
    'loader': '<line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>',
    'check-square': '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    'file-check': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/>',
    'globe': '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    'rss': '<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>',
    'map-pin': '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    'instagram': '<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>',
    'shopping-bag': '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    'tag': '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
    'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    'lightbulb': '<line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>',
    'info': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    'trash-2': '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    'external-link': '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    'chevron-left': '<polyline points="15 18 9 12 15 6"/>',
    'chevron-right': '<polyline points="9 18 15 12 9 6"/>',
    'chevron-down': '<polyline points="6 9 12 15 18 9"/>',
    'check': '<polyline points="20 6 9 17 4 12"/>',
    'alert-circle': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    'alert-triangle': '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    'refresh-cw': '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    'arrow-left': '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    'image': '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    'star': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    'camera': '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    'megaphone': '<path d="M3 11l19-9-9 19-2-8-8-2z"/>',
    'utensils': '<line x1="3" y1="2" x2="3" y2="22"/><path d="M21 2v7.5L9 14M21 2a5 5 0 0 0-5 5v1.5"/>',
    'x': '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    'plus': '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    'search': '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    'settings': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  };
  return `<svg ${s}>${paths[name]||'<circle cx="12" cy="12" r="10"/>'}</svg>`;
}

function escapeSvgAttr(value){
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// data-icon 속성 가진 span을 SVG로 자동 교체
document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('[data-icon]').forEach(el=>{
    const name = el.getAttribute('data-icon');
    const size = el.getAttribute('data-size') || '14';
    const color = el.getAttribute('data-color') || 'currentColor';
    const existingStyle = el.getAttribute('style') || '';
    const preservedAttrs = ['id', 'class', 'aria-hidden', 'role']
      .map((attr) => [attr, el.getAttribute(attr)])
      .filter(([, value]) => value)
      .map(([attr, value]) => `${attr}="${escapeSvgAttr(value)}"`);
    preservedAttrs.push(`data-icon="${escapeSvgAttr(name)}"`);
    el.outerHTML = `<svg ${preservedAttrs.join(' ')} width="${escapeSvgAttr(size)}" height="${escapeSvgAttr(size)}" viewBox="0 0 24 24" fill="none" stroke="${escapeSvgAttr(color)}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;${escapeSvgAttr(existingStyle)}">${getPath(name)}</svg>`;
  });
  enhanceBreadcrumbNavigation();
});

const breadcrumbRouteMap = {
  'agency_dashboard.html': [
    ['대행사', 'agency_dashboard.html'],
    ['대시보드', 'agency_dashboard.html']
  ],
  'agency_member_biz.html': [
    ['대행사', 'agency_dashboard.html'],
    ['업체관리', 'agency_member_biz.html']
  ],
  'agency_list.html': [
    ['대행사', 'agency_dashboard.html'],
    ['매장관리', 'agency_list.html']
  ],
  'agency_member_staff.html': [
    ['대행사', 'agency_dashboard.html'],
    ['대행사 직원관리', 'agency_member_staff.html']
  ],
  'soho_member.html': [
    ['대행사', 'agency_dashboard.html'],
    ['대행사 직원관리', 'soho_member.html']
  ],
  'soho_dashboard.html': [
    ['매장 관리', 'soho_dashboard.html'],
    ['대시보드', 'soho_dashboard.html']
  ],
  'soho_store_register.html': [
    ['매장 관리', 'soho_dashboard.html'],
    ['매장 정보 등록', 'soho_store_register.html']
  ],
  '01_대시보드.html': [
    ['마케팅 채널관리', '01_대시보드_온보딩전.html'],
    ['대시보드', '01_대시보드.html']
  ],
  '01_대시보드_온보딩전.html': [
    ['마케팅 채널관리', '01_대시보드_온보딩전.html'],
    ['대시보드 (학습 전)', '01_대시보드_온보딩전.html']
  ],
  '02_블로그관리.html': [
    ['마케팅 채널관리', '01_대시보드_온보딩전.html'],
    ['블로그 관리', '02_블로그관리.html']
  ],
  '03_AI학습_온보딩.html': [
    ['마케팅 채널관리', '01_대시보드_온보딩전.html'],
    ['AI 학습', '06_AI학습_현황.html'],
    ['학습 설정', '03_AI학습_온보딩.html']
  ],
  '04_AI학습_수집중.html': [
    ['마케팅 채널관리', '01_대시보드_온보딩전.html'],
    ['AI 학습', '06_AI학습_현황.html'],
    ['수집 실행', '04_AI학습_수집중.html']
  ],
  '05_AI학습_콘텐츠선택.html': [
    ['마케팅 채널관리', '01_대시보드_온보딩전.html'],
    ['AI 학습', '06_AI학습_현황.html'],
    ['분석 콘텐츠 선택', '05_AI학습_콘텐츠선택.html']
  ],
  '06_AI학습_현황.html': [
    ['마케팅 채널관리', '01_대시보드_온보딩전.html'],
    ['AI 학습', '06_AI학습_현황.html'],
    ['학습 현황', '06_AI학습_현황.html']
  ],
  '06_AI학습_현황_수집실패.html': [
    ['마케팅 채널관리', '01_대시보드_온보딩전.html'],
    ['AI 학습', '06_AI학습_현황.html'],
    ['학습 현황 (수집 실패)', '06_AI학습_현황_수집실패.html']
  ],
  '06_AI학습_현황_분석실패.html': [
    ['마케팅 채널관리', '01_대시보드_온보딩전.html'],
    ['AI 학습', '06_AI학습_현황.html'],
    ['학습 현황 (분석 실패)', '06_AI학습_현황_분석실패.html']
  ],
  '06_AI학습_현황_재학습중.html': [
    ['마케팅 채널관리', '01_대시보드_온보딩전.html'],
    ['AI 학습', '06_AI학습_현황.html'],
    ['학습 현황 (재학습 중)', '06_AI학습_현황_재학습중.html']
  ],
  '07_마케팅전략룰셋.html': [
    ['마케팅 채널관리', '01_대시보드_온보딩전.html'],
    ['마케팅 전략 룰셋', '07_마케팅전략룰셋.html']
  ],
  '08_AI콘텐츠생성_목록.html': [
    ['마케팅 채널관리', '01_대시보드_온보딩전.html'],
    ['AI 콘텐츠 자동 생성', '08_AI콘텐츠생성_목록.html']
  ],
  '09_AI콘텐츠생성_상세.html': [
    ['마케팅 채널관리', '01_대시보드_온보딩전.html'],
    ['AI 콘텐츠 자동 생성', '08_AI콘텐츠생성_목록.html'],
    ['콘텐츠 상세', '09_AI콘텐츠생성_상세.html']
  ],
  '10_블로그_발행대기_상세.html': [
    ['마케팅 채널관리', '01_대시보드_온보딩전.html'],
    ['블로그 관리', '02_블로그관리.html'],
    ['발행 대기', '10_블로그_발행대기_상세.html']
  ],
  '11_블로그_발행완료_상세.html': [
    ['마케팅 채널관리', '01_대시보드_온보딩전.html'],
    ['블로그 관리', '02_블로그관리.html'],
    ['발행 완료', '11_블로그_발행완료_상세.html']
  ],
  'event_operation_poc.html': [
    ['마케팅 운영', 'event_operation_poc.html'],
    ['Event-to-Operation PoC', 'event_operation_poc.html']
  ]
};

function currentHtmlFile(){
  const file = window.location.pathname.split('/').pop() || '';
  try {
    return decodeURIComponent(file);
  } catch {
    return file;
  }
}

function injectBreadcrumbStyle(){
  if (document.getElementById('breadcrumb-nav-style')) return;
  const style = document.createElement('style');
  style.id = 'breadcrumb-nav-style';
  style.textContent = `
    .breadcrumb-link{
      color:#6B7280;
      text-decoration:none;
      border-radius:4px;
      padding:2px 3px;
      margin:-2px -3px;
      cursor:pointer;
    }
    .breadcrumb-link:hover{
      color:#3B5BDB;
      background:#EEF2FF;
    }
    .breadcrumb-current{
      color:#1A1A2E;
      font-weight:600;
    }
    .breadcrumb-sep{
      color:#CBD5E1;
      margin:0 4px;
    }
  `;
  document.head.appendChild(style);
}

function inferBreadcrumbSegments(container, file){
  const labels = container.textContent
    .split(/[›>]/)
    .map((label) => label.trim())
    .filter(Boolean);

  if (labels.length <= 1) return null;
  return labels.map((label, index) => [label, index === labels.length - 1 ? file : null]);
}

function enhanceBreadcrumbNavigation(){
  const file = currentHtmlFile();
  const containers = document.querySelectorAll('.topbar-breadcrumb, .topbar-left');
  if (!containers.length) return;

  injectBreadcrumbStyle();
  containers.forEach((container) => {
    if (container.dataset.breadcrumbEnhanced === 'true') return;
    const segments = breadcrumbRouteMap[file] || inferBreadcrumbSegments(container, file);
    if (!segments || !segments.length) return;

    container.dataset.breadcrumbEnhanced = 'true';
    container.textContent = '';

    segments.forEach(([label, href], index) => {
      if (index > 0) {
        const separator = document.createElement('span');
        separator.className = 'breadcrumb-sep';
        separator.textContent = '›';
        container.appendChild(separator);
      }

      const isCurrent = index === segments.length - 1;
      if (href && !isCurrent) {
        const link = document.createElement('a');
        link.className = 'breadcrumb-link';
        link.href = href;
        link.textContent = label;
        link.setAttribute('data-flow-target', href);
        link.setAttribute('data-flow-label', `상단 이동: ${label}`);
        container.appendChild(link);
        return;
      }

      const current = document.createElement('span');
      current.className = 'breadcrumb-current';
      current.textContent = label;
      container.appendChild(current);
    });
  });
}

function getPath(name){
  const paths = {
    'layout-dashboard': '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    'brain': '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>',
    'sliders': '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    'sparkles': '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>',
    'loader': '<line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>',
    'check-square': '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    'file-check': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/>',
    'globe': '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    'rss': '<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>',
    'map-pin': '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    'instagram': '<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>',
    'shopping-bag': '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    'tag': '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
    'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    'lightbulb': '<line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>',
    'info': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    'trash-2': '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    'external-link': '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    'chevron-left': '<polyline points="15 18 9 12 15 6"/>',
    'chevron-right': '<polyline points="9 18 15 12 9 6"/>',
    'chevron-down': '<polyline points="6 9 12 15 18 9"/>',
    'check': '<polyline points="20 6 9 17 4 12"/>',
    'alert-circle': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    'alert-triangle': '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    'refresh-cw': '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    'arrow-left': '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    'image': '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    'star': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    'camera': '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    'megaphone': '<path d="M3 11l19-9-9 19-2-8-8-2z"/>',
    'utensils': '<line x1="3" y1="2" x2="3" y2="22"/><path d="M21 2v7.5L9 14M21 2a5 5 0 0 0-5 5v1.5"/>',
    'x': '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    'plus': '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    'search': '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    'settings': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  };
  return paths[name] || '<circle cx="12" cy="12" r="10"/>';
}
