const config = require('../config');

async function search(query, options = {}) {
  if (!config.mcp.perplexity.apiKey) {
    return { ok: false, error: 'PERPLEXITY_API_KEY not set' };
  }

  const response = await fetch(`${config.mcp.perplexity.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.mcp.perplexity.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model || config.mcp.perplexity.model,
      messages: [
        {
          role: 'system',
          content: 'You are a research assistant. Cite sources when possible. Be concise and factual.',
        },
        { role: 'user', content: query },
      ],
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(60000),
  });

  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: data.error?.message || `Perplexity HTTP ${response.status}` };
  }

  return {
    ok: true,
    provider: 'perplexity',
    answer: data.choices?.[0]?.message?.content || '',
    citations: data.citations || [],
  };
}

function status() {
  return {
    provider: 'perplexity',
    configured: Boolean(config.mcp.perplexity.apiKey),
    model: config.mcp.perplexity.model,
  };
}

module.exports = { search, status };
