/**
 * Personal user profile — TONY remembers everything about you.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

const FILE = () => path.join(config.dataDir, 'user-profile.json');

const DEFAULT_PROFILE = {
  name: config.companion?.userName || 'Muhammad Afzal',
  nicknames: [],
  languages: ['English', 'Urdu', 'Roman Urdu'],
  timezone: 'Asia/Karachi',
  favoriteMovies: [
    'Iron Man', 'Iron Man 2', 'Iron Man 3', 'The Avengers', 'Age of Ultron',
    'Infinity War', 'Endgame', 'Spider-Man: Homecoming', 'Far From Home', 'No Way Home',
    'Captain America: Civil War', 'Black Panther', 'Doctor Strange', 'Thor: Ragnarok',
    'Guardians of the Galaxy', 'Ant-Man', 'Black Widow', 'Shang-Chi',
  ],
  favoriteNovels: [
    'Jannat Ke Pattay — Nemrah Ahmed',
    'Peer-e-Kamil — Umera Ahmed',
    'Usr-e-Yusra — Umera Ahmed',
    'Sulphite — Nimra Ahmed',
    'Namal — Nimra Ahmed',
    'Haalim — Nemrah Ahmed',
    'Bakht — Mehrunisa Khosa',
    'Amar Bail — Umera Ahmed',
  ],
  favoriteCharacters: ['Tony Stark', 'Peter Parker', 'Steve Rogers', 'T\'Challa', 'Doctor Strange'],
  interests: ['Marvel', 'coding', 'AI', 'Urdu literature', 'automation'],
  personalityNotes: [],
  facts: [],
  preferences: {},
  moodHistory: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE(), 'utf8'));
    return { ...DEFAULT_PROFILE, ...data };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

function save(profile) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  profile.updatedAt = new Date().toISOString();
  fs.writeFileSync(FILE(), JSON.stringify(profile, null, 2));
  return profile;
}

function update(partial) {
  const p = load();
  Object.assign(p, partial);
  if (partial.facts) p.facts = [...new Set([...(p.facts || []), ...partial.facts])].slice(-200);
  return save(p);
}

function addFact(text, tags = []) {
  const p = load();
  p.facts.push({ text, tags, at: new Date().toISOString() });
  if (p.facts.length > 200) p.facts = p.facts.slice(-200);
  return save(p);
}

function learnFromMessage(message) {
  const p = load();
  const m = String(message || '');

  const nameMatch = m.match(/my name is (\w+(?:\s+\w+)?)/i);
  if (nameMatch) p.name = nameMatch[1];

  const likeMovie = m.match(/(?:love|like|favorite)\s+(?:movie|film)\s+(.+?)(?:\.|$)/i);
  if (likeMovie) {
    p.favoriteMovies = [...new Set([...(p.favoriteMovies || []), likeMovie[1].trim()])];
  }

  const likeNovel = m.match(/(?:love|like|read|favorite)\s+(?:book|novel)\s+(.+?)(?:\.|$)/i);
  if (likeNovel) {
    p.favoriteNovels = [...new Set([...(p.favoriteNovels || []), likeNovel[1].trim()])];
  }

  if (/remember (?:that )?i /i.test(m)) {
    addFact(m.replace(/remember (?:that )?i /i, 'User: '), ['auto']);
  }

  return save(p);
}

function formatForAgent() {
  const p = load();
  return `## User profile — ${p.name}
Languages: ${(p.languages || []).join(', ')}
Marvel favorites: ${(p.favoriteMovies || []).slice(0, 6).join(', ')}…
Novels: ${(p.favoriteNovels || []).slice(0, 5).join(', ')}…
Characters they love: ${(p.favoriteCharacters || []).join(', ')}
Interests: ${(p.interests || []).join(', ')}
Recent facts: ${(p.facts || []).slice(-5).map((f) => f.text).join(' | ') || 'learning…'}
Personality notes: ${(p.personalityNotes || []).slice(-3).join(' | ') || 'warm, ambitious, multilingual'}`;
}

module.exports = { load, save, update, addFact, learnFromMessage, formatForAgent, DEFAULT_PROFILE };
