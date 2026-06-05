(function () {
  const params = new URLSearchParams(window.location.search);
  const storeId = params.get('storeId') || window.localStorage.getItem('storeLearningStoreId') || 'store_demo_cake';

  window.localStorage.setItem('storeLearningStoreId', storeId);

  const blogList = document.getElementById('blog-post-list');
  const aiContentList = document.getElementById('ai-content-list');
  const blogPendingCount = document.getElementById('blog-pending-count');
  const aiContentPendingCount = document.getElementById('ai-content-pending-count');
  const generateButton = document.getElementById('blog-generate-btn');

  if (!blogList && !aiContentList && !generateButton) return;

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
    if (status === 'pending_approval') return 'b-orange';
    if (status === 'published' || status === 'publish_requested') return 'b-green';
    if (status === 'cancelled') return 'b-gray';
    return 'b-blue';
  }

  function scoreClass(score) {
    if (score == null) return 'b-gray';
    if (score >= 80) return 'b-green';
    if (score >= 70) return 'b-yellow';
    return 'b-gray';
  }

  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  }

  function formatShortDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  }

  function postDetailUrl(post) {
    return `09_AI콘텐츠생성_상세.html?postId=${post.id}`;
  }

  function emptyRow(colspan, message) {
    return `<tr><td class="td-empty" colspan="${colspan}" style="text-align:center;padding:24px">${escapeHtml(message)}</td></tr>`;
  }

  function renderBlogManagement(posts) {
    if (!blogList) return;
    if (!posts.length) {
      blogList.innerHTML = emptyRow(7, '승인 대기 블로그 초안이 없습니다.');
      return;
    }

    blogList.innerHTML = posts
      .map(
        (post) => `
          <tr onclick="location.href='${postDetailUrl(post)}'" style="cursor:pointer" data-blog-post-id="${escapeHtml(post.id)}">
            <td class="td-link" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${escapeHtml(post.title)}
              <span style="margin-left:4px" class="icon-external-link" data-icon="external-link" data-size="11" data-color="#9AA0B4"></span>
            </td>
            <td><span class="badge b-blue">AI 자동</span></td>
            <td><span class="badge ${statusClass(post.status)}">${statusLabel(post.status)}</span></td>
            <td class="td-empty">-</td>
            <td class="td-empty">-</td>
            <td><span class="badge ${scoreClass(post.seoScore)}" style="font-size:10px">${post.seoScore ?? '-'}점</span></td>
            <td>${formatShortDate(post.publishedAt || post.scheduledAt || post.createdAt)}</td>
          </tr>
        `
      )
      .join('');
  }

  function renderAiContentList(posts) {
    if (!aiContentList) return;
    if (!posts.length) {
      aiContentList.innerHTML = emptyRow(4, '생성된 AI 블로그 초안이 없습니다.');
      return;
    }

    aiContentList.innerHTML = posts
      .map(
        (post) => `
          <tr onclick="location.href='${postDetailUrl(post)}'" style="cursor:pointer" data-blog-post-id="${escapeHtml(post.id)}">
            <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" class="td-link">${escapeHtml(post.title)}</td>
            <td><span class="badge ${statusClass(post.status)}">${statusLabel(post.status)}</span></td>
            <td><span class="badge ${scoreClass(post.seoScore)}" style="font-size:10px">${post.seoScore ?? '-'}점</span></td>
            <td>${formatDate(post.createdAt)}</td>
          </tr>
        `
      )
      .join('');
  }

  function updateCounts(count) {
    if (blogPendingCount) blogPendingCount.textContent = `승인 대기 ${count}건`;
    if (aiContentPendingCount) aiContentPendingCount.textContent = `${count}건`;
  }

  async function loadPosts() {
    try {
      const response = await fetch(`/api/stores/${storeId}/blog-posts`);
      if (!response.ok) throw new Error(`블로그 목록을 불러오지 못했습니다. (${response.status})`);
      const payload = await response.json();
      const posts = Array.isArray(payload.posts) ? payload.posts : [];
      renderBlogManagement(posts);
      renderAiContentList(posts);
      updateCounts(payload.pendingApprovalCount ?? posts.filter((post) => post.status === 'pending_approval').length);
    } catch (error) {
      const message = error instanceof Error ? error.message : '블로그 목록을 불러오지 못했습니다.';
      if (blogList) blogList.innerHTML = emptyRow(7, message);
      if (aiContentList) aiContentList.innerHTML = emptyRow(4, message);
    }
  }

  if (generateButton) {
    generateButton.addEventListener('click', async () => {
      generateButton.disabled = true;
      const originalText = generateButton.textContent;
      generateButton.textContent = '생성 중';
      try {
        const response = await fetch(`/api/stores/${storeId}/blog-posts/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error(`블로그 초안을 생성하지 못했습니다. (${response.status})`);
        await loadPosts();
      } catch (error) {
        const message = error instanceof Error ? error.message : '블로그 초안을 생성하지 못했습니다.';
        if (aiContentList) aiContentList.innerHTML = emptyRow(4, message);
      } finally {
        generateButton.disabled = false;
        generateButton.textContent = originalText;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', loadPosts);
})();
