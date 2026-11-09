/**
 * Safe app launcher for common local apps. No shell free-form execution.
 */
const { spawn } = require('child_process');
const process = require('process');

const APP_MAP = {
  vscode: {
    win: ['code'],
    mac: ['code'],
    linux: ['code'],
  },
  terminal: {
    win: ['wt'],
    mac: ['open', '-a', 'Terminal'],
    linux: ['x-terminal-emulator'],
  },
  chrome: {
    win: ['cmd', '/c', 'start', 'chrome'],
    mac: ['open', '-a', 'Google Chrome'],
    linux: ['google-chrome'],
  },
  browser: {
    win: ['cmd', '/c', 'start', 'http://localhost:8787/jarvis'],
    mac: ['open', 'http://localhost:8787/jarvis'],
    linux: ['xdg-open', 'http://localhost:8787/jarvis'],
  },
  notepad: {
    win: ['notepad'],
    mac: ['open', '-a', 'TextEdit'],
    linux: ['gedit'],
  },
  explorer: {
    win: ['explorer', '.'],
    mac: ['open', '.'],
    linux: ['xdg-open', '.'],
  },
  calculator: {
    win: ['calc'],
    mac: ['open', '-a', 'Calculator'],
    linux: ['gnome-calculator'],
  },
};

function platformKey() {
  if (process.platform === 'win32') return 'win';
  if (process.platform === 'darwin') return 'mac';
  return 'linux';
}

function openApp(appName) {
  const key = String(appName || '').toLowerCase();
  const entry = APP_MAP[key];
  if (!entry) {
    return {
      ok: false,
      error: `Unknown app "${appName}". Supported: ${Object.keys(APP_MAP).join(', ')}`,
    };
  }
  const cmd = entry[platformKey()];
  try {
    const child = spawn(cmd[0], cmd.slice(1), {
      detached: true,
      stdio: 'ignore',
      shell: process.platform === 'win32',
      cwd: process.cwd(),
    });
    child.unref();
    return { ok: true, app: key, command: cmd.join(' ') };
  } catch (e) {
    return { ok: false, app: key, error: e.message };
  }
}

module.exports = { openApp, APP_MAP };
