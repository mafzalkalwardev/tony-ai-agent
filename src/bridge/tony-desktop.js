/**
 * Bridge to tony-ai — local Python/PyQt6 voice-first desktop assistant.
 * https://github.com/mafzalkalwardev/tony-ai
 *
 * Node agent uses this for local Windows ops (git, project tools, safety-gated shell)
 * while tony-ai PyQt6 app remains the native desktop UI when installed.
 */
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const config = require('../config');

function resolveDesktopPath() {
  const candidates = [
    config.tonyDesktop.path,
    path.join(config.integrationsDir, 'repos', 'tony-ai'),
    path.join(config.workspaceRoot, 'tony-ai'),
    path.join(config.workspaceRoot, '..', 'tony-ai'),
  ].filter(Boolean);

  for (const p of candidates) {
    const resolved = path.resolve(p);
    if (fs.existsSync(path.join(resolved, 'run_tony.py'))) return resolved;
  }
  return null;
}

function status() {
  const desktopPath = resolveDesktopPath();
  const bridgeScript = path.join(config.workspaceRoot, 'scripts', 'tony-ai-bridge.py');
  const hasBridge = fs.existsSync(bridgeScript);
  const hasPython = (() => {
    try {
      execSync('python --version', { stdio: 'pipe' });
      return true;
    } catch {
      try {
        execSync('py --version', { stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    }
  })();

  let version = null;
  if (desktopPath && fs.existsSync(path.join(desktopPath, 'VERSION'))) {
    version = fs.readFileSync(path.join(desktopPath, 'VERSION'), 'utf8').trim();
  }

  return {
    configured: Boolean(desktopPath),
    path: desktopPath,
    version,
    bridgeScript: hasBridge,
    python: hasPython,
    repo: 'https://github.com/mafzalkalwardev/tony-ai',
    features: [
      'Local faster-whisper STT + pyttsx3 TTS (no paid APIs)',
      'PyQt6 desktop UI with wake mode',
      'Git/project tools with safety approvals',
      'Observe/Teach/Vision modes',
    ],
  };
}

function pythonBin() {
  try {
    execSync('python --version', { stdio: 'pipe' });
    return 'python';
  } catch {
    return 'py';
  }
}

function runBridge(command, payload = {}) {
  const st = status();
  if (!st.configured) {
    return {
      ok: false,
      error: 'tony-ai not found. Run: npm run integrations:init (adds tony-ai repo)',
      hint: 'Or set TONY_DESKTOP_PATH to your tony-ai clone',
      repo: st.repo,
    };
  }

  const bridgeScript = path.join(config.workspaceRoot, 'scripts', 'tony-ai-bridge.py');
  if (!fs.existsSync(bridgeScript)) {
    return { ok: false, error: 'scripts/tony-ai-bridge.py missing' };
  }

  const input = JSON.stringify({ command, ...payload });
  const result = spawnSync(pythonBin(), [bridgeScript, st.path], {
    input,
    encoding: 'utf8',
    timeout: 120000,
    cwd: st.path,
  });

  if (result.error) return { ok: false, error: result.error.message };
  if (result.status !== 0) {
    return { ok: false, error: (result.stderr || result.stdout || 'Bridge failed').slice(0, 2000) };
  }

  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    return { ok: true, output: result.stdout.trim().slice(0, 8000) };
  }
}

function runTextCommand(text) {
  return runBridge('command', { text });
}

function healthCheck() {
  return runBridge('health');
}

module.exports = { status, runTextCommand, healthCheck, runBridge, resolveDesktopPath };
