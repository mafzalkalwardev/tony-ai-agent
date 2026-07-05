const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');
const { trimEpisodeContent } = require('../llm/context-budget');

let db;

function ensureDataDir() {
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }
}

function getDb() {
  if (!db) {
    ensureDataDir();
    db = new Database(path.join(config.dataDir, 'memory.db'));
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS tool_traces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        arguments TEXT,
        result TEXT,
        ok INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_episodes_session ON episodes(session_id);
    `);
  }
  return db;
}

function appendEpisode(sessionId, role, content, metadata = null) {
  const trimmed = trimEpisodeContent(content, config.context?.episodeMaxChars || 6000);
  getDb()
    .prepare('INSERT INTO episodes (session_id, role, content, metadata) VALUES (?, ?, ?, ?)')
    .run(sessionId, role, trimmed, metadata ? JSON.stringify(metadata) : null);
}

function appendToolTrace(sessionId, toolName, args, result, ok = true) {
  getDb()
    .prepare('INSERT INTO tool_traces (session_id, tool_name, arguments, result, ok) VALUES (?, ?, ?, ?, ?)')
    .run(sessionId, toolName, JSON.stringify(args), String(result).slice(0, 8000), ok ? 1 : 0);
}

function getSessionHistory(sessionId, limit = 40) {
  const maxChars = config.context?.episodeMaxChars || 6000;
  return getDb()
    .prepare('SELECT role, content, created_at FROM episodes WHERE session_id = ? ORDER BY id DESC LIMIT ?')
    .all(sessionId, limit)
    .reverse()
    .map((row) => ({
      ...row,
      content: trimEpisodeContent(row.content, maxChars),
    }));
}

function searchEpisodes(query, limit = 10) {
  const like = `%${query}%`;
  return getDb()
    .prepare(
      `SELECT session_id, role, content, created_at FROM episodes
       WHERE content LIKE ? ORDER BY id DESC LIMIT ?`
    )
    .all(like, limit);
}

module.exports = {
  appendEpisode,
  appendToolTrace,
  getSessionHistory,
  searchEpisodes,
};
