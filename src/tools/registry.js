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
      const { logCommand } = require('./runners');
      const approvals = require('../safety/approvals');
      const rate = require('../safety/rate_limit').check('shell');
      if (!rate.allowed) {
        return { ok: false, level: 'RATE_LIMITED', error: rate.error, retryAfterMs: rate.retryAfterMs };
      }
      const check = canRunCommand(command, { approved, unsafeMode: config.shellUnsafe });
      if (!check.allowed) {
        let pending = null;
        if (check.level === 'NEEDS_APPROVAL') {
          pending = approvals.create({
            action: 'shell',
            command,
            reason: check.reason,
          });
        }
        return {
          ok: false,
          level: check.level,
          error: check.reason,
          pendingApprovalId: pending?.id,
          hint: check.level === 'NEEDS_APPROVAL' ? 'Ask user to approve, then retry with approved:true' : undefined,
        };
      }
      logCommand(command, { approved, level: check.level, tool: 'shell' });
      const out = execSync(command, {
        cwd: config.workspaceRoot,
        encoding: 'utf8',
        timeout: 120000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { ok: true, level: check.level, output: out.slice(0, 8000), rateRemaining: rate.remaining };
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
      const nextBytes = Buffer.byteLength(content, 'utf8');
      const LARGE_OVERWRITE = 200 * 1024; // 200 KB
      if (fs.existsSync(full)) {
        const currentBytes = fs.statSync(full).size;
        if (currentBytes >= LARGE_OVERWRITE && !approved) {
          const approvals = require('../safety/approvals');
          const pending = approvals.create({
            action: 'overwrite_large_file',
            command: `write_file ${filePath}`,
            reason: `Overwriting large file (${currentBytes} bytes) requires approval`,
          });
          return {
            ok: false,
            level: 'NEEDS_APPROVAL',
            needsApproval: true,
            pendingApprovalId: pending.id,
            error: `Large file overwrite blocked until approved (${currentBytes} bytes).`,
          };
        }
      }
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf8');
      return { ok: true, path: filePath, bytes: nextBytes };
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

  openwiki_search: {
    name: 'openwiki_search',
    description: 'Search OpenWiki repo documentation for coding context',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    async execute({ query }) {
      return require('../mcp/openwiki').search(query);
    },
  },

  openwiki_overview: {
    name: 'openwiki_overview',
    description: 'Get OpenWiki architecture overview / mermaid diagram for a project',
    parameters: {
      type: 'object',
      properties: { project: { type: 'string' } },
    },
    async execute({ project }) {
      return require('../mcp/openwiki').overview(project);
    },
  },

  scraper_media_scrape: {
    name: 'scraper_media_scrape',
    description: 'Scrape URL to LLM-optimized markdown via Scraper Media MCP (or Firecrawl fallback)',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        render_js: { type: 'boolean' },
        css_selector: { type: 'string' },
      },
      required: ['url'],
    },
    async execute({ url, render_js, css_selector }) {
      return require('../mcp/scraper-media').scrape(url, { render_js, css_selector });
    },
  },

  motiongraph_aesthetic: {
    name: 'motiongraph_aesthetic',
    description: 'Get motion graphics / HUD aesthetic parameters (Iron Man JARVIS style visuals)',
    parameters: {
      type: 'object',
      properties: {
        object: { type: 'string' },
        look: { type: 'string' },
        action: { type: 'string' },
      },
    },
    async execute({ object, look, action }) {
      return require('../mcp/motiongraph').mapAesthetic(object, look, action);
    },
  },

  obsidian_skill: {
    name: 'obsidian_skill',
    description: 'Load obsidian-skills spec (markdown, canvas, bases, CLI) from kepano/obsidian-skills',
    parameters: {
      type: 'object',
      properties: {
        skill: {
          type: 'string',
          enum: ['obsidian-markdown', 'obsidian-bases', 'json-canvas', 'obsidian-cli', 'defuddle'],
        },
      },
      required: ['skill'],
    },
    async execute({ skill }) {
      return require('../mcp/obsidian-skills').readSkill(skill);
    },
  },

  obsidian_create_canvas: {
    name: 'obsidian_create_canvas',
    description: 'Create JSON Canvas diagram in Obsidian vault (JARVIS neural graph)',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        nodes: { type: 'array' },
        edges: { type: 'array' },
      },
      required: ['title'],
    },
    async execute({ title, nodes, edges }) {
      return require('../mcp/obsidian-skills').createCanvas(title, nodes, edges);
    },
  },

  mcp_call: {
    name: 'mcp_call',
    description: 'Call any configured MCP server tool by URL (advanced)',
    parameters: {
      type: 'object',
      properties: {
        server: { type: 'string', enum: ['playwright', 'openwiki', 'scraper-media', 'motiongraph'] },
        tool: { type: 'string' },
        args: { type: 'object' },
      },
      required: ['server', 'tool'],
    },
    async execute({ server, tool, args = {} }) {
      const config = require('../config');
      const hub = require('../mcp/hub');
      const urls = {
        playwright: config.mcp.playwright.mcpUrl,
        openwiki: config.mcp.openwiki.mcpUrl,
        'scraper-media': config.mcp.scraperMedia.mcpUrl,
        motiongraph: config.mcp.motiongraph.mcpUrl,
      };
      return hub.callServer(urls[server], tool, args);
    },
  },

  fullstack_scaffold: {
    name: 'fullstack_scaffold',
    description:
      'Scaffold a full-stack app (React, Vue, Next, Express, Python FastAPI, etc.) — creates project structure via write_file',
    parameters: {
      type: 'object',
      properties: {
        stack: { type: 'string', description: 'e.g. nextjs, react-vite, vue, fastapi, django' },
        name: { type: 'string' },
        features: { type: 'array', items: { type: 'string' } },
      },
      required: ['stack', 'name'],
    },
    async execute({ stack, name, features = [] }, sessionId) {
      const paul = require('../agents/paul');
      const task = `Scaffold ${stack} project "${name}" with features: ${features.join(', ') || 'basic CRUD + auth'}. Polyglot production-ready code.`;
      return paul.build(task, sessionId, { constraints: 'Minimal deps, working npm/pip scripts, README' });
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

  desktop_automate: {
    name: 'desktop_automate',
    description:
      'Full laptop control via pyautogui — click, doubleclick, type, press, hotkey, scroll, drag, move, screenshot, multi-step sequence. Use for realtime desktop takeover.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'click',
            'doubleclick',
            'type',
            'press',
            'hotkey',
            'screenshot',
            'move',
            'position',
            'scroll',
            'drag',
            'sequence',
          ],
        },
        x: { type: 'number' },
        y: { type: 'number' },
        x2: { type: 'number' },
        y2: { type: 'number' },
        text: { type: 'string' },
        key: { type: 'string' },
        keys: { type: 'array', items: { type: 'string' } },
        clicks: { type: 'number' },
        duration: { type: 'number' },
        steps: { type: 'array', items: { type: 'object' } },
        approved: { type: 'boolean' },
      },
      required: ['action'],
    },
    async execute(payload) {
      const automation = require('../bridge/automation');
      const cfg = require('../config');
      if (!cfg.automation?.enabled) {
        return { ok: false, error: 'Desktop automation disabled — set TONY_AUTOMATION_ENABLED=true' };
      }
      const trusted = require('../safety/trusted_mode');
      if (
        !payload.approved &&
        !trusted.canAutoApprove('desktop_automate', payload.action) &&
        ['click', 'type', 'hotkey', 'press', 'drag', 'sequence'].includes(payload.action)
      ) {
        const pending = require('../safety/approvals').create({
          action: 'desktop_automate',
          command: payload.action,
          reason: 'Desktop control requires approval or Trusted Operator Mode',
        });
        return {
          ok: false,
          needsApproval: true,
          pendingApprovalId: pending.id,
          error: 'Approve desktop control or say: Tony trusted mode on',
        };
      }
      return automation.run(payload);
    },
  },

  presentation_create: {
    name: 'presentation_create',
    description:
      'Create a PowerPoint .pptx presentation from title and slides (realtime laptop task). Saves to data/presentations/. Open with desktop_automate or tell user the path.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Presentation title' },
        slides: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              bullets: { type: 'array', items: { type: 'string' } },
            },
          },
          description: 'Slide list with title and bullet points',
        },
      },
      required: ['title'],
    },
    async execute({ title, slides }) {
      const presentation = require('../bridge/presentation');
      return presentation.create({ title, slides });
    },
  },

  user_profile_get: {
    name: 'user_profile_get',
    description: 'Read personal profile TONY builds about the user — name, movies, novels, facts, preferences',
    parameters: { type: 'object', properties: {} },
    async execute() {
      const profile = require('../memory/profile');
      return { ok: true, profile: profile.load(), formatted: profile.formatForAgent() };
    },
  },

  user_profile_update: {
    name: 'user_profile_update',
    description: 'Update user profile — name, interests, favorite movies/novels, personality notes, facts',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        nicknames: { type: 'array', items: { type: 'string' } },
        interests: { type: 'array', items: { type: 'string' } },
        favoriteMovies: { type: 'array', items: { type: 'string' } },
        favoriteNovels: { type: 'array', items: { type: 'string' } },
        personalityNotes: { type: 'array', items: { type: 'string' } },
        fact: { type: 'string' },
      },
    },
    async execute({ fact, ...partial }) {
      const profile = require('../memory/profile');
      if (fact) profile.addFact(fact, ['agent']);
      const updated = profile.update(partial);
      return { ok: true, profile: updated };
    },
  },

  error_log: {
    name: 'error_log',
    description: 'List recent errors TONY learned from and their fixes',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' }, limit: { type: 'number' } },
    },
    async execute({ query, limit }) {
      const errors = require('../memory/errors');
      const lessons = query ? errors.search(query, limit || 10) : errors.recent(limit || 15);
      return { ok: true, lessons, formatted: errors.formatForAgent(lessons) };
    },
  },

  error_learn: {
    name: 'error_learn',
    description: 'Record a mistake and the fix that worked — TONY remembers for next time',
    parameters: {
      type: 'object',
      properties: {
        tool: { type: 'string' },
        error: { type: 'string' },
        fix: { type: 'string' },
        context: { type: 'string' },
      },
      required: ['error', 'fix'],
    },
    async execute({ tool, error, fix, context }, sessionId) {
      const lesson = require('../memory/errors').record({
        tool: tool || 'agent',
        error,
        fix,
        context: context || '',
        sessionId,
        outcome: 'resolved',
      });
      return { ok: true, lesson, message: 'Fix saved — TONY will apply this when similar errors occur' };
    },
  },

  companion_wake: {
    name: 'companion_wake',
    description: 'Wake up TONY — time-based greeting, praise, work done/remaining, persona mode',
    parameters: {
      type: 'object',
      properties: { message: { type: 'string' } },
    },
    async execute({ message }, sessionId) {
      return require('../companion/wake').generateWakeResponse({
        sessionId,
        message: message || 'Wake up Tony',
      });
    },
  },

  habit_summary: {
    name: 'habit_summary',
    description: 'Show habits TONY learned automatically (wake times, topics, moods)',
    parameters: { type: 'object', properties: {} },
    async execute() {
      const habits = require('../companion/habits');
      return { ok: true, ...habits.summary(), formatted: habits.formatForAgent() };
    },
  },

  self_heal: {
    name: 'self_heal',
    description: 'Analyze last tool failure and attempt automatic fix/retry',
    parameters: {
      type: 'object',
      properties: {
        tool: { type: 'string' },
        error: { type: 'string' },
        message: { type: 'string' },
      },
      required: ['tool', 'error'],
    },
    async execute({ tool, error, message }, sessionId) {
      const { attemptSelfHeal } = require('../core/reflexion');
      return attemptSelfHeal({
        message: message || 'self-heal request',
        tool,
        args: {},
        result: { ok: false, error },
        sessionId,
      });
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

builtins.project_scan = {
  name: 'project_scan',
  description: 'Scan the workspace: file tree, package.json/requirements, README, tests folder, detected test/build commands',
  parameters: {
    type: 'object',
    properties: { path: { type: 'string', description: 'Relative project path', default: '.' } },
  },
  async execute({ path: projectPath = '.' } = {}) {
    const scanner = require('./project_scanner');
    const result = scanner.scan(projectPath);
    return { ok: true, ...result, text: scanner.scanAsText(projectPath) };
  },
};

builtins.run_tests = {
  name: 'run_tests',
  description: 'Run detected project tests (npm test / pytest). Requires approval unless already approved.',
  parameters: {
    type: 'object',
    properties: {
      approved: { type: 'boolean' },
      path: { type: 'string', default: '.' },
    },
  },
  async execute({ approved = false, path: projectPath = '.' } = {}) {
    return require('./runners').runTests({ approved, projectPath });
  },
};

builtins.build_project = {
  name: 'build_project',
  description: 'Run detected safe build command (e.g. npm run build). Always needs approval.',
  parameters: {
    type: 'object',
    properties: {
      approved: { type: 'boolean' },
      path: { type: 'string', default: '.' },
    },
  },
  async execute({ approved = false, path: projectPath = '.' } = {}) {
    return require('./runners').runBuild({ approved, projectPath });
  },
};

builtins.client_delivery = {
  name: 'client_delivery',
  description:
    'Prepare a professional client delivery package (summary, setup, testing checklist, message draft). Does NOT send messages.',
  parameters: {
    type: 'object',
    properties: {
      completedWork: { type: 'string' },
      limitations: { type: 'string' },
      path: { type: 'string', default: '.' },
    },
  },
  async execute({ completedWork = '', limitations = '', path: projectPath = '.' } = {}) {
    return require('./delivery_helper').prepareDeliveryPackage({
      projectPath,
      completedWork,
      limitations,
    });
  },
};

builtins.intent_route = {
  name: 'intent_route',
  description: 'Classify a user command into TONY intent categories (Roman Urdu / English / Hindi supported)',
  parameters: {
    type: 'object',
    properties: { message: { type: 'string' } },
    required: ['message'],
  },
  async execute({ message }) {
    const routed = require('../core/intent_router').route(message);
    return { ok: true, ...routed };
  },
};

builtins.clipboard = {
  name: 'clipboard',
  description:
    'Read or write clipboard text for copy/paste commands (Roman Urdu: "Tony ye copy karo"). Uses OS clipboard when available.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to copy; omit to read clipboard' },
      mode: { type: 'string', enum: ['auto', 'read', 'write'], default: 'auto' },
    },
  },
  async execute({ text = '', mode = 'auto' } = {}) {
    return require('./clipboard_tool').copyPaste({ text, mode });
  },
};

builtins.search_web = {
  name: 'search_web',
  description: 'Search the web (opens DuckDuckGo). Use for "browser mein search karo …"',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      open: { type: 'boolean', default: true },
      approved: { type: 'boolean' },
    },
    required: ['query'],
  },
  async execute({ query, open = true, approved = false } = {}) {
    const trusted = require('../safety/trusted_mode');
    if (!approved && !trusted.canAutoApprove('search_web', query)) {
      const pending = require('../safety/approvals').create({
        action: 'search_web',
        command: query,
        reason: 'Opening external browser search requires approval',
      });
      return {
        ok: false,
        level: 'NEEDS_APPROVAL',
        needsApproval: true,
        pendingApprovalId: pending.id,
        error: 'Approve browser search first (yes/haan), or enable Trusted Operator Mode.',
        previewUrl: require('./web_search').buildSearchUrl(query),
      };
    }
    return require('./web_search').searchWeb(query, { open });
  },
};

builtins.open_app = {
  name: 'open_app',
  description: 'Open a common local app (vscode, terminal, chrome, browser, notepad, explorer, calculator)',
  parameters: {
    type: 'object',
    properties: { app: { type: 'string' } },
    required: ['app'],
  },
  async execute({ app }) {
    return require('./open_app').openApp(app);
  },
};

builtins.summarize_repo = {
  name: 'summarize_repo',
  description: 'Summarize local git repository state (branch, status, recent commits). Safe/read-only.',
  parameters: { type: 'object', properties: {} },
  async execute() {
    return require('./github_helper').summarizeRepo();
  },
};

builtins.explain_changes = {
  name: 'explain_changes',
  description: 'Explain changed/untracked files before commit or PR',
  parameters: { type: 'object', properties: {} },
  async execute() {
    return require('./github_helper').explainChangedFiles();
  },
};

builtins.commit_message = {
  name: 'commit_message',
  description: 'Draft a commit message from local changes (does not commit)',
  parameters: {
    type: 'object',
    properties: { topic: { type: 'string' } },
  },
  async execute({ topic = '' } = {}) {
    return require('./github_helper').generateCommitMessage(topic);
  },
};

builtins.prepare_pr = {
  name: 'prepare_pr',
  description: 'Prepare push/PR instructions and checklist (does not push)',
  parameters: {
    type: 'object',
    properties: { topic: { type: 'string' } },
  },
  async execute({ topic = '' } = {}) {
    return require('./github_helper').preparePrInstructions(topic);
  },
};

builtins.preferences_get = {
  name: 'preferences_get',
  description: 'Read local operator preferences (no secrets)',
  parameters: { type: 'object', properties: {} },
  async execute() {
    return { ok: true, preferences: require('./preferences').load() };
  },
};

builtins.preferences_update = {
  name: 'preferences_update',
  description: 'Update local operator preferences (rejects secret-like values)',
  parameters: {
    type: 'object',
    properties: {
      userName: { type: 'string' },
      language: { type: 'string' },
      projectNote: { type: 'string' },
      alwaysAllowNpmTest: { type: 'boolean' },
    },
  },
  async execute(args = {}) {
    const prefs = require('./preferences');
    if (args.projectNote) return { ok: true, preferences: prefs.addProjectNote(args.projectNote) };
    const patch = {};
    if (args.userName) patch.userName = args.userName;
    if (args.language) patch.language = args.language;
    if (typeof args.alwaysAllowNpmTest === 'boolean') {
      patch.safety = { alwaysAllowNpmTest: args.alwaysAllowNpmTest };
    }
    return { ok: true, preferences: prefs.save(patch) };
  },
};

builtins.export_delivery = {
  name: 'export_delivery',
  description: 'Generate and save a client delivery markdown file under data/reports (does not send)',
  parameters: {
    type: 'object',
    properties: {
      completedWork: { type: 'string' },
      limitations: { type: 'string' },
    },
  },
  async execute({ completedWork = '', limitations = '' } = {}) {
    const pack = require('./delivery_helper').prepareDeliveryPackage({
      projectPath: '.',
      completedWork,
      limitations,
    });
    const outDir = path.join(config.dataDir, 'reports');
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(outDir, `delivery_${stamp}.md`);
    fs.writeFileSync(file, pack.markdown, 'utf8');
    return { ...pack, savedPath: path.relative(config.workspaceRoot, file) };
  },
};

builtins.local_stt_status = {
  name: 'local_stt_status',
  description: 'Show optional faster-whisper local STT bridge status',
  parameters: { type: 'object', properties: {} },
  async execute() {
    return { ok: true, ...require('../voice/local_stt').status() };
  },
};

builtins.trusted_mode = {
  name: 'trusted_mode',
  description:
    'Enable/disable Trusted Operator Mode. When ON, TONY auto-approves research, desktop control, installs, builds, git write — hard blocks (secrets/rm -rf/payments/deceptive deepfakes) remain. Memorial voice still needs consent.',
  parameters: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean' },
      action: { type: 'string', enum: ['status', 'on', 'off'] },
    },
  },
  async execute({ enabled, action = 'status' } = {}) {
    const trusted = require('../safety/trusted_mode');
    if (action === 'on' || enabled === true) return { ok: true, ...trusted.enable({ by: 'tool' }) };
    if (action === 'off' || enabled === false) return { ok: true, ...trusted.disable() };
    return { ok: true, ...trusted.status() };
  },
};

builtins.research_web = {
  name: 'research_web',
  description:
    'Full-web research on any topic: multi-engine links + fetch public pages. Can open browser. Use for deep research across any websites.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      urls: { type: 'array', items: { type: 'string' } },
      openBrowser: { type: 'boolean' },
    },
    required: ['query'],
  },
  async execute({ query, urls = [], openBrowser } = {}) {
    const trusted = require('../safety/trusted_mode');
    const cfg = require('../config');
    const open = openBrowser ?? (trusted.isEnabled() || cfg.research?.openBrowserOnResearch);
    if (!trusted.canAutoApprove('research_web', query) && !trusted.isEnabled()) {
      const pending = require('../safety/approvals').create({
        action: 'research_web',
        command: query,
        reason: 'Broad web research/browser open — approve or enable trusted mode',
      });
      return {
        ok: false,
        needsApproval: true,
        pendingApprovalId: pending.id,
        preview: require('./web_search').buildSearchUrl(query),
        error: 'Approve research or say: Tony trusted mode on',
      };
    }
    return require('./research_web').researchTopic(query, { openBrowser: open, urls });
  },
};

builtins.browse_site = {
  name: 'browse_site',
  description: 'Open and/or fetch ANY public http(s) website for research',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      open: { type: 'boolean', default: true },
      approved: { type: 'boolean' },
    },
    required: ['url'],
  },
  async execute({ url, open = true, approved = false } = {}) {
    const trusted = require('../safety/trusted_mode');
    if (!approved && !trusted.canAutoApprove('browse_site', url)) {
      const pending = require('../safety/approvals').create({
        action: 'browse_site',
        command: url,
        reason: 'Opening external site requires approval or trusted mode',
      });
      return { ok: false, needsApproval: true, pendingApprovalId: pending.id, error: pending.reason };
    }
    return require('./research_web').browseSite(url, { open });
  },
};

builtins.decide_action = {
  name: 'decide_action',
  description:
    'Analyze a big/risky decision. In Trusted Mode, recommends and authorizes proceeding. Otherwise creates approval.',
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      intent: { type: 'string' },
    },
    required: ['message'],
  },
  async execute({ message, intent = 'unknown' }, sessionId) {
    const engine = require('../core/decision_engine');
    return engine.decideAndMaybeExecute({
      message,
      intent: { intent },
      sessionId,
    });
  },
};

builtins.laptop_control = {
  name: 'laptop_control',
  description:
    'High-level laptop takeover helper: screenshot, open app, type text, hotkey chord, or run a step sequence.',
  parameters: {
    type: 'object',
    properties: {
      goal: { type: 'string' },
      steps: { type: 'array', items: { type: 'object' } },
      approved: { type: 'boolean' },
    },
    required: ['goal'],
  },
  async execute({ goal, steps = [], approved = false } = {}) {
    const trusted = require('../safety/trusted_mode');
    if (!approved && !trusted.canAutoApprove('laptop_control', goal)) {
      const pending = require('../safety/approvals').create({
        action: 'laptop_control',
        command: goal,
        reason: 'Laptop takeover requires approval or Trusted Operator Mode',
      });
      return { ok: false, needsApproval: true, pendingApprovalId: pending.id, error: pending.reason };
    }
    const automation = require('../bridge/automation');
    if (!steps.length) {
      const shot = automation.run({ action: 'screenshot' });
      return {
        ok: true,
        goal,
        note: 'No steps provided — captured screenshot. Provide steps for click/type/hotkey sequence.',
        screenshot: shot,
      };
    }
    return automation.run({ action: 'sequence', steps });
  },
};

builtins.browser_operator = {
  name: 'browser_operator',
  description:
    'Always-on browser operator via Playwright MCP — navigate, snapshot, click, type on any public site. Start with npm run playwright:mcp.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['status', 'navigate', 'snapshot', 'click', 'type', 'research'],
      },
      url: { type: 'string' },
      ref: { type: 'string' },
      text: { type: 'string' },
      approved: { type: 'boolean' },
    },
    required: ['action'],
  },
  async execute({ action, url, ref, text, approved = false } = {}) {
    const trusted = require('../safety/trusted_mode');
    const op = require('./browser_operator');
    if (action === 'status') return { ok: true, ...op.status(), ready: await op.ensureReady() };
    if (!approved && !trusted.canAutoApprove('browser_operator', action)) {
      const pending = require('../safety/approvals').create({
        action: 'browser_operator',
        command: `${action} ${url || ref || ''}`.trim(),
        reason: 'Browser operator requires approval or Trusted Mode',
      });
      return { ok: false, needsApproval: true, pendingApprovalId: pending.id, error: pending.reason };
    }
    if (action === 'navigate') return op.navigate(url);
    if (action === 'snapshot') return op.snapshot(url);
    if (action === 'click') return op.click(ref);
    if (action === 'type') return op.type(ref, text);
    if (action === 'research') return op.researchAndSnapshot(url);
    return { ok: false, error: `Unknown action: ${action}` };
  },
};

builtins.create_issue = {
  name: 'create_issue',
  description: 'Create a GitHub issue via gh CLI (requires approval or Trusted Mode)',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      body: { type: 'string' },
      approved: { type: 'boolean' },
    },
    required: ['title'],
  },
  async execute({ title, body = '', approved = false } = {}) {
    const trusted = require('../safety/trusted_mode');
    if (!approved && !trusted.canAutoApprove('create_issue', title)) {
      const pending = require('../safety/approvals').create({
        action: 'create_issue',
        command: title,
        reason: 'Creating GitHub issues requires approval or Trusted Mode',
      });
      return { ok: false, needsApproval: true, pendingApprovalId: pending.id, error: pending.reason };
    }
    return require('./github_helper').createIssue({ title, body });
  },
};

builtins.create_pr = {
  name: 'create_pr',
  description: 'Create a GitHub pull request via gh CLI (requires approval or Trusted Mode)',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      body: { type: 'string' },
      base: { type: 'string', default: 'master' },
      draft: { type: 'boolean' },
      approved: { type: 'boolean' },
    },
  },
  async execute({ title, body = '', base = 'master', draft = false, approved = false } = {}) {
    const trusted = require('../safety/trusted_mode');
    if (!approved && !trusted.canAutoApprove('create_pr', title || 'pr')) {
      const pending = require('../safety/approvals').create({
        action: 'create_pr',
        command: title || 'create pr',
        reason: 'Creating GitHub PRs requires approval or Trusted Mode',
      });
      return { ok: false, needsApproval: true, pendingApprovalId: pending.id, error: pending.reason };
    }
    return require('./github_helper').createPullRequest({ title, body, base, draft });
  },
};

builtins.telegram_status = {
  name: 'telegram_status',
  description: 'Show Telegram remote channel status',
  parameters: { type: 'object', properties: {} },
  async execute() {
    return { ok: true, ...require('../channels/telegram').status() };
  },
};

builtins.telegram_send = {
  name: 'telegram_send',
  description: 'Send a message to the configured Telegram chat (approval/trusted for outbound)',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      approved: { type: 'boolean' },
    },
    required: ['text'],
  },
  async execute({ text, approved = false } = {}) {
    const trusted = require('../safety/trusted_mode');
    const rate = require('../safety/rate_limit').check('telegram_send');
    if (!rate.allowed) return { ok: false, error: rate.error, retryAfterMs: rate.retryAfterMs };
    if (!approved && !trusted.canAutoApprove('send_message', text)) {
      const pending = require('../safety/approvals').create({
        action: 'telegram_send',
        command: text.slice(0, 120),
        reason: 'Outbound Telegram message requires approval',
      });
      return { ok: false, needsApproval: true, pendingApprovalId: pending.id, error: pending.reason };
    }
    return require('../channels/telegram').sendMessage(text);
  },
};

builtins.discord_status = {
  name: 'discord_status',
  description: 'Show Discord remote channel status',
  parameters: { type: 'object', properties: {} },
  async execute() {
    return { ok: true, ...require('../channels/discord').status() };
  },
};

builtins.discord_send = {
  name: 'discord_send',
  description: 'Send a message via Discord webhook (approval/trusted for outbound)',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      approved: { type: 'boolean' },
    },
    required: ['text'],
  },
  async execute({ text, approved = false } = {}) {
    const trusted = require('../safety/trusted_mode');
    const rate = require('../safety/rate_limit').check('discord_send');
    if (!rate.allowed) return { ok: false, error: rate.error, retryAfterMs: rate.retryAfterMs };
    if (!approved && !trusted.canAutoApprove('send_message', text)) {
      const pending = require('../safety/approvals').create({
        action: 'discord_send',
        command: text.slice(0, 120),
        reason: 'Outbound Discord message requires approval',
      });
      return { ok: false, needsApproval: true, pendingApprovalId: pending.id, error: pending.reason };
    }
    return require('../channels/discord').sendMessage(text);
  },
};

builtins.workspace_list = {
  name: 'workspace_list',
  description: 'List registered multi-repo workspaces and the active root',
  parameters: { type: 'object', properties: {} },
  async execute() {
    return require('./workspaces').list();
  },
};

builtins.workspace_add = {
  name: 'workspace_add',
  description: 'Register another local repo path as a TONY workspace',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      path: { type: 'string' },
    },
    required: ['name', 'path'],
  },
  async execute({ name, path: repoPath }) {
    return require('./workspaces').addWorkspace({ name, path: repoPath });
  },
};

builtins.workspace_switch = {
  name: 'workspace_switch',
  description: 'Switch TONY active workspace root by id or name',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  async execute({ id }) {
    return require('./workspaces').switchWorkspace(id);
  },
};

builtins.reminder_add = {
  name: 'reminder_add',
  description: 'Create a local reminder (minutesFromNow or dueAt ISO)',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      minutesFromNow: { type: 'number' },
      dueAt: { type: 'string' },
    },
    required: ['text'],
  },
  async execute(args = {}) {
    return require('./reminders').addReminder(args);
  },
};

builtins.reminder_list = {
  name: 'reminder_list',
  description: 'List open local reminders',
  parameters: { type: 'object', properties: { includeDone: { type: 'boolean' } } },
  async execute({ includeDone = false } = {}) {
    return { ok: true, reminders: require('./reminders').list({ includeDone }) };
  },
};

builtins.reminder_complete = {
  name: 'reminder_complete',
  description: 'Mark a reminder done by id',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  async execute({ id }) {
    return require('./reminders').completeReminder(id);
  },
};

builtins.daily_briefing = {
  name: 'daily_briefing',
  description: 'Generate morning/afternoon operator briefing (repo + reminders + trusted mode)',
  parameters: { type: 'object', properties: {} },
  async execute() {
    return require('./reminders').dailyBriefing();
  },
};

builtins.vault_watch_status = {
  name: 'vault_watch_status',
  description: 'Show Obsidian vault live-watcher status and recent note events',
  parameters: { type: 'object', properties: {} },
  async execute() {
    return { ok: true, ...require('../brain/vault_watcher').status() };
  },
};

builtins.vault_watch_start = {
  name: 'vault_watch_start',
  description: 'Start live Obsidian vault watcher',
  parameters: { type: 'object', properties: {} },
  async execute() {
    return require('../brain/vault_watcher').start();
  },
};

builtins.vault_sync_index = {
  name: 'vault_sync_index',
  description: 'Write vault watch log + refresh agentic brain index snapshot',
  parameters: { type: 'object', properties: {} },
  async execute() {
    return require('../brain/vault_watcher').syncIndex();
  },
};

builtins.prefs_vault_seal = {
  name: 'prefs_vault_seal',
  description: 'Seal live preferences into encrypted vault (requires TONY_PREFS_SECRET)',
  parameters: { type: 'object', properties: {} },
  async execute() {
    return require('./pref_vault').sealFromLivePrefs();
  },
};

builtins.prefs_vault_open = {
  name: 'prefs_vault_open',
  description: 'Open encrypted preference vault and restore into live prefs',
  parameters: { type: 'object', properties: {} },
  async execute() {
    return require('./pref_vault').restoreIntoLivePrefs();
  },
};

builtins.generate_skill = {
  name: 'generate_skill',
  description: 'Draft a SKILL.md from successful procedural playbooks (optionally write to skills/)',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      query: { type: 'string' },
      write: { type: 'boolean' },
    },
  },
  async execute({ name, query, write = false } = {}) {
    return require('../skills/generate').draftFromPlaybooks({ name, query, write });
  },
};

builtins.tony_mcp_status = {
  name: 'tony_mcp_status',
  description: 'Show TONY MCP tool-server status for Cursor integration',
  parameters: { type: 'object', properties: {} },
  async execute() {
    return { ok: true, ...require('../mcp/tony-server').status() };
  },
};

builtins.memory_reindex = {
  name: 'memory_reindex',
  description: 'Rebuild local vector embeddings index from semantic facts',
  parameters: { type: 'object', properties: {} },
  async execute() {
    return require('../memory/semantic').reindexAll();
  },
};

builtins.memory_vector_search = {
  name: 'memory_vector_search',
  description: 'Semantic vector search over local embeddings index',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'number' },
    },
    required: ['query'],
  },
  async execute({ query, limit = 8 }) {
    return { ok: true, hits: require('../memory/embeddings').search(query, limit) };
  },
};

builtins.client_list = {
  name: 'client_list',
  description: 'List tracked clients/contacts (local JSON, no secrets)',
  parameters: { type: 'object', properties: {} },
  async execute() {
    return require('./clients').list();
  },
};

builtins.client_upsert = {
  name: 'client_upsert',
  description: 'Add/update a client record with optional note',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      company: { type: 'string' },
      notes: { type: 'string' },
      status: { type: 'string' },
    },
    required: ['name'],
  },
  async execute(args = {}) {
    return require('./clients').upsertClient(args);
  },
};

builtins.macro_list = {
  name: 'macro_list',
  description: 'List saved operator macros/shortcuts',
  parameters: { type: 'object', properties: {} },
  async execute() {
    return require('./macros').list();
  },
};

builtins.macro_save = {
  name: 'macro_save',
  description: 'Save an operator macro shortcut (name → command text)',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      command: { type: 'string' },
    },
    required: ['name', 'command'],
  },
  async execute({ name, command }) {
    return require('./macros').saveMacro({ name, command });
  },
};

builtins.export_session = {
  name: 'export_session',
  description: 'Export a chat session transcript to data/reports',
  parameters: {
    type: 'object',
    properties: {
      sessionId: { type: 'string' },
      limit: { type: 'number' },
    },
    required: ['sessionId'],
  },
  async execute({ sessionId, limit = 100 }) {
    return require('./session_export').exportSession(sessionId, { limit });
  },
};

builtins.memorial_voice_register = {
  name: 'memorial_voice_register',
  description:
    'Register a MEMORIAL voice for a loved one (often deceased) with explicit consent. Requires consent phrase, rights affirmation, personal-use-only, and local audio samples. Not for scams or deceiving third parties.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      relationship: { type: 'string' },
      personStatus: { type: 'string', enum: ['deceased', 'living'] },
      samplePaths: { type: 'array', items: { type: 'string' } },
      hasRights: { type: 'boolean' },
      personalMemorialOnly: { type: 'boolean' },
      notForDeception: { type: 'boolean' },
      livingPermission: { type: 'boolean' },
      consentText: { type: 'string', description: 'Must include: I consent to memorial voice for <Name>' },
    },
    required: ['name', 'relationship', 'samplePaths', 'consentText'],
  },
  async execute(args = {}) {
    if (!require('../config').memorialVoice?.enabled) {
      return { ok: false, error: 'Memorial voice disabled in config' };
    }
    return require('../voice/memorial_voice').registerMemorialVoice(args);
  },
};

builtins.memorial_voice_clone = {
  name: 'memorial_voice_clone',
  description: 'Create ElevenLabs Instant Voice Clone for a consented memorial voice profile',
  parameters: {
    type: 'object',
    properties: { name: { type: 'string' } },
    required: ['name'],
  },
  async execute({ name }) {
    return require('../voice/memorial_voice').cloneMemorialVoice(name);
  },
};

builtins.memorial_voice_speak = {
  name: 'memorial_voice_speak',
  description: 'Speak text using a consented memorial voice (always labeled as synthetic remembrance)',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      text: { type: 'string' },
    },
    required: ['name', 'text'],
  },
  async execute({ name, text }) {
    return require('../voice/memorial_voice').speakMemorial(name, text);
  },
};

builtins.memorial_voice_list = {
  name: 'memorial_voice_list',
  description: 'List consented memorial voices (no raw audio paths exposed beyond counts)',
  parameters: { type: 'object', properties: {} },
  async execute() {
    const memorial = require('../voice/memorial_voice');
    return { ok: true, voices: memorial.listVoices(), status: memorial.status() };
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
