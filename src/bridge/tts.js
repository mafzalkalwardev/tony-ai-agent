/**
 * Local TTS bridge — edge-tts / pyttsx3 when ElevenLabs unavailable.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPT = path.join(__dirname, '../../scripts/tony-tts.py');

function pythonBin() {
  try {
    require('child_process').execSync('python --version', { stdio: 'pipe' });
    return 'python';
  } catch {
    return 'py';
  }
}

function speak(text, voice) {
  const result = spawnSync(pythonBin(), [SCRIPT], {
    input: JSON.stringify({ text, voice }),
    encoding: 'utf8',
    timeout: 90000,
  });

  if (result.error) return { ok: false, error: result.error.message };
  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    return { ok: false, error: (result.stderr || result.stdout || 'TTS failed').slice(0, 500) };
  }
}

function status() {
  const edge = spawnSync(pythonBin(), ['-c', 'import edge_tts'], { encoding: 'utf8' });
  const pyttsx = spawnSync(pythonBin(), ['-c', 'import pyttsx3'], { encoding: 'utf8' });
  return {
    configured: edge.status === 0 || pyttsx.status === 0,
    edgeTts: edge.status === 0,
    pyttsx3: pyttsx.status === 0,
    hint: edge.status !== 0 ? 'pip install edge-tts' : 'ready',
  };
}

module.exports = { speak, status };
