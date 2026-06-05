(function () {
  const STORAGE_KEY = 'bizplanet.storeRegistration.storeId';
  let currentStoreId = window.localStorage.getItem(STORAGE_KEY);

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
    }
  }

  function checkedDays() {
    return Array.from(document.querySelectorAll('.day-check input[type="checkbox"]:checked')).map((item) => item.value);
  }

  function writeClosedDays(days) {
    const selected = new Set(Array.isArray(days) ? days : []);
    document.querySelectorAll('.day-check input[type="checkbox"]').forEach((item) => {
      item.checked = selected.has(item.value);
    });
  }

  function selectedParking() {
    const checked = document.querySelector('input[name="parking"]:checked');
    return checked ? checked.value : null;
  }

  function writeParking(parking) {
    document.querySelectorAll('input[name="parking"]').forEach((item) => {
      item.checked = item.value === parking;
    });
  }

  async function populateStore(store) {
    const metadata = store.metadata || {};
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
    writeInput('f-open', metadata.openTime);
    writeInput('f-close', metadata.closeTime);
    writeInput('f-break1', metadata.breakStart);
    writeInput('f-break2', metadata.breakEnd);
    writeInput('f-parking-note', metadata.parkingNote);
    writeInput('f-desc', store.description);
    writeClosedDays(metadata.closedDays);
    writeParking(metadata.parking);
  }

  function validateRequiredFields() {
    const required = ['f-type', 'f-name', 'f-biz', 'f-tel', 'f-addr1', 'f-open', 'f-close'];
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
        openTime: readValue('f-open'),
        closeTime: readValue('f-close'),
        breakStart: readValue('f-break1'),
        breakEnd: readValue('f-break2'),
        closedDays: checkedDays(),
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
    }
  }

  async function saveStoreToApi() {
    if (!validateRequiredFields()) {
      alert('필수 항목을 모두 입력해주세요.');
      return;
    }

    const payload = collectStorePayload();
    const storeId = currentStoreId;
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

    try {
      const saved = await readResponse(response);
      await populateStore(saved.store);
      alert('매장이 등록됐어요! AI 학습을 시작할 수 있어요.');
    } catch (error) {
      alert(error instanceof Error ? error.message : '매장 정보를 저장하지 못했습니다.');
    }
  }

  async function loadSavedStore() {
    const storeId = window.localStorage.getItem(STORAGE_KEY);
    if (!storeId) return;

    try {
      const response = await fetch(`/api/stores/${storeId}`);
      if (response.status === 404) return;
      const payload = await readResponse(response);
      await populateStore(payload.store);
    } catch (error) {
      console.warn(error);
    }
  }

  window.fetchPlace = fetchPlaceFromApi;
  window.submitForm = saveStoreToApi;
  document.addEventListener('DOMContentLoaded', loadSavedStore);
})();
