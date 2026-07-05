/**
 * Safety policy — ported from tony-ai (https://github.com/mafzalkalwardev/tony-ai)
 * SAFE | NEEDS_APPROVAL | BLOCKED
 */

const BLOCKED_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bdel\s+\/s\b/i,
  /\bformat\s+[a-z]:/i,
  /\b(shutdown|restart)\b/i,
  /\.env\b/i,
  /\b(api[_-]?key|secret|token|password|otp|2fa)\b/i,
  /\bforce-push\b/i,
  /git\s+push\s+.*--force/i,
  /git\s+reset\s+--hard/i,
  /git\s+clean\s+-fd/i,
];

const APPROVAL_PATTERNS = [
  /^git\s+push\b/i,
  /^git\s+commit\b/i,
  /^npm\s+install\b/i,
  /^npm\s+i\b/i,
  /^pip\s+install\b/i,
  /^npm\s+run\s+build\b/i,
  /^node\s+scripts\//i,
  /^python\s+/i,
];

const SAFE_PATTERNS = [
  /^git\s+status\b/i,
  /^git\s+log\b/i,
  /^git\s+diff\b/i,
  /^git\s+branch\b/i,
  /^npm\s+test\b/i,
  /^npm\s+run\s+test\b/i,
  /^(ls|dir)\b/i,
  /^node\s+scripts\/test/i,
  /^codegraph\s+/i,
];

function classifyCommand(command) {
  const cmd = String(command || '').trim();
  if (!cmd) return { level: 'BLOCKED', reason: 'Empty command' };

  for (const re of BLOCKED_PATTERNS) {
    if (re.test(cmd)) return { level: 'BLOCKED', reason: `Blocked pattern: ${re.source}` };
  }

  for (const re of SAFE_PATTERNS) {
    if (re.test(cmd)) return { level: 'SAFE', reason: 'Allowlisted read-only command' };
  }

  for (const re of APPROVAL_PATTERNS) {
    if (re.test(cmd)) return { level: 'NEEDS_APPROVAL', reason: 'Requires explicit user approval' };
  }

  return { level: 'NEEDS_APPROVAL', reason: 'Command not in safe allowlist' };
}

function canRunCommand(command, { approved = false, unsafeMode = false } = {}) {
  const { level, reason } = classifyCommand(command);
  if (unsafeMode && level !== 'BLOCKED') return { allowed: true, level: 'UNSAFE_OVERRIDE', reason };
  if (level === 'SAFE') return { allowed: true, level, reason };
  if (level === 'NEEDS_APPROVAL' && approved) return { allowed: true, level, reason: 'User approved' };
  return { allowed: false, level, reason };
}

module.exports = { classifyCommand, canRunCommand, BLOCKED_PATTERNS, APPROVAL_PATTERNS, SAFE_PATTERNS };
