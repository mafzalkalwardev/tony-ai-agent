/**
 * PowerPoint presentation creation via python-pptx bridge.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const config = require('../config');

const SCRIPT = path.join(__dirname, '../../scripts/tony-presentation.py');

function pythonBin() {
  try {
    require('child_process').execSync('python --version', { stdio: 'pipe' });
    return 'python';
  } catch {
    return 'py';
  }
}

function create(payload) {
  const result = spawnSync(pythonBin(), [SCRIPT], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env, TONY_DATA_DIR: config.dataDir },
  });

  if (result.error) return { ok: false, error: result.error.message };
  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    return { ok: false, error: (result.stderr || result.stdout || 'Presentation failed').slice(0, 500) };
  }
}

function status() {
  const check = spawnSync(pythonBin(), ['-c', 'import pptx'], { encoding: 'utf8' });
  return {
    configured: check.status === 0,
    script: SCRIPT,
    hint: check.status !== 0 ? 'pip install python-pptx' : 'ready',
  };
}

module.exports = { create, status };
