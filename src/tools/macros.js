/**
 * Operator macros — saved command shortcuts.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

function storePath() {
  return path.join(config.dataDir, 'macros.json');
}

function load() {
  try {
    if (!fs.existsSync(storePath())) return { macros: [] };
    return JSON.parse(fs.readFileSync(storePath(), 'utf8'));
  } catch {
    return { macros: [] };
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(storePath()), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(data, null, 2), 'utf8');
  return data;
}

function list() {
  return { ok: true, macros: load().macros };
}

function saveMacro({ name, command } = {}) {
  if (!name?.trim() || !command?.trim()) return { ok: false, error: 'name and command required' };
  if (/api[_-]?key|token|password|secret|\.env\b/i.test(command)) {
    return { ok: false, error: 'Refused secret-like macro command' };
  }
  const data = load();
  const id = slug(name);
  data.macros = data.macros.filter((m) => m.id !== id);
  data.macros.unshift({
    id,
    name: name.trim(),
    command: command.trim().slice(0, 500),
    at: new Date().toISOString(),
  });
  data.macros = data.macros.slice(0, 50);
  save(data);
  return { ok: true, macro: data.macros[0], macros: data.macros };
}

function getMacro(nameOrId) {
  const key = String(nameOrId || '').trim().toLowerCase();
  const macro = load().macros.find((m) => m.id === key || m.name.toLowerCase() === key);
  if (!macro) return { ok: false, error: 'Macro not found' };
  return { ok: true, macro };
}

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

module.exports = { list, saveMacro, getMacro };
