const { execSync } = require('child_process');
const config = require('../config');
const goalStore = require('./store');
const { runAgent } = require('../core/agent');
const { complete } = require('../llm');

async function verifyCriteria(goal) {
  const checks = [];

  for (const criterion of goal.successCriteria || []) {
    const c = String(criterion).trim();
    if (!c) continue;

    if (/^test:/i.test(c)) {
      const cmd = c.replace(/^test:/i, '').trim() || 'npm test';
      try {
        execSync(cmd, { cwd: config.workspaceRoot, encoding: 'utf8', timeout: 120000, stdio: 'pipe' });
        checks.push({ criterion: c, passed: true });
      } catch (e) {
        checks.push({ criterion: c, passed: false, error: e.message?.slice(0, 500) });
      }
      continue;
    }

    if (/^file exists:/i.test(c)) {
      const fs = require('fs');
      const p = c.replace(/^file exists:/i, '').trim();
      checks.push({ criterion: c, passed: fs.existsSync(p) });
      continue;
    }

    if (/^response contains:/i.test(c)) {
      const needle = c.replace(/^response contains:/i, '').trim().toLowerCase();
      const last = goal.progress?.[goal.progress.length - 1];
      const text = (last?.response || '').toLowerCase();
      checks.push({ criterion: c, passed: text.includes(needle) });
      continue;
    }

    checks.push({ criterion: c, passed: null, note: 'manual or LLM-verified' });
  }

  const automated = checks.filter((x) => x.passed !== null);
  const allAutomatedPass = automated.length > 0 && automated.every((x) => x.passed);
  const hasManual = checks.some((x) => x.passed === null);

  return { checks, allAutomatedPass, hasManual, complete: allAutomatedPass && !hasManual };
}

async function llmVerifyGoal(goal, lastResponse) {
  const criteria = (goal.successCriteria || []).join('\n- ');
  const result = await complete(
    [
      {
        role: 'system',
        content:
          'You verify goal completion. Reply ONLY with JSON: {"complete": true|false, "reason": "..."}',
      },
      {
        role: 'user',
        content: `Goal: ${goal.title}\nDescription: ${goal.description}\nSuccess criteria:\n- ${criteria}\n\nLatest agent response:\n${lastResponse}\n\nIs the goal complete?`,
      },
    ],
    { temperature: 0 }
  );

  try {
    const parsed = JSON.parse(result.content.match(/\{[\s\S]*\}/)?.[0] || '{}');
    return { complete: Boolean(parsed.complete), reason: parsed.reason || '' };
  } catch {
    return { complete: false, reason: 'Could not parse verification' };
  }
}

function buildGoalPrompt(goal) {
  const criteria = (goal.successCriteria || []).map((c) => `- ${c}`).join('\n');
  const history = (goal.progress || [])
    .slice(-3)
    .map((p) => `Round ${p.round}: ${p.response?.slice(0, 400) || p.note}`)
    .join('\n');

  return `GOAL (keep working until ALL success criteria are met):
Title: ${goal.title}
Description: ${goal.description}

Success criteria:
${criteria || '- Agent declares goal complete with evidence'}

Previous rounds:
${history || 'None — this is the first round.'}

Instructions: Use tools. Make measurable progress. When done, state clearly which criteria are satisfied and provide evidence.`;
}

async function runGoal({ goalId, sessionId, maxRounds }) {
  const goal = goalStore.get(goalId);
  if (!goal) throw new Error(`Goal not found: ${goalId}`);
  if (goal.status === 'completed') return { goal, status: 'already_completed' };

  const rounds = maxRounds || config.goals.maxRounds;
  let lastResult = null;

  for (let round = 1; round <= rounds; round += 1) {
    const current = goalStore.get(goalId);
    if (current.status === 'completed') break;

    const prompt = buildGoalPrompt(current);
    lastResult = await runAgent({ sessionId, message: prompt });

    goalStore.appendProgress(goalId, {
      round,
      response: lastResult.response,
      tools: lastResult.toolResults?.map((t) => t.tool),
      iterations: lastResult.iterations,
    });

    const verification = await verifyCriteria(goalStore.get(goalId));
    if (verification.complete) {
      goalStore.complete(goalId, lastResult.response);
      return {
        goal: goalStore.get(goalId),
        status: 'completed',
        rounds: round,
        verification,
        lastResult,
      };
    }

    const llmCheck = await llmVerifyGoal(current, lastResult.response);
    if (llmCheck.complete && verification.allAutomatedPass !== false) {
      goalStore.complete(goalId, llmCheck.reason || lastResult.response);
      return {
        goal: goalStore.get(goalId),
        status: 'completed',
        rounds: round,
        verification: { ...verification, llm: llmCheck },
        lastResult,
      };
    }
  }

  const final = goalStore.get(goalId);
  return {
    goal: final,
    status: final.status === 'completed' ? 'completed' : 'in_progress',
    rounds: final.rounds,
    lastResult,
    note: final.status !== 'completed' ? `Reached max rounds (${rounds})` : undefined,
  };
}

async function runGoalFromText({ title, description, successCriteria, sessionId, maxRounds }) {
  const goal = goalStore.create({ title, description, successCriteria });
  const result = await runGoal({ goalId: goal.id, sessionId, maxRounds });
  return result;
}

module.exports = { runGoal, runGoalFromText, verifyCriteria, buildGoalPrompt };
