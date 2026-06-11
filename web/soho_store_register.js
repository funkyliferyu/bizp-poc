(function () {
  const STORAGE_KEY = 'bizplanet.storeRegistration.storeId';
  let currentStoreId = initialStoreId();
  let currentStore = null;
  let menuExpanded = false;
  let currentMenuImageUrls = [];
  let currentMenuImageIndex = 0;
  let currentWeeklyBusinessHours = [];
  let businessHoursAreDiffering = false;
  let ragPhaseTimer = null;
  const sourceImageSets = {};
  const DIFFERING_HOURS_LABEL = '요일별 상이';
  const WEEKDAY_OPTIONS = [
    { day: 'mon', label: '월' },
    { day: 'tue', label: '화' },
    { day: 'wed', label: '수' },
    { day: 'thu', label: '목' },
    { day: 'fri', label: '금' },
    { day: 'sat', label: '토' },
    { day: 'sun', label: '일' }
  ];

  function params() {
    return new URLSearchParams(window.location.search);
  }

  function initialStoreId() {
    const storeId = params().get('storeId') || window.localStorage.getItem(STORAGE_KEY);
    if (storeId) window.localStorage.setItem(STORAGE_KEY, storeId);
    return storeId;
  }

  function field(id) {
    return document.getElementById(id);
  }

  function readValue(id) {
    const element = field(id);
    return element && 'value' in element ? element.value.trim() : '';
  }

  function markAutofilled(id) {
    const element = field(id);
    if (element) element.classList.add('autofilled');
  }

  function markAutofillGroup(name, active) {
    const element = document.querySelector(`[data-autofill-group="${name}"]`);
    if (!element) return;
    element.classList.toggle('autofilled', Boolean(active));
  }

  function setButtonBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.innerHTML = `<span class="spinner" style="border-color:rgba(255,255,255,.35);border-top-color:#fff"></span>${label}`;
      return;
    }

    button.disabled = false;
    button.removeAttribute('aria-busy');
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }

  function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function asArray(value) {
    if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined && item !== '');
    if (value === null || value === undefined || value === '') return [];
    return [value];
  }

  function cleanText(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatNumber(value) {
    if (value === null || value === undefined || value === '') return '-';
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString('ko-KR') : String(value);
  }

  function formatPrice(value) {
    if (value === null || value === undefined || value === '') return '';
    const price = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(price) ? `${price.toLocaleString('ko-KR')}원` : String(value);
  }

  function isTimeText(value) {
    return /^\d{1,2}:\d{2}$/.test(cleanText(value));
  }

  function normalizeDayValue(value) {
    const day = cleanText(value);
    const dayMap = {
      mon: 'mon',
      tue: 'tue',
      wed: 'wed',
      thu: 'thu',
      fri: 'fri',
      sat: 'sat',
      sun: 'sun',
      월: 'mon',
      화: 'tue',
      수: 'wed',
      목: 'thu',
      금: 'fri',
      토: 'sat',
      일: 'sun'
    };
    return dayMap[day] || '';
  }

  function dayLabelFor(day) {
    return WEEKDAY_OPTIONS.find((item) => item.day === day)?.label || day;
  }

  function isClosedValue(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
  }

  function parseWeeklyBusinessHoursFromLines(lines) {
    const rows = new Map();
    asArray(lines).forEach((line) => {
      const text = cleanText(line);
      const match = text.match(/^([월화수목금토일])\s+(.+)$/);
      if (!match) return;

      const day = normalizeDayValue(match[1]);
      if (!day) return;

      const content = match[2];
      const businessRange = content.match(/(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/);
      const breakRange = content.match(/브레이크타임\s*(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/);
      const closed = /휴무|휴진|휴업/.test(content);
      rows.set(day, {
        day,
        dayLabel: match[1],
        closed,
        openTime: businessRange?.[1] || '',
        closeTime: businessRange?.[2] || '',
        breakStart: breakRange?.[1] || '',
        breakEnd: breakRange?.[2] || '',
        description: closed ? content : ''
      });
    });
    return rows;
  }

  function normalizeWeeklyBusinessHourRow(row, fallback) {
    const record = asRecord(row);
    const day = normalizeDayValue(record.day) || normalizeDayValue(record.dayLabel) || fallback.day;
    return {
      day,
      dayLabel: cleanText(record.dayLabel) || fallback.label,
      closed: isClosedValue(record.closed),
      openTime: cleanText(record.openTime),
      closeTime: cleanText(record.closeTime),
      breakStart: cleanText(record.breakStart),
      breakEnd: cleanText(record.breakEnd),
      description: cleanText(record.description)
    };
  }

  function normalizeWeeklyBusinessHours(parsedPlace) {
    const parsed = asRecord(parsedPlace);
    const explicitRows = new Map();
    asArray(parsed.weeklyBusinessHours)
      .map(asRecord)
      .forEach((row) => {
        const day = normalizeDayValue(row.day) || normalizeDayValue(row.dayLabel);
        if (!day) return;
        explicitRows.set(day, row);
      });

    const lineRows = parseWeeklyBusinessHoursFromLines(parsed.businessHours);
    const closedDays = new Set(asArray(parsed.closedDays).map(normalizeDayValue).filter(Boolean));
    const hasDetailedRows = explicitRows.size > 0 || lineRows.size > 0;
    const defaultOpen = cleanText(parsed.openTime) || readValue('f-open');
    const defaultClose = cleanText(parsed.closeTime) || readValue('f-close');
    const defaultBreakStart = cleanText(parsed.breakStart) || readValue('f-break1');
    const defaultBreakEnd = cleanText(parsed.breakEnd) || readValue('f-break2');

    return WEEKDAY_OPTIONS.map((option) => {
      const source = explicitRows.get(option.day) || lineRows.get(option.day) || {};
      const row = normalizeWeeklyBusinessHourRow(source, option);
      const closed = row.closed || closedDays.has(option.day);
      const useDefaultTimes = !hasDetailedRows && !closed;
      return {
        day: option.day,
        dayLabel: row.dayLabel || option.label,
        closed,
        openTime: row.openTime || (useDefaultTimes ? defaultOpen : ''),
        closeTime: row.closeTime || (useDefaultTimes ? defaultClose : ''),
        breakStart: row.breakStart || (useDefaultTimes ? defaultBreakStart : ''),
        breakEnd: row.breakEnd || (useDefaultTimes ? defaultBreakEnd : ''),
        description: row.description || (closed ? '휴무' : '')
      };
    });
  }

  function representativeWeeklyBusinessHour(rows) {
    return rows.find((row) => !row.closed && row.openTime && row.closeTime) || null;
  }

  function uniqueOpenDayValues(rows, keys) {
    const values = new Set();
    rows
      .filter((row) => !row.closed)
      .forEach((row) => {
        values.add(keys.map((key) => cleanText(row[key])).join('~'));
      });
    return values;
  }

  function hasDifferingWeeklyBusinessHours(rows) {
    const openRows = rows.filter((row) => !row.closed && row.openTime && row.closeTime);
    if (openRows.length <= 1) return false;
    return uniqueOpenDayValues(openRows, ['openTime', 'closeTime']).size > 1;
  }

  function hasDifferingWeeklyBreakHours(rows) {
    const openRows = rows.filter((row) => !row.closed);
    if (openRows.length <= 1) return false;
    return uniqueOpenDayValues(openRows, ['breakStart', 'breakEnd']).size > 1;
  }

  function writeDisplayInput(id, value) {
    writeInput(id, value);
    if (value === DIFFERING_HOURS_LABEL) markAutofilled(id);
  }

  function setBusinessHoursSyncMessage(visible) {
    const message = field('business-hours-sync-message');
    if (message) message.hidden = !visible;
  }

  function refreshBusinessHoursSyncState() {
    const hoursDiffer = hasDifferingWeeklyBusinessHours(currentWeeklyBusinessHours);
    const breaksDiffer = hasDifferingWeeklyBreakHours(currentWeeklyBusinessHours);
    businessHoursAreDiffering = hoursDiffer || breaksDiffer;
    setBusinessHoursSyncMessage(businessHoursAreDiffering);
  }

  function applyWeeklyBusinessHoursSummaryToMainFields(rows) {
    const representative = representativeWeeklyBusinessHour(rows);
    const hoursDiffer = hasDifferingWeeklyBusinessHours(rows);
    const breaksDiffer = hasDifferingWeeklyBreakHours(rows);

    if (hoursDiffer) {
      writeDisplayInput('f-open', DIFFERING_HOURS_LABEL);
      writeDisplayInput('f-close', DIFFERING_HOURS_LABEL);
    } else if (representative) {
      writeInput('f-open', representative.openTime);
      writeInput('f-close', representative.closeTime);
    }

    const breakRow = rows.find((row) => !row.closed && row.breakStart && row.breakEnd) || representative;
    if (breaksDiffer) {
      writeDisplayInput('f-break1', DIFFERING_HOURS_LABEL);
      writeDisplayInput('f-break2', DIFFERING_HOURS_LABEL);
    } else if (breakRow) {
      writeInput('f-break1', breakRow.breakStart || '');
      writeInput('f-break2', breakRow.breakEnd || '');
    }

    writeClosedDays(rows.filter((row) => row.closed).map((row) => row.day));
    currentWeeklyBusinessHours = rows;
    refreshBusinessHoursSyncState();
  }

  function hasMainFieldTimes() {
    return isTimeText(readValue('f-open')) && isTimeText(readValue('f-close'));
  }

  function syncWeeklyBusinessHoursFromMainFields() {
    const closedDays = new Set(checkedDays());
    const openTime = readValue('f-open');
    const closeTime = readValue('f-close');
    const breakStart = readValue('f-break1');
    const breakEnd = readValue('f-break2');
    const applyMainHours = isTimeText(openTime) && isTimeText(closeTime);
    const applyMainBreak = (isTimeText(breakStart) && isTimeText(breakEnd)) || (!breakStart && !breakEnd);
    const existingRows = currentWeeklyBusinessHours.length
      ? currentWeeklyBusinessHours
      : normalizeWeeklyBusinessHours({});
    const byDay = new Map(existingRows.map((row) => [row.day, row]));

    currentWeeklyBusinessHours = WEEKDAY_OPTIONS.map((option) => {
      const row = byDay.get(option.day) || {
        day: option.day,
        dayLabel: option.label,
        closed: false,
        openTime: '',
        closeTime: '',
        breakStart: '',
        breakEnd: '',
        description: ''
      };
      const closed = closedDays.has(option.day);
      return {
        ...row,
        day: option.day,
        dayLabel: row.dayLabel || option.label,
        closed,
        openTime: closed ? '' : applyMainHours ? openTime : row.openTime,
        closeTime: closed ? '' : applyMainHours ? closeTime : row.closeTime,
        breakStart: closed ? '' : applyMainBreak ? breakStart : row.breakStart,
        breakEnd: closed ? '' : applyMainBreak ? breakEnd : row.breakEnd,
        description: closed ? row.description || '휴무' : ''
      };
    });
    refreshBusinessHoursSyncState();
  }

  function storedMainTimeValue(id) {
    const value = readValue(id);
    return value === DIFFERING_HOURS_LABEL ? '' : value;
  }

  function writeWeeklyBusinessHours(parsedPlace) {
    currentWeeklyBusinessHours = normalizeWeeklyBusinessHours(parsedPlace);
    applyWeeklyBusinessHoursSummaryToMainFields(currentWeeklyBusinessHours);
  }

  function businessHourInput(row, key, placeholder) {
    const value = row.closed ? '' : cleanText(row[key]);
    return `<input type="text" data-key="${escapeHtml(key)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${row.closed ? 'disabled' : ''}>`;
  }

  function toggleBusinessHourClosed(checkbox) {
    const row = checkbox.closest('.business-hours-row');
    if (!row) return;
    row.querySelectorAll('input[type="text"]').forEach((input) => {
      input.disabled = checkbox.checked;
    });
  }

  function renderBusinessHoursModalRows() {
    const rows = currentWeeklyBusinessHours.length
      ? currentWeeklyBusinessHours
      : normalizeWeeklyBusinessHours(asRecord(currentStore?.metadata?.naverPlaceParsed || currentStore?.metadata));
    currentWeeklyBusinessHours = rows;
    setHtml(
      'business-hours-rows',
      rows
        .map(
          (row) => `<div class="business-hours-row" data-day="${escapeHtml(row.day)}" data-day-label="${escapeHtml(
            row.dayLabel || dayLabelFor(row.day)
          )}" data-description="${escapeHtml(row.description || '')}">
            <div class="business-hours-day">${escapeHtml(row.dayLabel || dayLabelFor(row.day))}</div>
            <label class="business-hours-closed"><input type="checkbox" ${row.closed ? 'checked' : ''} onchange="toggleBusinessHourClosed(this)">휴무</label>
            ${businessHourInput(row, 'openTime', '시작')}
            ${businessHourInput(row, 'closeTime', '종료')}
            ${businessHourInput(row, 'breakStart', '브레이크 시작')}
            ${businessHourInput(row, 'breakEnd', '브레이크 종료')}
          </div>`
        )
        .join('')
    );
  }

  function readBusinessHoursModalRows() {
    return Array.from(document.querySelectorAll('.business-hours-row')).map((row) => {
      const closed = Boolean(row.querySelector('input[type="checkbox"]')?.checked);
      const valueFor = (key) => cleanText(row.querySelector(`input[data-key="${key}"]`)?.value);
      return {
        day: row.dataset.day || '',
        dayLabel: row.dataset.dayLabel || dayLabelFor(row.dataset.day || ''),
        closed,
        openTime: closed ? '' : valueFor('openTime'),
        closeTime: closed ? '' : valueFor('closeTime'),
        breakStart: closed ? '' : valueFor('breakStart'),
        breakEnd: closed ? '' : valueFor('breakEnd'),
        description: closed ? row.dataset.description || '휴무' : ''
      };
    });
  }

  function openBusinessHoursModal() {
    renderBusinessHoursModalRows();
    const modal = field('business-hours-modal');
    if (modal) modal.style.display = 'flex';
  }

  function closeBusinessHoursModal() {
    const modal = field('business-hours-modal');
    if (modal) modal.style.display = 'none';
  }

  function saveBusinessHoursModal() {
    currentWeeklyBusinessHours = readBusinessHoursModalRows();
    applyWeeklyBusinessHoursSummaryToMainFields(currentWeeklyBusinessHours);
    closeBusinessHoursModal();
  }

  function unwrapPlaceImageUrl(value) {
    const urlText = cleanText(value);
    if (!urlText) return '';
    try {
      const url = new URL(urlText);
      if (url.hostname === 'search.pstatic.net' && url.pathname.includes('/common/')) {
        const source = url.searchParams.get('src');
        if (source && /^https?:\/\//i.test(source)) return source.replace(/#\d+x\d+$/i, '');
      }
    } catch {
      return urlText;
    }
    return urlText.replace(/#\d+x\d+$/i, '');
  }

  function isUsablePlaceImageUrl(value) {
    if (!value || !/^https?:\/\//i.test(value)) return false;
    const lower = value.toLowerCase();
    if (
      lower.includes('icon_default_profile') ||
      lower.includes('/assets/shared/images/') ||
      lower.includes('blog.naver.com') ||
      lower.includes('cafe.naver.com') ||
      lower.includes('tvcast') ||
      lower.includes('/place/panorama/') ||
      lower.includes('instagram.com') ||
      lower.includes('booking.naver.com')
    ) {
      return false;
    }
    return (
      lower.includes('ldb-phinf.pstatic.net') ||
      lower.includes('search.pstatic.net/common') ||
      /\.(?:jpe?g|png|webp)(?:[?#].*)?$/i.test(lower)
    );
  }

  function normalizePlaceImageUrls(values) {
    const seen = new Set();
    const urls = [];
    asArray(values).forEach((value) => {
      const normalized = unwrapPlaceImageUrl(value);
      if (!isUsablePlaceImageUrl(normalized) || seen.has(normalized)) return;
      seen.add(normalized);
      urls.push(normalized);
    });
    return urls;
  }

  function setHidden(id, hidden) {
    const element = field(id);
    if (element) element.hidden = hidden;
  }

  function setHtml(id, html) {
    const element = field(id);
    if (element) element.innerHTML = html;
  }

  function renderEmpty(id, text) {
    setHtml(id, `<span class="metadata-value">${escapeHtml(text)}</span>`);
  }

  const EXTERNAL_CHANNEL_LABELS = {
    blog: '블로그',
    instagram: '인스타그램',
    daangn: '당근',
    youtube: '유튜브',
    tiktok: '틱톡'
  };

  function channelLinkLabel(record, fallbackType) {
    const channel = cleanText(record.channel).toLowerCase();
    return (
      cleanText(record.type) ||
      cleanText(record.label) ||
      cleanText(record.name) ||
      cleanText(record.title) ||
      cleanText(record.channelName) ||
      EXTERNAL_CHANNEL_LABELS[channel] ||
      fallbackType ||
      '외부 링크'
    );
  }

  function normalizeLinks(parsedPlace) {
    const links = [];
    const addLink = (item, fallbackType) => {
      if (!item) return;
      if (typeof item === 'string') {
        links.push({ type: fallbackType || '외부 링크', url: item });
        return;
      }
      if (typeof item === 'object') {
        const record = asRecord(item);
        const url = cleanText(record.url || record.landingUrl || record.href || record.link || record.sourceUrl);
        if (url) links.push({ type: channelLinkLabel(record, fallbackType), url });
      }
    };

    [
      [parsedPlace.homepageLinks, parsedPlace.homepageType || '홈페이지'],
      [parsedPlace.homepages, parsedPlace.homepageType || '홈페이지'],
      [parsedPlace.externalLinks, '외부 링크'],
      [parsedPlace.externalChannelLinks, '외부채널'],
      [asRecord(parsedPlace.naverPlaceParsed).externalChannelLinks, '외부채널']
    ].forEach(([values, fallbackType]) => {
      asArray(values).forEach((item) => addLink(item, fallbackType));
    });
    asArray(parsedPlace.homepageUrl).forEach((url) => addLink(url, parsedPlace.homepageType || '홈페이지'));
    asArray(parsedPlace.homepage).forEach((url) => addLink(url, parsedPlace.homepageType || '홈페이지'));

    const seen = new Set();
    return links.filter((link) => {
      const key = link.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function renderChips(id, values, emptyText) {
    const items = asArray(values).map(cleanText).filter(Boolean);
    if (!items.length) {
      renderEmpty(id, emptyText);
      return false;
    }
    setHtml(
      id,
      items.map((item) => `<span class="metadata-chip">${escapeHtml(item)}</span>`).join('')
    );
    return true;
  }

  function renderLinks(parsedPlace) {
    const links = normalizeLinks(parsedPlace);
    if (!links.length) {
      renderEmpty('place-links-list', '등록된 외부채널 링크가 없습니다.');
      return false;
    }
    setHtml(
      'place-links-list',
      links
        .map(
          (link) =>
            `<div><strong>${escapeHtml(link.type)}</strong> <a class="metadata-link" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.url)}</a></div>`
        )
        .join('')
    );
    return true;
  }

  function renderBooking(parsedPlace) {
    const bookingUrl = cleanText(parsedPlace.bookingUrl);
    if (!bookingUrl) {
      renderEmpty('place-booking', '등록된 예약 링크가 없습니다.');
      return false;
    }
    setHtml(
      'place-booking',
      `<a class="metadata-link" href="${escapeHtml(bookingUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(bookingUrl)}</a>`
    );
    return true;
  }

  function renderReviewStats(parsedPlace) {
    const stats = asRecord(parsedPlace.reviewStats);
    const hasStats = ['rating', 'visitorReviewCount', 'blogReviewCount', 'visitorTextReviewCount'].some(
      (key) => stats[key] !== null && stats[key] !== undefined && stats[key] !== ''
    );
    if (!hasStats) {
      renderEmpty('place-review-stats', '리뷰 지표가 없습니다.');
      return false;
    }
    const items = [
      ['평점', stats.rating],
      ['방문자 리뷰', stats.visitorReviewCount],
      ['블로그 리뷰', stats.blogReviewCount],
      ['텍스트 리뷰', stats.visitorTextReviewCount]
    ];
    setHtml(
      'place-review-stats',
      items
        .map(
          ([label, value]) =>
            `<div class="stat-card"><div class="stat-label">${escapeHtml(label)}</div><div class="stat-value">${formatNumber(value)}</div></div>`
        )
        .join('')
    );
    return true;
  }

  function renderBroadcastInfos(parsedPlace) {
    const broadcasts = asArray(parsedPlace.broadcastInfos).map(asRecord);
    if (!broadcasts.length) {
      renderEmpty('place-broadcasts', '방송 정보가 없습니다.');
      return false;
    }
    setHtml(
      'place-broadcasts',
      broadcasts
        .map((item) => {
          const title = [item.channel, item.program].map(cleanText).filter(Boolean).join(' · ') || '방송 정보';
          const meta = [item.date, item.menu].map(cleanText).filter(Boolean).join(' · ');
          return `<div class="broadcast-item"><div class="broadcast-title">${escapeHtml(title)}</div><div class="broadcast-meta">${escapeHtml(meta || '-')}</div></div>`;
        })
        .join('')
    );
    return true;
  }

  function renderNameCountTable(items, emptyText) {
    const rows = asArray(items)
      .map(asRecord)
      .map((item) => {
        const name = cleanText(item.name);
        if (!name) return null;
        const count = item.count === null || item.count === undefined || item.count === '' ? '-' : formatNumber(item.count);
        return `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(count)}</td></tr>`;
      })
      .filter(Boolean);
    if (!rows.length) return `<div class="metadata-empty">${escapeHtml(emptyText)}</div>`;
    return `<table class="hospital-table"><thead><tr><th>항목</th><th>수</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
  }

  function renderHospitalInfo(parsedPlace) {
    const hospitalInfo = asRecord(parsedPlace.hospitalInfo);
    const panel = field('place-hospital-panel');
    if (!hospitalInfo) {
      if (panel) panel.hidden = true;
      return false;
    }

    const subjects = asArray(hospitalInfo.subjects).map(cleanText).filter(Boolean);
    const specialistSubjects = asArray(hospitalInfo.specialistSubjects);
    const specialEquipments = asArray(hospitalInfo.specialEquipments);
    const specialOperations = asArray(hospitalInfo.specialOperations);
    const specialSubjects = asArray(hospitalInfo.specialSubjects);
    const hasAny =
      subjects.length ||
      specialistSubjects.length ||
      specialEquipments.length ||
      specialOperations.length ||
      specialSubjects.length;
    if (!hasAny) {
      if (panel) panel.hidden = true;
      return false;
    }

    const sourceName = cleanText(hospitalInfo.sourceName) || '건강보험심사평가원';
    const sourceUrl = cleanText(hospitalInfo.sourceUrl);
    const sourceHtml = sourceUrl
      ? `<a class="metadata-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceName)} 병원정보 더보기</a>`
      : escapeHtml(sourceName);

    setHtml(
      'place-hospital-info',
      [
        subjects.length
          ? `<div><div class="hospital-info-title">진료과목</div><div class="chip-list">${subjects
              .map((item) => `<span class="metadata-chip">${escapeHtml(item)}</span>`)
              .join('')}</div></div>`
          : '',
        `<div><div class="hospital-info-title">진료과목별 전문의 정보</div>${renderNameCountTable(
          specialistSubjects,
          '전문의 정보가 없습니다.'
        )}</div>`,
        `<div><div class="hospital-info-title">특수진료장비</div>${renderNameCountTable(
          specialEquipments,
          '특수진료장비 정보가 없습니다.'
        )}</div>`,
        specialOperations.length
          ? `<div><div class="hospital-info-title">특수진료</div>${renderNameCountTable(
              specialOperations,
              '특수진료 정보가 없습니다.'
            )}</div>`
          : '',
        specialSubjects.length
          ? `<div><div class="hospital-info-title">특수진료과목</div>${renderNameCountTable(
              specialSubjects,
              '특수진료과목 정보가 없습니다.'
            )}</div>`
          : '',
        `<div class="hospital-source">출처: ${sourceHtml}</div>`
      ].join('')
    );
    if (panel) panel.hidden = false;
    return true;
  }

  function renderPlaceMetadata(metadata) {
    const parsedPlace = asRecord(metadata.naverPlaceParsed || metadata);
    const hasAny = [
      renderLinks(parsedPlace),
      renderBooking(parsedPlace),
      renderChips('place-facilities', parsedPlace.facilities, '편의시설 정보가 없습니다.'),
      renderReviewStats(parsedPlace),
      renderBroadcastInfos(parsedPlace),
      renderChips('place-keywords', parsedPlace.keywords, '키워드가 없습니다.'),
      renderHospitalInfo(parsedPlace)
    ].some(Boolean);

    setHidden('place-metadata-section', !hasAny);
    setHidden('place-metadata-empty', hasAny);
  }

  function renderMenuSection(parsedPlace) {
    const menuItems = asArray(parsedPlace.menuItems).map(asRecord);
    const menuImageUrls = normalizePlaceImageUrls(parsedPlace.menuImageUrls);
    const hasMenu = menuItems.length > 0 || menuImageUrls.length > 0;

    setHidden('place-menu-section', !hasMenu);
    if (!hasMenu) return;

    const count = field('place-menu-count');
    if (count) count.textContent = `${menuItems.length.toLocaleString('ko-KR')}개`;

    currentMenuImageUrls = menuImageUrls.slice(0, 4);
    sourceImageSets.menuSection = currentMenuImageUrls;
    const imagePanel = field('place-menu-images-panel');
    if (imagePanel) imagePanel.hidden = currentMenuImageUrls.length === 0;
    setHtml(
      'place-menu-images',
      currentMenuImageUrls
        .map(
          (url, index) =>
            `<button type="button" class="menu-image" data-menu-image-index="${index}" onclick="openMenuImageViewer(${index})" aria-label="업체제공 메뉴 사진 ${index + 1} 크게 보기"><img src="${escapeHtml(url)}" alt="업체제공 메뉴 사진 ${index + 1}"></button>`
        )
        .join('')
    );

    const visibleItems = menuItems.slice(0, menuExpanded ? menuItems.length : 5);
    setHtml(
      'place-menu-list',
      visibleItems
        .map((item) => {
          const name = cleanText(item.name) || '메뉴명 없음';
          const price = formatPrice(item.price);
          const description = cleanText(item.description);
          return `<div class="menu-item"><div class="menu-title">${escapeHtml(name)}</div><div class="menu-meta">${escapeHtml([price, description].filter(Boolean).join(' · ') || '-')}</div></div>`;
        })
        .join('') || '<div class="metadata-empty">표시할 메뉴 항목이 없습니다.</div>'
    );

    const toggle = field('place-menu-toggle');
    if (toggle) {
      toggle.hidden = menuItems.length <= 5;
      toggle.textContent = menuExpanded ? '접기' : '메뉴 전체보기';
    }
  }

  function renderSourceImagePanel(panelId, containerId, urls, setKey, label) {
    const imageUrls = normalizePlaceImageUrls(urls).slice(0, 4);
    sourceImageSets[setKey] = imageUrls;
    setHidden(panelId, imageUrls.length === 0);
    setHtml(
      containerId,
      imageUrls
        .map(
          (url, index) =>
            `<button type="button" class="upload-source-image" onclick="openSourceImageViewer('${escapeHtml(setKey)}', ${index})" aria-label="${escapeHtml(label)} ${index + 1} 크게 보기"><img src="${escapeHtml(url)}" alt="${escapeHtml(label)} ${index + 1}"></button>`
        )
        .join('')
    );
  }

  function renderUploadSourceAssets(parsedPlace) {
    renderSourceImagePanel(
      'place-photo-source-panel',
      'place-photo-source-images',
      parsedPlace.placeImageUrls,
      'placePhotos',
      '네이버 플레이스 매장 사진'
    );
    renderSourceImagePanel(
      'place-menu-source-panel',
      'place-menu-source-images',
      parsedPlace.menuImageUrls,
      'placeMenuImages',
      '네이버 플레이스 메뉴판 이미지'
    );
  }

  function renderMenuImageViewer() {
    const url = currentMenuImageUrls[currentMenuImageIndex];
    const image = field('menu-image-viewer-img');
    if (!url || !image) return;

    image.src = url;
    image.alt = `업체제공 메뉴 사진 ${currentMenuImageIndex + 1}`;

    const counter = field('menu-image-viewer-counter');
    if (counter) counter.textContent = `${currentMenuImageIndex + 1} / ${currentMenuImageUrls.length}`;

    const original = field('menu-image-viewer-original');
    if (original) original.href = url;

    const hasMultipleImages = currentMenuImageUrls.length > 1;
    const previous = field('menu-image-viewer-prev');
    const next = field('menu-image-viewer-next');
    if (previous) previous.disabled = !hasMultipleImages;
    if (next) next.disabled = !hasMultipleImages;
  }

  function openMenuImageViewer(index) {
    if (!currentMenuImageUrls.length) return;
    currentMenuImageIndex = Math.max(0, Math.min(Number(index) || 0, currentMenuImageUrls.length - 1));
    renderMenuImageViewer();
    const viewer = field('menu-image-viewer');
    if (viewer) viewer.style.display = 'flex';
  }

  function closeMenuImageViewer() {
    const viewer = field('menu-image-viewer');
    if (viewer) viewer.style.display = 'none';
  }

  function stepMenuImageViewer(delta) {
    if (!currentMenuImageUrls.length) return;
    currentMenuImageIndex = (currentMenuImageIndex + delta + currentMenuImageUrls.length) % currentMenuImageUrls.length;
    renderMenuImageViewer();
  }

  function openSourceImageViewer(setKey, index) {
    const urls = sourceImageSets[setKey] || [];
    if (!urls.length) return;
    currentMenuImageUrls = urls;
    openMenuImageViewer(index);
  }

  function openRawData() {
    if (!currentStoreId) {
      alert('먼저 네이버 플레이스 정보를 불러오거나 저장된 매장을 조회해주세요.');
      return;
    }
    const url = `store_raw_data.html?storeId=${encodeURIComponent(currentStoreId)}&section=naverPlaceParsed`;
    window.open(url, '_blank', 'noopener');
  }

  function setRagStatus(text) {
    const status = field('rag-doc-status');
    if (status) status.textContent = text;
  }

  function setRagLink(id, file) {
    const link = field(id);
    if (!link) return;
    const downloadPath = cleanText(file?.downloadPath);
    if (!downloadPath) {
      link.hidden = true;
      link.removeAttribute('href');
      link.removeAttribute('download');
      return;
    }

    link.href = downloadPath;
    link.download = cleanText(file.fileName) || '';
    link.hidden = false;
    if (file.fileName) link.textContent = file.fileName;
  }

  function clearRagDocuments(message) {
    setRagStatus(message || '업체에 최적화된 응답을 제공하기 위해 RAG 용 문서를 생성해주세요.');
    setRagLink('rag-info-download', null);
    setRagLink('rag-reviews-download', null);
    setRagLink('rag-doc-source-info', null);
    setRagLink('rag-doc-source-reviews', null);
    setHidden('rag-doc-source-empty', false);
  }

  function setRagDownloads(manifest) {
    if (!manifest) {
      clearRagDocuments();
      return;
    }

    const generatedAt = cleanText(manifest.generatedAt);
    const reviewCount = Number(manifest.reviewCount || 0).toLocaleString('ko-KR');
    const generatedLabel = generatedAt ? new Date(generatedAt).toLocaleString('ko-KR') : '생성 완료';
    const warnings = asArray(manifest.warnings).map(cleanText).filter(Boolean);
    const warningText = warnings.length ? ` · ${warnings.join(' ')}` : '';
    setRagStatus(`챗봇용 RAG 문서 생성 완료 · 리뷰 ${reviewCount}개 포함 · ${generatedLabel}${warningText}`);
    setRagLink('rag-info-download', manifest.files?.info);
    setRagLink('rag-reviews-download', manifest.files?.reviews);
    setRagLink('rag-doc-source-info', manifest.files?.info);
    setRagLink('rag-doc-source-reviews', manifest.files?.reviews);
    setHidden('rag-doc-source-empty', true);
  }

  async function loadRagDocuments() {
    if (!currentStoreId) {
      clearRagDocuments('매장을 불러오면 RAG 문서를 생성할 수 있습니다.');
      return;
    }

    try {
      const response = await fetch(`/api/stores/${currentStoreId}/rag-documents`);
      if (response.status === 404) {
        clearRagDocuments();
        return;
      }
      const payload = await readResponse(response);
      setRagDownloads(payload.manifest);
    } catch (error) {
      console.warn(error);
      clearRagDocuments('RAG 문서 상태를 확인하지 못했습니다.');
    }
  }

  async function generateRagDocuments() {
    if (!currentStoreId) {
      alert('먼저 네이버 플레이스 정보를 불러오거나 저장된 매장을 조회해주세요.');
      return;
    }

    setButtonBusy(field('rag-generate-button'), true, '생성 중');
    if (ragPhaseTimer) window.clearTimeout(ragPhaseTimer);
    setRagStatus('네이버플레이스 리뷰를 가져오는 중입니다. 최대 100개 기준으로 더보기 범위를 확장합니다.');
    ragPhaseTimer = window.setTimeout(() => {
      setRagStatus('RAG 문서를 생성하는 중입니다. 수집된 리뷰와 매장 정보를 DOCX로 정리하고 있습니다.');
    }, 2500);
    try {
      const response = await fetch(`/api/stores/${currentStoreId}/rag-documents/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshReviews: true,
          reviewLimit: 100
        })
      });
      const payload = await readResponse(response);
      setRagDownloads(payload.manifest);
    } catch (error) {
      clearRagDocuments('RAG 문서를 생성하지 못했습니다.');
      alert(error instanceof Error ? error.message : 'RAG 문서를 생성하지 못했습니다.');
    } finally {
      if (ragPhaseTimer) {
        window.clearTimeout(ragPhaseTimer);
        ragPhaseTimer = null;
      }
      setButtonBusy(field('rag-generate-button'), false);
    }
  }

  function trainingSettingsUrl() {
    const storeId = currentStoreId;
    const next = new URL('03_AI학습_온보딩.html', window.location.href);
    if (storeId) next.searchParams.set('storeId', storeId);
    return `${next.pathname}${next.search}`;
  }

  function showStoreSaveModal() {
    const modal = field('store-save-modal');
    const button = field('go-training-settings-btn');
    if (button) button.dataset.targetUrl = trainingSettingsUrl();
    if (modal) modal.style.display = 'flex';
  }

  function closeStoreSaveModal() {
    const modal = field('store-save-modal');
    if (modal) modal.style.display = 'none';
  }

  function goToTrainingSettings() {
    window.location.href = trainingSettingsUrl();
  }

  function toggleMenuList() {
    menuExpanded = !menuExpanded;
    const metadata = asRecord(currentStore?.metadata);
    renderMenuSection(asRecord(metadata.naverPlaceParsed || metadata));
  }

  async function readResponse(response) {
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(body.error || '요청을 처리하지 못했습니다.');
    }
    return body;
  }

  async function ensureCategoryOptions() {
    if (typeof window.ensureIndustryOptionsLoaded === 'function') {
      await window.ensureIndustryOptionsLoaded();
    }
  }

  function writeInput(id, value) {
    const element = field(id);
    if (!element || !('value' in element)) return;
    element.value = value || '';
    if (value) markAutofilled(id);
  }

  function writeCategory(category) {
    const select = field('f-type');
    if (!select || !('options' in select) || !category) return;

    Array.from(select.options).forEach((item) => {
      if (item.dataset.importedCategory === 'true') item.remove();
    });

    select.value = category;
    if (select.value === category) {
      markAutofilled('f-type');
      return;
    }

    const categoryName = category.split('>').at(-1).trim();
    const option = Array.from(select.options).find((item) => {
      return item.value === category || item.textContent.trim() === categoryName;
    });
    if (option) {
      select.value = option.value;
      markAutofilled('f-type');
      return;
    }

    const importedOption = document.createElement('option');
    importedOption.value = category;
    importedOption.textContent = `불러온 업종: ${categoryName}`;
    importedOption.setAttribute('data-imported-category', 'true');
    select.appendChild(importedOption);
    select.value = category;
    markAutofilled('f-type');
  }

  function checkedDays() {
    return Array.from(document.querySelectorAll('.day-check input[type="checkbox"]:checked')).map((item) => item.value);
  }

  function writeClosedDays(days) {
    const selected = new Set(Array.isArray(days) ? days : []);
    document.querySelectorAll('.day-check input[type="checkbox"]').forEach((item) => {
      item.checked = selected.has(item.value);
    });
    markAutofillGroup('closed-days', selected.size > 0);
  }

  function selectedParking() {
    const checked = document.querySelector('input[name="parking"]:checked');
    return checked ? checked.value : null;
  }

  function writeParking(parking) {
    document.querySelectorAll('input[name="parking"]').forEach((item) => {
      item.checked = item.value === parking;
    });
    markAutofillGroup('parking', Boolean(parking));
  }

  async function populateStore(store) {
    const metadata = store.metadata || {};
    const parsedPlace = metadata.naverPlaceParsed || metadata;
    currentStore = store;
    currentStoreId = store.id;
    window.localStorage.setItem(STORAGE_KEY, store.id);

    await ensureCategoryOptions();
    writeInput('place-url', store.naverPlaceUrl);
    writeCategory(store.category);
    writeInput('f-name', store.name);
    writeInput('f-biz', metadata.businessNumber);
    writeInput('f-tel', store.phone);
    writeInput('f-addr1', store.address);
    writeInput('f-addr2', metadata.addressDetail);
    writeInput('f-email', metadata.email);
    writeInput('f-open', parsedPlace.openTime || metadata.openTime);
    writeInput('f-close', parsedPlace.closeTime || metadata.closeTime);
    writeInput('f-break1', parsedPlace.breakStart || metadata.breakStart);
    writeInput('f-break2', parsedPlace.breakEnd || metadata.breakEnd);
    writeInput('f-parking-note', parsedPlace.parkingNote || metadata.parkingNote);
    writeInput('f-desc', store.description);
    writeClosedDays(parsedPlace.closedDays || metadata.closedDays);
    writeWeeklyBusinessHours(parsedPlace);
    writeParking(parsedPlace.parking || metadata.parking);
    menuExpanded = false;
    const rawButton = field('raw-data-button');
    if (rawButton) rawButton.disabled = !currentStoreId;
    const ragButton = field('rag-generate-button');
    if (ragButton) ragButton.disabled = !currentStoreId;
    renderPlaceMetadata(metadata);
    renderMenuSection(parsedPlace);
    renderUploadSourceAssets(parsedPlace);
    await loadRagDocuments();
  }

  function validateRequiredFields() {
    const required = ['f-type', 'f-name', 'f-tel', 'f-addr1', 'f-open', 'f-close'];
    let valid = true;
    required.forEach((id) => {
      const element = field(id);
      if (!element || !('value' in element) || !element.value.trim()) {
        if (element) element.style.borderColor = '#C92A2A';
        valid = false;
      } else {
        element.style.borderColor = '';
      }
    });
    return valid;
  }

  function collectStorePayload() {
    syncWeeklyBusinessHoursFromMainFields();
    return {
      name: readValue('f-name'),
      naverPlaceUrl: readValue('place-url') || null,
      category: readValue('f-type') || null,
      address: readValue('f-addr1') || null,
      phone: readValue('f-tel') || null,
      description: readValue('f-desc') || null,
      metadata: {
        businessNumber: readValue('f-biz'),
        addressDetail: readValue('f-addr2'),
        email: readValue('f-email'),
        openTime: storedMainTimeValue('f-open'),
        closeTime: storedMainTimeValue('f-close'),
        breakStart: storedMainTimeValue('f-break1'),
        breakEnd: storedMainTimeValue('f-break2'),
        closedDays: checkedDays(),
        weeklyBusinessHours: currentWeeklyBusinessHours,
        parking: selectedParking(),
        parkingNote: readValue('f-parking-note')
      }
    };
  }

  async function fetchPlaceFromApi() {
    const naverPlaceUrl = readValue('place-url');
    if (!naverPlaceUrl) {
      alert('네이버 플레이스 URL을 입력해주세요.');
      return;
    }

    setButtonBusy(field('place-fetch-btn'), true, '불러오는 중');
    try {
      const response = await fetch('/api/stores/import-place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ naverPlaceUrl })
      });
      const payload = await readResponse(response);
      await populateStore(payload.store);
    } catch (error) {
      alert(error instanceof Error ? error.message : '플레이스 정보를 불러오지 못했습니다.');
    } finally {
      setButtonBusy(field('place-fetch-btn'), false);
    }
  }

  async function saveStoreToApi() {
    if (!validateRequiredFields()) {
      alert('필수 항목을 모두 입력해주세요.');
      return;
    }

    const payload = collectStorePayload();
    const storeId = currentStoreId;

    setButtonBusy(field('store-submit-btn'), true, '저장 중');
    try {
      const response = storeId
        ? await fetch(`/api/stores/${storeId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
        : await fetch('/api/stores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
      });
      const saved = await readResponse(response);
      await populateStore(saved.store);
      showStoreSaveModal();
    } catch (error) {
      alert(error instanceof Error ? error.message : '매장 정보를 저장하지 못했습니다.');
    } finally {
      setButtonBusy(field('store-submit-btn'), false);
    }
  }

  async function loadSavedStore() {
    const storeId = initialStoreId();
    if (!storeId) return;

    try {
      const response = await fetch(`/api/stores/${storeId}`);
      if (response.status === 404) return;
      const payload = await readResponse(response);
      await populateStore(payload.store);
      if (params().get('focus') === 'parking') focusStoreRegistrationSection('parking');
    } catch (error) {
      console.warn(error);
    }
  }

  function focusStoreRegistrationSection(section) {
    if (section !== 'parking') return;
    const target = document.querySelector('[data-autofill-group="parking"]') || field('f-parking-note');
    if (target) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const parkingNote = field('f-parking-note');
    if (parkingNote) parkingNote.focus({ preventScroll: true });
  }

  function bindBusinessHoursSyncEvents() {
    ['f-open', 'f-close', 'f-break1', 'f-break2'].forEach((id) => {
      const element = field(id);
      if (element) element.addEventListener('change', syncWeeklyBusinessHoursFromMainFields);
    });
    document.querySelectorAll('.day-check input[type="checkbox"]').forEach((item) => {
      item.addEventListener('change', syncWeeklyBusinessHoursFromMainFields);
    });
  }

  function initializeStoreRegistrationPage() {
    bindBusinessHoursSyncEvents();
    loadSavedStore();
  }

  window.fetchPlace = fetchPlaceFromApi;
  window.submitForm = saveStoreToApi;
  window.openRawData = openRawData;
  window.generateRagDocuments = generateRagDocuments;
  window.toggleMenuList = toggleMenuList;
  window.openMenuImageViewer = openMenuImageViewer;
  window.openSourceImageViewer = openSourceImageViewer;
  window.closeMenuImageViewer = closeMenuImageViewer;
  window.stepMenuImageViewer = stepMenuImageViewer;
  window.openBusinessHoursModal = openBusinessHoursModal;
  window.closeBusinessHoursModal = closeBusinessHoursModal;
  window.saveBusinessHoursModal = saveBusinessHoursModal;
  window.toggleBusinessHourClosed = toggleBusinessHourClosed;
  window.showStoreSaveModal = showStoreSaveModal;
  window.closeStoreSaveModal = closeStoreSaveModal;
  window.goToTrainingSettings = goToTrainingSettings;
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenuImageViewer();
      closeBusinessHoursModal();
    }
  });
  document.addEventListener('DOMContentLoaded', initializeStoreRegistrationPage);
})();
