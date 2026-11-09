/**
 * Live Obsidian vault watcher — tracks note create/change/delete events.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const obsidian = require('./obsidian');

let watcher = null;
const events = [];
const MAX_EVENTS = 200;

function enabled() {
  return config.obsidian?.watch !== false;
}

function status() {
  return {
    watching: Boolean(watcher),
    enabled: enabled(),
    vault: obsidian.status(),
    recentEvents: events.slice(0, 20),
  };
}

function pushEvent(type, filePath) {
  events.unshift({
    type,
    path: filePath,
    at: new Date().toISOString(),
  });
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
}

function start() {
  if (watcher) return { ok: true, already: true, ...status() };
  if (!enabled()) return { ok: false, error: 'Vault watch disabled (TONY_OBSIDIAN_WATCH=false)' };
  if (!obsidian.isConfigured()) return { ok: false, error: 'Obsidian vault not configured' };

  const root = config.obsidian.vaultPath;
  try {
    watcher = fs.watch(root, { recursive: true }, (eventType, filename) => {
      if (!filename || !String(filename).endsWith('.md')) return;
      pushEvent(eventType === 'rename' ? 'change' : eventType, String(filename).replace(/\\/g, '/'));
    });
    watcher.on('error', () => {
      watcher = null;
    });
    return { ok: true, watching: true, vault: root };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function stop() {
  if (watcher) {
    try {
      watcher.close();
    } catch {
      /* ignore */
    }
  }
  watcher = null;
  return { ok: true, watching: false };
}

function recent(limit = 20) {
  return events.slice(0, limit);
}

function syncIndex() {
  const idx = obsidian.getAgenticBrainIndex();
  const stamp = new Date().toISOString();
  const notePath = path.join(config.obsidian.brainFolder, 'Watch-Log.md');
  const lines = [
    `# Vault Watch Log`,
    ``,
    `Updated: ${stamp}`,
    ``,
    `## Recent events`,
    ...(recent(30).map((e) => `- \`${e.at}\` **${e.type}** \`${e.path}\``) || ['- (none)']),
    ``,
    `## Index snapshot`,
    `Notes visible: ${idx.hits?.length ?? 0}`,
  ];
  const written = obsidian.writeNote(notePath, lines.join('\n'));
  return { ok: true, written, events: recent(10), indexHits: idx.hits?.length ?? 0 };
}

module.exports = { start, stop, status, recent, syncIndex, enabled };
