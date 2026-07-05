/**
 * Local agent — works offline via task replay, memory, and graph tools.
 */
const memory = require('../memory');
const taskStore = require('../tasks/store');
const { replayTask, OFFLINE_TOOLS } = require('../tasks/replay');
const { executeTool } = require('../tools/registry');
const graphify = require('../brain/graphify');
const obsidian = require('../brain/obsidian');

const LOCAL_COMMANDS = [
  { pattern: /^list tasks?$/i, action: 'list_tasks' },
  { pattern: /^remember\s+(.+)/i, action: 'remember' },
  { pattern: /^search memory\s+(.+)/i, action: 'memory_search' },
  { pattern: /^graph\s+(.+)/i, action: 'graph_query' },
  { pattern: /^status$/i, action: 'status' },
];

async function handleLocalCommand(message, sessionId) {
  for (const cmd of LOCAL_COMMANDS) {
    const m = message.match(cmd.pattern);
    if (!m) continue;

    if (cmd.action === 'list_tasks') {
      const tasks = taskStore.list();
      const text =
        tasks.length === 0
          ? 'No recorded tasks. Complete a task online and say "remember this task as X" to record it.'
          : tasks
              .map(
                (t) =>
                  `- **${t.name}** (${t.id}): ${t.steps.length} steps, run ${t.runCount}x\n  Triggers: ${t.triggers.slice(0, 3).join(', ')}`
              )
              .join('\n');
      return finish(sessionId, message, text, 'local-command');
    }

    if (cmd.action === 'remember') {
      memory.remember(m[1], ['offline', 'user']);
      return finish(sessionId, message, `Remembered locally: ${m[1]}`, 'local-command');
    }

    if (cmd.action === 'memory_search') {
      const results = memory.searchAll(m[1], 8);
      return finish(sessionId, message, JSON.stringify(results, null, 2), 'local-command');
    }

    if (cmd.action === 'graph_query') {
      graphify.buildFromWorkspace();
      const q = graphify.query(m[1]);
      return finish(sessionId, message, JSON.stringify(q, null, 2), 'local-command');
    }

    if (cmd.action === 'status') {
      return finish(
        sessionId,
        message,
        `TONY Local Agent (offline mode)\n- Tasks recorded: ${taskStore.list().length}\n- Graph nodes: ${graphify.loadGraph().nodes.length}\n- Obsidian: ${obsidian.isConfigured() ? obsidian.listNotes().length + ' notes' : 'not configured'}\n- Offline tools: ${OFFLINE_TOOLS.size}`,
        'local-status'
      );
    }
  }
  return null;
}

function finish(sessionId, userMessage, response, mode) {
  memory.appendEpisode(sessionId, 'user', userMessage);
  memory.appendEpisode(sessionId, 'assistant', response);
  return { sessionId, response, mode, toolResults: [], iterations: 0, offline: true };
}

async function runLocalAgent({ sessionId, message }) {
  memory.appendEpisode(sessionId, 'user', message);

  const task = taskStore.findByTrigger(message);
  if (task) {
    return replayTask(task, sessionId);
  }

  const cmdResult = await handleLocalCommand(message, sessionId);
  if (cmdResult) return cmdResult;

  const context = [];
  const mem = memory.searchAll(message, 5);
  if (mem.semantic.length) context.push('Memory: ' + mem.semantic.map((f) => f.text).join('; '));

  graphify.buildFromWorkspace();
  const graph = graphify.query(message.split(/\s+/)[0] || 'task', 5);
  if (graph.nodes.length) {
    context.push('Graph: ' + graph.nodes.map((n) => n.label).join(', '));
  }

  if (obsidian.isConfigured()) {
    const notes = obsidian.searchNotes(message, 3);
    if (notes.hits?.length) context.push('Notes: ' + notes.hits.map((h) => h.path).join(', '));
  }

  const tasks = taskStore.list().slice(0, 5);
  const taskHint = tasks.length
    ? `\n\nRecorded tasks you can repeat:\n${tasks.map((t) => `- "repeat ${t.name}"`).join('\n')}`
    : '';

  const response = [
    '**TONY Local Mode** (offline — no cloud LLM).',
    context.length ? context.join('\n') : 'Searching local memory and graph only.',
    '',
    'Commands: `list tasks`, `remember <fact>`, `search memory <query>`, `graph <term>`, `status`',
    'To repeat a task: `repeat <task name>` or `run task <name>`',
    taskHint,
  ].join('\n');

  memory.appendEpisode(sessionId, 'assistant', response);
  return { sessionId, response, mode: 'local-fallback', toolResults: [], iterations: 0, offline: true };
}

module.exports = { runLocalAgent, handleLocalCommand };
