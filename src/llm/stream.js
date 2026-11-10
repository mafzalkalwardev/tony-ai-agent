/**
 * Response streaming helpers — SSE chunker + optional Groq token stream.
 */
const config = require('../config');

async function* chunkText(text, size = 48) {
  const s = String(text || '');
  for (let i = 0; i < s.length; i += size) {
    yield s.slice(i, i + size);
    await new Promise((r) => setTimeout(r, 8));
  }
}

async function* streamGroq(messages, options = {}) {
  if (!config.groq?.apiKey) {
    yield* chunkText('(Groq not configured — falling back to chunked reply)');
    return;
  }
  const body = {
    model: config.groq.model,
    messages: messages.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
    temperature: options.temperature ?? 0.3,
    stream: true,
  };
  const response = await fetch(`${config.groq.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.groq.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok || !response.body) {
    const err = await response.text().catch(() => '');
    throw new Error(err || `Groq stream HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n');
    buf = parts.pop() || '';
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        /* ignore partial */
      }
    }
  }
}

function writeSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

module.exports = { chunkText, streamGroq, writeSse };
