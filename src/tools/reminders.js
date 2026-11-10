/**
 * Local reminders + daily briefing helpers.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

function storePath() {
  return path.join(config.dataDir, 'reminders.json');
}

function load() {
  try {
    if (!fs.existsSync(storePath())) return { items: [] };
    return JSON.parse(fs.readFileSync(storePath(), 'utf8'));
  } catch {
    return { items: [] };
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(storePath()), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(data, null, 2), 'utf8');
  return data;
}

function list({ includeDone = false } = {}) {
  const items = load().items || [];
  return items
    .filter((i) => includeDone || i.status !== 'done')
    .sort((a, b) => String(a.dueAt || '').localeCompare(String(b.dueAt || '')));
}

function addReminder({ text, dueAt, minutesFromNow } = {}) {
  if (!text?.trim()) return { ok: false, error: 'Reminder text required' };
  let due = dueAt;
  if (!due && minutesFromNow != null) {
    due = new Date(Date.now() + Number(minutesFromNow) * 60000).toISOString();
  }
  if (!due) {
    due = new Date(Date.now() + 60 * 60000).toISOString();
  }
  const item = {
    id: `rem-${Date.now()}`,
    text: text.trim(),
    dueAt: new Date(due).toISOString(),
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  const data = load();
  data.items.unshift(item);
  save(data);
  return { ok: true, reminder: item, upcoming: list().slice(0, 10) };
}

function completeReminder(id) {
  const data = load();
  const item = data.items.find((i) => i.id === id || i.text === id);
  if (!item) return { ok: false, error: 'Reminder not found' };
  item.status = 'done';
  item.doneAt = new Date().toISOString();
  save(data);
  return { ok: true, reminder: item };
}

function dueNow() {
  const now = Date.now();
  return list().filter((i) => new Date(i.dueAt).getTime() <= now);
}

function dailyBriefing() {
  const trusted = (() => {
    try {
      return require('../safety/trusted_mode').status();
    } catch {
      return { label: 'unknown' };
    }
  })();
  const prefs = (() => {
    try {
      return require('./preferences').load();
    } catch {
      return {};
    }
  })();
  const gh = (() => {
    try {
      return require('./github_helper').summarizeRepo();
    } catch {
      return { branch: '?', status: '?' };
    }
  })();
  const upcoming = list().slice(0, 8);
  const overdue = dueNow();
  const hour = new Date().getHours();
  const greet =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = config.companion?.userName || 'boss';

  const markdown = `# ${greet}, ${name}

**Trusted mode:** ${trusted.label || '—'}
**Active workspace:** ${require('./workspaces').getActivePath()}
**Branch:** ${gh.branch || '?'}
**Working tree:**
\`\`\`
${String(gh.status || '(unknown)').slice(0, 800)}
\`\`\`

## Reminders
${
  upcoming.length
    ? upcoming
        .map((r) => `- ${r.status === 'open' && new Date(r.dueAt) <= new Date() ? '⚠️ ' : ''}${r.text} _(due ${r.dueAt})_`)
        .join('\n')
    : '- None scheduled'
}

## Overdue
${overdue.length ? overdue.map((r) => `- ${r.text}`).join('\n') : '- None'}

## Recent prefs notes
${(prefs.projectNotes || []).slice(-3).map((n) => `- ${n}`).join('\n') || '- None'}

Say \`Tony reminder in 30 minutes: call client\` or \`Tony daily briefing\`.
`;

  return {
    ok: true,
    greet,
    overdue: overdue.length,
    upcoming: upcoming.length,
    trusted: trusted.label,
    markdown,
  };
}

module.exports = {
  list,
  addReminder,
  completeReminder,
  dueNow,
  dailyBriefing,
};
