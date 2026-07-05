/**
 * Habit tracker — TONY learns your patterns automatically.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

const FILE = () => path.join(config.dataDir, 'habits.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE(), 'utf8'));
  } catch {
    return {
      wakeTimes: [],
      activeHours: {},
      phrases: {},
      moods: {},
      topics: {},
      sessions: [],
    };
  }
}

function save(data) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(FILE(), JSON.stringify(data, null, 2));
}

function hourKey(d = new Date()) {
  return `${d.getHours()}`;
}

function recordInteraction({ message, mood, isWake, sessionId }) {
  const data = load();
  const now = new Date();
  const hour = hourKey(now);

  data.activeHours[hour] = (data.activeHours[hour] || 0) + 1;

  if (isWake) {
    data.wakeTimes.push(now.toISOString());
    if (data.wakeTimes.length > 100) data.wakeTimes = data.wakeTimes.slice(-100);
  }

  if (mood) {
    data.moods[mood] = (data.moods[mood] || 0) + 1;
  }

  const words = String(message || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4);
  for (const w of words.slice(0, 8)) {
    data.topics[w] = (data.topics[w] || 0) + 1;
  }

  data.sessions.push({
    at: now.toISOString(),
    mood: mood || 'neutral',
    isWake: Boolean(isWake),
    preview: String(message || '').slice(0, 80),
    sessionId,
  });
  if (data.sessions.length > 500) data.sessions = data.sessions.slice(-500);

  save(data);
  return data;
}

function typicalWakeHour() {
  const data = load();
  if (!data.wakeTimes.length) return null;
  const hours = data.wakeTimes.map((t) => new Date(t).getHours());
  const counts = {};
  for (const h of hours) counts[h] = (counts[h] || 0) + 1;
  return Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]);
}

function summary() {
  const data = load();
  const topTopics = Object.entries(data.topics || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);
  const topMood = Object.entries(data.moods || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
  const peakHour = Object.entries(data.activeHours || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    totalSessions: data.sessions?.length || 0,
    wakeCount: data.wakeTimes?.length || 0,
    typicalWakeHour: typicalWakeHour(),
    peakActiveHour: peakHour != null ? `${peakHour}:00` : null,
    frequentTopics: topTopics,
    dominantMood: topMood || 'neutral',
    lastWake: data.wakeTimes?.[data.wakeTimes.length - 1],
  };
}

function formatForAgent() {
  const s = summary();
  const lines = [];
  if (s.typicalWakeHour != null) lines.push(`Usually wakes TONY around ${s.typicalWakeHour}:00`);
  if (s.peakActiveHour) lines.push(`Most active around ${s.peakActiveHour}`);
  if (s.frequentTopics.length) lines.push(`Often talks about: ${s.frequentTopics.join(', ')}`);
  if (s.dominantMood && s.dominantMood !== 'neutral') lines.push(`Recent mood pattern: ${s.dominantMood}`);
  return lines.join('\n') || 'Still learning your habits.';
}

module.exports = { load, recordInteraction, summary, formatForAgent, typicalWakeHour };
