/**
 * Work briefing — what you finished and what's left.
 */
const goalStore = require('../goals/store');
const taskStore = require('../tasks/store');
const memory = require('../memory');

function workBrief(sessionId) {
  const completed = goalStore.list('completed').slice(-5);
  const active = goalStore.list('active');
  const tasks = taskStore.list();
  const recentEpisodes = sessionId ? memory.getSessionHistory(sessionId, 8) : [];

  const doneToday = completed.filter((g) => {
    const d = g.completedAt || g.updatedAt;
    if (!d) return false;
    const t = new Date(d);
    const now = new Date();
    return t.toDateString() === now.toDateString();
  });

  const doneItems = [
    ...doneToday.map((g) => `✓ Goal: ${g.title}`),
    ...tasks.filter((t) => (t.runCount || 0) > 0).slice(0, 3).map((t) => `✓ Task replayed: ${t.name}`),
  ];

  const remainingItems = [
    ...active.map((g) => `→ ${g.title} (${g.status})`),
    ...active.flatMap((g) => (g.successCriteria || []).slice(0, 2).map((c) => `  • ${c}`)),
  ];

  if (!remainingItems.length && active.length === 0) {
    remainingItems.push('→ No active goals — ready for your next mission');
  }

  const recentWork = recentEpisodes
    .filter((e) => e.role === 'user')
    .slice(-3)
    .map((e) => e.content.slice(0, 60));

  return {
    done: doneItems.length ? doneItems : ['→ Quiet session so far — fresh start ahead'],
    remaining: remainingItems.slice(0, 8),
    activeGoals: active.length,
    completedGoals: completed.length,
    recordedTasks: tasks.length,
    recentTopics: recentWork,
  };
}

function formatBrief(brief) {
  return {
    done: brief.done.join('\n'),
    remaining: brief.remaining.join('\n'),
  };
}

module.exports = { workBrief, formatBrief };
