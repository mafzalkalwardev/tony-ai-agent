#!/usr/bin/env node
const net = require('net');
const { spawn } = require('child_process');
const path = require('path');
const config = require('../src/config');

const port = config.mcp.playwright.port || 8931;

function portInUse(p) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(true));
    tester.once('listening', () => tester.close(() => resolve(false)));
    tester.listen(p, '127.0.0.1');
  });
}

async function main() {
  const busy = await portInUse(port);
  if (busy) {
    console.log(`Playwright MCP already running on http://localhost:${port}/mcp`);
    console.log('(EADDRINUSE is OK — another terminal or test started it first)\n');
    process.exit(0);
  }

  console.log(`Starting @playwright/mcp on http://localhost:${port}/mcp`);
  console.log('Docs: https://playwright.dev/docs/getting-started-mcp\n');

  const args = ['@playwright/mcp@latest', '--port', String(port)];
  if (config.mcp.playwright.headless) args.push('--headless');

  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

main();
