/**
 * Optional local STT bridge (faster-whisper via Python) when Deepgram is unavailable.
 * Modular fallback — never required for typed commands.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const config = require('../config');

function scriptPath() {
  return path.join(__dirname, '../../scripts/tony-local-stt.py');
}

function status() {
  const script = scriptPath();
  return {
    configured: fs.existsSync(script),
    preferLocalStt: Boolean(config.voice?.preferLocalStt),
    script,
    engine: 'faster-whisper (optional python)',
  };
}

function transcribeFile(audioPath, { language = null } = {}) {
  if (!fs.existsSync(audioPath)) {
    return { ok: false, error: `Audio file not found: ${audioPath}` };
  }
  if (!fs.existsSync(scriptPath())) {
    return {
      ok: false,
      error: 'Local STT script missing. Typed commands still work.',
      hint: 'scripts/tony-local-stt.py',
    };
  }
  const args = [scriptPath(), audioPath];
  if (language) args.push('--language', language);
  const result = spawnSync('python', args, {
    encoding: 'utf8',
    timeout: 120000,
  });
  if (result.error) {
    return { ok: false, error: result.error.message, fallback: 'deepgram-or-browser' };
  }
  if (result.status !== 0) {
    return {
      ok: false,
      error: (result.stderr || result.stdout || 'Local STT failed').slice(0, 500),
      fallback: 'deepgram-or-browser',
    };
  }
  try {
    const parsed = JSON.parse(result.stdout || '{}');
    return {
      ok: Boolean(parsed.text),
      transcript: parsed.text || '',
      language: parsed.language || language || 'auto',
      provider: 'faster-whisper-local',
    };
  } catch (e) {
    return { ok: false, error: `Invalid local STT JSON: ${e.message}`, raw: result.stdout?.slice(0, 300) };
  }
}

module.exports = { status, transcribeFile, scriptPath };
