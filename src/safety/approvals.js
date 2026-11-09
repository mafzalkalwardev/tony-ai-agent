/**
 * Pending approval queue for risky actions (push, deploy, send, install, etc.).
 */
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const config = require('../config');

function storePath() {
  return path.join(config.dataDir, 'pending_approvals.json');
}

function load() {
  try {
    if (!fs.existsSync(storePath())) return { pending: [] };
    return JSON.parse(fs.readFileSync(storePath(), 'utf8'));
  } catch {
    return { pending: [] };
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(storePath()), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(data, null, 2), 'utf8');
}

function create({ action, command, reason, sessionId = '', meta = {} }) {
  const data = load();
  const item = {
    id: randomUUID(),
    action,
    command,
    reason,
    sessionId,
    meta,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  data.pending.unshift(item);
  data.pending = data.pending.slice(0, 50);
  save(data);
  return item;
}

function list(status = 'pending') {
  return load().pending.filter((p) => p.status === status);
}

function decide(id, approved) {
  const data = load();
  const item = data.pending.find((p) => p.id === id);
  if (!item) return null;
  item.status = approved ? 'approved' : 'rejected';
  item.decidedAt = new Date().toISOString();
  save(data);
  return item;
}

function isApprovalText(text) {
  const cleaned = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '');
  return ['yes', 'y', 'approve', 'approved', 'haan', 'han', 'ji', 'ok', 'theek hai'].includes(cleaned);
}

function isRejectText(text) {
  const cleaned = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '');
  return ['no', 'n', 'nahi', 'nahin', 'cancel', 'stop', 'reject'].includes(cleaned);
}

module.exports = {
  create,
  list,
  decide,
  isApprovalText,
  isRejectText,
  load,
};
