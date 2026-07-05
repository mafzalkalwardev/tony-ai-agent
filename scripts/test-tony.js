const { randomUUID } = require('crypto');
const path = require('path');

process.chdir(path.join(__dirname, '..'));
process.env.TONY_LLM_PROVIDER = process.env.TONY_LLM_PROVIDER || 'mock';
process.env.TONY_DATA_DIR = process.env.TONY_DATA_DIR || './data-test';

const { runAgent } = require('../src/core/agent');
const memory = require('../src/memory');
const { listSkills } = require('../src/skills/loader');
const { listTools } = require('../src/tools/registry');

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

  assert('tools registered', listTools().length >= 45);

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

  const { classifyCommand, canRunCommand } = require('../src/safety/policy');
  assert('safety blocks rm -rf', classifyCommand('rm -rf /').level === 'BLOCKED');
  assert('safety allows git status', canRunCommand('git status').allowed === true);

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
