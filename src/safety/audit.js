/**
 * Append-only operator audit log — approvals, tool runs, safety decisions.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

function logPath() {
  return path.join(config.dataDir, 'audit.log.jsonl');
}

function record(event = {}) {
  const entry = {
    at: new Date().toISOString(),
    type: event.type || 'event',
    action: event.action || '',
    level: event.level || '',
    sessionId: event.sessionId || '',
    detail: String(event.detail || '').slice(0, 500),
    ok: event.ok,
  };
  // Never write secret-like detail
  if (/api[_-]?key|token|password|secret|\.env\b/i.test(entry.detail)) {
    entry.detail = '[redacted]';
  }
  fs.mkdirSync(path.dirname(logPath()), { recursive: true });
  fs.appendFileSync(logPath(), `${JSON.stringify(entry)}\n`, 'utf8');
  return entry;
}

function recent(limit = 50) {
  try {
    if (!fs.existsSync(logPath())) return [];
    const lines = fs.readFileSync(logPath(), 'utf8').trim().split('\n').filter(Boolean);
    return lines
      .slice(-limit)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .reverse();
  } catch {
    return [];
  }
}

function status() {
  return {
    path: logPath(),
    entries: recent(1000).length,
    recent: recent(5),
  };
}

module.exports = { record, recent, status };
