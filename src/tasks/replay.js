const taskStore = require('./store');
const { executeTool } = require('../tools/registry');
const memory = require('../memory');

/** Tools that work without internet */
const OFFLINE_TOOLS = new Set([
  'read_file',
  'list_directory',
  'memory_search',
  'memory_remember',
  'list_skills',
  'graph_query',
  'graph_build',
  'obsidian_search',
  'obsidian_read',
  'knowledge_structures',
  'integration_search',
  'free_llm_providers',
  'goal_list',
  'task_list',
  'task_replay',
  'shell',
]);

async function replayTask(task, sessionId) {
  const results = [];
  const skipped = [];

  for (const step of task.steps || []) {
    if (!OFFLINE_TOOLS.has(step.tool)) {
      skipped.push({ tool: step.tool, reason: 'requires internet — skipped offline' });
      continue;
    }
    const result = await executeTool(step.tool, step.args || {}, sessionId);
    results.push({ tool: step.tool, args: step.args, result });
  }

  taskStore.incrementRun(task.id);

  const summary = results
    .map((r) => `${r.tool}: ${r.result.ok !== false ? 'OK' : r.result.error}`)
    .join('\n');

  const response = [
    `Replayed task **${task.name}** (${task.runCount + 1} runs total).`,
    summary,
    skipped.length ? `\nSkipped offline-incompatible steps:\n${skipped.map((s) => `- ${s.tool}`).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  memory.appendEpisode(sessionId, 'assistant', response);

  return {
    sessionId,
    response,
    mode: 'task-replay',
    task,
    toolResults: results,
    skipped,
    iterations: 0,
  };
}

function isOfflineCapable(task) {
  return (task.steps || []).every((s) => OFFLINE_TOOLS.has(s.tool));
}

module.exports = { replayTask, isOfflineCapable, OFFLINE_TOOLS };
