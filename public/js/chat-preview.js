/**
 * Chat attachment previews — screenshots inline in JARVIS messages.
 */
(() => {
  function authQuery(getToken) {
    const token = getToken?.() || window.tonyResolveToken?.() || '';
    return token ? `?token=${encodeURIComponent(token)}` : '';
  }

  function attachmentUrl(att, getToken) {
    const base = att.url || `/api/screenshots/${encodeURIComponent(att.name)}`;
    const q = authQuery(getToken);
    return base.includes('?') ? `${base}&token=${encodeURIComponent(getToken?.() || '')}` : `${base}${q}`;
  }

  function extractFromToolResults(toolResults = []) {
    const out = [];
    const seen = new Set();
    for (const tr of toolResults) {
      const r = tr?.result;
      if (!r?.ok || r.action !== 'screenshot' || !r.path) continue;
      const name = r.path.split('/').pop().split('\\').pop();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push({
        type: 'screenshot',
        name,
        path: r.path,
        width: r.width,
        height: r.height,
        url: `/api/screenshots/${encodeURIComponent(name)}`,
      });
    }
    return out;
  }

  function resolveAttachments(result) {
    if (result?.attachments?.length) return result.attachments;
    return extractFromToolResults(result?.toolResults);
  }

  function ensureLightbox() {
    let lb = document.getElementById('tonyLightbox');
    if (lb) return lb;

    lb = document.createElement('div');
    lb.id = 'tonyLightbox';
    lb.className = 'tony-lightbox';
    lb.innerHTML = '<button type="button" class="tony-lightbox-close" aria-label="Close">×</button><img alt="Screenshot preview" />';
    lb.addEventListener('click', (e) => {
      if (e.target === lb || e.target.classList.contains('tony-lightbox-close')) {
        lb.classList.remove('open');
      }
    });
    document.body.appendChild(lb);
    return lb;
  }

  function openLightbox(src) {
    const lb = ensureLightbox();
    lb.querySelector('img').src = src;
    lb.classList.add('open');
  }

  function renderAttachments(container, attachments, getToken) {
    if (!attachments?.length || !container) return;

    const wrap = document.createElement('div');
    wrap.className = 'msg-attachments';

    for (const att of attachments) {
      if (att.type !== 'screenshot') continue;

      const fig = document.createElement('figure');
      fig.className = 'msg-screenshot';

      const img = document.createElement('img');
      img.src = attachmentUrl(att, getToken);
      img.alt = 'Desktop screenshot';
      img.loading = 'lazy';
      img.addEventListener('click', () => openLightbox(img.src));
      img.addEventListener('error', () => {
        fig.classList.add('msg-screenshot-error');
        img.replaceWith(Object.assign(document.createElement('span'), {
          className: 'msg-screenshot-fallback',
          textContent: `Screenshot saved: ${att.path || att.name}`,
        }));
      });

      const cap = document.createElement('figcaption');
      cap.textContent =
        att.width && att.height
          ? `Screenshot · ${att.width}×${att.height} · click to expand`
          : 'Screenshot · click to expand';

      fig.appendChild(img);
      fig.appendChild(cap);
      wrap.appendChild(fig);
    }

    if (wrap.children.length) container.appendChild(wrap);
  }

  window.tonyResolveAttachments = resolveAttachments;
  window.tonyRenderAttachments = renderAttachments;
  window.tonyOpenLightbox = openLightbox;
})();
