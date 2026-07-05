const fs = require('fs');
const path = require('path');
const config = require('../config');

function vaultPath() {
  return config.obsidian.vaultPath;
}

function isConfigured() {
  return Boolean(vaultPath() && fs.existsSync(vaultPath()));
}

function listNotes(limit = 50) {
  if (!isConfigured()) return [];
  const notes = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) notes.push(full);
    }
  }

  walk(vaultPath());
  return notes.slice(0, limit);
}

function readNote(relativeOrName) {
  if (!isConfigured()) return { ok: false, error: 'Obsidian vault not configured or missing' };

  const candidates = listNotes(500);
  const match = candidates.find((p) => {
    const rel = path.relative(vaultPath(), p).replace(/\\/g, '/');
    const base = path.basename(p, '.md');
    return rel === relativeOrName || base.toLowerCase() === relativeOrName.toLowerCase();
  });

  if (!match) return { ok: false, error: `Note not found: ${relativeOrName}` };

  const content = fs.readFileSync(match, 'utf8');
  const links = [...content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)].map((m) => m[1]);
  const tags = [...content.matchAll(/#([a-zA-Z0-9_/-]+)/g)].map((m) => m[1]);

  return {
    ok: true,
    path: path.relative(vaultPath(), match).replace(/\\/g, '/'),
    content: content.slice(0, 12000),
    links,
    tags,
  };
}

function searchNotes(query, limit = 10) {
  if (!isConfigured()) return { ok: false, error: 'Obsidian vault not configured', hits: [] };

  const q = query.toLowerCase();
  const hits = [];

  for (const notePath of listNotes(500)) {
    const rel = path.relative(vaultPath(), notePath).replace(/\\/g, '/');
    const content = fs.readFileSync(notePath, 'utf8');
    if (rel.toLowerCase().includes(q) || content.toLowerCase().includes(q)) {
      hits.push({
        path: rel,
        excerpt: content.replace(/\s+/g, ' ').slice(0, 200),
        links: [...content.matchAll(/\[\[([^\]|]+)/g)].map((m) => m[1]).slice(0, 5),
      });
    }
    if (hits.length >= limit) break;
  }

  return { ok: true, hits, vault: vaultPath() };
}

function writeNote(relativePath, content) {
  if (!isConfigured()) return { ok: false, error: 'Obsidian vault not configured' };

  const full = path.join(vaultPath(), relativePath.endsWith('.md') ? relativePath : `${relativePath}.md`);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return { ok: true, path: relativePath };
}

function getAgenticBrainIndex() {
  const brainDir = path.join(vaultPath(), config.obsidian.brainFolder);
  if (!fs.existsSync(brainDir)) {
    if (isConfigured()) {
      fs.mkdirSync(brainDir, { recursive: true });
      fs.writeFileSync(
        path.join(brainDir, 'README.md'),
        `# Agentic Brain\n\nThis vault folder is TONY's persistent cognitive workspace.\n\n- [[Memory]] — long-term facts\n- [[Projects]] — active work\n- [[Graph]] — knowledge graph notes\n`
      );
    }
  }

  return searchNotes('', 20);
}

function status() {
  return {
    configured: isConfigured(),
    vaultPath: vaultPath() || null,
    brainFolder: config.obsidian.brainFolder,
    noteCount: isConfigured() ? listNotes(1000).length : 0,
  };
}

module.exports = {
  isConfigured,
  listNotes,
  readNote,
  searchNotes,
  writeNote,
  getAgenticBrainIndex,
  status,
};
