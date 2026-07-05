#!/usr/bin/env node
/**
 * Live integration test — uses .env keys when present, local fallbacks when not.
 * Run: npm run test:live
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.chdir(require('path').join(__dirname, '..'));

const { randomUUID } = require('crypto');

let passed = 0;
let failed = 0;
let skipped = 0;

function ok(name) {
  passed += 1;
  console.log(`  OK ${name}`);
}
function fail(name, err) {
  failed += 1;
  console.error(`  FAIL ${name}: ${err}`);
}
function skip(name, reason) {
  skipped += 1;
  console.log(`  SKIP ${name} (${reason})`);
}

async function main() {
  console.log('=== TONY Live Integration Test ===\n');

  const config = require('../src/config');
  const mcp = require('../src/mcp');

  console.log('Configured providers:');
  const status = mcp.statusAll();
  for (const [name, s] of Object.entries(status)) {
    const on = s.configured || s.mcpUrl || s.mode === 'local-free';
    console.log(`  ${name}: ${on ? 'ready' : 'fallback/local'}`);
  }
  console.log('');

  // Groq / OpenAI brain
  try {
    const { complete } = require('../src/llm');
    const r = await complete([{ role: 'user', content: 'Reply exactly: BRAIN_OK' }]);
    ok(`LLM brain (${r.provider || config.llmProvider})`);
  } catch (e) {
    fail('LLM brain', e.message);
  }

  // Local research (no paid key)
  try {
    const local = await mcp.localResearch('playwright mcp');
    if (local.ok && local.sources.length) ok('local research (graphify + repos)');
    else fail('local research', 'no sources');
  } catch (e) {
    fail('local research', e.message);
  }

  // Firecrawl (if key set)
  if (mcp.firecrawl.status().configured) {
    try {
      const fc = await mcp.firecrawl.scrape('https://example.com');
      if (fc.ok) ok('Firecrawl scrape');
      else fail('Firecrawl scrape', fc.error);
    } catch (e) {
      fail('Firecrawl scrape', e.message);
    }
  } else {
    skip('Firecrawl', 'no key');
  }

  // Playwright MCP (local free)
  try {
    const reachable = await mcp.playwright.mcpClient.isReachable(config.mcp.playwright.mcpUrl);
    if (reachable) {
      const snap = await mcp.playwright.snapshot('https://example.com');
      if (snap.ok) ok(`Playwright MCP (${snap.provider})`);
      else fail('Playwright MCP', snap.error);
    } else {
      skip('Playwright MCP', 'run npm run playwright:mcp in another terminal');
    }
  } catch (e) {
    fail('Playwright MCP', e.message);
  }

  // Voice status
  const arch = require('../src/brain/architectures').status();
  if (arch.voice.stt.configured) ok('Deepgram configured');
  else skip('Deepgram', 'no key');
  if (arch.voice.tts.configured) ok('ElevenLabs configured');
  else skip('ElevenLabs', 'no key');

  // Agent tool loop (light)
  try {
    const { runAgent } = require('../src/core/agent');
    const result = await runAgent({
      sessionId: randomUUID(),
      message: 'Use integration_search for playwright. One sentence answer.',
    });
    if (result.response) ok('Agent tool loop');
    else fail('Agent tool loop', 'empty response');
  } catch (e) {
    fail('Agent tool loop', e.message);
  }

  // Goal store
  try {
    const store = require('../src/goals/store');
    const g = store.create({
      title: 'Live test goal',
      successCriteria: ['test:npm test'],
    });
    store.complete(g.id);
    ok('Goal store');
  } catch (e) {
    fail('Goal store', e.message);
  }

  console.log(`\n=== ${passed} passed, ${failed} failed, ${skipped} skipped ===`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
