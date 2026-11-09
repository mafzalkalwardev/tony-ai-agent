/**
 * Local hashed bag-of-words embeddings — no external model required.
 * Improves semantic memory ranking via cosine similarity.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const DIM = 256;

function storePath() {
  return path.join(config.dataDir, 'embeddings.json');
}

function load() {
  try {
    if (!fs.existsSync(storePath())) return { docs: [] };
    return JSON.parse(fs.readFileSync(storePath(), 'utf8'));
  } catch {
    return { docs: [] };
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(storePath()), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(data, null, 2), 'utf8');
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff\s]/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function embed(text) {
  const vec = new Array(DIM).fill(0);
  const tokens = tokenize(text);
  for (const token of tokens) {
    const h = crypto.createHash('sha256').update(token).digest();
    const idx = h.readUInt16BE(0) % DIM;
    const sign = h[2] % 2 === 0 ? 1 : -1;
    vec[idx] += sign;
  }
  return normalize(vec);
}

function normalize(vec) {
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / mag);
}

function cosine(a, b) {
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) s += a[i] * b[i];
  return s;
}

function indexText(id, text, meta = {}) {
  const data = load();
  const next = {
    id: String(id || `doc-${Date.now()}`),
    text: String(text || '').slice(0, 2000),
    vector: embed(text),
    meta,
    at: new Date().toISOString(),
  };
  data.docs = data.docs.filter((d) => d.id !== next.id);
  data.docs.unshift(next);
  if (data.docs.length > 1000) data.docs = data.docs.slice(0, 1000);
  save(data);
  return { ok: true, id: next.id };
}

function search(query, limit = 8) {
  const qv = embed(query);
  const scored = load()
    .docs.map((d) => ({
      id: d.id,
      text: d.text,
      meta: d.meta,
      at: d.at,
      score: cosine(qv, d.vector || []),
    }))
    .filter((d) => d.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored;
}

function reindexFacts(facts = []) {
  let n = 0;
  for (const f of facts) {
    indexText(`fact-${n}-${String(f.text || '').slice(0, 24)}`, f.text, { tags: f.tags || [] });
    n += 1;
  }
  return { ok: true, indexed: n };
}

function status() {
  return {
    dim: DIM,
    docs: load().docs.length,
    backend: 'local-hash-bow',
  };
}

module.exports = { embed, search, indexText, reindexFacts, cosine, status, tokenize };
