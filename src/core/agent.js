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
Use write_file + shell (with user approval for git push/commit unless Trusted Operator Mode is ON) to implement code changes.
When Trusted Operator Mode is ON: auto-approve research on ANY public website, desktop/laptop control, installs, builds, tests, git write. Still NEVER read/write secrets (.env/tokens), never rm -rf, never complete payments, never deceptive deepfakes.
Memorial voice cloning of loved ones is allowed ONLY through memorial_voice_* tools after explicit consent phrase + rights affirmation (personal remembrance). Always label synthetic memorial speech. Never use memorial voices to deceive third parties.
Use browser_operator / research_web / browse_site / playwright tools for full-web research and site control.
Use desktop_automate / laptop_control / open_app for full laptop control (click/type/scroll/drag/hotkeys/sequences).
Use create_issue / create_pr (gh) after approval or trusted mode.
Telegram + Discord channels can receive/send remote commands when configured.
Use workspace_list / workspace_add / workspace_switch for multi-repo work.
Use reminder_add / daily_briefing for local reminders and morning briefings.
Use vault_watch_start / vault_sync_index for live Obsidian vault watching.
Use generate_skill to draft skills from successful playbooks.
Use prefs_vault_seal / prefs_vault_open when TONY_PREFS_SECRET is set.
TONY MCP tools are available at /api/mcp/tony/* for Cursor integration.
Use memory_vector_search / memory_reindex for local embedding search.
Use client_list / client_upsert for client tracking (no secrets).
Use macro_save / macro_list for operator shortcuts; export_session for transcripts.
Use checkpoint_save/list/restore for session snapshots; audit_recent for safety audit.
Use changelog_digest, backup_data, focus_start/stop for operator hygiene.
For big risky choices use decide_action — in trusted mode take the decision and execute; otherwise ask once.
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
    ['run_tests', 'build_project', 'git_push', 'git_commit', 'github_pr', 'create_pr', 'create_issue', 'search_web'].includes(
      routed.intent
    )
  ) {
    const trusted = require('../safety/trusted_mode');
    if (trusted.canAutoApprove(routed.intent, message)) {
      // Trusted mode: fall through and execute instead of waiting.
    } else {
      const pending = approvals.create({
        action: routed.intent,
        command: routed.params?.searchQuery || routed.normalized || message,
        reason: safety.reason,
        sessionId,
        meta: { category: routed.category, params: routed.params || {} },
      });
      const response = `Approval needed for **${routed.intent}** (${safety.reason}).\nReply **yes** / **haan**, or enable \`Tony trusted mode on\` for full autonomy.\nPending id: ${pending.id}`;
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
  }

  // In trusted mode, auto-run common risky operator intents immediately.
  if (require('../safety/trusted_mode').canAutoApprove(routed.intent, message)) {
    if (routed.intent === 'run_tests') {
      const result = require('../tools/runners').runTests({ approved: true });
      memory.appendEpisode(sessionId, 'assistant', result.ok ? result.output : result.error);
      return {
        sessionId,
        response: result.ok
          ? `Trusted mode ran tests:\n\`\`\`\n${(result.output || '').slice(0, 5000)}\n\`\`\``
          : `Trusted mode test run failed: ${result.error}`,
        intent: routed,
        safety: { level: 'TRUSTED_AUTO', reason: 'Trusted Operator Mode' },
        toolResults: [{ tool: 'run_tests', result }],
        iterations: 0,
        provider: 'local',
        online: true,
      };
    }
    if (routed.intent === 'build_project') {
      const result = require('../tools/runners').runBuild({ approved: true });
      return {
        sessionId,
        response: result.ok
          ? `Trusted mode ran build:\n\`\`\`\n${(result.output || '').slice(0, 5000)}\n\`\`\``
          : `Trusted mode build failed: ${result.error}`,
        intent: routed,
        safety: { level: 'TRUSTED_AUTO', reason: 'Trusted Operator Mode' },
        toolResults: [{ tool: 'build_project', result }],
        iterations: 0,
        provider: 'local',
        online: true,
      };
    }
    if (routed.intent === 'search_web') {
      const q = routed.params?.searchQuery || routed.normalized || message;
      const result = require('../tools/web_search').searchWeb(q, { open: true });
      memory.appendEpisode(sessionId, 'assistant', result.url || result.error || '');
      return {
        sessionId,
        response: result.ok ? `Trusted mode opened research: ${result.url}` : result.error,
        intent: routed,
        safety: { level: 'TRUSTED_AUTO', reason: 'Trusted Operator Mode' },
        toolResults: [{ tool: 'search_web', result }],
        iterations: 0,
        provider: 'local',
        online: true,
      };
    }
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
  if (action === 'search_web' || action === 'research_web') {
    if (action === 'research_web') {
      const result = await require('../tools/research_web').researchTopic(item.command, { openBrowser: true });
      return { response: result.markdown || result.error, toolResults: [{ tool: 'research_web', result }] };
    }
    const result = require('../tools/web_search').searchWeb(item.command, { open: true });
    return {
      response: result.ok
        ? `Approved + opened search for **${result.query}**\n${result.url}`
        : `Approved, but search failed: ${result.error}`,
      toolResults: [{ tool: 'search_web', result }],
    };
  }
  if (action === 'browse_site') {
    const result = await require('../tools/research_web').browseSite(item.command, { open: true });
    return { response: result.markdown || result.error, toolResults: [{ tool: 'browse_site', result }] };
  }
  if (action === 'laptop_control' || action === 'desktop_automate') {
    const shot = require('../bridge/automation').run({ action: 'screenshot' });
    return {
      response: `Approved laptop control. Screenshot: ${shot.path || shot.error || 'ready'}. Give me the next click/type steps.`,
      toolResults: [{ tool: 'laptop_control', result: shot }],
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
  if (routed.intent === 'create_issue') {
    const title =
      params.issueTitle ||
      String(message || '')
        .replace(/.*\b(create|open)\s+issue\b[:\s-]*/i, '')
        .trim() ||
      'Tony issue';
    const trusted = require('../safety/trusted_mode');
    if (!trusted.canAutoApprove('create_issue', title)) {
      const pending = approvals.create({
        action: 'create_issue',
        command: title,
        reason: 'Creating GitHub issues requires approval or Trusted Mode',
        sessionId,
      });
      return reply(
        `Approval needed to create issue **${title}**.\nReply **yes** / **haan**, or \`Tony trusted mode on\`.\nPending: ${pending.id}`,
        'create_issue',
        { needsApproval: true, pendingApprovalId: pending.id }
      );
    }
    const result = require('../tools/github_helper').createIssue({ title, body: params.body || '' });
    return reply(
      result.ok ? `Issue created:\n${result.output}` : `Issue create failed: ${result.error}`,
      'create_issue',
      result
    );
  }
  if (routed.intent === 'create_pr') {
    const trusted = require('../safety/trusted_mode');
    const title = params.prTitle || '';
    if (!trusted.canAutoApprove('create_pr', title || 'pr')) {
      const pending = approvals.create({
        action: 'create_pr',
        command: title || 'create pr',
        reason: 'Creating GitHub PRs requires approval or Trusted Mode',
        sessionId,
      });
      return reply(
        `Approval needed to create PR.\nReply **yes** / **haan**, or \`Tony trusted mode on\`.\nPending: ${pending.id}`,
        'create_pr',
        { needsApproval: true, pendingApprovalId: pending.id }
      );
    }
    const result = require('../tools/github_helper').createPullRequest({
      title: title || undefined,
      body: params.body || '',
      draft: Boolean(params.draft),
    });
    return reply(
      result.ok ? `PR created:\n${result.output}` : `PR create failed: ${result.error}`,
      'create_pr',
      result
    );
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
  if (routed.intent === 'daily_briefing') {
    const brief = require('../tools/reminders').dailyBriefing();
    return reply(brief.markdown, 'daily_briefing', brief);
  }
  if (routed.intent === 'reminder') {
    const minutesMatch = String(message || '').match(/\bin\s+(\d+)\s+(minute|minutes|min|hour|hours)\b/i);
    let minutesFromNow = 60;
    if (minutesMatch) {
      const n = Number(minutesMatch[1]);
      minutesFromNow = /hour/i.test(minutesMatch[2]) ? n * 60 : n;
    }
    const text = String(message || '')
      .replace(/^.*?\b(reminder|remind me|yaad dilana)\b[:\s-]*/i, '')
      .replace(/\bin\s+\d+\s+(minute|minutes|min|hour|hours)\b/i, '')
      .trim() || String(message || '').trim();
    if (/^list|dikhao|show/i.test(text) || /\breminders?\b\s*$/i.test(message || '')) {
      const items = require('../tools/reminders').list();
      return reply(
        items.length
          ? `# Reminders\n${items.map((r) => `- ${r.text} _(due ${r.dueAt})_`).join('\n')}`
          : 'No open reminders. Say `Tony reminder in 30 minutes: …`',
        'reminder_list',
        { reminders: items }
      );
    }
    const result = require('../tools/reminders').addReminder({ text, minutesFromNow });
    return reply(
      result.ok
        ? `Reminder set for **${result.reminder.dueAt}**:\n${result.reminder.text}`
        : result.error,
      'reminder_add',
      result
    );
  }
  if (routed.intent === 'workspace_switch') {
    const ws = require('../tools/workspaces');
    if (/\blist\b/i.test(message)) {
      const listed = ws.list();
      return reply(
        `# Workspaces\nActive: \`${listed.activePath}\`\n${listed.workspaces
          .map((w) => `- ${w.active ? '✅ ' : ''}${w.name} (\`${w.id}\`) → ${w.path}`)
          .join('\n')}`,
        'workspace_list',
        listed
      );
    }
    const addMatch = String(message || '').match(/\badd\s+workspace\s+(.+?)\s+at\s+(.+)$/i);
    if (addMatch) {
      const result = ws.addWorkspace({ name: addMatch[1].trim(), path: addMatch[2].trim() });
      return reply(
        result.ok ? `Workspace added. Active still: \`${result.activePath}\`` : result.error,
        'workspace_add',
        result
      );
    }
    const target =
      String(message || '')
        .replace(/.*\b(switch|change)\s+(workspace|repo)\b[:\s-]*/i, '')
        .replace(/.*\bworkspace\s+switch\b[:\s-]*/i, '')
        .trim() || '';
    if (!target || /^(list|show)$/i.test(target)) {
      const listed = ws.list();
      return reply(
        `# Workspaces\nActive: \`${listed.activePath}\`\n${listed.workspaces
          .map((w) => `- ${w.active ? '✅ ' : ''}${w.name} (\`${w.id}\`) → ${w.path}`)
          .join('\n')}\n\nSwitch with: \`Tony switch workspace <name>\``,
        'workspace_list',
        listed
      );
    }
    const result = ws.switchWorkspace(target);
    return reply(
      result.ok
        ? `Switched workspace to **${result.switchedTo.name}**\n\`${result.workspaceRoot}\``
        : result.error,
      'workspace_switch',
      result
    );
  }
  if (routed.intent === 'vault_watch') {
    const watcher = require('../brain/vault_watcher');
    if (/\bsync\b/i.test(message)) {
      const result = watcher.syncIndex();
      return reply(
        result.ok
          ? `Vault index synced. Events: ${result.events?.length || 0}`
          : result.error,
        'vault_sync_index',
        result
      );
    }
    const started = watcher.start();
    const st = watcher.status();
    return reply(
      `# Vault watcher\nWatching: **${st.watching ? 'yes' : 'no'}**\nRecent events: ${st.recentEvents?.length || 0}\n${
        started.error ? `\nNote: ${started.error}` : ''
      }`,
      'vault_watch_status',
      { ...started, ...st }
    );
  }
  if (routed.intent === 'generate_skill') {
    const name =
      String(message || '')
        .replace(/.*\b(generate|draft)\s+skill\b[:\s-]*/i, '')
        .replace(/.*\bskill\s+(banao|draft|generate)\b[:\s-]*/i, '')
        .trim() || 'operator-flow';
    const write = /\bwrite\b|\bsave\b/i.test(message);
    const result = require('../skills/generate').draftFromPlaybooks({ name, query: name, write });
    return reply(
      `${result.draftOnly ? 'Draft only' : 'Saved'} skill **${result.id}** (from ${result.playbooksUsed} playbooks)\n\n\`\`\`md\n${String(result.content).slice(0, 3500)}\n\`\`\``,
      'generate_skill',
      result
    );
  }
  if (routed.intent === 'client_tracker') {
    const clients = require('../tools/clients');
    if (/\blist\b/i.test(message) || /\bclients?\s*$/i.test(message.trim())) {
      const listed = clients.list();
      return reply(
        listed.clients.length
          ? `# Clients\n${listed.clients.map((c) => `- **${c.name}** ${c.company || ''} _(notes: ${(c.notes || []).length})_`).join('\n')}`
          : 'No clients yet. Say `Tony add client Acme: wants dark mode`.',
        'client_list',
        listed
      );
    }
    const m = String(message || '').match(/\b(?:add\s+client|client\s+add|client\s+note)\s+([^:]+)(?::\s*(.*))?$/i);
    const name = m?.[1]?.trim() || String(message || '').replace(/.*\bclient\b/i, '').trim();
    const notes = m?.[2]?.trim() || '';
    const result = clients.upsertClient({ name: name || 'Client', notes });
    return reply(
      result.ok ? `Saved client **${result.client.name}**. Notes: ${(result.client.notes || []).length}` : result.error,
      'client_upsert',
      result
    );
  }
  if (routed.intent === 'macro') {
    const macros = require('../tools/macros');
    if (/\blist\b/i.test(message)) {
      const listed = macros.list();
      return reply(
        listed.macros.length
          ? `# Macros\n${listed.macros.map((m) => `- **${m.name}** → \`${m.command}\``).join('\n')}`
          : 'No macros. Save with `Tony save macro status: repo check karo`.',
        'macro_list',
        listed
      );
    }
    const runMatch = String(message || '').match(/\brun\s+macro\s+(.+)$/i);
    if (runMatch) {
      const found = macros.getMacro(runMatch[1].trim());
      if (!found.ok) return reply(found.error, 'macro_list', found);
      // Re-enter agent with the macro command text.
      return runAgent({ sessionId, message: found.macro.command });
    }
    const saveMatch = String(message || '').match(/\bsave\s+macro\s+([^:]+):\s*(.+)$/i);
    if (saveMatch) {
      const result = macros.saveMacro({ name: saveMatch[1].trim(), command: saveMatch[2].trim() });
      return reply(result.ok ? `Macro **${result.macro.name}** saved.` : result.error, 'macro_save', result);
    }
    return reply(
      'Macros: `Tony save macro status: repo check karo` · `Tony run macro status` · `Tony macro list`',
      'macro_list',
      macros.list()
    );
  }
  if (routed.intent === 'export_session') {
    const result = require('../tools/session_export').exportSession(sessionId);
    return reply(
      result.ok ? `Session exported (${result.turns} turns) → \`${result.savedPath}\`` : result.error,
      'export_session',
      result
    );
  }
  if (routed.intent === 'checkpoint') {
    const cp = require('./checkpoints');
    if (/\blist\b/i.test(message)) {
      const listed = cp.listCheckpoints();
      return reply(
        listed.checkpoints.length
          ? `# Checkpoints\n${listed.checkpoints.map((c) => `- \`${c.sessionId}\` ${c.turns} turns @ ${c.savedAt}`).join('\n')}`
          : 'No checkpoints yet. Say `Tony save checkpoint`.',
        'checkpoint_list',
        listed
      );
    }
    if (/\brestore\b/i.test(message)) {
      const result = cp.restoreCheckpoint(sessionId);
      return reply(
        result.ok ? `Restored checkpoint (${result.restored} turns) from ${result.savedAt}` : result.error,
        'checkpoint_restore',
        result
      );
    }
    const result = cp.saveCheckpoint(sessionId, { label: 'manual', note: message });
    return reply(
      result.ok ? `Checkpoint saved (${result.turns} turns) → \`${result.path}\`` : result.error,
      'checkpoint_save',
      result
    );
  }
  if (routed.intent === 'audit_log') {
    const entries = require('../safety/audit').recent(25);
    return reply(
      entries.length
        ? `# Audit log\n${entries.map((e) => `- ${e.at} **${e.type}** ${e.action} — ${e.detail}`).join('\n')}`
        : 'Audit log empty.',
      'audit_recent',
      { entries }
    );
  }
  if (routed.intent === 'changelog') {
    const sinceMatch = String(message || '').match(/\bsince\s+(.+)$/i);
    const since = sinceMatch ? sinceMatch[1].trim() : '7 days ago';
    const dig = require('../tools/changelog').exportDigest({ since });
    return reply(`${dig.markdown}\n\nSaved: \`${dig.savedPath}\``, 'changelog_digest', dig);
  }
  if (routed.intent === 'backup') {
    const result = require('../tools/backup').createBackup();
    return reply(
      result.ok
        ? `Backup created (${result.fileCount} files, ${result.bytes} bytes) → \`${result.savedPath}\``
        : result.error,
      'backup_data',
      result
    );
  }
  if (routed.intent === 'focus_timer') {
    const focus = require('../tools/focus_timer');
    if (/\bstop\b/i.test(message)) {
      const result = focus.stop({ complete: true });
      return reply(result.ok ? `Focus stopped. Completed: ${result.session.completed}` : result.error, 'focus_stop', result);
    }
    if (/\bstatus\b/i.test(message)) {
      const st = focus.status();
      if (!st.active) return reply('No active focus session.', 'focus_status', st);
      const mins = Math.ceil((st.remainingMs || 0) / 60000);
      return reply(
        `Focus **${st.active.label}** — ${mins} min left (ends ${st.active.endsAt})`,
        'focus_status',
        st
      );
    }
    const minsMatch = String(message || '').match(/\b(\d+)\s*(min|minute|minutes)\b/i);
    const minutes = minsMatch ? Number(minsMatch[1]) : 25;
    const result = focus.start({ minutes, label: 'Focus' });
    return reply(
      result.ok
        ? `Focus started: **${result.active.minutes} min** until ${result.active.endsAt}`
        : result.error,
      'focus_start',
      result
    );
  }
  if (routed.intent === 'memory_reindex') {
    if (/\bvector\s+search\b/i.test(message)) {
      const q = String(message || '').replace(/.*\bvector\s+search\b[:\s-]*/i, '').trim() || 'tony';
      const hits = require('../memory/embeddings').search(q, 8);
      return reply(
        hits.length
          ? `# Vector search\n${hits.map((h) => `- (${h.score.toFixed(2)}) ${h.text}`).join('\n')}`
          : 'No embedding hits. Remember facts first, then `Tony reindex memory`.',
        'memory_vector_search',
        { hits }
      );
    }
    const result = require('../memory/semantic').reindexAll();
    return reply(`Reindexed **${result.indexed}** facts into local embeddings.`, 'memory_reindex', result);
  }
  if (routed.intent === 'prefs_vault') {
    const vault = require('../tools/pref_vault');
    if (/\brestore|open\b/i.test(message)) {
      const result = vault.restoreIntoLivePrefs();
      return reply(result.ok ? 'Encrypted prefs restored into live preferences.' : result.error, 'prefs_vault_open', result);
    }
    const result = vault.sealFromLivePrefs();
    return reply(
      result.ok ? `Preferences sealed into encrypted vault at ${result.at}` : result.error,
      'prefs_vault_seal',
      result
    );
  }
  if (routed.intent === 'memorial_voice') {
    const memorial = require('../voice/memorial_voice');
    const voices = memorial.listVoices();
    const response = `# Memorial voice (personal remembrance)

I can help preserve a loved one's voice for **private emotional remembrance**.

This is synthetic. It is not them — it is a memory aid.

## Required consent (all of it)
1. Affirm you have the right to use their recordings
2. Personal memorial use only
3. Not for deceiving anyone
4. Type: \`I consent to memorial voice for <Name>\`
5. Provide local audio sample path(s)

## Tools
- memorial_voice_register
- memorial_voice_clone
- memorial_voice_speak
- memorial_voice_list

Registered memorial voices: ${voices.length ? voices.map((v) => v.name).join(', ') : 'none yet'}

If you want to begin, tell me their name, your relationship, and a sample file path.`;
    return reply(response, 'memorial_voice_list', { ok: true, voices });
  }

  if (routed.intent === 'trusted_mode_on') {
    const state = require('../safety/trusted_mode').enable({ by: 'voice/text' });
    return reply(
      `**Trusted Operator Mode ON.**\nI will take research, laptop control, install/build/test, and git-write decisions for you.\nHard blocks still apply: secrets, destructive wipes, payments, voice cloning.\nSay \`Tony trusted mode off\` anytime.`,
      'trusted_mode',
      state
    );
  }
  if (routed.intent === 'trusted_mode_off') {
    const state = require('../safety/trusted_mode').disable();
    return reply('Trusted Operator Mode OFF. Approvals required again for risky actions.', 'trusted_mode', state);
  }
  if (routed.intent === 'research_web') {
    const query = params.searchQuery || routed.normalized || message;
    const trustedOn = require('../safety/trusted_mode').isEnabled();
    if (!trustedOn) {
      const pending = approvals.create({
        action: 'research_web',
        command: query,
        reason: 'Full-web research',
        sessionId,
      });
      return reply(
        `Research ready for **${query}**.\nApprove with **yes**, or enable \`Tony trusted mode on\` for continuous research autonomy.\nPending: ${pending.id}`,
        'research_web',
        { needsApproval: true, pendingApprovalId: pending.id }
      );
    }
    const result = await require('../tools/research_web').researchTopic(query, { openBrowser: true });
    return reply(result.markdown || JSON.stringify(result), 'research_web', result);
  }
  if (routed.intent === 'laptop_control') {
    const trustedOn = require('../safety/trusted_mode').isEnabled();
    if (!trustedOn) {
      const pending = approvals.create({
        action: 'laptop_control',
        command: message,
        reason: 'Laptop control',
        sessionId,
      });
      return reply(
        `Laptop control armed. Approve with **yes** or enable Trusted Mode.\nPending: ${pending.id}`,
        'laptop_control',
        { needsApproval: true, pendingApprovalId: pending.id }
      );
    }
    const shot = require('../bridge/automation').run({ action: 'screenshot' });
    return reply(
      `Trusted laptop control active. Screenshot: ${shot.path || shot.error || 'n/a'}\nTell me clicks/typing steps and I will drive the desktop.`,
      'laptop_control',
      shot
    );
  }
  if (routed.intent === 'settings') {
    const prefs = require('../tools/preferences').load();
    const stt = require('../voice/local_stt').status();
    const trustedStatus = require('../safety/trusted_mode').status();
    const response = `# Preferences

- Assistant: ${prefs.assistantName}
- User: ${prefs.userName}
- Language: ${prefs.language}
- Trusted mode: ${trustedStatus.label}
- Always listen: ${prefs.voice?.alwaysListen}
- Prefer local TTS: ${prefs.voice?.preferLocalTts}
- Prefer local STT: ${prefs.voice?.preferLocalStt}
- Always allow npm test: ${prefs.safety?.alwaysAllowNpmTest}
- Local STT bridge: ${stt.configured ? 'script ready' : 'missing'}
- Recent commands: ${(prefs.recentCommands || []).slice(0, 5).map((c) => c.command).join(' | ') || 'none'}

Say \`Tony trusted mode on\` for full laptop + web research autonomy.
Say "project note: …" to save a note (no secrets).`;
    return reply(response, 'preferences_get', { ok: true, preferences: prefs, stt, trustedStatus });
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
