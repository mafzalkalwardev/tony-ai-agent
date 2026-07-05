#!/usr/bin/env node
/**
 * Launch MCP stack helpers + print config for TONY.
 * Playwright, Scraper Media, Motiongraph, OpenWiki — start what is installed.
 */
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

const root = path.resolve(__dirname, '..');

function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => {
      s.close();
      resolve(true);
    });
    s.listen(port, '127.0.0.1');
  });
}

async function main() {
  console.log('=== TONY MCP Stack ===\n');

  const playwrightPort = Number(process.env.PLAYWRIGHT_MCP_PORT || 8931);
  if (await portFree(playwrightPort)) {
    console.log(`Starting Playwright MCP on :${playwrightPort}…`);
    spawn(process.execPath, [path.join(root, 'scripts/playwright-mcp.js')], {
      cwd: root,
      stdio: 'inherit',
      detached: true,
    }).unref();
  } else {
    console.log(`Playwright MCP already on :${playwrightPort}`);
  }

  console.log('\nOptional MCP servers (install separately):');
  console.log('  OpenWiki MCP     → OPENWIKI_MCP_URL=http://localhost:8090/mcp');
  console.log('  Scraper Media    → SCRAPER_MEDIA_MCP_URL=http://localhost:8920/mcp');
  console.log('  Motiongraph      → MOTIONGRAPH_MCP_URL=http://localhost:8921/mcp');
  console.log('\nRun: npm run tony:daemon   # 24/7 gateway + goal ticks');
  console.log('Run: npm run desktop       # JARVIS desktop window');
}

main();
