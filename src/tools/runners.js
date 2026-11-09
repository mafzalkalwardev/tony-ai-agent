/**
 * Safe project test/build runners — never destructive; builds/tests need approval.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { canRunCommand } = require('../safety/policy');
const { scan } = require('./project_scanner');

const LOG_PATH = path.join(config.dataDir, 'command_runs.log');

function ensureLogDir() {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
}

function logCommand(command, meta = {}) {
  ensureLogDir();
  const line = `[${new Date().toISOString()}] cmd=${command} meta=${JSON.stringify(meta)}\n`;
  try {
    fs.appendFileSync(LOG_PATH, line, 'utf8');
  } catch {
    /* ignore */
  }
}

function runDetected(command, { approved = false } = {}) {
  if (!command) {
    return { ok: false, error: 'No recognized command detected. Tony will not invent shell commands.' };
  }
  const check = canRunCommand(command, { approved, unsafeMode: config.shellUnsafe });
  if (!check.allowed) {
    return {
      ok: false,
      level: check.level,
      error: check.reason,
      command,
      needsApproval: check.level === 'NEEDS_APPROVAL',
      hint: check.level === 'NEEDS_APPROVAL' ? 'Approve this action, then retry with approved:true' : undefined,
    };
  }
  logCommand(command, { approved, level: check.level });
  try {
    const output = execSync(command, {
      cwd: config.workspaceRoot,
      encoding: 'utf8',
      timeout: 180000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { ok: true, level: check.level, command, output: String(output).slice(0, 12000) };
  } catch (e) {
    return {
      ok: false,
      level: check.level,
      command,
      error: e.message,
      output: String(e.stdout || e.stderr || '').slice(0, 8000),
    };
  }
}

function runTests({ approved = false, projectPath = '.' } = {}) {
  const s = scan(projectPath);
  return runDetected(s.testCommand, { approved });
}

function runBuild({ approved = false, projectPath = '.' } = {}) {
  const s = scan(projectPath);
  return runDetected(s.buildCommand, { approved });
}

module.exports = { runTests, runBuild, runDetected, logCommand, LOG_PATH };
