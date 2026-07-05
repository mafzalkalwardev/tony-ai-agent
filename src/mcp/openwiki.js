/**
 * OpenWiki — repo documentation for coding agents.
 * Supports langchain-ai/openwiki (local openwiki/ folder) + HTTP MCP (open-wiki / openwiki serve).
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const hub = require('./hub');

function wikiDir() {
  const candidates = [
    path.join(config.workspaceRoot, 'openwiki'),
    path.join(config.integrationsDir, 'repos', 'openwiki', 'openwiki'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function status() {
  const dir = wikiDir();
  return hub.statusFor('openwiki', config.mcp.openwiki.mcpUrl, {
    wikiDir: dir,
    hasLocalWiki: Boolean(dir),
    docsUrl: config.mcp.openwiki.docsUrl,
  });
}

function searchLocal(query, limit = 8) {
  const dir = wikiDir();
  if (!dir) return { ok: false, error: 'No openwiki/ folder — run: npm run openwiki:init' };
  const q = query.toLowerCase();
  const hits = [];
  const walk = (d, prefix = '') => {
    for (const name of fs.readdirSync(d)) {
      const full = path.join(d, name);
      const rel = path.join(prefix, name);
      if (fs.statSync(full).isDirectory()) walk(full, rel);
      else if (/\.(md|mdx)$/i.test(name)) {
        const text = fs.readFileSync(full, 'utf8');
        if (text.toLowerCase().includes(q) || rel.toLowerCase().includes(q)) {
          hits.push({ path: rel, excerpt: text.slice(0, 600) });
        }
      }
    }
  };
  walk(dir);
  return { ok: true, hits: hits.slice(0, limit), source: 'local-openwiki' };
}

async function search(query) {
  const local = searchLocal(query);
  if (local.ok && local.hits?.length) return local;

  const url = config.mcp.openwiki.mcpUrl;
  if (url) {
    const remote = await hub.callServer(url, 'search_docs', { query });
    if (remote.ok) return { ok: true, ...remote, source: 'openwiki-mcp' };
  }

  return local.ok ? local : { ok: false, error: 'OpenWiki not indexed. Set OPENWIKI_MCP_URL or run openwiki --init' };
}

async function overview(project = 'tony-agent') {
  const url = config.mcp.openwiki.mcpUrl;
  if (url) {
    return hub.callServer(url, 'get_project_overview', { project });
  }
  const dir = wikiDir();
  if (!dir) return { ok: false, error: 'No openwiki docs' };
  const readme = fs.readdirSync(dir).find((f) => /^readme/i.test(f));
  return {
    ok: true,
    overview: readme ? fs.readFileSync(path.join(dir, readme), 'utf8').slice(0, 4000) : 'OpenWiki folder present',
    source: 'local',
  };
}

module.exports = { status, search, overview, searchLocal, wikiDir };
