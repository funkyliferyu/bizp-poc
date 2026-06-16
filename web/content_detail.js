(function () {
  const params = new URLSearchParams(window.location.search);
  const postId = params.get('postId') || 'blog_post_demo_pending_approval';

  const titleEl = document.getElementById('content-detail-title');
  const metaEl = document.getElementById('content-detail-meta');
  const statusEl = document.getElementById('content-detail-status');
  const provenanceEl = document.getElementById('content-provenance-line');
  const bodyEl = document.getElementById('draftContentBody');
  const imageListEl = document.getElementById('content-image-list');
  const seoTotalEl = document.getElementById('seo-total-score');
  const seoFillEl = document.getElementById('seo-score-fill');
  const seoSummaryEl = document.getElementById('seo-score-summary');
  const seoBadgeEl = document.getElementById('seo-score-badge');
  const seoItemsEl = document.getElementById('seoScoreItems');
  const previewModal = document.getElementById('modal-blog-preview');
  const previewTitleEl = document.getElementById('blogPreviewTitle');
  const previewMetaEl = document.getElementById('blogPreviewMeta');
  const previewBodyEl = document.getElementById('blogPreviewBody');
  const previewImagesEl = document.getElementById('blogPreviewImages');
  const regenerateTextBtn = document.getElementById('regenerate-text-btn');
  const regenerateImagesBtn = document.getElementById('regenerate-images-btn');
  const seoRescoreBtn = document.getElementById('seo-rescore-btn');
  const requestPublishBtn = document.getElementById('request-publish-btn');
  const scheduleRequestPublishBtn = document.getElementById('schedule-request-publish-btn');
  let latestContentProvenance = null;

  if (!titleEl || !bodyEl) return;

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function statusLabel(status) {
    if (status === 'pending_approval') return '승인 대기';
    if (status === 'publish_requested') return '발행 요청';
    if (status === 'published') return '발행완료';
    if (status === 'cancelled') return '취소';
    return status || '대기';
  }

  function statusClass(status) {
    if (status === 'pending_approval') return 'badge b-orange';
    if (status === 'publish_requested' || status === 'published') return 'badge b-green';
    if (status === 'cancelled') return 'badge b-gray';
    return 'badge b-blue';
  }

  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  }

  function scoreColor(score) {
    if (score >= 80) return '#2F9E44';
    if (score >= 70) return '#F59F00';
    return '#E8590C';
  }

  function setLoading(message) {
    bodyEl.innerHTML = `<p>${escapeHtml(message)}</p>`;
  }

  function setError(message) {
    bodyEl.innerHTML = `<p style="color:#E03131">${escapeHtml(message)}</p>`;
  }

  function setButtonBusy(button, busy, label) {
    if (!button) return;
    if (!button.dataset.originalText) button.dataset.originalText = button.textContent || '';
    button.disabled = busy;
    button.textContent = busy ? label : button.dataset.originalText;
  }

  function imagePromptForDisplay(media, fallback) {
    const prompt = media?.prompt || media?.alt || fallback;
    const trimMarker = '표현하는 이미지 설명';
    const markerIndex = String(prompt || '').indexOf(trimMarker);
    if (markerIndex === -1) return prompt;
    return String(prompt).slice(0, markerIndex + trimMarker.length).trim();
  }

  function renderBody(article, mediaAssets) {
    const sections = Array.isArray(article?.bodySections) ? article.bodySections : [];
    if (!sections.length) {
      bodyEl.innerHTML = `<p>${escapeHtml(article?.bodyText || '본문이 없습니다.')}</p>`;
      return;
    }

    bodyEl.innerHTML = sections
      .map((section, index) => {
        const media = mediaAssets[index];
        const imageSlot = media
          ? `<div class="content-image-slot" data-image-slot="${index + 1}">[이미지${index + 1} 배치] <span>${escapeHtml(imagePromptForDisplay(media, '이미지 프롬프트'))}</span></div>`
          : '';
        return `<p><strong>${escapeHtml(section.heading)}</strong><br>${escapeHtml(section.body)}</p>${imageSlot}`;
      })
      .join('');
  }

  function renderImages(mediaAssets) {
    if (!imageListEl) return;
    if (!mediaAssets.length) {
      imageListEl.innerHTML = '<div class="td-empty" style="grid-column:1/-1;text-align:center;padding:18px">이미지 프롬프트가 없습니다.</div>';
      return;
    }

    imageListEl.innerHTML = mediaAssets
      .map(
        (media, index) => `
          <div class="img-card ${index === 0 ? 'selected' : ''}" onclick="selectImg(this)" data-media-asset-id="${escapeHtml(media.id)}">
            <div class="img-thumb"><span class="icon-image" data-icon="image" data-size="24" data-color="#9AA0B4"></span></div>
            <div class="img-label">
              이미지 ${index + 1}
              ${index === 0 ? '<div class="sel-dot"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg></div>' : ''}
            </div>
            <div style="font-size:11px;color:#6B7280;line-height:1.5;padding:8px;border-top:1px solid #EDF2F7">${escapeHtml(imagePromptForDisplay(media, 'placeholder'))}</div>
          </div>
        `
      )
      .join('');
  }

  function renderPreviewImage(media, index) {
    if (!media) return '';
    return `
      <div class="blog-preview-image" data-preview-image-slot="${index + 1}">
        <div class="blog-preview-image-label">이미지 ${index + 1}</div>
        <div class="blog-preview-image-copy">${escapeHtml(imagePromptForDisplay(media, '이미지 프롬프트'))}</div>
      </div>
    `;
  }

  function renderPreviewBody(preview, mediaAssets) {
    const sections = Array.isArray(preview?.bodySections) ? preview.bodySections : [];
    if (!sections.length) return preview?.html || '';
    const bodyHtml = sections
      .map((section, index) => {
        const paragraphs = String(section.body || '')
          .split(/\n{2,}/u)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean);
        const paragraphHtml = paragraphs.length
          ? paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')
          : '<p>본문이 없습니다.</p>';
        return `
          <section class="blog-preview-section">
            <h2>${escapeHtml(section.heading || `본문 ${index + 1}`)}</h2>
            ${paragraphHtml}
          </section>
          ${renderPreviewImage(mediaAssets[index], index)}
        `;
      })
      .join('');
    const cta = preview?.cta ? `<div class="blog-preview-cta">${escapeHtml(preview.cta)}</div>` : '';
    return `${bodyHtml}${cta}`;
  }

  function renderSeo(seoScore) {
    const total = seoScore?.totalScore ?? seoScore?.score ?? 0;
    if (seoTotalEl) {
      seoTotalEl.textContent = String(total);
      seoTotalEl.style.color = scoreColor(total);
    }
    if (seoFillEl) {
      seoFillEl.style.width = `${Math.max(0, Math.min(100, total))}%`;
      seoFillEl.style.background = scoreColor(total);
    }
    if (seoSummaryEl) seoSummaryEl.textContent = total >= 80 ? '발행 준비도 양호' : '키워드와 이미지 프롬프트 보강 권장';
    if (seoBadgeEl) seoBadgeEl.textContent = `총점 ${total}점`;
    if (!seoItemsEl) return;

    const rubric = seoScore?.rubric || {};
    seoItemsEl.innerHTML = Object.keys(rubric)
      .map((key) => {
        const item = rubric[key];
        return `
          <div class="seo-score-item" data-seo-key="${escapeHtml(key)}">
            <div class="seo-score-top"><span class="seo-score-name">${escapeHtml(item.label || key)}</span><span class="seo-score-val">${item.score}/${item.maxScore}</span></div>
            <div class="seo-score-copy">${escapeHtml(item.feedback || '')}</div>
          </div>
        `;
      })
      .join('');
  }

  function provenanceText(label, provenance) {
    if (!provenance) return '';
    const actionLabels = {
      generate_blog_post: '초안 생성',
      regenerate_text: '본문 재생성',
      seo_rescore: 'SEO 재평가',
      initial_score: '초기 점수',
      regenerate_images_rescore: '이미지 재생성 후 점수'
    };
    const inputBudget = provenance.inputBudget || {};
    const promptCharacterCount = Number(inputBudget.promptCharacterCount);
    const promptCharacterBudget = Number(inputBudget.promptCharacterBudget);
    const budgetText =
      Number.isFinite(promptCharacterCount) && Number.isFinite(promptCharacterBudget)
        ? `입력 ${promptCharacterCount.toLocaleString('ko-KR')}/${promptCharacterBudget.toLocaleString('ko-KR')}자`
        : '';
    const parts = [
      provenance.provider || provenance.mode,
      provenance.model,
      actionLabels[provenance.action] || provenance.action,
      budgetText
    ].filter(Boolean);
    if (parts.length === 0) return '';
    return `<strong>${escapeHtml(label)}</strong> ${escapeHtml(parts.join(' · '))}`;
  }

  function renderContentProvenance(contentProvenance, seoProvenance) {
    if (!provenanceEl) return;
    const lines = [
      provenanceText('본문 생성', contentProvenance),
      provenanceText('SEO 평가', seoProvenance)
    ].filter(Boolean);
    provenanceEl.innerHTML = lines.join(' · ');
    provenanceEl.style.display = lines.length ? 'block' : 'none';
  }

  function renderStatus(status) {
    if (!statusEl) return;
    statusEl.textContent = statusLabel(status);
    statusEl.className = statusClass(status);
    if (requestPublishBtn) {
      requestPublishBtn.disabled = status === 'publish_requested';
      requestPublishBtn.textContent = status === 'publish_requested' ? '발행 요청 완료' : '바로 발행 요청';
    }
    if (scheduleRequestPublishBtn) scheduleRequestPublishBtn.disabled = status === 'publish_requested';
  }

  function renderDetail(payload) {
    const post = payload.blogPost;
    const article = payload.article || post.article || {};
    const mediaAssets = Array.isArray(payload.mediaAssets) ? payload.mediaAssets : [];

    titleEl.textContent = post.title;
    if (metaEl) metaEl.textContent = `${formatDate(post.createdAt)} 생성 · 블로그`;
    renderStatus(post.status);
    renderBody(article, mediaAssets);
    renderImages(mediaAssets);
    renderSeo(payload.seoScore);
    latestContentProvenance = payload.contentProvenance || null;
    renderContentProvenance(payload.contentProvenance, payload.seoScore?.provenance);
  }

  async function loadDetail() {
    try {
      setLoading('콘텐츠 상세를 불러오는 중입니다.');
      const response = await fetch(`/api/blog-posts/${postId}`);
      if (!response.ok) throw new Error(`콘텐츠 상세를 불러오지 못했습니다. (${response.status})`);
      renderDetail(await response.json());
    } catch (error) {
      setError(error instanceof Error ? error.message : '콘텐츠 상세를 불러오지 못했습니다.');
    }
  }

  async function handleActionResponse(response) {
    if (!response.ok) throw new Error(`요청을 처리하지 못했습니다. (${response.status})`);
    const payload = await response.json();
    renderDetail(payload.blogPost && payload.article ? payload : await (await fetch(`/api/blog-posts/${postId}`)).json());
    return payload;
  }

  async function postAction(path, button, loadingText) {
    setButtonBusy(button, true, loadingText);
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return await handleActionResponse(response);
    } catch (error) {
      setError(error instanceof Error ? error.message : '요청을 처리하지 못했습니다.');
      return null;
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function regenerateText() {
    setButtonBusy(regenerateTextBtn, true, '글 재생성 중');
    try {
      const response = await fetch(`/api/blog-posts/${postId}/regenerate-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      renderDetail(await handleActionResponse(response));
    } catch (error) {
      setError(error instanceof Error ? error.message : '글을 재생성하지 못했습니다.');
    } finally {
      setButtonBusy(regenerateTextBtn, false);
    }
  }

  async function regenerateImages() {
    setButtonBusy(regenerateImagesBtn, true, '이미지 재생성 중');
    try {
      const response = await fetch(`/api/blog-posts/${postId}/regenerate-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      renderDetail(await handleActionResponse(response));
    } catch (error) {
      setError(error instanceof Error ? error.message : '이미지 프롬프트를 재생성하지 못했습니다.');
    } finally {
      setButtonBusy(regenerateImagesBtn, false);
    }
  }

  async function rescoreSeo() {
    setButtonBusy(seoRescoreBtn, true, 'SEO 재평가 중');
    try {
      const response = await fetch(`/api/blog-posts/${postId}/seo-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error(`SEO 점수를 계산하지 못했습니다. (${response.status})`);
      const payload = await response.json();
      renderSeo(payload.seoScore);
      renderContentProvenance(latestContentProvenance, payload.seoScore?.provenance);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'SEO 점수를 계산하지 못했습니다.');
    } finally {
      setButtonBusy(seoRescoreBtn, false);
    }
  }

  async function openPreview() {
    try {
      const response = await fetch(`/api/blog-posts/${postId}/preview`);
      if (!response.ok) throw new Error(`미리보기를 불러오지 못했습니다. (${response.status})`);
      const payload = await response.json();
      const preview = payload.preview || {};
      const mediaAssets = Array.isArray(preview.mediaAssets) ? preview.mediaAssets : [];
      if (previewTitleEl) previewTitleEl.textContent = preview.title || titleEl.textContent || '';
      if (previewMetaEl) {
        previewMetaEl.textContent = '';
        previewMetaEl.style.display = 'none';
      }
      if (previewBodyEl) previewBodyEl.innerHTML = renderPreviewBody(preview, mediaAssets);
      if (previewImagesEl) {
        previewImagesEl.innerHTML = `
          <div class="blog-preview-side-card">
            <div class="blog-preview-side-title">SEO 요약</div>
            <div style="font-size:12px;color:#4A5568;line-height:1.6">총점 ${payload.seoScore?.totalScore ?? '-'}점 · 발행 전 검토용 미리보기</div>
          </div>
        `;
      }
      if (previewModal) previewModal.style.display = 'flex';
    } catch (error) {
      setError(error instanceof Error ? error.message : '미리보기를 불러오지 못했습니다.');
    }
  }

  function closePreview() {
    if (previewModal) previewModal.style.display = 'none';
  }

  async function requestPublish(button) {
    let completed = false;
    setButtonBusy(button, true, '발행 요청 중');
    try {
      const response = await fetch(`/api/blog-posts/${postId}/request-publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      renderDetail(await handleActionResponse(response));
      completed = true;
      const scheduleModal = document.getElementById('modal-schedule');
      if (scheduleModal) scheduleModal.style.display = 'none';
    } catch (error) {
      setError(error instanceof Error ? error.message : '발행 요청 상태로 변경하지 못했습니다.');
    } finally {
      if (!completed) setButtonBusy(button, false);
    }
  }

  if (regenerateTextBtn) regenerateTextBtn.addEventListener('click', regenerateText);
  if (regenerateImagesBtn) regenerateImagesBtn.addEventListener('click', regenerateImages);
  if (seoRescoreBtn) seoRescoreBtn.addEventListener('click', rescoreSeo);
  if (requestPublishBtn) requestPublishBtn.addEventListener('click', () => requestPublish(requestPublishBtn));
  if (scheduleRequestPublishBtn) {
    scheduleRequestPublishBtn.addEventListener('click', () => requestPublish(scheduleRequestPublishBtn));
  }

  window.openBlogPreview = openPreview;
  window.closeBlogPreview = closePreview;

  document.addEventListener('DOMContentLoaded', loadDetail);
})();
