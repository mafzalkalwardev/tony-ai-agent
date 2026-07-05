/**
 * Error memory — TONY learns from mistakes and reuses fixes.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

const FILE = () => path.join(config.dataDir, 'error-lessons.json');
const MAX = 300;

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE(), 'utf8'));
  } catch {
    return { lessons: [] };
  }
}

function save(data) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(FILE(), JSON.stringify(data, null, 2));
}

function normalizeError(err) {
  return String(err || 'unknown')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function record({ tool, error, context = '', fix = '', sessionId = '', outcome = 'failed' }) {
  const data = load();
  const errNorm = normalizeError(error);
  const existing = data.lessons.find(
    (l) => l.tool === tool && l.error === errNorm && l.fix && outcome === 'resolved'
  );
  if (existing) {
    existing.hits = (existing.hits || 1) + 1;
    existing.lastAt = new Date().toISOString();
    save(data);
    return existing;
  }

  const lesson = {
    id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tool: tool || 'agent',
    error: errNorm,
    context: context.slice(0, 400),
    fix: fix.slice(0, 800),
    sessionId,
    outcome,
    hits: 1,
    at: new Date().toISOString(),
    lastAt: new Date().toISOString(),
  };
  data.lessons.push(lesson);
  if (data.lessons.length > MAX) data.lessons = data.lessons.slice(-MAX);
  save(data);
  return lesson;
}

function resolve(id, fix, outcome = 'resolved') {
  const data = load();
  const lesson = data.lessons.find((l) => l.id === id);
  if (!lesson) return null;
  lesson.fix = fix.slice(0, 800);
  lesson.outcome = outcome;
  lesson.resolvedAt = new Date().toISOString();
  lesson.lastAt = lesson.resolvedAt;
  save(data);
  return lesson;
}

function search(query, limit = 8) {
  const q = normalizeError(query).toLowerCase();
  if (!q) return load().lessons.slice(-limit);

  return load()
    .lessons.filter(
      (l) =>
        l.error.toLowerCase().includes(q) ||
        l.tool.toLowerCase().includes(q) ||
        l.context.toLowerCase().includes(q) ||
        (l.fix && l.fix.toLowerCase().includes(q))
    )
    .sort((a, b) => (b.hits || 1) - (a.hits || 1))
    .slice(0, limit);
}

function forTool(tool, limit = 5) {
  return load()
    .lessons.filter((l) => l.tool === tool && l.fix)
    .sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt))
    .slice(0, limit);
}

function recent(limit = 10) {
  return load()
    .lessons.slice(-limit)
    .reverse();
}

function formatForAgent(lessons) {
  if (!lessons?.length) return '';
  return lessons
    .map(
      (l) =>
        `- [${l.tool}] Error: ${l.error.slice(0, 120)}${l.fix ? `\n  Fix that worked: ${l.fix.slice(0, 200)}` : ''}`
    )
    .join('\n');
}

function suggestFix(tool, error) {
  const matches = search(`${tool} ${error}`, 3).filter((l) => l.fix && l.outcome === 'resolved');
  return matches[0]?.fix || null;
}

module.exports = {
  load,
  record,
  resolve,
  search,
  forTool,
  recent,
  formatForAgent,
  suggestFix,
  normalizeError,
};
