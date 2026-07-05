const config = require('../config');
const mcpClient = require('./mcp-client');

function mcpUrl() {
  return config.mcp.playwright.mcpUrl || 'http://localhost:8931/mcp';
}

async function navigate(url) {
  const url_ = mcpUrl();
  if (await mcpClient.isReachable(url_)) {
    return { ...(await mcpClient.callTool(url_, 'browser_navigate', { url })), provider: 'playwright-mcp', url };
  }
  return fetchSnapshot(url);
}

async function snapshot(url) {
  const url_ = mcpUrl();
  if (await mcpClient.isReachable(url_)) {
    await mcpClient.callTool(url_, 'browser_navigate', { url });
    const snap = await mcpClient.callTool(url_, 'browser_snapshot', {});
    return { ...snap, provider: 'playwright-mcp', url };
  }
  return fetchSnapshot(url);
}

async function fetchSnapshot(url) {
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'Only http(s) URLs allowed' };

  const firecrawl = require('./firecrawl');
  if (firecrawl.status().configured) {
    const scraped = await firecrawl.scrape(url);
    if (scraped.ok) {
      return {
        ok: true,
        provider: 'firecrawl-fallback',
        url,
        content: scraped.content,
        title: scraped.title,
        note: 'Playwright MCP offline — used Firecrawl scrape instead',
      };
    }
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const html = await response.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    ok: true,
    provider: 'fetch-fallback',
    url,
    status: response.status,
    content: text.slice(0, 8000),
    note: 'Start Playwright MCP: npm run playwright:mcp (see playwright.dev/docs/getting-started-mcp)',
  };
}

async function listTools() {
  const url_ = mcpUrl();
  if (!(await mcpClient.isReachable(url_))) {
    return { ok: false, error: 'Playwright MCP not reachable', hint: 'npm run playwright:mcp' };
  }
  const tools = await mcpClient.listTools(url_);
  return { ok: true, tools: tools.map((t) => t.name) };
}

function status() {
  const url = mcpUrl();
  return {
    provider: 'playwright',
    mcpUrl: url,
    package: '@playwright/mcp',
    docs: 'https://playwright.dev/docs/getting-started-mcp',
    configured: Boolean(url),
    mode: 'local-free',
  };
}

module.exports = { navigate, snapshot, listTools, status, mcpClient };
