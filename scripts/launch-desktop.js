#!/usr/bin/env node
/** Open TONY JARVIS UI in desktop app window (Edge/Chrome app mode). */
const { spawn } = require('child_process');
const http = require('http');
const config = require('../src/config');

const url = `http://localhost:${config.port}/jarvis?token=${encodeURIComponent(config.apiToken)}`;

function waitForGateway(ms = 20000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const poll = () => {
      const req = http.get(`http://localhost:${config.port}/health`, () => resolve(true));
      req.on('error', () => {
        if (Date.now() - start > ms) resolve(false);
        else setTimeout(poll, 800);
      });
    };
    poll();
  });
}

async function main() {
  const up = await waitForGateway();
  if (!up) {
    console.error('Gateway not running. Start: npm run charlie');
    process.exit(1);
  }

  const browsers = [
    process.env.TONY_DESKTOP_BROWSER,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);

  for (const exe of browsers) {
    try {
      const child = spawn(exe, [`--app=${url}`, '--window-size=1400,900'], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      console.log(`JARVIS desktop opened: ${url}`);
      return;
    } catch {
      continue;
    }
  }

  console.log(`Open manually: ${url}`);
}

main();
