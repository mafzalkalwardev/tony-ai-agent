#!/usr/bin/env node
/**
 * Charlie OS — local operating shell for TONY.
 * Boots gateway, builds knowledge graph, and exposes a unified status dashboard.
 */

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const root = path.resolve(__dirname, '../..');
process.chdir(root);

const config = require('../config');
const architectures = require('../brain/architectures');
const graphify = require('../brain/graphify');
const paul = require('../agents/paul');

const args = process.argv.slice(2);
const command = args[0] || 'boot';

function banner() {
  console.log(`
╔══════════════════════════════════════════╗
║  CHARLIE OS  ·  TONY Agent Runtime       ║
║  Groq brain · Deepgram · ElevenLabs      ║
║  Graphify · Obsidian · Paul builder      ║
╚══════════════════════════════════════════╝
`);
}

function statusDashboard() {
  const arch = architectures.status();
  console.log('LLM provider:', config.llmProvider);
  console.log('Gateway port:', config.port);
  console.log('Graphify:', `${arch.graphify.nodes} nodes, ${arch.graphify.edges} edges`);
  console.log('Obsidian:', arch.obsidian.configured ? arch.obsidian.noteCount + ' notes' : 'not configured');
  console.log('Voice STT:', arch.voice.stt.configured ? 'Deepgram ready' : 'Deepgram missing key');
  console.log('Voice TTS:', arch.voice.tts.configured ? 'ElevenLabs ready' : 'ElevenLabs missing key');
  console.log('Paul:', paul.status().role);
}

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${config.port}/health`, (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            if (res.statusCode === 200) resolve(JSON.parse(body));
            else reject(new Error(`HTTP ${res.statusCode}`));
          });
        });
        req.on('error', reject);
        req.setTimeout(2000, () => req.destroy(new Error('timeout')));
      });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

function bootGateway() {
  return spawn(process.execPath, [path.join(root, 'src/gateway/server.js')], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
}

async function boot() {
  banner();
  console.log('[Charlie OS] Building knowledge graph...');
  const graph = graphify.buildFromWorkspace();
  console.log(`[Charlie OS] Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

  if (require('../brain/obsidian').isConfigured()) {
    require('../brain/obsidian').getAgenticBrainIndex();
    console.log('[Charlie OS] Obsidian agentic brain vault ready');
  }

  console.log('[Charlie OS] Starting TONY gateway...');
  const child = bootGateway();

  const healthy = await waitForHealth();
  if (healthy) {
    console.log(`\n[Charlie OS] TONY online at http://localhost:${config.port}`);
    statusDashboard();
    console.log('\nCommands: npm run chat | npm run charlie status | npm run charlie build "task"');
  } else {
    console.warn('[Charlie OS] Gateway started but health check timed out');
  }

  child.on('exit', (code) => process.exit(code ?? 0));
}

async function runBuild() {
  const task = args.slice(1).join(' ') || 'Verify TONY integrations and run tests';
  banner();
  console.log('[Charlie OS] Dispatching Paul builder...\n');
  const { randomUUID } = require('crypto');
  const result = await paul.build(task, randomUUID());
  console.log(result.response);
  if (result.toolResults.length) {
    console.log('\nTools used:', result.toolResults.map((t) => t.tool).join(', '));
  }
}

async function main() {
  if (command === 'status') {
    banner();
    statusDashboard();
    return;
  }

  if (command === 'graph') {
    banner();
    const graph = graphify.buildFromWorkspace();
    console.log(`Built graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
    return;
  }

  if (command === 'build') {
    await runBuild();
    return;
  }

  if (command === 'boot') {
    await boot();
    return;
  }

  console.log('Usage: node src/charlie-os/index.js [boot|status|graph|build <task>]');
}

main().catch((e) => {
  console.error('[Charlie OS] Error:', e.message);
  process.exit(1);
});
