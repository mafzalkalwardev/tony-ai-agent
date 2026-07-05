/**
 * Jan.ai local LLM bridge — OpenAI-compatible API at localhost:1337
 * @see https://github.com/janhq/jan
 */
const config = require('../config');

function status() {
  const baseUrl = config.jan?.baseUrl || 'http://localhost:1337/v1';
  return {
    name: 'jan',
    configured: Boolean(config.jan?.enabled),
    baseUrl,
    repo: 'https://github.com/janhq/jan',
  };
}

async function isAvailable() {
  if (!config.jan?.enabled) return false;
  try {
    const res = await fetch(`${config.jan.baseUrl}/models`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function complete(messages, options = {}) {
  const baseUrl = config.jan.baseUrl || 'http://localhost:1337/v1';
  const model = options.model || config.jan.model || 'jan-default';

  const body = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
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

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `Jan HTTP ${response.status}`);
  }

  const choice = data.choices?.[0]?.message || {};
  const toolCalls = (choice.tool_calls || []).map((tc) => ({
    name: tc.function?.name,
    arguments: JSON.parse(tc.function?.arguments || '{}'),
  }));

  return {
    content: choice.content || '',
    toolCalls,
    provider: 'jan',
    finishReason: data.choices?.[0]?.finish_reason,
  };
}

module.exports = { status, isAvailable, complete };
