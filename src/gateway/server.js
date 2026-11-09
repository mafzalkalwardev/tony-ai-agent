require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const path = require('path');
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { randomUUID } = require('crypto');
const config = require('../config');
const { runAgent } = require('../core/agent');
const memory = require('../memory');

const app = express();
app.use(express.json({ limit: '10mb' }));

const publicDir = path.join(__dirname, '../../public');
app.use(express.static(publicDir));

app.get('/', (_req, res) => {
  res.redirect('/jarvis.html');
});

app.get('/jarvis', (_req, res) => {
  res.sendFile(path.join(publicDir, 'jarvis.html'));
});

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer\s+/i, '') || req.query.token;
  if (token !== config.apiToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/health', async (_req, res) => {
  const architectures = require('../brain/architectures');
  const mcp = require('../mcp');
  const goalStore = require('../goals/store');
  const taskStore = require('../tasks/store');
  const { isOnline, status: connStatus } = require('../local/connectivity');
  const online = await isOnline();
  res.json({
    ok: true,
    name: 'TONY',
    version: '2.11.0',
    llm: config.llmProvider,
    operator: {
      categories: require('../core/intent_router').CATEGORIES,
      pendingApprovals: require('../safety/approvals').list('pending').length,
      trustedMode: require('../safety/trusted_mode').status(),
      telegram: require('../channels/telegram').status(),
      memorialVoice: require('../voice/memorial_voice').status(),
      browserOperator: require('../tools/browser_operator').status(),
    },
    llmChain: require('../llm').providerStatus(),
    online,
    connectivity: connStatus(),
    companion: {
      enabled: config.companion.enabled,
      userName: config.companion.userName,
      alwaysListen: config.companion.alwaysListen,
    },
    jan: require('../llm/jan').status(),
    automation: require('../bridge/automation').status(),
    presentation: require('../bridge/presentation').status(),
    profile: require('../memory/profile').load().name,
    voice: {
      noiseCancellation: config.voice.noiseCancellation,
      minConfidence: config.voice.minConfidence,
      highPassHz: config.voice.highPassHz,
      silenceStopSeconds: config.voice.silenceStopSeconds,
      silenceThreshold: config.voice.silenceThreshold,
      useSilenceDetection: config.voice.useSilenceDetection !== false,
      vadSpeechMult: config.voice.vadSpeechMult,
      preferLocalStt: config.voice.preferLocalStt,
      preferLocalTts: config.voice.preferLocalTts,
    },
    skills: require('../skills/loader').listSkills().length,
    tools: require('../tools/registry').listTools().length,
    mind: architectures.status(),
    mcp: mcp.statusAll(),
    goals: { active: goalStore.list('active').length, completed: goalStore.list('completed').length },
    tasks: { recorded: taskStore.list().length },
    codegraph: require('../brain/codegraph').status(),
    tonyDesktop: require('../bridge/tony-desktop').status(),
  });
});

app.post('/api/chat', auth, async (req, res) => {
  try {
    const { message, sessionId = randomUUID() } = req.body || {};
    if (!message) return res.status(400).json({ error: 'message required' });
    const result = await runAgent({ sessionId, message });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/screenshots/:name', auth, (req, res) => {
  const { resolveScreenshotFile } = require('./attachments');
  const file = resolveScreenshotFile(req.params.name);
  if (!file) return res.status(404).json({ error: 'Screenshot not found' });
  res.type('image/png');
  res.sendFile(file);
});

app.get('/api/memory/search', auth, (req, res) => {
  const q = req.query.q || '';
  res.json(memory.searchAll(q));
});

app.post('/api/memory/remember', auth, (req, res) => {
  const { text, tags } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  res.json({ ok: true, fact: memory.remember(text, tags || []) });
});

app.get('/api/skills', auth, (_req, res) => {
  res.json(require('../skills/loader').listSkills());
});

app.post('/api/crew', auth, async (req, res) => {
  try {
    const { task } = req.body || {};
    if (!task) return res.status(400).json({ error: 'task required' });
    const { runCrew } = require('../core/crew');
    const result = await runCrew(task);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/voice/status', auth, async (_req, res) => {
  res.json(await require('../channels/voice').voiceStatus());
});

app.post('/api/voice/transcribe', auth, async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body || {};
    if (!audioBase64) return res.status(400).json({ error: 'audioBase64 required' });
    const result = await require('../channels/voice').transcribeAudio({ audioBase64, mimeType });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/voice/speak', auth, async (req, res) => {
  try {
    const { text, voiceId } = req.body || {};
    if (!text) return res.status(400).json({ error: 'text required' });
    const result = await require('../channels/voice').speakText(text, { voiceId });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/voice/converse', auth, async (req, res) => {
  try {
    const { audioBase64, mimeType, sessionId = randomUUID(), speak = true } = req.body || {};
    if (!audioBase64) return res.status(400).json({ error: 'audioBase64 required' });
    const result = await require('../channels/voice').voiceConverse({
      sessionId,
      audioBase64,
      mimeType,
      speak,
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/companion/wake', auth, async (req, res) => {
  try {
    const { message, sessionId = randomUUID() } = req.body || {};
    const result = await require('../companion/wake').generateWakeResponse({ sessionId, message });
    res.json({ sessionId, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/companion/habits', auth, (_req, res) => {
  const habits = require('../companion/habits');
  res.json({ ok: true, ...habits.summary(), formatted: habits.formatForAgent() });
});

app.get('/api/profile', auth, (_req, res) => {
  const profile = require('../memory/profile');
  res.json({ ok: true, profile: profile.load(), formatted: profile.formatForAgent() });
});

app.post('/api/profile', auth, (req, res) => {
  const profile = require('../memory/profile');
  const { fact, ...partial } = req.body || {};
  if (fact) profile.addFact(fact, ['api']);
  const updated = Object.keys(partial).length ? profile.update(partial) : profile.load();
  res.json({ ok: true, profile: updated });
});

app.get('/api/brain/status', auth, (_req, res) => {
  res.json(require('../brain/architectures').status());
});

app.post('/api/brain/graph/build', auth, (_req, res) => {
  const graphify = require('../brain/graphify');
  const graph = graphify.buildFromWorkspace();
  res.json({ ok: true, nodes: graph.nodes.length, edges: graph.edges.length, builtAt: graph.builtAt });
});

app.get('/api/brain/graph/query', auth, (req, res) => {
  const graphify = require('../brain/graphify');
  res.json(graphify.query(req.query.q || ''));
});

app.get('/api/brain/obsidian/search', auth, (req, res) => {
  const obsidian = require('../brain/obsidian');
  res.json(obsidian.searchNotes(req.query.q || ''));
});

app.post('/api/agents/paul/build', auth, async (req, res) => {
  try {
    const { task, constraints, sessionId = randomUUID() } = req.body || {};
    if (!task) return res.status(400).json({ error: 'task required' });
    const paul = require('../agents/paul');
    const result = await paul.build(task, sessionId, { constraints });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/mcp/status', auth, (_req, res) => {
  res.json(require('../mcp').statusAll());
});

app.post('/api/mcp/research', auth, async (req, res) => {
  try {
    const { query } = req.body || {};
    if (!query) return res.status(400).json({ error: 'query required' });
    res.json(await require('../mcp').research(query));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/research/deep', auth, async (req, res) => {
  try {
    const { query, scrape_url, browser_url } = req.body || {};
    if (!query) return res.status(400).json({ error: 'query required' });
    res.json(await require('../knowledge/research').deepResearch(query, {
      scrapeUrl: scrape_url,
      browserUrl: browser_url,
      searchRepos: true,
    }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/goals', auth, (req, res) => {
  const goalStore = require('../goals/store');
  res.json({ goals: goalStore.list(req.query.status) });
});

app.post('/api/goals', auth, (req, res) => {
  const { title, description, successCriteria, tags } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title required' });
  const goal = require('../goals/store').create({
    title,
    description,
    successCriteria: successCriteria || [],
    tags,
  });
  res.json({ ok: true, goal });
});

app.post('/api/goals/run', auth, async (req, res) => {
  try {
    const { goalId, title, description, successCriteria, maxRounds, sessionId = randomUUID() } =
      req.body || {};
    const runner = require('../goals/runner');
    if (goalId) {
      res.json(await runner.runGoal({ goalId, sessionId, maxRounds }));
      return;
    }
    if (title && successCriteria?.length) {
      res.json(
        await runner.runGoalFromText({
          title,
          description,
          successCriteria,
          sessionId,
          maxRounds,
        })
      );
      return;
    }
    res.status(400).json({ error: 'goalId or title+successCriteria required' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/workflows/run', auth, async (req, res) => {
  try {
    const { task, mode, speak, successCriteria, sessionId = randomUUID() } = req.body || {};
    if (!task) return res.status(400).json({ error: 'task required' });
    const { runWorkflow } = require('../workflows/runner');
    res.json(await runWorkflow({ task, sessionId, mode, speak, successCriteria }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/codegraph/status', auth, (_req, res) => {
  res.json(require('../brain/codegraph').status());
});

app.get('/api/tony-desktop/status', auth, (_req, res) => {
  res.json(require('../bridge/tony-desktop').status());
});

app.get('/api/integrations/manifest', auth, (_req, res) => {
  res.json(require('../../integrations/manifest.json'));
});

app.get('/api/free-llm', auth, (_req, res) => {
  res.json(require('../knowledge/free-llm-index.json'));
});

app.get('/api/tasks', auth, (_req, res) => {
  res.json({ tasks: require('../tasks/store').list() });
});

app.post('/api/tasks', auth, (req, res) => {
  const { name, description, triggers, steps } = req.body || {};
  if (!name || !steps?.length) return res.status(400).json({ error: 'name and steps required' });
  const task = require('../tasks/store').create({ name, description, triggers, steps });
  res.json({ ok: true, task });
});

app.post('/api/tasks/replay', auth, async (req, res) => {
  try {
    const { taskId, name, sessionId = randomUUID() } = req.body || {};
    const store = require('../tasks/store');
    const task = store.get(taskId || name);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(await require('../tasks/replay').replayTask(task, sessionId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/tasks/:id', auth, (req, res) => {
  require('../tasks/store').remove(req.params.id);
  res.json({ ok: true });
});

app.get('/api/local/status', auth, async (_req, res) => {
  const { isOnline, status } = require('../local/connectivity');
  res.json({
    online: await isOnline(true),
    connectivity: status(),
    ollama: await require('../llm/ollama').isAvailable(),
    tasks: require('../tasks/store').list().length,
    llm: require('../llm').providerStatus(),
  });
});

app.post('/api/intent/route', auth, (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });
  const routed = require('../core/intent_router').route(message);
  const safety = require('../safety/policy').classifyIntent(routed.intent, message);
  res.json({ ok: true, ...routed, safety });
});

app.get('/api/operator/status', auth, (_req, res) => {
  const approvals = require('../safety/approvals');
  res.json({
    ok: true,
    pendingApprovals: approvals.list('pending').slice(0, 10),
    categories: require('../core/intent_router').CATEGORIES,
    voice: {
      noiseCancellation: config.voice.noiseCancellation,
      minConfidence: config.voice.minConfidence,
      silenceStopSeconds: config.voice.silenceStopSeconds,
      silenceThreshold: config.voice.silenceThreshold,
      preferLocalStt: config.voice.preferLocalStt,
    },
  });
});

app.get('/api/approvals', auth, (req, res) => {
  const status = req.query.status || 'pending';
  res.json({ ok: true, approvals: require('../safety/approvals').list(status) });
});

app.post('/api/approvals/:id', auth, (req, res) => {
  const approved = Boolean(req.body?.approved);
  const item = require('../safety/approvals').decide(req.params.id, approved);
  if (!item) return res.status(404).json({ error: 'Approval not found' });
  res.json({ ok: true, approval: item });
});

app.get('/api/project/scan', auth, (req, res) => {
  const projectPath = req.query.path || '.';
  const scanner = require('../tools/project_scanner');
  res.json({ ok: true, ...scanner.scan(projectPath), text: scanner.scanAsText(projectPath) });
});

app.post('/api/delivery/prepare', auth, (req, res) => {
  const { completedWork, limitations, path: projectPath = '.' } = req.body || {};
  res.json(
    require('../tools/delivery_helper').prepareDeliveryPackage({
      projectPath,
      completedWork,
      limitations,
    })
  );
});

app.post('/api/delivery/export', auth, async (req, res) => {
  try {
    const result = await require('../tools/registry').executeTool(
      'export_delivery',
      {
        completedWork: req.body?.completedWork || '',
        limitations: req.body?.limitations || '',
      },
      req.body?.sessionId || 'api'
    );
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/github/summary', auth, (_req, res) => {
  res.json(require('../tools/github_helper').summarizeRepo());
});

app.get('/api/github/changes', auth, (_req, res) => {
  res.json(require('../tools/github_helper').explainChangedFiles());
});

app.post('/api/github/commit-message', auth, (req, res) => {
  res.json(require('../tools/github_helper').generateCommitMessage(req.body?.topic || ''));
});

app.post('/api/github/prepare-pr', auth, (req, res) => {
  res.json(require('../tools/github_helper').preparePrInstructions(req.body?.topic || ''));
});

app.post('/api/github/create-issue', auth, async (req, res) => {
  try {
    const result = await require('../tools/registry').executeTool(
      'create_issue',
      {
        title: req.body?.title,
        body: req.body?.body || '',
        approved: Boolean(req.body?.approved),
      },
      req.body?.sessionId || 'api'
    );
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/github/create-pr', auth, async (req, res) => {
  try {
    const result = await require('../tools/registry').executeTool(
      'create_pr',
      {
        title: req.body?.title,
        body: req.body?.body || '',
        base: req.body?.base || 'master',
        draft: Boolean(req.body?.draft),
        approved: Boolean(req.body?.approved),
      },
      req.body?.sessionId || 'api'
    );
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/telegram/status', auth, (_req, res) => {
  res.json({ ok: true, ...require('../channels/telegram').status() });
});

app.post('/api/telegram/webhook', auth, async (req, res) => {
  try {
    res.json(await require('../channels/telegram').handleUpdate(req.body || {}));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/telegram/send', auth, async (req, res) => {
  try {
    const result = await require('../tools/registry').executeTool(
      'telegram_send',
      { text: req.body?.text || '', approved: Boolean(req.body?.approved) },
      req.body?.sessionId || 'api'
    );
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/memorial-voice', auth, (_req, res) => {
  const memorial = require('../voice/memorial_voice');
  res.json({ ok: true, ...memorial.status(), voices: memorial.listVoices() });
});

app.post('/api/memorial-voice/register', auth, async (req, res) => {
  try {
    res.json(require('../voice/memorial_voice').registerMemorialVoice(req.body || {}));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/memorial-voice/clone', auth, async (req, res) => {
  try {
    res.json(await require('../voice/memorial_voice').cloneMemorialVoice(req.body?.name));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/memorial-voice/speak', auth, async (req, res) => {
  try {
    const { name, text } = req.body || {};
    if (!name || !text) return res.status(400).json({ error: 'name and text required' });
    res.json(await require('../voice/memorial_voice').speakMemorial(name, text));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/browser/operator', auth, async (req, res) => {
  try {
    const result = await require('../tools/registry').executeTool(
      'browser_operator',
      {
        action: req.body?.action || 'status',
        url: req.body?.url,
        ref: req.body?.ref,
        text: req.body?.text,
        approved: Boolean(req.body?.approved),
      },
      req.body?.sessionId || 'api'
    );
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/preferences', auth, (_req, res) => {
  res.json({ ok: true, preferences: require('../tools/preferences').load() });
});

app.post('/api/preferences', auth, (req, res) => {
  const prefs = require('../tools/preferences');
  if (req.body?.projectNote) {
    return res.json({ ok: true, preferences: prefs.addProjectNote(req.body.projectNote) });
  }
  res.json({ ok: true, preferences: prefs.save(req.body || {}) });
});

app.get('/api/voice/local-stt', auth, (_req, res) => {
  res.json({ ok: true, ...require('../voice/local_stt').status() });
});

app.get('/api/trusted-mode', auth, (_req, res) => {
  res.json({ ok: true, ...require('../safety/trusted_mode').status() });
});

app.post('/api/trusted-mode', auth, (req, res) => {
  const trusted = require('../safety/trusted_mode');
  const enabled = req.body?.enabled;
  if (enabled === true) return res.json({ ok: true, ...trusted.enable({ by: 'api' }) });
  if (enabled === false) return res.json({ ok: true, ...trusted.disable() });
  res.json({ ok: true, ...trusted.status() });
});

app.post('/api/research', auth, async (req, res) => {
  try {
    const { query, urls, openBrowser } = req.body || {};
    if (!query) return res.status(400).json({ error: 'query required' });
    const trusted = require('../safety/trusted_mode');
    if (!trusted.isEnabled() && !req.body?.approved) {
      const pending = require('../safety/approvals').create({
        action: 'research_web',
        command: query,
        reason: 'API research requires approval or trusted mode',
      });
      return res.status(402).json({ ok: false, needsApproval: true, pendingApprovalId: pending.id });
    }
    res.json(await require('../tools/research_web').researchTopic(query, { urls, openBrowser }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/decide', auth, async (req, res) => {
  try {
    const { message, intent } = req.body || {};
    if (!message) return res.status(400).json({ error: 'message required' });
    res.json(
      await require('../core/decision_engine').decideAndMaybeExecute({
        message,
        intent: { intent: intent || 'unknown' },
        sessionId: req.body?.sessionId || 'api',
      })
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  if (token !== config.apiToken) {
    ws.close(4401, 'Unauthorized');
    return;
  }

  const sessionId = url.searchParams.get('session') || randomUUID();
  ws.send(JSON.stringify({ type: 'ready', sessionId }));

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'chat' && msg.message) {
        ws.send(JSON.stringify({ type: 'thinking' }));
        const result = await runAgent({ sessionId, message: msg.message });
        ws.send(JSON.stringify({ type: 'response', ...result }));
        return;
      }

      if (msg.type === 'voice' && msg.audioBase64) {
        ws.send(JSON.stringify({ type: 'thinking' }));
        const voice = require('../channels/voice');
        const result = await voice.voiceConverse({
          sessionId,
          audioBase64: msg.audioBase64,
          mimeType: msg.mimeType,
          speak: msg.speak !== false,
        });
        ws.send(JSON.stringify({ type: 'voice_response', ...result }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', error: e.message }));
    }
  });
});

if (require.main === module) {
  server.listen(config.port, () => {
    console.log(`TONY gateway listening on http://localhost:${config.port}`);
    console.log(`WebSocket: ws://localhost:${config.port}/ws?token=***`);
    if (config.telegram?.polling && config.telegram?.botToken) {
      require('../channels/telegram')
        .startPolling()
        .then((r) => console.log('Telegram polling:', r.ok ? 'on' : r.error))
        .catch((e) => console.warn('Telegram polling failed:', e.message));
    }
  });
}

module.exports = { app, server };
