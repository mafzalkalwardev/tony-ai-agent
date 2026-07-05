const fs = require('fs');
const path = require('path');
const config = require('../config');

const GOALS_PATH = path.join(config.dataDir, 'goals.json');

function ensure() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  if (!fs.existsSync(GOALS_PATH)) {
    fs.writeFileSync(GOALS_PATH, JSON.stringify({ goals: [] }, null, 2));
  }
}

function load() {
  ensure();
  return JSON.parse(fs.readFileSync(GOALS_PATH, 'utf8'));
}

function save(data) {
  ensure();
  fs.writeFileSync(GOALS_PATH, JSON.stringify(data, null, 2));
}

function create({ title, description, successCriteria = [], priority = 'normal', tags = [] }) {
  const data = load();
  const goal = {
    id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    description,
    successCriteria,
    priority,
    tags,
    status: 'active',
    progress: [],
    rounds: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  };
  data.goals.unshift(goal);
  save(data);
  return goal;
}

function get(id) {
  return load().goals.find((g) => g.id === id) || null;
}

function list(status) {
  const goals = load().goals;
  return status ? goals.filter((g) => g.status === status) : goals;
}

function update(id, patch) {
  const data = load();
  const idx = data.goals.findIndex((g) => g.id === id);
  if (idx < 0) return null;
  data.goals[idx] = { ...data.goals[idx], ...patch, updatedAt: new Date().toISOString() };
  save(data);
  return data.goals[idx];
}

function appendProgress(id, entry) {
  const goal = get(id);
  if (!goal) return null;
  const progress = [...(goal.progress || []), { ...entry, at: new Date().toISOString() }];
  return update(id, { progress, rounds: (goal.rounds || 0) + 1 });
}

function complete(id, summary = '') {
  return update(id, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    summary,
  });
}

function fail(id, reason = '') {
  return update(id, { status: 'failed', failureReason: reason });
}

module.exports = { create, get, list, update, appendProgress, complete, fail };
