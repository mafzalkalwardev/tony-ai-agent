/**
 * Automated workflow orchestrator — voice → plan → crew/goals → tools → speak.
 * Unifies agent, goals, crew, tasks, and optional voice output.
 */
const { randomUUID } = require('crypto');
const config = require('../config');
const { runAgent } = require('../core/agent');
const { runCrew } = require('../core/crew');
const goalRunner = require('../goals/runner');
const goalStore = require('../goals/store');
const taskStore = require('../tasks/store');
const { extractAttachments } = require('../gateway/attachments');

function pickMode(task, { mode = 'auto' } = {}) {
  if (mode !== 'auto') return mode;
  const t = task.toLowerCase();
  if (/goal|until|success criteria|loop until|criteria:/i.test(t)) return 'goal';
  if (/research|compare|analyze|multi-agent|crew|specialist/i.test(t)) return 'crew';
  if (/repeat|replay|offline task/i.test(t)) return 'task';
  if (t.length > 200 || /build|ship|integrate|deploy|website|github push/i.test(t)) return 'goal';
  return 'agent';
}

function buildSuccessCriteria(task) {
  const criteria = [];
  if (/test/i.test(task)) criteria.push('test:npm test');
  if (/website|frontend|ui/i.test(task)) criteria.push('file exists:public/index.html');
  if (!criteria.length) criteria.push(`response contains:${task.slice(0, 40).toLowerCase()}`);
  return criteria;
}

async function runWorkflow({
  task,
  sessionId = randomUUID(),
  mode = 'auto',
  speak = false,
  recordTask = true,
  maxRounds,
  successCriteria,
}) {
  const selectedMode = pickMode(task, { mode });
  const startedAt = new Date().toISOString();
  let result;
  let voice = null;

  if (selectedMode === 'crew') {
    const crewResult = await runCrew(task);
    result = {
      sessionId,
      response: crewResult.synthesis,
      toolResults: [],
      mode: 'crew',
      crew: crewResult,
      provider: 'crew',
    };
  } else if (selectedMode === 'goal') {
    const criteria = successCriteria?.length ? successCriteria : buildSuccessCriteria(task);
    const goalResult = await goalRunner.runGoalFromText({
      title: task.slice(0, 120),
      description: task,
      successCriteria: criteria,
      sessionId,
      maxRounds: maxRounds || config.goals.maxRounds,
    });
    result = {
      sessionId,
      response: goalResult.lastResult?.response || goalResult.note || 'Goal loop finished',
      toolResults: goalResult.lastResult?.toolResults || [],
      mode: 'goal',
      goal: goalResult,
      provider: goalResult.lastResult?.provider,
    };
  } else if (selectedMode === 'task') {
    const matched = taskStore.findByTrigger(task) || taskStore.get(task.replace(/repeat\s+/i, '').trim());
    if (!matched) {
      result = await runAgent({ sessionId, message: task });
      result.mode = 'agent';
    } else {
      const replay = await require('../tasks/replay').replayTask(matched, sessionId);
      result = { sessionId, response: replay.response, toolResults: replay.toolResults || [], mode: 'task', task: matched };
    }
  } else {
    result = await runAgent({ sessionId, message: task });
    result.mode = 'agent';
  }

  if (speak && result.response) {
    try {
      voice = await require('../channels/voice').speakText(result.response.slice(0, 2000));
    } catch (e) {
      voice = { ok: false, error: e.message };
    }
  }

  if (recordTask && result.toolResults?.length >= config.tasks.minStepsToRecord) {
    taskStore.recordFromRun({
      name: `workflow:${task.slice(0, 40)}`,
      message: task,
      toolResults: result.toolResults,
    });
  }

  return {
    ok: true,
    workflow: {
      task,
      mode: selectedMode,
      startedAt,
      finishedAt: new Date().toISOString(),
    },
    sessionId,
    response: result.response,
    toolResults: result.toolResults,
    attachments: result.attachments || extractAttachments(result.toolResults),
    voice,
    details: result.goal || result.crew || undefined,
  };
}

module.exports = { runWorkflow, pickMode, buildSuccessCriteria };
