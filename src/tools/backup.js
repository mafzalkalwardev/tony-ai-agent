/**
 * Backup TONY data directory (skips obvious secret files).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('../config');

const SKIP = /(^|\/)(\.env|.*\.pem|.*\.key|credentials|secrets?)(\.|$)/i;

function listFiles(root, base = root, out = []) {
  if (!fs.existsSync(root)) return out;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    const rel = path.relative(base, full).replace(/\\/g, '/');
    if (SKIP.test(rel) || SKIP.test(entry.name)) continue;
    if (entry.isDirectory()) listFiles(full, base, out);
    else out.push(rel);
  }
  return out;
}

function createBackup({ label = 'tony-data' } = {}) {
  const src = config.dataDir;
  const outDir = path.join(config.dataDir, 'backups');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archive = path.join(outDir, `${label}_${stamp}.tar`);
  const files = listFiles(src).filter((f) => !f.startsWith('backups/'));
  if (!files.length) return { ok: false, error: 'No files to back up' };

  // Write file list then tar (portable, no secrets)
  const listFile = path.join(outDir, `_list_${stamp}.txt`);
  fs.writeFileSync(listFile, files.join('\n'), 'utf8');
  try {
    execSync(`tar -cf ${JSON.stringify(archive)} -C ${JSON.stringify(src)} -T ${JSON.stringify(listFile)}`, {
      encoding: 'utf8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) {
    return { ok: false, error: String(e.stderr || e.message || 'tar failed') };
  } finally {
    try {
      fs.unlinkSync(listFile);
    } catch {
      /* ignore */
    }
  }

  const stat = fs.statSync(archive);
  return {
    ok: true,
    fileCount: files.length,
    bytes: stat.size,
    savedPath: path.relative(config.workspaceRoot, archive),
  };
}

function listBackups() {
  const outDir = path.join(config.dataDir, 'backups');
  if (!fs.existsSync(outDir)) return { ok: true, backups: [] };
  const backups = fs
    .readdirSync(outDir)
    .filter((f) => f.endsWith('.tar'))
    .map((f) => {
      const full = path.join(outDir, f);
      const st = fs.statSync(full);
      return { name: f, bytes: st.size, at: st.mtime.toISOString() };
    })
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return { ok: true, backups };
}

module.exports = { createBackup, listBackups, listFiles };
