/**
 * Export session transcripts for review / delivery notes.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const memory = require('../memory');

function exportSession(sessionId, { limit = 100 } = {}) {
  if (!sessionId) return { ok: false, error: 'sessionId required' };
  const history = memory.getSessionHistory(sessionId, limit) || [];
  const lines = [
    `# TONY session export`,
    `session: ${sessionId}`,
    `exported: ${new Date().toISOString()}`,
    '',
    ...history.map((h) => {
      const role = h.role || 'unknown';
      const content = String(h.content || h.text || '').slice(0, 4000);
      return `## ${role}\n${content}\n`;
    }),
  ];
  const outDir = path.join(config.dataDir, 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(outDir, `session_${sessionId.slice(0, 8)}_${stamp}.md`);
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  return {
    ok: true,
    turns: history.length,
    savedPath: path.relative(config.workspaceRoot, file),
    markdown: lines.join('\n').slice(0, 8000),
  };
}

module.exports = { exportSession };
