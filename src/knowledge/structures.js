/**
 * Multiple knowledge structures for research and reasoning.
 */

const graphify = require('../brain/graphify');
const obsidian = require('../brain/obsidian');
const mcp = require('../mcp');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const STRUCTURES = ['graph', 'tree', 'timeline', 'matrix', 'vault', 'web', 'repo'];

function asTree(nodes, edges) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, { ...n, children: [] }]));
  const roots = [];
  for (const e of edges) {
    if (byId[e.from] && byId[e.to]) byId[e.from].children.push(byId[e.to]);
  }
  const childIds = new Set(edges.map((e) => e.to));
  for (const n of nodes) {
    if (!childIds.has(n.id)) roots.push(byId[n.id]);
  }
  return { type: 'tree', roots };
}

function asTimeline(events) {
  return {
    type: 'timeline',
    events: [...events].sort((a, b) => (a.at || '').localeCompare(b.at || '')),
  };
}

function asMatrix(rows, cols, cells) {
  return { type: 'matrix', rows, cols, cells };
}

function repoIndex(query) {
  const manifestPath = path.join(config.workspaceRoot, 'integrations', 'manifest.json');
  if (!fs.existsSync(manifestPath)) return { type: 'repo', hits: [] };

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const q = query.toLowerCase();
  const hits = (manifest.repos || []).filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.tags?.some((t) => t.toLowerCase().includes(q))
  );
  return { type: 'repo', hits };
}

async function queryAll(term, options = {}) {
  const structures = options.structures || STRUCTURES;
  const out = { term, results: {} };

  if (structures.includes('graph')) {
    out.results.graph = graphify.query(term);
  }

  if (structures.includes('vault') && obsidian.isConfigured()) {
    out.results.vault = obsidian.searchNotes(term);
  }

  if (structures.includes('repo')) {
    out.results.repo = repoIndex(term);
  }

  if (structures.includes('web')) {
    out.results.web = await mcp.research(term, options.mcp || {});
  }

  if (structures.includes('tree') && out.results.graph) {
    out.results.tree = asTree(out.results.graph.nodes || [], out.results.graph.edges || []);
  }

  return out;
}

function formatForAgent(queryResult) {
  const parts = [];
  for (const [name, data] of Object.entries(queryResult.results || {})) {
    if (!data) continue;
    if (name === 'graph' && data.nodes?.length) {
      parts.push(`### Graph\n${data.nodes.map((n) => `- [${n.type}] ${n.label}`).join('\n')}`);
    }
    if (name === 'vault' && data.hits?.length) {
      parts.push(`### Obsidian\n${data.hits.map((h) => `- ${h.path}`).join('\n')}`);
    }
    if (name === 'repo' && data.hits?.length) {
      parts.push(`### Integration repos\n${data.hits.map((h) => `- ${h.name}: ${h.url}`).join('\n')}`);
    }
    if (name === 'web' && data.sources?.length) {
      parts.push(
        `### Web research\n${data.sources.map((s) => `- ${s.type}: ${(s.answer || JSON.stringify(s.results || '')).slice(0, 300)}`).join('\n')}`
      );
    }
  }
  return parts.join('\n\n');
}

module.exports = {
  STRUCTURES,
  asTree,
  asTimeline,
  asMatrix,
  repoIndex,
  queryAll,
  formatForAgent,
};
