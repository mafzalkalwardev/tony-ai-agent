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
const intentRouter = require('./intent_router');
const { classifyIntent } = require('../safety/policy');
const approvals = require('../safety/approvals');

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

  const routed = intentRouter.route(message);
  const safety = classifyIntent(routed.intent, message);

  // Resolve pending approvals via short yes/no replies
  const pending = approvals.list('pending');
  if (pending.length && approvals.isApprovalText(message)) {
    const item = approvals.decide(pending[0].id, true);
    const executed = await executeApprovedAction(item, sessionId);
    const response =
      executed?.response ||
      `Approved: ${item.action} — ${item.command}\nRetry the action (or ask me to continue) with approval noted.`;
    memory.appendEpisode(sessionId, 'assistant', response);
    return {
      sessionId,
      response,
      intent: routed,
      safety,
      approval: item,
      toolResults: executed?.toolResults || [],
      iterations: 0,
      provider: 'local',
      online: true,
      pendingApprovals: approvals.list('pending').slice(0, 5),
    };
  }
  if (pending.length && approvals.isRejectText(message)) {
    const item = approvals.decide(pending[0].id, false);
    const response = `Cancelled: ${item.action} — ${item.command}`;
    memory.appendEpisode(sessionId, 'assistant', response);
    return {
      sessionId,
      response,
      intent: routed,
      safety,
      approval: item,
      toolResults: [],
      iterations: 0,
      provider: 'local',
      online: true,
    };
  }

  if (safety.level === 'BLOCKED') {
    const response = `Blocked for safety: ${safety.reason}`;
    memory.appendEpisode(sessionId, 'assistant', response);
    return {
      sessionId,
      response,
      intent: routed,
      safety,
      toolResults: [],
      iterations: 0,
      provider: 'local',
      online: true,
    };
  }

  try {
    require('../tools/preferences').rememberCommand(message);
  } catch {
    /* ignore */
  }

  // Fast local paths for common operator intents (no LLM required)
  const localFast = await handleLocalOperatorIntent({ routed, safety, sessionId, message });
  if (localFast) return localFast;

  if (
    safety.level === 'NEEDS_APPROVAL' &&
    ['run_tests', 'build_project', 'git_push', 'git_commit', 'github_pr', 'search_web'].includes(routed.intent)
  ) {
    const pending = approvals.create({
      action: routed.intent,
      command: routed.params?.searchQuery || routed.normalized || message,
      reason: safety.reason,
      sessionId,
      meta: { category: routed.category, params: routed.params || {} },
    });
    const response = `Approval needed for **${routed.intent}** (${safety.reason}).\nReply **yes** / **haan** to approve, or **no** / **nahi** to cancel.\nPending id: ${pending.id}`;
    memory.appendEpisode(sessionId, 'assistant', response);
    return {
      sessionId,
      response,
      intent: routed,
      safety,
      approval: pending,
      pendingApprovals: approvals.list('pending').slice(0, 5),
      toolResults: [],
      iterations: 0,
      provider: 'local',
      online: true,
    };
  }

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
      intent: routed,
      safety,
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

  // Surface approval needs from tool results
  const needsApproval = toolResults.find((t) => t.result?.needsApproval || t.result?.level === 'NEEDS_APPROVAL');
  if (needsApproval && !needsApproval.result?.pendingApprovalId) {
    approvals.create({
      action: needsApproval.tool,
      command: needsApproval.args?.command || needsApproval.tool,
      reason: needsApproval.result?.error || needsApproval.result?.hint || 'Approval required',
      sessionId,
    });
  }

  return {
    sessionId,
    response: finalContent,
    plan: planResult,
    intent: routed,
    safety,
    pendingApprovals: approvals.list('pending').slice(0, 5),
    toolResults,
    attachments: require('../gateway/attachments').extractAttachments(toolResults),
    iterations,
    provider,
    online,
  };
}

async function executeApprovedAction(item, sessionId) {
  const action = item?.action;
  if (action === 'search_web' || action === 'shell' && /search/i.test(item.command || '')) {
    const result = require('../tools/web_search').searchWeb(item.command, { open: true });
    return {
      response: result.ok
        ? `Approved + opened search for **${result.query}**\n${result.url}`
        : `Approved, but search failed: ${result.error}`,
      toolResults: [{ tool: 'search_web', result }],
    };
  }
  if (action === 'run_tests') {
    const result = require('../tools/runners').runTests({ approved: true });
    return {
      response: result.ok
        ? `Tests approved and ran:\n\`\`\`\n${(result.output || '').slice(0, 4000)}\n\`\`\``
        : `Tests approved but failed: ${result.error || result.output || 'unknown'}`,
      toolResults: [{ tool: 'run_tests', result }],
    };
  }
  if (action === 'build_project') {
    const result = require('../tools/runners').runBuild({ approved: true });
    return {
      response: result.ok
        ? `Build approved and ran:\n\`\`\`\n${(result.output || '').slice(0, 4000)}\n\`\`\``
        : `Build approved but failed: ${result.error || result.output || 'unknown'}`,
      toolResults: [{ tool: 'build_project', result }],
    };
  }
  if (action === 'shell' && item.command) {
    const result = await executeTool('shell', { command: item.command, approved: true }, sessionId);
    return {
      response: result.ok
        ? `Ran approved command:\n\`\`\`\n${String(result.output || '').slice(0, 4000)}\n\`\`\``
        : `Approved command failed: ${result.error}`,
      toolResults: [{ tool: 'shell', result }],
    };
  }
  return null;
}

async function handleLocalOperatorIntent({ routed, safety, sessionId, message }) {
  const params = routed.params || {};
  const reply = (response, tool, result = { ok: true }) => {
    memory.appendEpisode(sessionId, 'assistant', response);
    return {
      sessionId,
      response,
      intent: routed,
      safety,
      toolResults: [{ tool, result }],
      iterations: 0,
      provider: 'local',
      online: true,
      pendingApprovals: approvals.list('pending').slice(0, 5),
    };
  };

  if (routed.intent === 'project_scan') {
    return reply(require('../tools/project_scanner').scanAsText('.'), 'project_scan');
  }
  if (routed.intent === 'client_delivery') {
    const pack = require('../tools/delivery_helper').prepareDeliveryPackage({
      projectPath: '.',
      completedWork: params.deliveryTopic || '',
    });
    return reply(pack.markdown, 'client_delivery', pack);
  }
  if (routed.intent === 'git_status') {
    try {
      const { execSync } = require('child_process');
      const out = execSync('git status --short', {
        cwd: config.workspaceRoot,
        encoding: 'utf8',
        timeout: 30000,
      });
      return reply(out.trim() || 'Working tree clean.', 'shell', {
        ok: true,
        command: 'git status --short',
      });
    } catch {
      return null;
    }
  }
  if (routed.intent === 'summarize_repo') {
    const result = require('../tools/github_helper').summarizeRepo();
    return reply(result.markdown, 'summarize_repo', result);
  }
  if (routed.intent === 'explain_changes') {
    const result = require('../tools/github_helper').explainChangedFiles();
    return reply(result.markdown, 'explain_changes', result);
  }
  if (routed.intent === 'commit_message') {
    const result = require('../tools/github_helper').generateCommitMessage(params.commitTopic || '');
    return reply(`Draft commit message:\n\n\`\`\`\n${result.message}\n\`\`\``, 'commit_message', result);
  }
  if (routed.intent === 'prepare_pr') {
    const result = require('../tools/github_helper').preparePrInstructions(params.commitTopic || '');
    return reply(result.markdown, 'prepare_pr', result);
  }
  if (routed.intent === 'copy_paste') {
    const clip = require('../tools/clipboard_tool').copyPaste({ mode: 'read' });
    return reply(
      clip.text ? `Clipboard (${clip.source}):\n${String(clip.text).slice(0, 2000)}` : 'Clipboard is empty.',
      'clipboard',
      clip
    );
  }
  if (routed.intent === 'open_app') {
    const app = params.appName || 'browser';
    const result = require('../tools/open_app').openApp(app);
    return reply(
      result.ok ? `Opening **${app}**…` : `Could not open ${app}: ${result.error}`,
      'open_app',
      result
    );
  }
  if (routed.intent === 'file_task' && params.filePath) {
    const result = await executeTool('read_file', { path: params.filePath }, sessionId);
    if (result.ok) {
      return reply(`# ${params.filePath}\n\n\`\`\`\n${String(result.content).slice(0, 4000)}\n\`\`\``, 'read_file', result);
    }
    return reply(result.error || 'Could not read file.', 'read_file', result);
  }
  if (routed.intent === 'settings') {
    const prefs = require('../tools/preferences').load();
    const stt = require('../voice/local_stt').status();
    const response = `# Preferences

- Assistant: ${prefs.assistantName}
- User: ${prefs.userName}
- Language: ${prefs.language}
- Always listen: ${prefs.voice?.alwaysListen}
- Prefer local TTS: ${prefs.voice?.preferLocalTts}
- Prefer local STT: ${prefs.voice?.preferLocalStt}
- Always allow npm test: ${prefs.safety?.alwaysAllowNpmTest}
- Local STT bridge: ${stt.configured ? 'script ready' : 'missing'}
- Recent commands: ${(prefs.recentCommands || []).slice(0, 5).map((c) => c.command).join(' | ') || 'none'}

Say "project note: …" to save a note (no secrets).`;
    return reply(response, 'preferences_get', { ok: true, preferences: prefs, stt });
  }
  if (/^project\s+note\s*:/i.test(message)) {
    const note = message.replace(/^project\s+note\s*:/i, '').trim();
    const preferences = require('../tools/preferences').addProjectNote(note);
    return reply(
      preferences.error || `Saved project note. Total notes: ${(preferences.projectNotes || []).length}`,
      'preferences_update',
      { ok: !preferences.error, preferences }
    );
  }
  return null;
}

module.exports = { runAgent, handleLocalOperatorIntent };
