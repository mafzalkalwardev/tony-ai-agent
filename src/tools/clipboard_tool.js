/**
 * Clipboard helper — read/write text for copy_paste intents.
 * Prefer local OS clipboard when available; otherwise use an in-memory session clipboard.
 */
const { execSync, spawnSync } = require('child_process');

let memoryClipboard = '';

function hasCommand(bin) {
  try {
    execSync(`command -v ${bin}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function readClipboard() {
  try {
    if (process.platform === 'win32') {
      const out = execSync('powershell -NoProfile -Command Get-Clipboard', {
        encoding: 'utf8',
        timeout: 5000,
      });
      return { ok: true, text: String(out || '').trimEnd(), source: 'os' };
    }
    if (process.platform === 'darwin' && hasCommand('pbpaste')) {
      const out = execSync('pbpaste', { encoding: 'utf8', timeout: 5000 });
      return { ok: true, text: String(out || ''), source: 'os' };
    }
    if (hasCommand('xclip')) {
      const out = execSync('xclip -selection clipboard -o', { encoding: 'utf8', timeout: 5000 });
      return { ok: true, text: String(out || ''), source: 'os' };
    }
    if (hasCommand('xsel')) {
      const out = execSync('xsel --clipboard --output', { encoding: 'utf8', timeout: 5000 });
      return { ok: true, text: String(out || ''), source: 'os' };
    }
  } catch (e) {
    return {
      ok: true,
      text: memoryClipboard,
      source: 'memory',
      warning: `OS clipboard unavailable (${e.message}). Using in-memory clipboard.`,
    };
  }
  return {
    ok: true,
    text: memoryClipboard,
    source: 'memory',
    warning: 'No OS clipboard tool found. Using in-memory clipboard.',
  };
}

function writeClipboard(text) {
  const value = String(text ?? '');
  memoryClipboard = value;

  try {
    if (process.platform === 'win32') {
      spawnSync('powershell', ['-NoProfile', '-Command', 'Set-Clipboard -Value $input'], {
        input: value,
        encoding: 'utf8',
        timeout: 5000,
      });
      return { ok: true, bytes: Buffer.byteLength(value, 'utf8'), source: 'os' };
    }
    if (process.platform === 'darwin' && hasCommand('pbcopy')) {
      spawnSync('pbcopy', [], { input: value, encoding: 'utf8', timeout: 5000 });
      return { ok: true, bytes: Buffer.byteLength(value, 'utf8'), source: 'os' };
    }
    if (hasCommand('xclip')) {
      spawnSync('xclip', ['-selection', 'clipboard'], {
        input: value,
        encoding: 'utf8',
        timeout: 5000,
      });
      return { ok: true, bytes: Buffer.byteLength(value, 'utf8'), source: 'os' };
    }
    if (hasCommand('xsel')) {
      spawnSync('xsel', ['--clipboard', '--input'], {
        input: value,
        encoding: 'utf8',
        timeout: 5000,
      });
      return { ok: true, bytes: Buffer.byteLength(value, 'utf8'), source: 'os' };
    }
  } catch (e) {
    return {
      ok: true,
      bytes: Buffer.byteLength(value, 'utf8'),
      source: 'memory',
      warning: `OS clipboard write failed (${e.message}). Saved in-memory only.`,
    };
  }

  return {
    ok: true,
    bytes: Buffer.byteLength(value, 'utf8'),
    source: 'memory',
    warning: 'No OS clipboard tool found. Saved in-memory only.',
  };
}

function copyPaste({ text = '', mode = 'auto' } = {}) {
  const m = String(mode || 'auto').toLowerCase();
  if (m === 'write' || (m === 'auto' && text)) {
    const written = writeClipboard(text);
    return { ok: true, action: 'write', ...written, textPreview: String(text).slice(0, 500) };
  }
  const read = readClipboard();
  return { ok: true, action: 'read', ...read, textPreview: String(read.text || '').slice(0, 500) };
}

module.exports = {
  readClipboard,
  writeClipboard,
  copyPaste,
};
