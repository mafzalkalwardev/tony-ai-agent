/**
 * Reflexion — analyze failures, suggest fixes, retry with learned corrections.
 */
const { complete, loadIdentity } = require('../llm');
const errorMemory = require('../memory/errors');
const { executeTool } = require('../tools/registry');

async function analyzeFailure({ message, tool, args, result, sessionId }) {
  const err = result?.error || result?.hint || JSON.stringify(result).slice(0, 300);
  const pastFix = errorMemory.suggestFix(tool, err);
  const similar = errorMemory.search(err, 3);

  if (pastFix) {
    return {
      ok: true,
      source: 'memory',
      analysis: `Known fix from past mistake: ${pastFix}`,
      suggestedFix: pastFix,
      retry: true,
    };
  }

  try {
    const llm = await complete(
      [
        {
          role: 'system',
          content: `${loadIdentity()}\nYou diagnose agent tool failures. Reply ONLY JSON: {"analysis":"...","suggestedFix":"...","retry":true|false,"fixedArgs":{}}`,
        },
        {
          role: 'user',
          content: `User task: ${message.slice(0, 500)}
Tool: ${tool}
Args: ${JSON.stringify(args || {})}
Error result: ${err}
Past similar errors: ${errorMemory.formatForAgent(similar) || 'none'}

What went wrong and how to fix? If retry makes sense, provide fixedArgs object.`,
        },
      ],
      { temperature: 0.1 }
    );

    const parsed = JSON.parse(llm.content.match(/\{[\s\S]*\}/)?.[0] || '{}');
    errorMemory.record({
      tool,
      error: err,
      context: message.slice(0, 200),
      fix: parsed.suggestedFix || '',
      sessionId,
      outcome: parsed.retry ? 'retry-planned' : 'analyzed',
    });

    return { ok: true, source: 'llm', ...parsed };
  } catch (e) {
    return { ok: false, analysis: e.message, retry: false };
  }
}

async function attemptSelfHeal({ message, tool, args, result, sessionId }) {
  const reflex = await analyzeFailure({ message, tool, args, result, sessionId });
  if (!reflex.retry) {
    return { ok: false, reflexion: reflex, healed: false };
  }

  if (reflex.fixedArgs && Object.keys(reflex.fixedArgs).length) {
    const retryResult = await executeTool(tool, { ...args, ...reflex.fixedArgs }, sessionId);
    if (retryResult.ok !== false) {
      errorMemory.resolve(
        errorMemory.search(tool, 1)[0]?.id,
        reflex.suggestedFix || 'Auto-retry with fixed args succeeded',
        'resolved'
      );
      return { ok: true, healed: true, reflexion: reflex, retryResult };
    }
    errorMemory.record({
      tool,
      error: retryResult.error || 'retry failed',
      context: message.slice(0, 200),
      fix: reflex.suggestedFix,
      sessionId,
      outcome: 'retry-failed',
    });
    return { ok: false, healed: false, reflexion: reflex, retryResult };
  }

  return { ok: true, healed: false, reflexion: reflex, note: 'Fix documented — agent should apply on next iteration' };
}

async function reflectOnRun({ message, toolResults, sessionId }) {
  const failures = (toolResults || []).filter((t) => t.result?.ok === false);
  if (!failures.length) return { reflections: [] };

  const reflections = [];
  for (const f of failures.slice(0, 3)) {
    reflections.push(
      await analyzeFailure({
        message,
        tool: f.tool,
        args: f.args,
        result: f.result,
        sessionId,
      })
    );
  }
  return { reflections, formatted: reflections.map((r) => r.analysis || r.suggestedFix).filter(Boolean).join('\n') };
}

module.exports = { analyzeFailure, attemptSelfHeal, reflectOnRun };
