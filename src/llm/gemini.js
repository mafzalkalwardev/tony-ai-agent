const config = require('../config');

/** Convert OpenAI-style messages to Gemini contents */
function toGeminiContents(messages) {
  const contents = [];
  for (const m of messages) {
    if (m.role === 'system') {
      contents.push({ role: 'user', parts: [{ text: `[System]\n${m.content}` }] });
      contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
      continue;
    }
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
    });
  }
  return contents;
}

function toGeminiTools(tools) {
  if (!tools?.length) return undefined;
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters || { type: 'object', properties: {} },
      })),
    },
  ];
}

async function complete(messages, options = {}) {
  if (!config.gemini.apiKey) {
    throw new Error('GOOGLE_AI_API_KEY not set');
  }

  const model = options.model || config.gemini.model;
  const url = `${config.gemini.baseUrl}/models/${model}:generateContent?key=${config.gemini.apiKey}`;

  const body = {
    contents: toGeminiContents(messages),
    generationConfig: { temperature: options.temperature ?? 0.3 },
  };

  const tools = toGeminiTools(options.tools);
  if (tools) body.tools = tools;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || JSON.stringify(data.error) || `Gemini HTTP ${response.status}`);
  }

  const parts = data.candidates?.[0]?.content?.parts || [];
  let content = '';
  const toolCalls = [];

  for (const part of parts) {
    if (part.text) content += part.text;
    if (part.functionCall) {
      toolCalls.push({
        name: part.functionCall.name,
        arguments: part.functionCall.args || {},
      });
    }
  }

  return { content, toolCalls, finishReason: data.candidates?.[0]?.finishReason };
}

module.exports = { complete };
