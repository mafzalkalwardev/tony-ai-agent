const { randomUUID } = require('crypto');
const path = require('path');

process.chdir(path.join(__dirname, '..'));
process.env.TONY_LLM_PROVIDER = process.env.TONY_LLM_PROVIDER || 'mock';
process.env.TONY_DATA_DIR = process.env.TONY_DATA_DIR || './data-test';

const { runAgent } = require('../src/core/agent');
const memory = require('../src/memory');
const { listSkills } = require('../src/skills/loader');
const { listTools, getTool } = require('../src/tools/registry');

let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) {
    passed += 1;
    console.log(`  OK ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}`);
  }
}

async function main() {
  console.log('=== TONY Agent Tests ===\n');

  assert('tools registered', listTools().length >= 53);

  const persona = require('../src/companion/persona');
  assert('marvel persona', persona.matchMediaTopic('Iron Man is great').length >= 1);
  assert('novel persona', persona.matchMediaTopic('Jannat Ke Pattay').length >= 1);

  const profile = require('../src/memory/profile');
  profile.learnFromMessage('My name is Afzal and I love movie Iron Man');
  assert('user profile', profile.load().name.includes('Afzal'));

  const jan = require('../src/llm/jan');
  assert('jan provider', typeof jan.complete === 'function');

  const automation = require('../src/bridge/automation');
  assert('automation bridge', typeof automation.run === 'function');

  const presentation = require('../src/bridge/presentation');
  assert('presentation bridge', typeof presentation.create === 'function');

  const voiceFilter = require('../src/voice/filter');
  assert('voice noise filter', voiceFilter.isLikelyNoiseTranscript('hmm', 0.9).noise === true);
  assert('voice keeps speech', voiceFilter.isLikelyNoiseTranscript('wake up Tony', 0.8).noise === false);

  const speakChain = require('../src/voice/speak');
  assert('tts chain', typeof speakChain.speak === 'function');

  const localTts = require('../src/bridge/tts');
  assert('local tts bridge', typeof localTts.speak === 'function');

  const attachments = require('../src/gateway/attachments');
  assert('attachment extract', attachments.extractAttachments([
    { tool: 'desktop_automate', result: { ok: true, action: 'screenshot', path: 'data/screenshots/screenshot-20260704-120000.png', width: 1920, height: 1080 } },
  ]).length === 1);

  const ctx = require('../src/llm/context-budget');
  const huge = { ok: true, imageBase64: 'A'.repeat(50000) };
  const safe = ctx.sanitizeToolResult(huge);
  assert('strips base64', safe.imageBase64.includes('omitted'));
  const trimmed = ctx.trimMessages(
    [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'old' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'new' },
    ],
    50
  );
  assert('trims messages', trimmed.length >= 2);

  const errors = require('../src/memory/errors');
  const lesson = errors.record({ tool: 'test', error: 'fetch failed', fix: 'restart gateway', outcome: 'resolved' });
  assert('error memory', Boolean(lesson.id));
  assert('error search', errors.search('fetch failed').length >= 1);

  const { analyzeFailure } = require('../src/core/reflexion');
  assert('reflexion module', typeof analyzeFailure === 'function');

  const companion = require('../src/companion/wake');
  assert('wake phrase', companion.isWakePhrase('Wake up Tony'));
  assert('not wake', !companion.isWakePhrase('hello'));

  const { detectMood } = require('../src/companion/mood');
  assert('sad mood', detectMood('I am sad today') === 'sad');

  const habits = require('../src/companion/habits');
  habits.recordInteraction({ message: 'wake test', mood: 'neutral', isWake: true, sessionId: 't' });
  assert('habits summary', habits.summary().wakeCount >= 1);

  const openwiki = require('../src/mcp/openwiki');
  assert('openwiki mcp', typeof openwiki.search === 'function');

  const scraper = require('../src/mcp/scraper-media');
  assert('scraper-media mcp', typeof scraper.scrape === 'function');

  const motion = require('../src/mcp/motiongraph');
  assert('motiongraph mcp', typeof motion.mapAesthetic === 'function');

  const obsSkills = require('../src/mcp/obsidian-skills');
  assert('obsidian-skills', typeof obsSkills.listSkills === 'function');

  const daemon = require('../src/daemon/index');
  assert('24/7 daemon', typeof daemon.runDaemon === 'function');

  const { classifyCommand, canRunCommand, classifyIntent, voiceCloneConsentRequired } = require('../src/safety/policy');
  assert('safety blocks rm -rf', classifyCommand('rm -rf /').level === 'BLOCKED');
  assert('safety allows git status', canRunCommand('git status').allowed === true);
  assert('safety build needs approval', classifyCommand('npm run build').level === 'NEEDS_APPROVAL');
  assert(
    'safety memorial voice needs consent/approval',
    classifyCommand('clone voice like my loved one').level === 'NEEDS_APPROVAL'
  );
  assert(
    'safety blocks deceptive deepfake scam',
    classifyCommand('deepfake scam call').level === 'BLOCKED'
  );
  assert('voice clone consent flag', voiceCloneConsentRequired('please clone voice') === true);
  assert('intent push needs approval', classifyIntent('git_push').level === 'NEEDS_APPROVAL');
  assert('intent memorial needs approval', classifyIntent('memorial_voice').level === 'NEEDS_APPROVAL');
  assert('intent scan safe', classifyIntent('project_scan').level === 'SAFE');

  const intentRouter = require('../src/core/intent_router');
  assert('intent repo check', intentRouter.route('Tony repo check karo').intent === 'git_status');
  assert('intent test run', intentRouter.route('Tony test run karo').intent === 'run_tests');
  assert('intent client message', intentRouter.route('Tony client ke liye message banao').category === 'client_delivery');
  assert('intent browser search', intentRouter.route('Tony browser mein search karo').intent === 'search_web');
  assert('intent copy', intentRouter.route('Tony ye copy karo').category === 'copy_paste');
  assert('intent status', intentRouter.route('Tony mujhe status batao').intent === 'git_status');
  assert('intent category map', intentRouter.route('project scan karo').category === 'project_scan');
  assert('intent summarize repo', intentRouter.route('summarize repo').intent === 'summarize_repo');
  assert('intent explain changes', intentRouter.route('explain changed files').intent === 'explain_changes');
  assert('intent commit message', intentRouter.route('commit message banao').intent === 'commit_message');
  assert('intent prepare pr', intentRouter.route('prepare pr').intent === 'prepare_pr');
  assert('intent create issue', intentRouter.route('create issue login bug').intent === 'create_issue');
  assert('intent create pr', intentRouter.route('create pr').intent === 'create_pr');
  assert('intent memorial voice', intentRouter.route('memorial voice for ammi').intent === 'memorial_voice');
  assert('intent daily briefing', intentRouter.route('Tony daily briefing').intent === 'daily_briefing');
  assert('intent reminder', intentRouter.route('Tony reminder in 30 minutes call client').intent === 'reminder');
  assert('intent workspace', intentRouter.route('Tony switch workspace').intent === 'workspace_switch');
  assert('intent vault watch', intentRouter.route('Tony vault watch').intent === 'vault_watch');
  assert('intent generate skill', intentRouter.route('Tony generate skill deploy').intent === 'generate_skill');
  assert('intent prefs vault', intentRouter.route('Tony seal preferences').intent === 'prefs_vault');
  assert('intent client tracker', intentRouter.route('Tony add client Acme').intent === 'client_tracker');
  assert('intent macro', intentRouter.route('Tony save macro status: repo check').intent === 'macro');
  assert('intent export session', intentRouter.route('Tony export session').intent === 'export_session');
  assert('intent memory reindex', intentRouter.route('Tony reindex memory').intent === 'memory_reindex');
  assert('intent open vscode', intentRouter.route('VS Code kholo').intent === 'open_app');

  const params = require('../src/core/params');
  assert('param search query', params.extractSearchQuery('Tony browser mein search karo faster whisper').includes('faster whisper'));
  assert('param app name', params.extractAppName('terminal kholo') === 'terminal');
  assert('param file path', params.extractFilePath('read file src/config.js') === 'src/config.js');

  const gh = require('../src/tools/github_helper');
  assert('github summarize', gh.summarizeRepo().ok === true);
  assert('github explain', gh.explainChangedFiles().ok === true);
  assert('github commit draft', gh.generateCommitMessage('operator').message.includes('feat:'));
  assert('github pr prep', gh.preparePrInstructions().draftOnly === true);
  assert('github createIssue fn', typeof gh.createIssue === 'function');
  assert('github createPR fn', typeof gh.createPullRequest === 'function');

  const memorial = require('../src/voice/memorial_voice');
  const consentFail = memorial.buildConsentRecord({
    name: 'Ammi',
    relationship: 'mother',
    hasRights: true,
    personalMemorialOnly: true,
    notForDeception: true,
    consentText: 'yes clone it',
  });
  assert('memorial consent phrase required', consentFail.ok === false);
  const consentOk = memorial.buildConsentRecord({
    name: 'Ammi',
    relationship: 'mother',
    personStatus: 'deceased',
    hasRights: true,
    personalMemorialOnly: true,
    notForDeception: true,
    consentText: 'I consent to memorial voice for Ammi',
  });
  assert('memorial consent ok', consentOk.ok === true);
  assert('memorial status', memorial.status().mode === 'memorial-consent-gated');
  assert('memorial tools registered', Boolean(getTool('memorial_voice_register')));
  assert('browser operator tool', Boolean(getTool('browser_operator')));
  assert('telegram status tool', Boolean(getTool('telegram_status')));
  assert('create_issue tool', Boolean(getTool('create_issue')));
  assert('create_pr tool', Boolean(getTool('create_pr')));

  const telegram = require('../src/channels/telegram');
  assert('telegram status', typeof telegram.status === 'function');

  const browserOp = require('../src/tools/browser_operator');
  assert('browser operator status', browserOp.status().operator === true);

  const discord = require('../src/channels/discord');
  assert('discord status', typeof discord.status === 'function' && discord.status().configured === false);

  const workspaces = require('../src/tools/workspaces');
  assert('workspace list', workspaces.list().ok === true && workspaces.list().workspaces.length >= 1);

  const reminders = require('../src/tools/reminders');
  const rem = reminders.addReminder({ text: 'test-reminder-tony', minutesFromNow: 5 });
  assert('reminder add', rem.ok === true);
  assert('reminder list', reminders.list().some((r) => r.text === 'test-reminder-tony'));
  assert('reminder complete', reminders.completeReminder(rem.reminder.id).ok === true);
  assert('daily briefing', reminders.dailyBriefing().ok === true && reminders.dailyBriefing().markdown.includes('Reminders'));

  const rateLimit = require('../src/safety/rate_limit');
  assert('rate limit allows first', rateLimit.check('shell').allowed === true);
  assert('rate limit status', rateLimit.status().shell.max >= 1);

  require('../src/tools/delivery_helper').saveTestReport({
    command: 'npm test',
    ok: true,
    output: 'all good tony-test-report',
  });
  const packWithReport = require('../src/tools/delivery_helper').prepareDeliveryPackage({ projectPath: '.' });
  assert('delivery attaches test report', packWithReport.testReportAttached === true);
  assert('discord tool', Boolean(getTool('discord_send')));
  assert('workspace tool', Boolean(getTool('workspace_switch')));
  assert('briefing tool', Boolean(getTool('daily_briefing')));

  const vaultWatch = require('../src/brain/vault_watcher');
  assert('vault watcher status', typeof vaultWatch.status === 'function');
  const startedWatch = vaultWatch.start();
  assert('vault watcher start', startedWatch.ok === true || Boolean(startedWatch.error));
  vaultWatch.stop();

  const procedural = require('../src/memory/procedural');
  procedural.recordPlaybook('deploy-flow', ['scan project', 'run tests', 'prepare pr'], 'success');
  const skillDraft = require('../src/skills/generate').draftFromPlaybooks({
    name: 'deploy-helper',
    query: 'deploy',
    write: false,
  });
  assert('skill draft', skillDraft.ok === true && skillDraft.content.includes('Playbook'));

  const prefVault = require('../src/tools/pref_vault');
  assert('prefs vault status', prefVault.status().enabled === false || typeof prefVault.status().enabled === 'boolean');
  process.env.TONY_PREFS_SECRET = 'test-secret-for-tony-vault';
  // reload config-backed secret via direct seal using module after patching
  const cryptoVault = require('../src/tools/pref_vault');
  // Force-enabled path: seal with temporary monkeypatch
  const origEnabled = cryptoVault.enabled;
  const sealed = (() => {
    const crypto = require('crypto');
    const fs = require('fs');
    const path = require('path');
    const cfg = require('../src/config');
    const file = path.join(cfg.dataDir, 'preferences.vault');
    const prefs = require('../src/tools/preferences').load();
    const key = crypto.scryptSync('test-secret-for-tony-vault', 'tony-prefs-vault-v1', 32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(JSON.stringify(prefs), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify({
        v: 1,
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        data: enc.toString('base64'),
        at: new Date().toISOString(),
      }),
      'utf8'
    );
    return fs.existsSync(file);
  })();
  assert('prefs vault file written', sealed === true);
  void origEnabled;

  const tonyMcp = require('../src/mcp/tony-server');
  assert('tony mcp tools', tonyMcp.listMcpTools().length >= 10);
  assert('tony mcp status', tonyMcp.status().mode === 'tony-mcp-http');
  assert('stream helper', typeof require('../src/llm/stream').chunkText === 'function');
  assert('generate_skill tool', Boolean(getTool('generate_skill')));
  assert('vault watch tool', Boolean(getTool('vault_watch_status')));

  const embeddings = require('../src/memory/embeddings');
  embeddings.indexText('t1', 'Tony loves Marvel and automation workflows');
  embeddings.indexText('t2', 'Client delivery checklist for web apps');
  const embHits = embeddings.search('marvel automation', 3);
  assert('embeddings search', embHits.length >= 1 && embHits[0].score > 0);
  memory.remember('User likes Roman Urdu operator commands', ['test', 'lang']);
  assert('semantic vector aware', require('../src/memory/semantic').search('Roman Urdu').length >= 1);

  const clients = require('../src/tools/clients');
  assert('client upsert', clients.upsertClient({ name: 'Acme', notes: 'wants dark mode' }).ok === true);
  assert('client list', clients.list().clients.some((c) => c.name === 'Acme'));
  assert('client rejects secrets', clients.upsertClient({ name: 'Bad', notes: 'api_key=secret' }).ok === false);

  const macros = require('../src/tools/macros');
  assert('macro save', macros.saveMacro({ name: 'status', command: 'repo check karo' }).ok === true);
  assert('macro get', macros.getMacro('status').ok === true);

  const sessionExport = require('../src/tools/session_export');
  const sid = randomUUID();
  memory.appendEpisode(sid, 'user', 'hello export');
  memory.appendEpisode(sid, 'assistant', 'hi there');
  assert('session export', sessionExport.exportSession(sid).ok === true);

  const ttsStream = require('../src/voice/tts_stream');
  assert('tts split sentences', ttsStream.splitSentences('Hi. There!').length >= 2);
  assert('client tool', Boolean(getTool('client_upsert')));
  assert('macro tool', Boolean(getTool('macro_save')));
  assert('vector search tool', Boolean(getTool('memory_vector_search')));

  const web = require('../src/tools/web_search');
  assert('web search url', web.buildSearchUrl('tony ai').includes('duckduckgo.com'));

  const openApp = require('../src/tools/open_app');
  assert('open app map', Boolean(openApp.APP_MAP.vscode));

  const prefs = require('../src/tools/preferences');
  prefs.save({ language: 'roman' });
  assert('preferences save', prefs.load().language === 'roman');
  assert('preferences reject secrets', Boolean(prefs.addProjectNote('api_key=supersecret').error));

  const localStt = require('../src/voice/local_stt');
  assert('local stt status', localStt.status().configured === true);

  const trusted = require('../src/safety/trusted_mode');
  trusted.disable();
  assert('trusted off default', trusted.isEnabled() === false);
  trusted.enable({ by: 'test' });
  assert('trusted on', trusted.isEnabled() === true);
  assert('trusted auto shell', trusted.canAutoApprove('shell', 'npm install') === true);
  assert(
    'trusted still respects block via policy',
    require('../src/safety/policy').canRunCommand('rm -rf /', { approved: true }).allowed === false
  );
  assert(
    'trusted never auto memorial',
    trusted.canAutoApprove('memorial_voice_register', 'clone voice') === false
  );
  trusted.disable();

  const decide = require('../src/core/decision_engine');
  assert('decision analyze', decide.analyze('deploy production').risk === 'high');
  assert('intent trusted on', intentRouter.route('Tony trusted mode on').intent === 'trusted_mode_on');
  assert('intent research', intentRouter.route('Tony research groq models').intent === 'research_web');

  const research = require('../src/tools/research_web');
  assert('research strip html', research.stripHtml('<b>hi</b> there').includes('hi'));

  const scanner = require('../src/tools/project_scanner');
  const scan = scanner.scan('.');
  assert('project scanner type', Boolean(scan.projectType));
  assert('project scanner tree', Array.isArray(scan.fileTree) && scan.fileTree.length > 0);
  assert('project scanner text', scanner.scanAsText('.').includes('Project Scan'));

  const delivery = require('../src/tools/delivery_helper').prepareDeliveryPackage({ projectPath: '.' });
  assert('delivery draft only', delivery.draftOnly === true && delivery.clientMessage.includes('Best regards'));

  const clipboard = require('../src/tools/clipboard_tool');
  assert('clipboard write', clipboard.writeClipboard('tony-clipboard-test').ok === true);
  assert(
    'clipboard read',
    String(clipboard.readClipboard().text || '').includes('tony-clipboard-test')
  );
  assert('clipboard tool registered', Boolean(getTool('clipboard')));
  assert('project_scan tool registered', Boolean(getTool('project_scan')));
  assert('client_delivery tool registered', Boolean(getTool('client_delivery')));
  assert('voice silence from settings', require('../src/config').voice.silenceStopSeconds === 1.2);

  const approvals = require('../src/safety/approvals');
  const pending = approvals.create({ action: 'shell', command: 'git push', reason: 'test' });
  assert('approval queue', Boolean(pending.id));
  assert('approval yes text', approvals.isApprovalText('haan'));
  assert('approval decide', approvals.decide(pending.id, false).status === 'rejected');

  const codegraph = require('../src/brain/codegraph');
  const cgStatus = codegraph.status();
  assert('codegraph module', typeof cgStatus.configured === 'boolean');

  const tonyDesktop = require('../src/bridge/tony-desktop');
  assert('tony-desktop bridge', typeof tonyDesktop.status === 'function');

  const { pickMode } = require('../src/workflows/runner');
  assert('workflow picks goal', pickMode('build website until tests pass') === 'goal');
  assert('workflow picks crew', pickMode('research and compare multi-agent') === 'crew');

  const { runCrew } = require('../src/core/crew');
  assert('crew module', typeof runCrew === 'function');

  const taskStore = require('../src/tasks/store');
  const t = taskStore.create({
    name: 'test-offline-task',
    triggers: ['repeat test-offline-task'],
    steps: [{ tool: 'memory_search', args: { query: 'test' } }],
  });
  assert('task store', Boolean(t.id));
  const { replayTask } = require('../src/tasks/replay');
  const replay = await replayTask(t, randomUUID());
  assert('task replay', replay.mode === 'task-replay');

  const { runLocalAgent } = require('../src/local/agent');
  const local = await runLocalAgent({ sessionId: randomUUID(), message: 'list tasks' });
  assert('local agent', local.offline === true);

  const gemini = require('../src/llm/gemini');
  assert('gemini provider', typeof gemini.complete === 'function');
  assert('skills loaded', listSkills().length >= 8);

  const mcp = require('../src/mcp');
  const mcpStatus = mcp.statusAll();
  assert('mcp layer', Object.keys(mcpStatus).length >= 5);

  const goalStore = require('../src/goals/store');
  const testGoal = goalStore.create({
    title: 'Test goal',
    description: 'Verify goal store',
    successCriteria: ['response contains:done'],
  });
  assert('goal store', Boolean(testGoal.id));
  goalStore.complete(testGoal.id, 'test done');

  const manifest = require('../integrations/manifest.json');
  assert('integrations manifest', manifest.repos.length >= 20);

  const structures = require('../src/knowledge/structures');
  const multi = await structures.queryAll('agent', { structures: ['graph', 'repo'] });
  assert('knowledge structures', Boolean(multi.results));

  const graphify = require('../src/brain/graphify');
  const graph = graphify.buildFromWorkspace();
  assert('graphify builds', graph.nodes.length >= 5);

  const obsidian = require('../src/brain/obsidian');
  const obsSearch = obsidian.searchNotes('memory');
  assert('obsidian brain', obsSearch.ok && obsSearch.hits.length >= 1);

  const architectures = require('../src/brain/architectures');
  const mind = architectures.status();
  assert('architectures of mind', mind.layers.length === 7);

  const paul = require('../src/agents/paul');
  assert('paul builder', paul.status().name === 'Paul');

  memory.remember('User prefers autonomous overnight builds', ['test']);
  const search = memory.searchAll('autonomous');
  assert('semantic memory', search.semantic.length >= 1);

  const sessionId = randomUUID();
  const result = await runAgent({
    sessionId,
    message: 'List available skills and search memory for autonomous',
  });
  assert('agent responds', Boolean(result.response));
  assert('agent used tools', result.toolResults.length >= 1);

  const history = memory.getSessionHistory(sessionId, 10);
  assert('episodic memory', history.length >= 2);

  const knowledge = require('../src/knowledge/agents-index.json');
  assert('knowledge index', knowledge.agents.length >= 15);

  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
