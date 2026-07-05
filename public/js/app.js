(() => {
  const TOKEN_KEY = 'tony_api_token';
  const SESSION_KEY = 'tony_session_id';

  let token = localStorage.getItem(TOKEN_KEY) || '';
  let sessionId = localStorage.getItem(SESSION_KEY) || crypto.randomUUID();
  let selectedLang = 'auto';
  let slideIndex = 0;

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

  function langPrefix() {
    const map = {
      en: '[Reply in English] ',
      ur: '[جواب اردو میں دیں] ',
      hi: '[हिन्दी में उत्तर दें] ',
      roman: '[Reply in Roman Urdu] ',
    };
    return map[selectedLang] || '';
  }

  function simpleMarkdown(text) {
    return text
      .replace(/### (.*)/g, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.*)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/\n/g, '<br>');
  }

  function addMessage(role, content, tools) {
    const el = document.createElement('div');
    el.className = `msg ${role}`;
    if (role === 'assistant') el.innerHTML = simpleMarkdown(content);
    else el.textContent = content;
    if (tools?.length) {
      const t = document.createElement('div');
      t.className = 'msg-tools';
      t.textContent = `[tools: ${tools.join(', ')}]`;
      el.appendChild(t);
    }
    $('#messages').appendChild(el);
    el.scrollIntoView({ behavior: 'smooth' });
    return content;
  }

  window.tonyApi = api;
  window.tonyAddMessage = addMessage;
  window.tonyLangPrefix = langPrefix;
  window.tonySessionId = () => sessionId;

  async function loadStatus() {
    try {
      const h = await fetch('/health').then((r) => r.json());
      $('#versionTag').textContent = `v${h.version || '2.1'}`;

      const rows = [];
      rows.push(['Groq Brain', h.llm === 'groq' ? 'ok' : 'warn']);
      if (h.llmChain?.gemini) rows.push(['Gemini', 'ok']);
      rows.push(['Online', h.online ? 'ok' : 'warn']);
      if (h.tasks) rows.push(['Tasks', h.tasks.recorded ? 'ok' : 'warn']);
      rows.push(['Tools', h.tools ? 'ok' : 'warn']);
      rows.push(['Skills', h.skills ? 'ok' : 'warn']);

      const mcp = h.mcp || {};
      for (const [name, s] of Object.entries(mcp)) {
        const on = s.configured || s.mcpUrl || s.mode === 'local-free';
        rows.push([name, on ? 'ok' : 'warn']);
      }

      if (h.mind?.voice) {
        rows.push(['Deepgram', h.mind.voice.stt?.configured ? 'ok' : 'warn']);
        rows.push(['ElevenLabs', h.mind.voice.tts?.configured ? 'ok' : 'warn']);
      }
      if (h.codegraph) {
        rows.push(['CodeGraph', h.codegraph.configured && h.codegraph.nodes > 0 ? 'ok' : 'warn']);
      }
      if (h.tonyDesktop) {
        rows.push(['tony-ai desktop', h.tonyDesktop.configured ? 'ok' : 'warn']);
      }

      $('#statusList').innerHTML = rows
        .map(
          ([label, state]) =>
            `<div class="status-row"><span>${label}</span><span class="status-dot ${state}"></span></div>`
        )
        .join('');
    } catch {
      $('#statusList').innerHTML = '<div class="status-row"><span>Offline</span></div>';
    }
  }

  async function sendChat(text) {
    addMessage('user', text);
    const thinking = document.createElement('div');
    thinking.className = 'msg thinking';
    thinking.textContent = 'TONY is thinking…';
    thinking.id = 'thinking';
    $('#messages').appendChild(thinking);

    try {
      const result = await api('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: langPrefix() + text,
          sessionId,
        }),
      });
      thinking.remove();
      localStorage.setItem(SESSION_KEY, result.sessionId || sessionId);
      sessionId = result.sessionId || sessionId;
      addMessage(
        'assistant',
        result.response || '(no response)',
        result.toolResults?.map((t) => t.tool)
      );
      if (window.tonyVoice?.Voice?.voiceOut) {
        window.tonyVoice.speakResponse(result.response);
      }
    } catch (e) {
      thinking.remove();
      addMessage('assistant', `Error: ${e.message}`);
    }
  }

  async function loadTasks() {
    try {
      const data = await api('/api/tasks');
      const tasks = data.tasks || [];
      const h = await fetch('/health').then((r) => r.json());
      const badge = $('#offlineBadge');
      badge.textContent = h.online ? '● Online' : '● Offline — local replay active';
      badge.classList.toggle('offline', !h.online);

      $('#tasksList').innerHTML = tasks.length
        ? tasks
            .map(
              (t) => `<div class="card">
              <h4>${t.name} <span class="tag">${t.runCount || 0} runs</span></h4>
              <p>${t.description || ''}</p>
              <p style="font-family:var(--mono);font-size:0.72rem;margin-top:0.5rem">${(t.steps || []).map((s) => s.tool).join(' → ')}</p>
              <p style="margin-top:0.35rem;font-size:0.75rem;color:var(--muted)">Say: "repeat ${t.name}"</p>
              <button class="btn-secondary" style="margin-top:0.5rem" onclick="replayTaskById('${t.id}')">Replay now</button>
            </div>`
            )
            .join('')
        : '<p style="color:var(--muted)">No tasks yet. Complete multi-step work online — TONY auto-records. Or say "remember this task as my task".</p>';
    } catch (e) {
      $('#tasksList').innerHTML = `<p style="color:var(--danger)">${e.message}</p>`;
    }
  }

  window.replayTaskById = async (id) => {
    try {
      const result = await api('/api/tasks/replay', { method: 'POST', body: JSON.stringify({ taskId: id }) });
      $$('.nav-item[data-view="chat"]')[0].click();
      addMessage('assistant', result.response || 'Task replayed.');
    } catch (e) {
      alert(e.message);
    }
  };

  async function loadGoals() {
    try {
      const data = await api('/api/goals');
      const goals = data.goals || [];
      $('#goalsList').innerHTML = goals.length
        ? goals
            .map(
              (g) => `<div class="card">
              <h4>${g.title} <span class="tag">${g.status}</span></h4>
              <p>${g.description || ''}</p>
              <p style="margin-top:0.5rem;font-family:var(--mono);font-size:0.75rem">${(g.successCriteria || []).join(' · ')}</p>
            </div>`
            )
            .join('')
        : '<p style="color:var(--muted)">No goals yet. Create one above.</p>';
    } catch (e) {
      $('#goalsList').innerHTML = `<p style="color:var(--danger)">${e.message}</p>`;
    }
  }

  async function loadBrain() {
    try {
      const h = await fetch('/health').then((r) => r.json());
      const mind = h.mind || {};
      const layers = mind.layers || [];
      $('#brainGrid').innerHTML = [
        ...layers.map(
          (l) => `<div class="brain-card"><h4>${l}</h4><div class="stat">●</div></div>`
        ),
        `<div class="brain-card"><h4>Graph nodes</h4><div class="stat">${mind.graphify?.nodes ?? 0}</div></div>`,
        `<div class="brain-card"><h4>Graph edges</h4><div class="stat">${mind.graphify?.edges ?? 0}</div></div>`,
        `<div class="brain-card"><h4>Obsidian notes</h4><div class="stat">${mind.obsidian?.noteCount ?? 0}</div></div>`,
        `<div class="brain-card"><h4>Active goals</h4><div class="stat">${h.goals?.active ?? 0}</div></div>`,
      ].join('');
    } catch {
      $('#brainGrid').innerHTML = '<p>Could not load brain status</p>';
    }
  }

  async function loadIntegrations() {
    try {
      const manifest = await api('/api/integrations/manifest');
      const repos = manifest.repos || [];
      $('#integrationsList').innerHTML =
        '<h3 style="margin-bottom:0.75rem;font-size:0.85rem;color:var(--muted)">Bundled Repos</h3>' +
        repos
          .map(
            (r) => `<div class="card">
            <h4>${r.name}</h4>
            <p>${r.description}</p>
            ${(r.tags || []).map((t) => `<span class="tag">${t}</span>`).join('')}
          </div>`
          )
          .join('');

      const free = await fetch('/api/free-llm', {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json());
      $('#freeLlmList').innerHTML =
        '<h3 style="margin:1.5rem 0 0.75rem;font-size:0.85rem;color:var(--muted)">Free LLM API Resources</h3>' +
        (free.providers || [])
          .map(
            (p) => `<div class="card">
            <h4>${p.name} ${p.tonyDefault ? '<span class="tag">TONY default</span>' : ''} ${p.local ? '<span class="tag">local free</span>' : ''}</h4>
            <p>${p.freeTier || ''}</p>
            <p style="margin-top:0.35rem;font-family:var(--mono);font-size:0.72rem">${p.env || ''}</p>
          </div>`
          )
          .join('');
    } catch (e) {
      $('#integrationsList').innerHTML = `<p>${e.message}</p>`;
    }
  }

  function showSlide(i) {
    const slides = $$('.slide');
    slideIndex = ((i % slides.length) + slides.length) % slides.length;
    slides.forEach((s, idx) => s.classList.toggle('active', idx === slideIndex));
    $('#slideIndicator').textContent = `${slideIndex + 1} / ${slides.length}`;
  }

  function initNav() {
    $$('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.nav-item').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const view = btn.dataset.view;
        $$('.view').forEach((v) => v.classList.remove('active'));
        $(`#view-${view}`).classList.add('active');
        if (view === 'goals') loadGoals();
        if (view === 'tasks') loadTasks();
        if (view === 'brain') loadBrain();
        if (view === 'integrations') loadIntegrations();
      });
    });
  }

  function initLang() {
    $$('.pill').forEach((p) => {
      p.addEventListener('click', () => {
        $$('.pill').forEach((x) => x.classList.remove('active'));
        p.classList.add('active');
        selectedLang = p.dataset.lang;
      });
    });
  }

  function initToken() {
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
    } else {
      boot();
    }
  }

  function boot() {
    loadStatus();
    setInterval(loadStatus, 30000);

    $('#chatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#chatInput');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      sendChat(text);
    });

    $('#chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        $('#chatForm').requestSubmit();
      }
    });

    $('#workflowForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const task = $('#workflowTask').value.trim();
      const mode = $('#workflowMode').value;
      const speak = $('#workflowSpeak').checked;
      if (!task) return;
      try {
        addMessage('user', `[Workflow] ${task}`);
        $$('.nav-item[data-view="chat"]')[0].click();
        const thinking = document.createElement('div');
        thinking.className = 'msg thinking';
        thinking.textContent = 'Running automated workflow…';
        $('#messages').appendChild(thinking);
        const result = await api('/api/workflows/run', {
          method: 'POST',
          body: JSON.stringify({ task, mode, speak, sessionId }),
        });
        thinking.remove();
        addMessage(
          'assistant',
          result.response || '(no response)',
          result.toolResults?.map((t) => t.tool)
        );
        if (speak && window.tonyVoice?.speakResponse) window.tonyVoice.speakResponse(result.response);
        if ($('#workflowsList')) {
          $('#workflowsList').innerHTML = `<div class="card"><h4>Last · ${result.workflow?.mode || mode}</h4><p>${(result.response || '').slice(0, 400)}</p></div>`;
        }
      } catch (err) {
        alert(err.message);
      }
    });

    $('#goalForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = $('#goalTitle').value.trim();
      const description = $('#goalDesc').value.trim();
      const criteria = $('#goalCriteria')
        .value.split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      try {
        addMessage('user', `[Goal] ${title}`);
        await api('/api/goals/run', {
          method: 'POST',
          body: JSON.stringify({ title, description, successCriteria: criteria, sessionId }),
        });
        loadGoals();
        $$('.nav-item[data-view="chat"]')[0].click();
        addMessage('assistant', `Goal "${title}" loop started. Check Goals tab for status.`);
      } catch (err) {
        alert(err.message);
      }
    });

    $('#rebuildGraph').addEventListener('click', async () => {
      try {
        await api('/api/brain/graph/build', { method: 'POST' });
        loadBrain();
      } catch (e) {
        alert(e.message);
      }
    });

    $('#prevSlide').addEventListener('click', () => showSlide(slideIndex - 1));
    $('#nextSlide').addEventListener('click', () => showSlide(slideIndex + 1));

    $('#micBtnMini')?.addEventListener('click', () => $('#micBtn')?.click());

    window.tonyVoice?.initVoice();

    addMessage(
      'assistant',
      'Welcome to **TONY** — your personal laptop AI.\n\n🎤 **Click the mic** or hold **Space** to talk. I listen via **Deepgram** and speak via **ElevenLabs**.\n\nLanguages: English, Urdu, Hindi, Roman Urdu. I can also code, push to GitHub, build websites, and run complex tasks — just ask.'
    );
  }

  initNav();
  initLang();
  initToken();
})();
