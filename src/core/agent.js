const config = require('../config');
const memory = require('../memory');
const procedural = require('../memory/procedural');
const { complete, loadIdentity } = require('../llm');
const { listTools, executeTool } = require('../tools/registry');
const { plan, synthesize } = require('./planner');
const { loadSkillsContext } = require('../skills/loader');
const { assembleContext, formatContextBlock } = require('../brain/architectures');
const goalStore = require('../goals/store');
const taskStore = require('../tasks/store');
const { replayTask } = require('../tasks/replay');
const { runLocalAgent } = require('../local/agent');
const { isOnline } = require('../local/connectivity');

function wantsTaskRecord(message) {
  return /remember this task|record this task|save this task|yaad rakh|task save/i.test(message);
}

function extractTaskName(message) {
  const m = message.match(/(?:as|named?)\s+["']?([^"'\n]+)["']?/i);
  return m ? m[1].trim() : message.slice(0, 50);
}

function buildMessages(sessionId, userMessage, skillsContext, extra = '') {
  const history = memory.getSessionHistory(sessionId, 20);
  const mindContext = formatContextBlock(assembleContext({ sessionId, userMessage }));
  const activeGoals = goalStore.list('active').slice(0, 5);
  const tasks = taskStore.list().slice(0, 5);
  const goalsBlock = activeGoals.length
    ? activeGoals.map((g) => `- [${g.id}] ${g.title}: ${(g.successCriteria || []).join('; ')}`).join('\n')
    : 'None';
  const tasksBlock = tasks.length
    ? tasks.map((t) => `- ${t.name}: triggers [${t.triggers.slice(0, 2).join(', ')}]`).join('\n')
    : 'None';

  const system = `${loadIdentity()}
${extra}

## Skills loaded
${skillsContext || 'None'}

## Architectures of mind (retrieved context)
${mindContext || 'No additional memory/graph context retrieved.'}

## Active goals
${goalsBlock}

## Recorded tasks (repeat with "repeat <name>" or "run task <name>")
${tasksBlock}

## Instructions
Use tools when needed. After tool results, continue reasoning or give final answer.
For incomplete goals, use goal_run to keep working until success criteria pass.
For complex multi-step work (build website, push github, research+code), use workflow_run.
For codebase questions, use codegraph_context or codegraph_search before editing files.
For local Windows desktop ops, check tony_desktop_status then tony_desktop_command if Python tony-ai is installed.
Use write_file + shell (with user approval for git push/commit) to implement code changes.
When user asks to repeat something, use task_replay or match recorded tasks.
When done, respond without requesting more tools.

## Multilingual
Reply in the user's language. Supported: English, Urdu (اردو), Hindi (हिन्दी), Roman Urdu (Urdu in Latin script).
Detect language from user message and match it naturally.
For personal assistant tasks, prefer TONY's built-in stack (Groq, Gemini, Deepgram, ElevenLabs, graphify, Obsidian, MCP) over generic advice.`;

  return [
    { role: 'system', content: system },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage },
  ];
}

async function runAgent({ sessionId, message, forceOffline = false }) {
  memory.appendEpisode(sessionId, 'user', message);

  const online = forceOffline ? false : await isOnline();
  if (!online && config.offline.autoDetect) {
    return runLocalAgent({ sessionId, message });
  }

  const matchedTask = taskStore.findByTrigger(message);
  if (matchedTask && /repeat|again|dobara|phir se|run task/i.test(message)) {
    return replayTask(matchedTask, sessionId);
  }

  const skillsContext = loadSkillsContext();
  const planResult = await plan(message, sessionId);
  const tools = listTools();
  const toolResults = [];

  const modeNote = online ? '' : '\n## Mode\nOperating with limited connectivity — prefer local tools.';
  let messages = buildMessages(sessionId, message, skillsContext, modeNote);
  let iterations = 0;
  let finalContent = '';
  let provider = config.llmProvider;

  while (iterations < config.maxIterations) {
    iterations += 1;
    let result;
    try {
      result = await complete(messages, {
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      });
      provider = result.provider || provider;
    } catch (e) {
      if (e.message === 'OFFLINE_MODE' || !online) {
        return runLocalAgent({ sessionId, message });
      }
      if (String(e.message).includes('fetch failed') || String(e.message).includes('network')) {
        return runLocalAgent({ sessionId, message });
      }
      throw e;
    }

    if (result.toolCalls?.length) {
      for (const call of result.toolCalls) {
        const toolResult = await executeTool(call.name, call.arguments, sessionId);
        toolResults.push({ tool: call.name, args: call.arguments, result: toolResult });
        messages.push({
          role: 'assistant',
          content: result.content || `Calling ${call.name}...`,
        });
        messages.push({
          role: 'user',
          content: `Tool ${call.name} result:\n${JSON.stringify(toolResult, null, 2)}`,
        });
      }
      continue;
    }

    finalContent = result.content || '';
    break;
  }

  if (!finalContent && toolResults.length) {
    try {
      finalContent = await synthesize(message, planResult, toolResults);
    } catch {
      finalContent =
        'Completed with tools:\n' + toolResults.map((t) => `- ${t.tool}`).join('\n');
    }
  }

  if (!finalContent) {
    finalContent =
      'I reached the iteration limit. Here is what I gathered:\n' +
      JSON.stringify(toolResults, null, 2);
  }

  memory.appendEpisode(sessionId, 'assistant', finalContent);

  if (config.autoReflect && toolResults.length) {
    procedural.recordPlaybook(
      planResult.intent?.slice(0, 80) || message.slice(0, 80),
      toolResults.map((t) => t.tool),
      'completed'
    );
  }

  if (
    (config.tasks.autoRecord || wantsTaskRecord(message)) &&
    toolResults.length >= config.tasks.minStepsToRecord
  ) {
    const recorded = taskStore.recordFromRun({
      name: extractTaskName(message),
      message,
      toolResults,
    });
    finalContent += `\n\n_(Task recorded as "${recorded.name}" — say "repeat ${recorded.name}" to run offline)_`;
  }

  return {
    sessionId,
    response: finalContent,
    plan: planResult,
    toolResults,
    iterations,
    provider,
    online,
  };
}

module.exports = { runAgent };
