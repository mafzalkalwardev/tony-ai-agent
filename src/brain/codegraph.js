/**
 * CodeGraph CLI bridge — symbol search, context, impact analysis for the agent.
 * Requires: codegraph init && codegraph index (npm run codegraph:sync)
 */
const { execSync } = require('child_process');
const config = require('../config');

function runCodegraph(args, timeout = 30000) {
  const cmd = `codegraph ${args}`;
  try {
    const out = execSync(cmd, {
      cwd: config.workspaceRoot,
      encoding: 'utf8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });
    return { ok: true, output: out.trim() };
  } catch (e) {
    const stderr = e.stderr?.toString?.() || e.message || '';
    return { ok: false, error: stderr.slice(0, 2000) || 'codegraph command failed' };
  }
}

function status() {
  const result = runCodegraph('status');
  if (!result.ok) return { configured: false, error: result.error };
  const files = result.output.match(/Files:\s+(\d+)/)?.[1];
  const nodes = result.output.match(/Nodes:\s+(\d+)/)?.[1];
  return {
    configured: true,
    files: Number(files) || 0,
    nodes: Number(nodes) || 0,
    raw: result.output.slice(0, 1500),
  };
}

function search(query, limit = 10) {
  const q = String(query).replace(/"/g, '\\"');
  return runCodegraph(`query "${q}" --limit ${limit}`);
}

function context(task, maxNodes = 15) {
  const t = String(task).replace(/"/g, '\\"');
  return runCodegraph(`context "${t}" --max-nodes ${maxNodes}`);
}

function impact(symbol) {
  const s = String(symbol).replace(/"/g, '\\"');
  return runCodegraph(`query "${s}" --limit 20`);
}

function syncIndex() {
  return runCodegraph('sync', 120000);
}

module.exports = { status, search, context, impact, syncIndex, runCodegraph };
