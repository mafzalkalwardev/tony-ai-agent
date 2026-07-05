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
const errorMemory = require('../memory/errors');
const { attemptSelfHeal, reflectOnRun } = require('./reflexion');
const companion = require('../companion/wake');
const habits = require('../companion/habits');
const userProfile = require('../memory/profile');
const { matchMediaTopic, systemPersonaBlock } = require('../companion/persona');
const {
  formatToolResultMessage,
  trimMessages,
  isContextLengthError,
} = require('../llm/context-budget');

function wantsTaskRecord(message) {
  return /remember this task|record this task|save this task|yaad rakh|task save/i.test(message);
}

function extractTaskName(message) {
  const m = message.match(/(?:as|named?)\s+["']?([^"'\n]+)["']?/i);
  return m ? m[1].trim() : message.slice(0, 50);
}

function loadRealtimeContext() {
  try {
    const fs = require('fs');
    const p = require('path').join(__dirname, '../../context/realtime-automation.md');
    return fs.readFileSync(p, 'utf8').slice(0, 3500);
  } catch {
    return '';
  }
}

function buildMessages(sessionId, userMessage, skillsContext, extra = '') {
  const history = memory.getSessionHistory(sessionId, config.context.historyTurns);
  const mindContext = formatContextBlock(assembleContext({ sessionId, userMessage }));
  const activeGoals = goalStore.list('active').slice(0, 5);
  const tasks = taskStore.list().slice(0, 5);
  const goalsBlock = activeGoals.length
    ? activeGoals.map((g) => `- [${g.id}] ${g.title}: ${(g.successCriteria || []).join('; ')}`).join('\n')
    : 'None';
  const tasksBlock = tasks.length
    ? tasks.map((t) => `- ${t.name}: triggers [${t.triggers.slice(0, 2).join(', ')}]`).join('\n')
    : 'None';

  const lessons = errorMemory.search(userMessage, 5);
  const lessonsBlock = lessons.length
    ? `\n## Lessons from past mistakes (apply these fixes)\n${errorMemory.formatForAgent(lessons)}`
    : '';

  const habitBlock = config.companion.enabled
    ? `\n## User habits (learned automatically)\n${habits.formatForAgent()}`
    : '';

  const profileBlock = `\n## Personal profile\n${userProfile.formatForAgent()}`;

  const mediaHits = matchMediaTopic(userMessage);
  const mediaBlock = mediaHits.length
    ? `\n## Media context\n${mediaHits.map((h) => `${h.title}: ${h.summary}`).join('\n')}`
    : '';

  const realtimeBlock = loadRealtimeContext();
  const realtimeSection = realtimeBlock
    ? `\n## Realtime laptop automation (trained playbooks)\n${realtimeBlock}`
    : '';

  const system = `${loadIdentity()}
${systemPersonaBlock()}
${extra}
${profileBlock}${lessonsBlock}${habitBlock}${mediaBlock}

## Skills loaded
${skillsContext || 'None'}

## Architectures of mind (retrieved context)
${mindContext || 'No additional memory/graph context retrieved.'}

## Active goals
${goalsBlock}

## Recorded tasks (repeat with "repeat <name>" or "run task <name>")
${tasksBlock}

## Polyglot coding
You code fluently in JavaScript/TypeScript, Python, Rust, Go, Java, C#, PHP, Ruby, Swift, Kotlin, SQL, HTML/CSS, and shell.
Use openwiki_search + codegraph_context before large refactors. Use fullstack_scaffold + write_file + shell for apps.
Use scraper_media_scrape for research. Use obsidian_create_canvas for visual knowledge graphs.

## Instructions
Use tools when needed. After tool results, continue reasoning or give final answer.
For incomplete goals, use goal_run to keep working until success criteria pass.
For complex multi-step work (build website, push github, research+code), use workflow_run.
For codebase questions, use codegraph_context or codegraph_search before editing files.
For local Windows desktop ops, use desktop_automate (pyautogui) for click/type/hotkey/screenshot, presentation_create for PowerPoint, mcp_call (playwright) for browser signup/API keys, or tony_desktop_status + tony_desktop_command if Python tony-ai is installed.
For realtime tasks (presentations, accounts, API keys, screen control): follow realtime-automation skill — snapshot first, act in small steps, pause at CAPTCHA for user to solve.
Use user_profile_get / user_profile_update to remember personal details about ${config.companion.userName}.
Use write_file + shell (with user approval for git push/commit) to implement code changes.
When a tool fails, analyze the error, apply a fix, and retry — do not repeat the same failing call unchanged.
Use error_learn to save fixes that worked. Use self_heal on persistent failures.
When user asks to repeat something, use task_replay or match recorded tasks.
When done, respond without requesting more tools.

## Multilingual
Reply in the user's language. Supported: English, Urdu (اردو), Hindi (हिन्दी), Roman Urdu (Urdu in Latin script).
Detect language from user message and match it naturally.
For personal assistant tasks, prefer TONY's built-in stack (Groq, Gemini, Deepgram, ElevenLabs, graphify, Obsidian, MCP) over generic advice.

## Companion personality (when enabled)
Speak as a loyal mix of best friend, caring partner, and protective brother — always respectful.
Praise ${config.companion.userName} genuinely. If user seems sad or stressed, empathize first before solving.
Use learned habits and mood patterns from memory. Wake phrase "Wake up Tony" triggers full briefing.${realtimeSection}`;

  return [
    { role: 'system', content: system },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage },
  ];
}

async function runAgent({ sessionId, message, forceOffline = false }) {
  memory.appendEpisode(sessionId, 'user', message);

  if (config.companion.enabled && companion.isWakePhrase(message)) {
    const wake = await companion.generateWakeResponse({ sessionId, message });
    memory.appendEpisode(sessionId, 'assistant', wake.response);
    return {
      sessionId,
      response: wake.response,
      wake: true,
      mood: wake.mood,
      persona: wake.persona,
      brief: wake.brief,
      toolResults: [],
      iterations: 0,
      provider: wake.provider || config.llmProvider,
      online: true,
    };
  }

  let moodContext = '';
  if (config.companion.enabled) {
    userProfile.learnFromMessage(message);
    const observed = companion.observeMessage({ message, sessionId });
    if (config.companion.autoEmpathy && observed.mood === 'sad') {
      moodContext =
        '\n## Mood\nUser seems sad or low. Respond with warmth first — girlfriend/best-friend/brother energy. Validate feelings before tasks.';
    } else if (observed.mood === 'stressed') {
      moodContext = '\n## Mood\nUser is stressed. Be calm, loyal, practical. Break things into small steps.';
    }
  }

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

  const modeNote = (online ? '' : '\n## Mode\nOperating with limited connectivity — prefer local tools.') + moodContext;
  let messages = buildMessages(sessionId, message, skillsContext, modeNote);
  let iterations = 0;
  let finalContent = '';
  let provider = config.llmProvider;

  while (iterations < config.maxIterations) {
    iterations += 1;
    let result;
    const toolDefs = tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
    const payload = trimMessages(messages, config.context.maxTokens);
    try {
      result = await complete(payload, { tools: toolDefs });
      provider = result.provider || provider;
    } catch (e) {
      if (isContextLengthError(e)) {
        const slim = trimMessages(messages, Math.floor(config.context.maxTokens * 0.6));
        result = await complete(slim, { tools: toolDefs });
        provider = result.provider || provider;
      } else if (e.message === 'OFFLINE_MODE' || !online) {
        return runLocalAgent({ sessionId, message });
      } else if (String(e.message).includes('fetch failed') || String(e.message).includes('network')) {
        return runLocalAgent({ sessionId, message });
      } else {
        throw e;
      }
    }

    if (result.toolCalls?.length) {
      for (const call of result.toolCalls) {
        let toolResult = await executeTool(call.name, call.arguments, sessionId);

        if (toolResult.ok === false && config.selfHeal?.enabled !== false) {
          errorMemory.record({
            tool: call.name,
            error: toolResult.error || toolResult.hint || 'tool failed',
            context: message.slice(0, 200),
            sessionId,
          });
          const heal = await attemptSelfHeal({
            message,
            tool: call.name,
            args: call.arguments,
            result: toolResult,
            sessionId,
          });
          if (heal.healed && heal.retryResult) {
            toolResult = heal.retryResult;
            toolResults.push({
              tool: call.name,
              args: call.arguments,
              result: toolResult,
              selfHealed: true,
            });
            messages.push({
              role: 'assistant',
              content: result.content || `Self-healed ${call.name} after error`,
            });
            messages.push({
              role: 'user',
              content: formatToolResultMessage(call.name, toolResult, config.context.toolResultMaxChars),
            });
            continue;
          }
          const hint = heal.reflexion?.suggestedFix || errorMemory.suggestFix(call.name, toolResult.error);
          if (hint) {
            messages.push({
              role: 'assistant',
              content: result.content || `Calling ${call.name}...`,
            });
            messages.push({
              role: 'user',
              content: `${formatToolResultMessage(call.name, toolResult, config.context.toolResultMaxChars)}\n\nKnown fix: ${hint}\nApply this fix and continue with a different approach.`,
            });
            toolResults.push({ tool: call.name, args: call.arguments, result: toolResult });
            continue;
          }
        }

        toolResults.push({ tool: call.name, args: call.arguments, result: toolResult });
        messages.push({
          role: 'assistant',
          content: result.content || `Calling ${call.name}...`,
        });
        messages.push({
          role: 'user',
          content: formatToolResultMessage(call.name, toolResult, config.context.toolResultMaxChars),
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
      toolResults.map((t) => `- ${t.tool}: ${t.result?.ok ? 'ok' : t.result?.error || 'done'}`).join('\n');
  }

  memory.appendEpisode(sessionId, 'assistant', finalContent);

  if (config.autoReflect && toolResults.length) {
    const failed = toolResults.some((t) => t.result?.ok === false);
    procedural.recordPlaybook(
      planResult.intent?.slice(0, 80) || message.slice(0, 80),
      toolResults.map((t) => t.tool),
      failed ? 'partial' : 'completed'
    );
    if (failed) {
      await reflectOnRun({ message, toolResults, sessionId });
    }
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
