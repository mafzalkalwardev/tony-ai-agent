/**
 * Changelog digest from local git history.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../config');

function runGit(args) {
  try {
    return execSync(`git ${args}`, {
      cwd: config.workspaceRoot,
      encoding: 'utf8',
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (e) {
    return String(e.stdout || e.stderr || e.message || '').trim();
  }
}

function digest({ since = '7 days ago', limit = 40 } = {}) {
  const log = runGit(`log --since=${JSON.stringify(since)} --pretty=format:%h|%ad|%s --date=short -n ${Number(limit) || 40}`);
  const lines = String(log || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const commits = lines.map((l) => {
    const [hash, date, ...rest] = l.split('|');
    return { hash, date, subject: rest.join('|') };
  });

  const features = commits.filter((c) => /^(feat|add|ship)/i.test(c.subject) || /\badd(ed)?\b/i.test(c.subject));
  const fixes = commits.filter((c) => /^(fix|bug)/i.test(c.subject) || /\bfix(es|ed)?\b/i.test(c.subject));
  const other = commits.filter((c) => !features.includes(c) && !fixes.includes(c));

  const markdown = `# Changelog digest

Since: **${since}**
Commits: **${commits.length}**

## Features
${features.length ? features.map((c) => `- \`${c.hash}\` ${c.subject} _( ${c.date} )`).join('\n') : '- (none)'}

## Fixes
${fixes.length ? fixes.map((c) => `- \`${c.hash}\` ${c.subject} _( ${c.date} )`).join('\n') : '- (none)'}

## Other
${other.slice(0, 20).map((c) => `- \`${c.hash}\` ${c.subject} _( ${c.date} )`).join('\n') || '- (none)'}
`;

  return { ok: true, since, commits: commits.length, features, fixes, other, markdown };
}

function exportDigest(opts = {}) {
  const dig = digest(opts);
  const outDir = path.join(config.dataDir, 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(outDir, `changelog_${stamp}.md`);
  fs.writeFileSync(file, dig.markdown, 'utf8');
  return { ...dig, savedPath: path.relative(config.workspaceRoot, file) };
}

module.exports = { digest, exportDigest };
