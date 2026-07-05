const config = require('../config');

/**
 * Playwright MCP bridge — calls local Playwright MCP server or falls back to fetch snapshot.
 * Set PLAYWRIGHT_MCP_URL=http://localhost:8931 for full browser automation.
 */
async function navigate(url, options = {}) {
  if (config.mcp.playwright.mcpUrl) {
    return callMcpTool('browser_navigate', { url });
  }
  return fetchSnapshot(url, options);
}

async function snapshot(url) {
  if (config.mcp.playwright.mcpUrl) {
    await callMcpTool('browser_navigate', { url });
    return callMcpTool('browser_snapshot', {});
  }
  return fetchSnapshot(url);
}

async function callMcpTool(toolName, args) {
  const response = await fetch(`${config.mcp.playwright.mcpUrl}/tools/${toolName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(60000),
  });
  const data = await response.json();
  if (!response.ok) return { ok: false, error: data.error || `Playwright MCP HTTP ${response.status}` };
  return { ok: true, provider: 'playwright-mcp', tool: toolName, result: data };
}

async function fetchSnapshot(url) {
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'Only http(s) URLs allowed' };
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const html = await response.text();
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    ok: true,
    provider: 'playwright-fallback',
    url,
    status: response.status,
    content: text.slice(0, 8000),
    note: 'Set PLAYWRIGHT_MCP_URL for full browser automation (microsoft/playwright-mcp)',
  };
}

function status() {
  return {
    provider: 'playwright',
    mcpConfigured: Boolean(config.mcp.playwright.mcpUrl),
    fallback: true,
  };
}

module.exports = { navigate, snapshot, status };
