/**
 * Simple focus / pomodoro timer for operator sessions.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

function storePath() {
  return path.join(config.dataDir, 'focus_timer.json');
}

function load() {
  try {
    if (!fs.existsSync(storePath())) return { sessions: [], active: null };
    return JSON.parse(fs.readFileSync(storePath(), 'utf8'));
  } catch {
    return { sessions: [], active: null };
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(storePath()), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(data, null, 2), 'utf8');
  return data;
}

function start({ minutes = 25, label = 'Focus' } = {}) {
  const data = load();
  if (data.active) return { ok: false, error: 'Focus session already active', active: data.active };
  const mins = Math.max(1, Math.min(180, Number(minutes) || 25));
  const active = {
    id: `focus-${Date.now()}`,
    label: String(label).slice(0, 80),
    minutes: mins,
    startedAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + mins * 60000).toISOString(),
  };
  data.active = active;
  save(data);
  return { ok: true, active };
}

function status() {
  const data = load();
  if (!data.active) return { ok: true, active: null, remainingMs: 0 };
  const remainingMs = Math.max(0, new Date(data.active.endsAt).getTime() - Date.now());
  const done = remainingMs === 0;
  return { ok: true, active: data.active, remainingMs, done };
}

function stop({ complete = false } = {}) {
  const data = load();
  if (!data.active) return { ok: false, error: 'No active focus session' };
  const session = {
    ...data.active,
    stoppedAt: new Date().toISOString(),
    completed: Boolean(complete) || new Date(data.active.endsAt).getTime() <= Date.now(),
  };
  data.sessions.unshift(session);
  data.sessions = data.sessions.slice(0, 50);
  data.active = null;
  save(data);
  return { ok: true, session, sessions: data.sessions.slice(0, 10) };
}

function history(limit = 10) {
  return { ok: true, sessions: load().sessions.slice(0, limit), active: load().active };
}

module.exports = { start, stop, status, history };
