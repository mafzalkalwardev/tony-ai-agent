/**
 * Lightweight client/contact tracker for delivery work — local JSON only.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

function storePath() {
  return path.join(config.dataDir, 'clients.json');
}

function load() {
  try {
    if (!fs.existsSync(storePath())) return { clients: [] };
    return JSON.parse(fs.readFileSync(storePath(), 'utf8'));
  } catch {
    return { clients: [] };
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(storePath()), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(data, null, 2), 'utf8');
  return data;
}

function list() {
  return { ok: true, clients: load().clients };
}

function upsertClient({ name, company = '', notes = '', status = 'active' } = {}) {
  if (!name?.trim()) return { ok: false, error: 'Client name required' };
  if (/api[_-]?key|token|password|secret/i.test(`${notes}${company}${name}`)) {
    return { ok: false, error: 'Refused secret-like text in client records' };
  }
  const data = load();
  const key = name.trim().toLowerCase();
  let client = data.clients.find((c) => c.name.toLowerCase() === key);
  if (!client) {
    client = {
      id: `cli-${Date.now()}`,
      name: name.trim(),
      company: '',
      notes: [],
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    data.clients.unshift(client);
  }
  if (company) client.company = String(company).slice(0, 120);
  if (status) client.status = String(status).slice(0, 40);
  if (notes) {
    client.notes = client.notes || [];
    client.notes.unshift({ note: String(notes).slice(0, 500), at: new Date().toISOString() });
    client.notes = client.notes.slice(0, 40);
  }
  client.updatedAt = new Date().toISOString();
  save(data);
  return { ok: true, client };
}

function findClient(nameOrId) {
  const key = String(nameOrId || '').trim().toLowerCase();
  return load().clients.find(
    (c) => c.id === key || c.name.toLowerCase() === key || c.id.toLowerCase() === key
  );
}

function getClient(nameOrId) {
  const client = findClient(nameOrId);
  if (!client) return { ok: false, error: 'Client not found' };
  return { ok: true, client };
}

module.exports = { list, upsertClient, getClient, findClient };
