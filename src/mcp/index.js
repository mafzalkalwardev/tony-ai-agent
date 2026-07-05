const perplexity = require('./perplexity');
const firecrawl = require('./firecrawl');
const quickbooks = require('./quickbooks');
const higgsfield = require('./higgsfield');
const playwright = require('./playwright');

const providers = {
  perplexity,
  firecrawl,
  quickbooks,
  higgsfield,
  playwright,
};

function statusAll() {
  return Object.fromEntries(Object.entries(providers).map(([name, mod]) => [name, mod.status()]));
}

async function research(query, options = {}) {
  const results = { query, sources: [] };

  if (options.perplexity !== false && perplexity.status().configured) {
    const p = await perplexity.search(query);
    if (p.ok) results.sources.push({ type: 'perplexity', ...p });
  }

  if (options.firecrawl !== false && firecrawl.status().configured) {
    const f = await firecrawl.search(query);
    if (f.ok) results.sources.push({ type: 'firecrawl', ...f });
  }

  if (!results.sources.length) {
    return { ok: false, error: 'No MCP research providers configured', query };
  }

  return { ok: true, ...results };
}

module.exports = {
  providers,
  statusAll,
  research,
  perplexity,
  firecrawl,
  quickbooks,
  higgsfield,
  playwright,
};
