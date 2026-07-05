const config = require('../config');

/**
 * Groq LLM — fast inference via OpenAI-compatible chat completions API.
 */
async function complete(messages, options = {}) {
  if (!config.groq.apiKey) {
    throw new Error('GROQ_API_KEY not set');
  }

  const body = {
    model: config.groq.model,
    messages: messages.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
    temperature: options.temperature ?? 0.3,
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
    body.tool_choice = options.toolChoice || 'auto';
  }

  const response = await fetch(`${config.groq.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.groq.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `Groq HTTP ${response.status}`);
  }

  const choice = data.choices[0];
  const msg = choice.message;
  const toolCalls = (msg.tool_calls || []).map((tc) => ({
    name: tc.function.name,
    arguments: JSON.parse(tc.function.arguments || '{}'),
  }));

  return {
    content: msg.content || '',
    toolCalls,
    finishReason: choice.finish_reason,
  };
}

module.exports = { complete };
