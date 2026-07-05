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
    version: '2.4.0',
    llm: config.llmProvider,
    llmChain: require('../llm').providerStatus(),
    online,
    connectivity: connStatus(),
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
  });
}

module.exports = { app, server };
