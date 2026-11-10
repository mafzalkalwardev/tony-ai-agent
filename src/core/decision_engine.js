/**
 * Decision engine — analyzes big/risky operator choices and either:
 * - executes under Trusted Operator Mode, or
 * - returns a strong recommendation + pending approval.
 */
const trusted = require('../safety/trusted_mode');
const approvals = require('../safety/approvals');
const { classifyCommand, classifyIntent } = require('../safety/policy');

const RISK_HINTS = [
  { re: /\b(push|deploy|release|publish)\b/i, risk: 'high', label: 'publish/deploy' },
  { re: /\b(install|dependency|pip|npm i)\b/i, risk: 'medium', label: 'install packages' },
  { re: /\b(delete|remove|overwrite|reset)\b/i, risk: 'high', label: 'destructive change' },
  { re: /\b(send|email|client message|whatsapp)\b/i, risk: 'high', label: 'external message' },
  { re: /\b(buy|payment|checkout|order)\b/i, risk: 'critical', label: 'money movement' },
  { re: /\b(research|browse|open|navigate|scrape)\b/i, risk: 'low', label: 'research/browse' },
  { re: /\b(build|test|scan|summarize|commit message)\b/i, risk: 'low', label: 'local engineering' },
];

function analyze(message, intent = {}) {
  const text = `${intent.intent || ''} ${message || ''}`;
  const hits = RISK_HINTS.filter((h) => h.re.test(text));
  const risk = hits.find((h) => h.risk === 'critical')?.risk
    || hits.find((h) => h.risk === 'high')?.risk
    || hits.find((h) => h.risk === 'medium')?.risk
    || 'low';
  const safety = classifyIntent(intent.intent || 'unknown', message);
  const cmdSafety = classifyCommand(message);
  return {
    risk,
    labels: hits.map((h) => h.label),
    safetyLevel: safety.level === 'BLOCKED' || cmdSafety.level === 'BLOCKED' ? 'BLOCKED' : safety.level,
    safetyReason: safety.reason || cmdSafety.reason,
    trusted: trusted.isEnabled(),
    recommendation:
      risk === 'critical'
        ? 'Do not automate money/payment. Pause for human confirmation at checkout.'
        : risk === 'high'
          ? trusted.isEnabled()
            ? 'Trusted mode ON — proceed carefully, log every step, keep hard blocks.'
            : 'Recommend enabling Trusted Operator Mode or approve this specific action.'
          : 'Safe to proceed with local tools / research.',
  };
}

async function decideAndMaybeExecute({ message, intent, sessionId, execute }) {
  const analysis = analyze(message, intent || {});
  if (analysis.safetyLevel === 'BLOCKED') {
    return {
      ok: false,
      blocked: true,
      analysis,
      response: `Blocked: ${analysis.safetyReason}`,
    };
  }

  const needsApproval = analysis.safetyLevel === 'NEEDS_APPROVAL' || analysis.risk === 'high';
  const auto = trusted.canAutoApprove(intent?.intent || 'decide', message);

  if (needsApproval && !auto) {
    const pending = approvals.create({
      action: intent?.intent || 'risky_decision',
      command: message,
      reason: analysis.recommendation,
      sessionId,
      meta: { analysis },
    });
    return {
      ok: true,
      waiting: true,
      analysis,
      pending,
      response: `# Decision required

**Risk:** ${analysis.risk}
**Why:** ${analysis.labels.join(', ') || 'elevated action'}
**Recommendation:** ${analysis.recommendation}

Reply **yes/haan** to authorize, or enable Trusted Operator Mode:
\`Tony trusted mode on\`

Pending: ${pending.id}`,
    };
  }

  if (typeof execute === 'function') {
    const result = await execute(analysis);
    return {
      ok: true,
      executed: true,
      analysis,
      result,
      response:
        result?.response ||
        `Executed under ${trusted.isEnabled() ? 'Trusted Operator Mode' : 'normal mode'} (risk=${analysis.risk}).`,
    };
  }

  return {
    ok: true,
    analysis,
    response: `Decision: proceed (risk=${analysis.risk}). ${analysis.recommendation}`,
  };
}

module.exports = { analyze, decideAndMaybeExecute, RISK_HINTS };
