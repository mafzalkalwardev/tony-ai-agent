/**
 * Local operator preferences (JSON). Never stores API keys/secrets.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

const SECRET_KEYS = /api[_-]?key|token|password|secret|authorization|private[_-]?key/i;

function storePath() {
  return path.join(config.dataDir, 'preferences.json');
}

function defaults() {
  return {
    assistantName: 'TONY',
    userName: config.companion?.userName || 'Muhammad Afzal',
    language: 'auto',
    voice: {
      preferLocalTts: true,
      preferLocalStt: false,
      silenceStopSeconds: config.voice?.silenceStopSeconds ?? 1.2,
      alwaysListen: config.companion?.alwaysListen ?? true,
    },
    safety: {
      alwaysAllowNpmTest: false,
      requireApprovalForPush: true,
    },
    projectNotes: [],
    recentCommands: [],
    updatedAt: null,
  };
}

function load() {
  try {
    if (!fs.existsSync(storePath())) return defaults();
    return { ...defaults(), ...JSON.parse(fs.readFileSync(storePath(), 'utf8')) };
  } catch {
    return defaults();
  }
}

function save(partial = {}) {
  const current = load();
  const next = deepMerge(current, sanitize(partial));
  next.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(storePath()), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function rememberCommand(command) {
  const prefs = load();
  const recent = prefs.recentCommands || [];
  recent.unshift({ command: String(command).slice(0, 240), at: new Date().toISOString() });
  prefs.recentCommands = recent.slice(0, 30);
  return save({ recentCommands: prefs.recentCommands });
}

function addProjectNote(note) {
  const cleaned = String(note || '').trim().slice(0, 500);
  if (!cleaned) return load();
  if (SECRET_KEYS.test(cleaned)) {
    return { ...load(), error: 'Refused to store secret-like text in preferences.' };
  }
  const notes = load().projectNotes || [];
  notes.unshift({ note: cleaned, at: new Date().toISOString() });
  return save({ projectNotes: notes.slice(0, 50) });
}

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_KEYS.test(k) || (typeof v === 'string' && SECRET_KEYS.test(v))) continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = sanitize(v);
    else out[k] = v;
  }
  return out;
}

function deepMerge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = deepMerge(a[k] || {}, v);
    else out[k] = v;
  }
  return out;
}

module.exports = { load, save, rememberCommand, addProjectNote, defaults, SECRET_KEYS };
