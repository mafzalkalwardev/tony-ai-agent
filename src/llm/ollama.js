const config = require('../config');

/**
 * Ollama — fully local LLM (works offline when Ollama is running).
 */
async function complete(messages, options = {}) {
  const base = config.ollama.baseUrl.replace(/\/$/, '');
  const model = options.model || config.ollama.model;

  const body = {
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
    stream: false,
    options: { temperature: options.temperature ?? 0.3 },
  };

  if (options.tools?.length) {
    body.tools = options.tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters || { type: 'object', properties: {} },
      },
    }));
  }

  const response = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Ollama HTTP ${response.status}`);
  }

  const msg = data.message || {};
  const toolCalls = (msg.tool_calls || []).map((tc) => ({
    name: tc.function?.name,
    arguments: typeof tc.function?.arguments === 'string'
      ? JSON.parse(tc.function.arguments || '{}')
      : tc.function?.arguments || {},
  }));

  return {
    content: msg.content || '',
    toolCalls,
    finishReason: data.done ? 'stop' : 'length',
  };
}

async function isAvailable() {
  try {
    const base = config.ollama.baseUrl.replace(/\/$/, '');
    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

module.exports = { complete, isAvailable };
