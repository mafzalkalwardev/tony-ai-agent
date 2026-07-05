/**
 * Desktop automation via Python pyautogui bridge.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const config = require('../config');

const SCRIPT = path.join(__dirname, '../../scripts/tony-automation.py');

function pythonBin() {
  try {
    require('child_process').execSync('python --version', { stdio: 'pipe' });
    return 'python';
  } catch {
    return 'py';
  }
}

function run(payload) {
  const result = spawnSync(pythonBin(), [SCRIPT], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    timeout: 60000,
    env: { ...process.env, TONY_DATA_DIR: config.dataDir },
  });

  if (result.error) return { ok: false, error: result.error.message };
  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    return { ok: false, error: (result.stderr || result.stdout || 'Automation failed').slice(0, 500) };
  }
}

function status() {
  const check = spawnSync(pythonBin(), ['-c', 'import pyautogui'], { encoding: 'utf8' });
  return {
    configured: check.status === 0,
    script: SCRIPT,
    hint: check.status !== 0 ? 'pip install pyautogui pyperclip' : 'ready',
  };
}

module.exports = { run, status };
