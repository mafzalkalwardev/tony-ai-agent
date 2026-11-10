/**
 * Multi-repo workspace picker — switch TONY's active project root.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

function storePath() {
  return path.join(config.dataDir, 'workspaces.json');
}

function defaults() {
  return {
    activeId: 'default',
    workspaces: [
      {
        id: 'default',
        name: 'TONY agent',
        path: config.workspaceRoot,
        addedAt: new Date().toISOString(),
      },
    ],
  };
}

function load() {
  try {
    if (!fs.existsSync(storePath())) return defaults();
    const data = { ...defaults(), ...JSON.parse(fs.readFileSync(storePath(), 'utf8')) };
    if (!Array.isArray(data.workspaces) || !data.workspaces.length) return defaults();
    return data;
  } catch {
    return defaults();
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(storePath()), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(data, null, 2), 'utf8');
  return data;
}

function list() {
  const data = load();
  return {
    ok: true,
    activeId: data.activeId,
    activePath: getActivePath(),
    workspaces: data.workspaces.map((w) => ({
      ...w,
      active: w.id === data.activeId,
      exists: fs.existsSync(w.path),
    })),
  };
}

function getActivePath() {
  const data = load();
  const active = data.workspaces.find((w) => w.id === data.activeId) || data.workspaces[0];
  return active?.path || config.workspaceRoot;
}

function applyActiveToConfig() {
  const next = getActivePath();
  if (next && fs.existsSync(next)) {
    config.workspaceRoot = path.resolve(next);
  }
  return config.workspaceRoot;
}

function addWorkspace({ name, path: repoPath } = {}) {
  const resolved = path.resolve(repoPath || '');
  if (!name?.trim()) return { ok: false, error: 'Workspace name required' };
  if (!repoPath?.trim()) return { ok: false, error: 'Workspace path required' };
  if (!fs.existsSync(resolved)) return { ok: false, error: `Path not found: ${resolved}` };
  if (!fs.statSync(resolved).isDirectory()) return { ok: false, error: 'Path must be a directory' };

  const data = load();
  const id = slug(name);
  if (data.workspaces.some((w) => w.id === id || path.resolve(w.path) === resolved)) {
    return { ok: false, error: 'Workspace already registered' };
  }
  data.workspaces.push({
    id,
    name: name.trim(),
    path: resolved,
    addedAt: new Date().toISOString(),
  });
  save(data);
  return { ok: true, ...list() };
}

function switchWorkspace(idOrName) {
  const key = String(idOrName || '').trim().toLowerCase();
  const data = load();
  const found = data.workspaces.find(
    (w) => w.id === key || w.name.toLowerCase() === key || w.id.toLowerCase() === key
  );
  if (!found) return { ok: false, error: `Workspace not found: ${idOrName}`, ...list() };
  if (!fs.existsSync(found.path)) return { ok: false, error: `Path missing: ${found.path}` };
  data.activeId = found.id;
  save(data);
  applyActiveToConfig();
  return { ok: true, switchedTo: found, workspaceRoot: config.workspaceRoot, ...list() };
}

function removeWorkspace(idOrName) {
  const key = String(idOrName || '').trim().toLowerCase();
  const data = load();
  if (key === 'default') return { ok: false, error: 'Cannot remove default workspace' };
  const before = data.workspaces.length;
  data.workspaces = data.workspaces.filter(
    (w) => w.id !== key && w.name.toLowerCase() !== key && w.id.toLowerCase() !== key
  );
  if (data.workspaces.length === before) return { ok: false, error: 'Workspace not found' };
  if (!data.workspaces.some((w) => w.id === data.activeId)) data.activeId = 'default';
  save(data);
  applyActiveToConfig();
  return { ok: true, ...list() };
}

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || `ws-${Date.now()}`;
}

// Apply on load so restarts restore last active workspace when valid.
try {
  applyActiveToConfig();
} catch {
  /* ignore */
}

module.exports = {
  list,
  addWorkspace,
  switchWorkspace,
  removeWorkspace,
  getActivePath,
  applyActiveToConfig,
  load,
};
