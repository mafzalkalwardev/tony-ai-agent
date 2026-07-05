const fs = require('fs');
const path = require('path');
const config = require('../config');

const TASKS_PATH = path.join(config.dataDir, 'tasks.json');

function ensure() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  if (!fs.existsSync(TASKS_PATH)) {
    fs.writeFileSync(TASKS_PATH, JSON.stringify({ tasks: [] }, null, 2));
  }
}

function load() {
  ensure();
  return JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
}

function save(data) {
  ensure();
  fs.writeFileSync(TASKS_PATH, JSON.stringify(data, null, 2));
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

function create({ name, description, triggers, steps, sourceMessage }) {
  const data = load();
  const task = {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    description: description || name,
    triggers: [...new Set([name.toLowerCase(), ...(triggers || []).map((t) => t.toLowerCase())])],
    steps: steps || [],
    sourceMessage: sourceMessage || '',
    runCount: 0,
    createdAt: new Date().toISOString(),
    lastRunAt: null,
    offlineCapable: true,
  };
  data.tasks.unshift(task);
  save(data);
  return task;
}

function get(id) {
  return load().tasks.find((t) => t.id === id || t.name === id) || null;
}

function list() {
  return load().tasks;
}

function findByTrigger(message) {
  const q = message.toLowerCase().trim();
  const data = load();

  const repeatPatterns = [
    /^repeat\s+(.+)/i,
    /^run\s+task\s+(.+)/i,
    /^do\s+(.+)\s+again/i,
    /^(.+)\s+dobara/i,
    /^(.+)\s+phir\s+se/i,
    /^again:\s*(.+)/i,
  ];

  for (const pat of repeatPatterns) {
    const m = q.match(pat);
    if (m) {
      const needle = m[1].trim().toLowerCase();
      const hit = data.tasks.find((t) =>
        t.triggers.some((tr) => tr.includes(needle) || needle.includes(tr)) ||
        t.name.toLowerCase().includes(needle)
      );
      if (hit) return hit;
    }
  }

  return (
    data.tasks.find((t) => t.triggers.some((tr) => q === tr || q.includes(tr) || tr.includes(q))) ||
    null
  );
}

function recordFromRun({ name, message, toolResults }) {
  if (!toolResults?.length) return null;

  const steps = toolResults.map((t) => ({
    tool: t.tool,
    args: t.args || {},
  }));

  return create({
    name: name || message.slice(0, 60),
    description: `Recorded from: ${message.slice(0, 120)}`,
    triggers: [
      message.slice(0, 60).toLowerCase(),
      `repeat ${(name || message).slice(0, 40).toLowerCase()}`,
      `run task ${(name || message).slice(0, 40).toLowerCase()}`,
    ],
    steps,
    sourceMessage: message,
  });
}

function incrementRun(id) {
  const data = load();
  const idx = data.tasks.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  data.tasks[idx].runCount += 1;
  data.tasks[idx].lastRunAt = new Date().toISOString();
  save(data);
  return data.tasks[idx];
}

function remove(id) {
  const data = load();
  data.tasks = data.tasks.filter((t) => t.id !== id);
  save(data);
}

module.exports = {
  create,
  get,
  list,
  findByTrigger,
  recordFromRun,
  incrementRun,
  remove,
};
