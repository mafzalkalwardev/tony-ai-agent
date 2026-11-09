const fs = require('fs');
const path = require('path');
const config = require('../config');

const FILE = () => path.join(config.dataDir, 'semantic.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE(), 'utf8'));
  } catch {
    return { facts: [], entities: {}, preferences: {} };
  }
}

function save(data) {
  const dir = config.dataDir;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FILE(), JSON.stringify(data, null, 2));
}

function rememberFact(text, tags = []) {
  const data = load();
  const fact = { text, tags, at: new Date().toISOString() };
  data.facts.push(fact);
  if (data.facts.length > 500) data.facts = data.facts.slice(-500);
  save(data);
  try {
    require('./embeddings').indexText(`fact-${Date.now()}`, text, { tags });
  } catch {
    /* ignore */
  }
  return data.facts[data.facts.length - 1];
}

function setPreference(key, value) {
  const data = load();
  data.preferences[key] = value;
  save(data);
}

function search(query, limit = 8) {
  const q = query.toLowerCase();
  const data = load();
  const substringHits = data.facts
    .filter((f) => f.text.toLowerCase().includes(q))
    .map((f) => ({ ...f, score: 1, match: 'substring' }));

  let vectorHits = [];
  try {
    vectorHits = require('./embeddings')
      .search(query, limit)
      .map((h) => ({
        text: h.text,
        tags: h.meta?.tags || ['embedding'],
        at: h.at,
        score: h.score,
        match: 'vector',
      }));
  } catch {
    vectorHits = [];
  }

  const prefs = Object.entries(data.preferences)
    .filter(([k, v]) => `${k} ${v}`.toLowerCase().includes(q))
    .map(([k, v]) => ({ text: `Preference: ${k} = ${v}`, tags: ['preference'], score: 0.9, match: 'pref' }));

  const merged = [];
  const seen = new Set();
  for (const hit of [...substringHits, ...vectorHits, ...prefs].sort((a, b) => (b.score || 0) - (a.score || 0))) {
    const key = String(hit.text || '').slice(0, 160);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(hit);
    if (merged.length >= limit) break;
  }
  return merged;
}

function reindexAll() {
  const data = load();
  return require('./embeddings').reindexFacts(data.facts || []);
}

module.exports = { load, rememberFact, setPreference, search, reindexAll };
