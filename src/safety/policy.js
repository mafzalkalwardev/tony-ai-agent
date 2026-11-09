/**
 * Safety policy — SAFE | NEEDS_APPROVAL | BLOCKED
 * Ported/expanded from tony-ai desktop assistant rules.
 */

const BLOCKED_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bdel\s+\/s\b/i,
  /\brd\s+\/s\b/i,
  /\bformat\s+[a-z]:/i,
  /\b(shutdown|restart)\b/i,
  /\.env\b/i,
  /\b(api[_-]?key|secret|token|password|otp|2fa)\b/i,
  /\bforce-push\b/i,
  /git\s+push\s+.*--force/i,
  /git\s+reset\s+--hard/i,
  /git\s+clean\s+-fd/i,
  /\bvoice\s+clone\b/i,
  /\bclone\s+voice\b/i,
  /\bimitate\s+(my|a|his|her|their)\s+voice\b/i,
  /\bdeepfake\s+voice\b/i,
  /\bsend\s+(email|message|whatsapp)\s+automatically\b/i,
  /\bbulk\s+sms\b/i,
  /\bmake\s+payment\b/i,
];

const APPROVAL_PATTERNS = [
  /^git\s+push\b/i,
  /^git\s+commit\b/i,
  /^npm\s+install\b/i,
  /^npm\s+i\b/i,
  /^pip\s+install\b/i,
  /^npm\s+run\s+build\b/i,
  /^npm\s+run\b/i,
  /^node\s+scripts\//i,
  /^python\s+/i,
  /\bdeploy\b/i,
  /\bvercel\s+deploy\b/i,
  /\bnetlify\s+deploy\b/i,
  /\bdocker\s+push\b/i,
  /\bnpm\s+install\s+-g\b/i,
  /\bpip\s+install\s+-g\b/i,
  /\bgh\s+pr\s+create\b/i,
  /\bgh\s+issue\s+create\b/i,
  /\bsend\s+(email|message|client)\b/i,
  /\bdelete\s+file\b/i,
  /\boverwrite\b/i,
];

const SAFE_PATTERNS = [
  /^git\s+status\b/i,
  /^git\s+log\b/i,
  /^git\s+diff\b/i,
  /^git\s+branch\b/i,
  /^npm\s+test\b/i,
  /^npm\s+run\s+test\b/i,
  /^python\s+-m\s+pytest\b/i,
  /^(ls|dir|pwd)\b/i,
  /^node\s+scripts\/test/i,
  /^codegraph\s+/i,
];

const INTENT_APPROVAL = new Set([
  'git_push',
  'git_commit',
  'build_project',
  'run_tests',
  'search_web',
  'deploy',
  'send_message',
  'install_dependencies',
  'run_shell_command',
]);

const INTENT_SAFE = new Set([
  'git_status',
  'project_scan',
  'client_delivery',
  'chat',
  'copy_paste',
  'settings',
  'file_task',
]);

const INTENT_BLOCKED = new Set(['voice_clone', 'read_secrets']);

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

function classifyIntent(intent, command = '') {
  const name = String(intent || '').trim();
  if (INTENT_BLOCKED.has(name) || /\b(voice clone|clone voice)\b/i.test(command)) {
    return {
      level: 'BLOCKED',
      reason: 'Voice cloning / secret access blocked without explicit consent workflow',
    };
  }
  if (INTENT_SAFE.has(name)) {
    return { level: 'SAFE', reason: `${name} is safe` };
  }
  if (INTENT_APPROVAL.has(name)) {
    return { level: 'NEEDS_APPROVAL', reason: `Approval required for ${name}` };
  }
  if (command) return classifyCommand(command);
  return { level: 'SAFE', reason: 'No risky pattern detected' };
}

function canRunCommand(command, { approved = false, unsafeMode = false } = {}) {
  const { level, reason } = classifyCommand(command);
  if (unsafeMode && level !== 'BLOCKED') return { allowed: true, level: 'UNSAFE_OVERRIDE', reason };
  if (level === 'SAFE') return { allowed: true, level, reason };
  if (level === 'NEEDS_APPROVAL' && approved) return { allowed: true, level, reason: 'User approved' };
  return { allowed: false, level, reason };
}

function voiceCloneConsentRequired(text) {
  return /\b(voice clone|clone voice|imitate.*voice|deepfake voice)\b/i.test(String(text || ''));
}

module.exports = {
  classifyCommand,
  classifyIntent,
  canRunCommand,
  voiceCloneConsentRequired,
  BLOCKED_PATTERNS,
  APPROVAL_PATTERNS,
  SAFE_PATTERNS,
};
