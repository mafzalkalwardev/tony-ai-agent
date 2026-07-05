(() => {
  const TOKEN_KEY = 'tony_api_token';
  const SESSION_KEY = 'tony_session_id';
  let token = localStorage.getItem(TOKEN_KEY) || new URLSearchParams(location.search).get('token') || '';
  let sessionId = localStorage.getItem(SESSION_KEY) || crypto.randomUUID();
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  function api(path, opts = {}) {
    return fetch(path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(opts.headers || {}),
      },
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      return data;
    });
  }

  window.tonyApi = api;
  window.tonySessionId = () => sessionId;
  window.tonyLangPrefix = () => '';
  window.tonyAddMessage = addMessage;

  function addMessage(role, content, tools) {
    const el = document.createElement('div');
    el.className = `msg ${role}`;
    el.innerHTML = role === 'assistant' ? simpleMd(content) : content;
    if (tools?.length) {
      const t = document.createElement('div');
      t.className = 'msg-tools';
      t.textContent = `[${tools.join(', ')}]`;
      el.appendChild(t);
    }
    $('#messages').appendChild(el);
    el.scrollIntoView({ behavior: 'smooth' });
  }

  function simpleMd(t) {
    return t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  }

  /* HUD particle network */
  function initHudCanvas() {
    const canvas = $('#hudCanvas');
    const ctx = canvas.getContext('2d');
    let nodes = [];
    const N = 55;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      nodes = Array.from({ length: N }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.hypot(dx, dy);
          if (d < 140) {
            ctx.strokeStyle = `rgba(0, 229, 255, ${0.15 * (1 - d / 140)})`;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
        ctx.fillStyle = 'rgba(0, 229, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(nodes[i].x, nodes[i].y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    draw();
  }

  function initGraphCanvas() {
    const canvas = $('#graphCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const nodes = Array.from({ length: 24 }, (_, i) => ({
      x: 40 + (i % 6) * 120 + Math.random() * 30,
      y: 40 + Math.floor(i / 6) * 90 + Math.random() * 20,
      label: `N${i}`,
    }));

    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (Math.random() > 0.72) continue;
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }
    for (const n of nodes) {
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  async function loadStatus() {
    try {
      const h = await fetch('/health').then((r) => r.json());
      $('#statBrain').textContent = (h.llm || 'groq').toUpperCase();
      $('#statTools').textContent = h.tools || '—';
      $('#statGraph').textContent = h.mind?.graphify?.nodes || h.codegraph?.nodes || '—';
      $('#statMode').textContent = h.online ? 'ONLINE' : 'LOCAL';

      const systems = [];
      systems.push(['Groq', h.llm === 'groq' ? 'ok' : 'warn']);
      systems.push(['Deepgram', h.mind?.voice?.stt?.configured ? 'ok' : 'warn']);
      systems.push(['ElevenLabs', h.mind?.voice?.tts?.configured ? 'ok' : 'warn']);
      systems.push(['CodeGraph', h.codegraph?.nodes > 0 ? 'ok' : 'warn']);
      systems.push(['OpenWiki', h.mcp?.openwiki?.hasLocalWiki || h.mcp?.openwiki?.configured ? 'ok' : 'warn']);
      systems.push(['Scraper', h.mcp?.['scraper-media']?.configured || h.mcp?.firecrawl?.configured ? 'ok' : 'warn']);
      systems.push(['Playwright', h.mcp?.playwright?.mcpUrl ? 'ok' : 'warn']);
      systems.push(['Obsidian', h.mind?.obsidian?.configured ? 'ok' : 'warn']);

      $('#systemList').innerHTML = systems
        .map(
          ([n, s]) =>
            `<div class="system-row"><span>${n}</span><span class="dot ${s}"></span></div>`
        )
        .join('');

      const mcp = h.mcp || {};
      $('#mcpGrid').innerHTML = Object.entries(mcp)
        .map(
          ([name, s]) =>
            `<div class="mcp-card ${s.configured || s.mcpUrl || s.hasLocalWiki ? 'ok' : 'warn'}"><strong>${name}</strong><br/>${s.configured ? 'ready' : 'optional'}</div>`
        )
        .join('');
    } catch {
      $('#statMode').textContent = 'OFFLINE';
    }
  }

  async function sendChat(text) {
    addMessage('user', text);
    const thinking = document.createElement('div');
    thinking.className = 'msg thinking';
    thinking.textContent = 'Processing…';
    $('#messages').appendChild(thinking);
    try {
      const result = await api('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text, sessionId }),
      });
      thinking.remove();
      sessionId = result.sessionId || sessionId;
      localStorage.setItem(SESSION_KEY, sessionId);
      addMessage('assistant', result.response || '(no response)', result.toolResults?.map((t) => t.tool));
      if (window.tonyVoice?.Voice?.voiceOut) window.tonyVoice.speakResponse(result.response);
    } catch (e) {
      thinking.remove();
      addMessage('assistant', `Error: ${e.message}`);
    }
  }

  function initNav() {
    $$('.hud-nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.hud-nav-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        $$('.panel').forEach((p) => p.classList.remove('active'));
        $(`#panel-${btn.dataset.panel}`).classList.add('active');
        if (btn.dataset.panel === 'graph') initGraphCanvas();
      });
    });
  }

  function tickClock() {
    const now = new Date();
    $('#hudClock').textContent = now.toTimeString().slice(0, 8);
  }

  function boot() {
    initHudCanvas();
    initNav();
    tickClock();
    setInterval(tickClock, 1000);
    loadStatus();
    setInterval(loadStatus, 30000);
    window.tonyVoice?.initVoice();

    $('#chatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = $('#chatInput').value.trim();
      if (!v) return;
      $('#chatInput').value = '';
      sendChat(v);
    });

    $('#workflowForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const task = $('#workflowTask').value.trim();
      if (!task) return;
      addMessage('user', `[Workflow] ${task}`);
      $$('.hud-nav-btn[data-panel="command"]')[0].click();
      const result = await api('/api/workflows/run', {
        method: 'POST',
        body: JSON.stringify({
          task,
          mode: $('#workflowMode').value,
          speak: $('#workflowSpeak').checked,
          sessionId,
        }),
      });
      addMessage('assistant', result.response, result.toolResults?.map((t) => t.tool));
    });

    $('#rebuildGraph')?.addEventListener('click', async () => {
      await api('/api/brain/graph/build', { method: 'POST' });
      initGraphCanvas();
      loadStatus();
    });

    addMessage(
      'assistant',
      '**JARVIS online.** I code in every major language, build web and mobile apps, scrape and research the web, and run workflows 24/7. Speak or type a command.'
    );
  }

  if (!token) {
    const dlg = $('#tokenDialog');
    dlg.showModal();
    dlg.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      token = $('#tokenInput').value.trim();
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
        dlg.close();
        boot();
      }
    });
  } else boot();
})();
