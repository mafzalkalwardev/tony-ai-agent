/**
 * Persistent agent session checkpoints (LangGraph-style snapshots).
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const memory = require('../memory');

function dir() {
  return path.join(config.dataDir, 'checkpoints');
}

function fileFor(sessionId) {
  const safe = String(sessionId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return path.join(dir(), `${safe}.json`);
}

function saveCheckpoint(sessionId, meta = {}) {
  if (!sessionId) return { ok: false, error: 'sessionId required' };
  const history = memory.getSessionHistory(sessionId, 200) || [];
  const payload = {
    sessionId,
    savedAt: new Date().toISOString(),
    turns: history.length,
    history,
    meta: {
      label: meta.label || 'checkpoint',
      note: String(meta.note || '').slice(0, 300),
      intent: meta.intent || null,
    },
  };
  fs.mkdirSync(dir(), { recursive: true });
  fs.writeFileSync(fileFor(sessionId), JSON.stringify(payload, null, 2), 'utf8');
  return {
    ok: true,
    sessionId,
    turns: payload.turns,
    savedAt: payload.savedAt,
    path: path.relative(config.workspaceRoot, fileFor(sessionId)),
  };
}

function loadCheckpoint(sessionId) {
  const file = fileFor(sessionId);
  if (!fs.existsSync(file)) return { ok: false, error: 'No checkpoint for session' };
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { ok: true, checkpoint: data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function restoreCheckpoint(sessionId) {
  const loaded = loadCheckpoint(sessionId);
  if (!loaded.ok) return loaded;
  const history = loaded.checkpoint.history || [];
  for (const turn of history) {
    try {
      memory.appendEpisode(sessionId, turn.role || 'assistant', turn.content || turn.text || '');
    } catch {
      /* ignore */
    }
  }
  return {
    ok: true,
    restored: history.length,
    savedAt: loaded.checkpoint.savedAt,
    meta: loaded.checkpoint.meta,
  };
}

function listCheckpoints() {
  fs.mkdirSync(dir(), { recursive: true });
  const files = fs.readdirSync(dir()).filter((f) => f.endsWith('.json'));
  const items = files.map((f) => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir(), f), 'utf8'));
      return {
        sessionId: data.sessionId,
        savedAt: data.savedAt,
        turns: data.turns,
        label: data.meta?.label,
        file: f,
      };
    } catch {
      return { file: f, error: true };
    }
  });
  return { ok: true, checkpoints: items.sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || ''))) };
}

module.exports = { saveCheckpoint, loadCheckpoint, restoreCheckpoint, listCheckpoints };
