const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('../config');
const memory = require('../memory');

function safePath(relative) {
  const resolved = path.resolve(config.workspaceRoot, relative);
  if (!resolved.startsWith(path.resolve(config.workspaceRoot))) {
    throw new Error('Path escapes workspace root');
  }
  return resolved;
}

const builtins = {
  read_file: {
    name: 'read_file',
    description: 'Read a text file from the workspace',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative file path' } },
      required: ['path'],
    },
    async execute({ path: filePath }) {
      const full = safePath(filePath);
      if (!fs.existsSync(full)) return { ok: false, error: `File not found: ${filePath}` };
      const content = fs.readFileSync(full, 'utf8');
      return { ok: true, path: filePath, content: content.slice(0, 12000) };
    },
  },

  list_directory: {
    name: 'list_directory',
    description: 'List files in a workspace directory',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative directory', default: '.' } },
    },
    async execute({ path: dir = '.' }) {
      const full = safePath(dir);
      const entries = fs.readdirSync(full, { withFileTypes: true }).map((e) => ({
        name: e.name,
        type: e.isDirectory() ? 'dir' : 'file',
      }));
      return { ok: true, path: dir, entries };
    },
  },

  memory_search: {
    name: 'memory_search',
    description: 'Search episodic, semantic, and procedural memory',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    async execute({ query }) {
      return { ok: true, results: memory.searchAll(query) };
    },
  },

  memory_remember: {
    name: 'memory_remember',
    description: 'Store a fact in long-term semantic memory',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['text'],
    },
    async execute({ text, tags = [] }) {
      const fact = memory.remember(text, tags);
      return { ok: true, fact };
    },
  },

  list_skills: {
    name: 'list_skills',
    description: 'List loaded agent skills',
    parameters: { type: 'object', properties: {} },
    async execute() {
      const { listSkills } = require('../skills/loader');
      return { ok: true, skills: listSkills() };
    },
  },

  knowledge_search: {
    name: 'knowledge_search',
    description: 'Search curated open-source agent knowledge index',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    async execute({ query }) {
      const index = require('../knowledge/agents-index.json');
      const q = query.toLowerCase();
      const hits = index.agents.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.patterns.some((p) => p.toLowerCase().includes(q)) ||
          a.description.toLowerCase().includes(q)
      );
      return { ok: true, hits: hits.slice(0, 8) };
    },
  },

  graph_query: {
    name: 'graph_query',
    description: 'Query the graphify knowledge graph for concepts, files, and relationships',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    async execute({ query }) {
      const graphify = require('../brain/graphify');
      return { ok: true, ...graphify.query(query) };
    },
  },

  graph_build: {
    name: 'graph_build',
    description: 'Rebuild the graphify knowledge graph from workspace sources',
    parameters: { type: 'object', properties: {} },
    async execute() {
      const graphify = require('../brain/graphify');
      const graph = graphify.buildFromWorkspace();
      return { ok: true, nodes: graph.nodes.length, edges: graph.edges.length, builtAt: graph.builtAt };
    },
  },

  obsidian_search: {
    name: 'obsidian_search',
    description: 'Search the Obsidian agentic brain vault',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    async execute({ query }) {
      const obsidian = require('../brain/obsidian');
      return obsidian.searchNotes(query);
    },
  },

  obsidian_read: {
    name: 'obsidian_read',
    description: 'Read a note from the Obsidian agentic brain vault',
    parameters: {
      type: 'object',
      properties: { note: { type: 'string', description: 'Note path or title' } },
      required: ['note'],
    },
    async execute({ note }) {
      const obsidian = require('../brain/obsidian');
      return obsidian.readNote(note);
    },
  },

  paul_build: {
    name: 'paul_build',
    description: 'Dispatch Paul builder agent to ship an integration or code task',
    parameters: {
      type: 'object',
      properties: {
        task: { type: 'string' },
        constraints: { type: 'string' },
      },
      required: ['task'],
    },
    async execute({ task, constraints }, sessionId) {
      const paul = require('../agents/paul');
      return paul.build(task, sessionId, { constraints });
    },
  },

  perplexity_search: {
    name: 'perplexity_search',
    description: 'Research the internet via Perplexity MCP with citations',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    async execute({ query }) {
      return require('../mcp/perplexity').search(query);
    },
  },

  firecrawl_scrape: {
    name: 'firecrawl_scrape',
    description: 'Scrape a URL to markdown via Firecrawl MCP',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url'],
    },
    async execute({ url }) {
      return require('../mcp/firecrawl').scrape(url);
    },
  },

  firecrawl_search: {
    name: 'firecrawl_search',
    description: 'Search the web via Firecrawl MCP',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    async execute({ query }) {
      return require('../mcp/firecrawl').search(query);
    },
  },

  quickbooks_query: {
    name: 'quickbooks_query',
    description: 'Run QuickBooks SQL query via MCP (requires OAuth tokens)',
    parameters: {
      type: 'object',
      properties: { sql: { type: 'string' } },
      required: ['sql'],
    },
    async execute({ sql }) {
      return require('../mcp/quickbooks').query(sql);
    },
  },

  higgsfield_generate: {
    name: 'higgsfield_generate',
    description: 'Generate image or video via Higgsfield API',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['image', 'video'] },
        prompt: { type: 'string' },
        image_url: { type: 'string' },
      },
      required: ['type', 'prompt'],
    },
    async execute({ type, prompt, image_url }) {
      const hf = require('../mcp/higgsfield');
      if (type === 'video' && image_url) return hf.imageToVideo(prompt, image_url);
      return hf.textToImage(prompt);
    },
  },

  playwright_snapshot: {
    name: 'playwright_snapshot',
    description: 'Browser snapshot via Playwright MCP (or fetch fallback)',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url'],
    },
    async execute({ url }) {
      return require('../mcp/playwright').snapshot(url);
    },
  },

  deep_research: {
    name: 'deep_research',
    description: 'Multi-structure research: graphify + repos + Obsidian + Perplexity/Firecrawl',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        scrape_url: { type: 'string' },
        browser_url: { type: 'string' },
      },
      required: ['query'],
    },
    async execute({ query, scrape_url, browser_url }) {
      return require('../knowledge/research').deepResearch(query, {
        scrapeUrl: scrape_url,
        browserUrl: browser_url,
        searchRepos: true,
      });
    },
  },

  knowledge_structures: {
    name: 'knowledge_structures',
    description: 'Query multiple knowledge structures (graph, tree, vault, repo, web)',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    async execute({ query }) {
      const structures = require('../knowledge/structures');
      const result = await structures.queryAll(query);
      return { ok: true, ...result, formatted: structures.formatForAgent(result) };
    },
  },

  goal_create: {
    name: 'goal_create',
    description: 'Create a persistent goal with success criteria',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        success_criteria: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'success_criteria'],
    },
    async execute({ title, description, success_criteria }) {
      const goal = require('../goals/store').create({
        title,
        description: description || title,
        successCriteria: success_criteria,
      });
      return { ok: true, goal };
    },
  },

  goal_run: {
    name: 'goal_run',
    description: 'Run agent loop until goal success criteria are met',
    parameters: {
      type: 'object',
      properties: {
        goal_id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        success_criteria: { type: 'array', items: { type: 'string' } },
        max_rounds: { type: 'number' },
      },
    },
    async execute(args, sessionId) {
      const runner = require('../goals/runner');
      if (args.goal_id) {
        return runner.runGoal({ goalId: args.goal_id, sessionId, maxRounds: args.max_rounds });
      }
      if (args.title && args.success_criteria?.length) {
        return runner.runGoalFromText({
          title: args.title,
          description: args.description,
          successCriteria: args.success_criteria,
          sessionId,
          maxRounds: args.max_rounds,
        });
      }
      return { ok: false, error: 'Provide goal_id or title+success_criteria' };
    },
  },

  goal_list: {
    name: 'goal_list',
    description: 'List active or completed goals',
    parameters: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['active', 'completed', 'failed'] } },
    },
    async execute({ status }) {
      return { ok: true, goals: require('../goals/store').list(status) };
    },
  },

  integration_search: {
    name: 'integration_search',
    description: 'Search bundled GitHub integration repos manifest',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    async execute({ query }) {
      return require('../knowledge/structures').repoIndex(query);
    },
  },

  free_llm_providers: {
    name: 'free_llm_providers',
    description: 'List free LLM/API providers from cheahjs/free-llm-api-resources index',
    parameters: { type: 'object', properties: {} },
    async execute() {
      const index = require('../knowledge/free-llm-index.json');
      return { ok: true, providers: index.providers, source: index.source };
    },
  },

  task_list: {
    name: 'task_list',
    description: 'List recorded tasks that can be replayed offline',
    parameters: { type: 'object', properties: {} },
    async execute() {
      return { ok: true, tasks: require('../tasks/store').list() };
    },
  },

  task_record: {
    name: 'task_record',
    description: 'Manually record a named task with tool steps for offline replay',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        triggers: { type: 'array', items: { type: 'string' } },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tool: { type: 'string' },
              args: { type: 'object' },
            },
          },
        },
      },
      required: ['name', 'steps'],
    },
    async execute({ name, triggers, steps }) {
      const task = require('../tasks/store').create({ name, triggers, steps });
      return { ok: true, task };
    },
  },

  task_replay: {
    name: 'task_replay',
    description: 'Replay a recorded task by id or name (works offline)',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        name: { type: 'string' },
      },
    },
    async execute({ task_id, name }, sessionId) {
      const store = require('../tasks/store');
      const task = store.get(task_id || name);
      if (!task) return { ok: false, error: 'Task not found' };
      return require('../tasks/replay').replayTask(task, sessionId);
    },
  },

  task_delete: {
    name: 'task_delete',
    description: 'Delete a recorded task',
    parameters: {
      type: 'object',
      properties: { task_id: { type: 'string' } },
      required: ['task_id'],
    },
    async execute({ task_id }) {
      require('../tasks/store').remove(task_id);
      return { ok: true, deleted: task_id };
    },
  },

  local_status: {
    name: 'local_status',
    description: 'Check offline mode, connectivity, and local agent capabilities',
    parameters: { type: 'object', properties: {} },
    async execute() {
      const { isOnline, status } = require('../local/connectivity');
      const online = await isOnline(true);
      return {
        ok: true,
        online,
        connectivity: status(),
        ollama: require('../llm/ollama').isAvailable(),
        tasks: require('../tasks/store').list().length,
        llm: require('../llm').providerStatus(),
      };
    },
  },

  web_fetch: {
    name: 'web_fetch',
    description: 'Fetch a public HTTP URL (read-only)',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url'],
    },
    async execute({ url }) {
      if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'Only http(s) URLs allowed' };
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const text = await response.text();
      return { ok: true, status: response.status, body: text.slice(0, 8000) };
    },
  },

  shell: {
    name: 'shell',
    description:
      'Run shell command in workspace. SAFE: git status, npm test. NEEDS_APPROVAL: git push/commit, npm install. BLOCKED: secrets, rm -rf.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string' },
        approved: { type: 'boolean', description: 'Set true only after user explicitly approved risky command' },
      },
      required: ['command'],
    },
    async execute({ command, approved = false }) {
      const { canRunCommand } = require('../safety/policy');
      const check = canRunCommand(command, { approved, unsafeMode: config.shellUnsafe });
      if (!check.allowed) {
        return {
          ok: false,
          level: check.level,
          error: check.reason,
          hint: check.level === 'NEEDS_APPROVAL' ? 'Ask user to approve, then retry with approved:true' : undefined,
        };
      }
      const out = execSync(command, {
        cwd: config.workspaceRoot,
        encoding: 'utf8',
        timeout: 120000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { ok: true, level: check.level, output: out.slice(0, 8000) };
    },
  },

  write_file: {
    name: 'write_file',
    description: 'Write or update a text file in the workspace (for code/build tasks)',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
        approved: { type: 'boolean' },
      },
      required: ['path', 'content'],
    },
    async execute({ path: filePath, content, approved = false }) {
      if (/\.env$/i.test(filePath) && !approved) {
        return { ok: false, error: 'Writing .env requires approved:true after user consent' };
      }
      const full = safePath(filePath);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf8');
      return { ok: true, path: filePath, bytes: Buffer.byteLength(content, 'utf8') };
    },
  },

  crew_run: {
    name: 'crew_run',
    description: 'Multi-agent crew (researcher, engineer, operator, strategist, Paul) for complex tasks',
    parameters: {
      type: 'object',
      properties: { task: { type: 'string' }, context: { type: 'string' } },
      required: ['task'],
    },
    async execute({ task, context = '' }) {
      const { runCrew } = require('../core/crew');
      const result = await runCrew(task, context);
      return { ok: true, synthesis: result.synthesis, specialists: result.specialists.map((s) => s.name) };
    },
  },

  workflow_run: {
    name: 'workflow_run',
    description:
      'Run automated workflow: auto-picks agent/goal/crew mode. Use for "build website", "push to github", complex voice tasks.',
    parameters: {
      type: 'object',
      properties: {
        task: { type: 'string' },
        mode: { type: 'string', enum: ['auto', 'agent', 'goal', 'crew', 'task'] },
        speak: { type: 'boolean' },
        success_criteria: { type: 'array', items: { type: 'string' } },
      },
      required: ['task'],
    },
    async execute({ task, mode, speak, success_criteria }, sessionId) {
      const { runWorkflow } = require('../workflows/runner');
      return runWorkflow({
        task,
        sessionId,
        mode: mode || 'auto',
        speak: Boolean(speak),
        successCriteria: success_criteria,
      });
    },
  },

  codegraph_status: {
    name: 'codegraph_status',
    description: 'Check CodeGraph index status (files, nodes, edges)',
    parameters: { type: 'object', properties: {} },
    async execute() {
      return { ok: true, ...require('../brain/codegraph').status() };
    },
  },

  codegraph_search: {
    name: 'codegraph_search',
    description: 'Search codebase symbols via CodeGraph knowledge graph',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' }, limit: { type: 'number' } },
      required: ['query'],
    },
    async execute({ query, limit }) {
      const result = require('../brain/codegraph').search(query, limit || 10);
      return { ok: result.ok, output: result.output || result.error };
    },
  },

  codegraph_context: {
    name: 'codegraph_context',
    description: 'Get CodeGraph context for a task (entry points, callers, code snippets)',
    parameters: {
      type: 'object',
      properties: { task: { type: 'string' } },
      required: ['task'],
    },
    async execute({ task }) {
      const result = require('../brain/codegraph').context(task);
      return { ok: result.ok, output: result.output || result.error };
    },
  },

  codegraph_sync: {
    name: 'codegraph_sync',
    description: 'Re-sync CodeGraph index after code changes',
    parameters: { type: 'object', properties: {} },
    async execute() {
      const result = require('../brain/codegraph').syncIndex();
      return { ok: result.ok, output: result.output || result.error };
    },
  },

  tony_desktop_status: {
    name: 'tony_desktop_status',
    description: 'Status of original tony-ai Python desktop assistant integration',
    parameters: { type: 'object', properties: {} },
    async execute() {
      return { ok: true, ...require('../bridge/tony-desktop').status() };
    },
  },

  tony_desktop_command: {
    name: 'tony_desktop_command',
    description: 'Run a command via tony-ai AssistantBrain (local Python, free STT/TTS desktop)',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
    async execute({ text }) {
      return require('../bridge/tony-desktop').runTextCommand(text);
    },
  },
};

// SignalMint tools
let signalmintToken = null;

async function signalmintLogin() {
  if (signalmintToken) return signalmintToken;
  const { apiUrl, email, password } = config.signalmint;
  if (!email || !password) throw new Error('SIGNALMINT_EMAIL/PASSWORD not configured');
  const res = await fetch(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data.token) throw new Error('SignalMint login failed');
  signalmintToken = data.token;
  return signalmintToken;
}

async function signalmintApi(pathname, options = {}) {
  const token = await signalmintLogin();
  const res = await fetch(`${config.signalmint.apiUrl}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

builtins.signalmint_health = {
  name: 'signalmint_health',
  description: 'Check SignalMint API health',
  parameters: { type: 'object', properties: {} },
  async execute() {
    const res = await fetch(`${config.signalmint.apiUrl}/api/health`);
    const data = await res.json();
    return { ok: true, health: data };
  },
};

builtins.signalmint_workspace = {
  name: 'signalmint_workspace',
  description: 'Get SignalMint workspace usage summary',
  parameters: { type: 'object', properties: {} },
  async execute() {
    try {
      const data = await signalmintApi('/api/user/workspace');
      return { ok: true, workspace: data };
    } catch (e) {
      return { ok: false, error: e.message, hint: 'Start SignalMint API or set credentials' };
    }
  },
};

builtins.signalmint_conversations = {
  name: 'signalmint_conversations',
  description: 'List SMS conversations in SignalMint',
  parameters: { type: 'object', properties: {} },
  async execute() {
    const data = await signalmintApi('/api/conversations');
    return { ok: true, conversations: data };
  },
};

builtins.github_search = {
  name: 'github_search',
  description: 'Search GitHub repositories (requires GITHUB_TOKEN)',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },
  async execute({ query }) {
    if (!config.githubToken) {
      return { ok: false, error: 'GITHUB_TOKEN not set' };
    }
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=5`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.githubToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    const data = await res.json();
    return {
      ok: true,
      items: (data.items || []).map((i) => ({
        name: i.full_name,
        stars: i.stargazers_count,
        description: i.description,
        url: i.html_url,
      })),
    };
  },
};

function listTools() {
  return Object.values(builtins);
}

function getTool(name) {
  return builtins[name] || null;
}

async function executeTool(name, args, sessionId) {
  const tool = getTool(name);
  if (!tool) return { ok: false, error: `Unknown tool: ${name}` };
  try {
    const result = await tool.execute(args || {}, sessionId);
    memory.appendToolTrace(sessionId, name, args, JSON.stringify(result), result.ok !== false);
    return result;
  } catch (e) {
    memory.appendToolTrace(sessionId, name, args, e.message, false);
    return { ok: false, error: e.message };
  }
}

module.exports = { listTools, getTool, executeTool, builtins };
