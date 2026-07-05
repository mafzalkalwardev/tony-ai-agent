const fs = require('fs');
const path = require('path');
const config = require('../config');

const GRAPH_PATH = path.join(config.dataDir, 'graphify.json');

function ensureGraph() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  if (!fs.existsSync(GRAPH_PATH)) {
    const initial = {
      version: '1.0.0',
      builtAt: null,
      nodes: [],
      edges: [],
    };
    fs.writeFileSync(GRAPH_PATH, JSON.stringify(initial, null, 2));
  }
}

function loadGraph() {
  ensureGraph();
  return JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8'));
}

function saveGraph(graph) {
  ensureGraph();
  fs.writeFileSync(GRAPH_PATH, JSON.stringify(graph, null, 2));
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function upsertNode(graph, node) {
  const idx = graph.nodes.findIndex((n) => n.id === node.id);
  if (idx >= 0) graph.nodes[idx] = { ...graph.nodes[idx], ...node };
  else graph.nodes.push(node);
}

function addEdge(graph, from, to, type = 'related') {
  const id = `${from}->${to}:${type}`;
  if (!graph.edges.some((e) => e.id === id)) {
    graph.edges.push({ id, from, to, type });
  }
}

function walkDir(dir, root, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      walkDir(full, root, files);
    } else if (entry.isFile() && /\.(js|md|json)$/i.test(entry.name)) {
      files.push(path.relative(root, full).replace(/\\/g, '/'));
    }
  }
  return files;
}

function buildFromWorkspace() {
  const graph = loadGraph();
  const root = config.workspaceRoot;

  graph.nodes = graph.nodes.filter((n) => n.source !== 'workspace');
  graph.edges = graph.edges.filter((e) => !e.id.startsWith('file:'));

  const files = walkDir(path.join(root, 'src'), root);
  const skills = walkDir(path.join(root, 'skills'), root);
  const allFiles = [...files, ...skills, 'TONY.md', 'README.md'].filter((f) => {
    try {
      return fs.existsSync(path.join(root, f));
    } catch {
      return false;
    }
  });

  for (const rel of allFiles) {
    const id = `file:${slug(rel)}`;
    upsertNode(graph, {
      id,
      label: rel,
      type: 'file',
      source: 'workspace',
    });

    try {
      const content = fs.readFileSync(path.join(root, rel), 'utf8');
      const requires = content.match(/require\(['"](\.\.?\/[^'"]+)['"]\)/g) || [];
      for (const req of requires) {
        const match = req.match(/require\(['"](\.\.?\/[^'"]+)['"]\)/);
        if (!match) continue;
        const resolved = path
          .relative(root, path.resolve(path.dirname(path.join(root, rel)), match[1]))
          .replace(/\\/g, '/');
        addEdge(graph, id, `file:${slug(resolved)}`, 'imports');
      }

      const wikilinks = content.match(/\[\[([^\]]+)\]\]/g) || [];
      for (const link of wikilinks) {
        const label = link.slice(2, -2);
        const noteId = `note:${slug(label)}`;
        upsertNode(graph, { id: noteId, label, type: 'concept', source: 'wikilink' });
        addEdge(graph, id, noteId, 'links');
      }
    } catch {
      // skip unreadable files
    }
  }

  graph.builtAt = new Date().toISOString();
  saveGraph(graph);
  return graph;
}

function query(term, limit = 12) {
  const graph = loadGraph();
  const q = term.toLowerCase();
  const nodes = graph.nodes.filter(
    (n) => n.label?.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)
  );
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = graph.edges.filter((e) => nodeIds.has(e.from) || nodeIds.has(e.to));

  return {
    term,
    nodes: nodes.slice(0, limit),
    edges: edges.slice(0, limit * 2),
    stats: { totalNodes: graph.nodes.length, totalEdges: graph.edges.length, builtAt: graph.builtAt },
  };
}

function getContextForAgent(term) {
  const result = query(term, 8);
  if (!result.nodes.length) return '';
  const lines = result.nodes.map((n) => `- [${n.type}] ${n.label}`);
  const edgeLines = result.edges.map((e) => `  ${e.from} --${e.type}--> ${e.to}`);
  return `Graph context for "${term}":\n${lines.join('\n')}\n${edgeLines.join('\n')}`;
}

function status() {
  const graph = loadGraph();
  return {
    path: GRAPH_PATH,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    builtAt: graph.builtAt,
  };
}

module.exports = { buildFromWorkspace, query, getContextForAgent, status, loadGraph };
