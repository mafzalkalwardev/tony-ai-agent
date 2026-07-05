const config = require('../config');

async function scrape(url, options = {}) {
  if (!config.mcp.firecrawl.apiKey) {
    return { ok: false, error: 'FIRECRAWL_API_KEY not set' };
  }

  const response = await fetch(`${config.mcp.firecrawl.baseUrl}/scrape`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.mcp.firecrawl.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: options.formats || ['markdown'],
      onlyMainContent: options.onlyMainContent !== false,
    }),
    signal: AbortSignal.timeout(90000),
  });

  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: data.error || data.message || `Firecrawl HTTP ${response.status}` };
  }

  const content = data.data?.markdown || data.data?.content || JSON.stringify(data.data || {});
  return {
    ok: true,
    provider: 'firecrawl',
    url,
    title: data.data?.metadata?.title,
    content: String(content).slice(0, 12000),
  };
}

async function search(query, options = {}) {
  if (!config.mcp.firecrawl.apiKey) {
    return { ok: false, error: 'FIRECRAWL_API_KEY not set' };
  }

  const response = await fetch(`${config.mcp.firecrawl.baseUrl}/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.mcp.firecrawl.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, limit: options.limit || 5 }),
    signal: AbortSignal.timeout(60000),
  });

  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: data.error || `Firecrawl HTTP ${response.status}` };
  }

  return { ok: true, provider: 'firecrawl', query, results: data.data || [] };
}

function status() {
  return {
    provider: 'firecrawl',
    configured: Boolean(config.mcp.firecrawl.apiKey),
  };
}

module.exports = { scrape, search, status };
