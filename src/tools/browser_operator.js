/**
 * Always-on browser operator helpers on top of Playwright MCP.
 */
const playwright = require('../mcp/playwright');
const mcpClient = require('../mcp/mcp-client');
const config = require('../config');

function mcpUrl() {
  return config.mcp.playwright.mcpUrl || 'http://localhost:8931/mcp';
}

async function ensureReady() {
  const url = mcpUrl();
  const reachable = await mcpClient.isReachable(url);
  return {
    ok: reachable,
    mcpUrl: url,
    hint: reachable ? 'ready' : 'Start with: npm run playwright:mcp',
  };
}

async function navigate(url) {
  return playwright.navigate(url);
}

async function snapshot(url) {
  return playwright.snapshot(url);
}

async function call(tool, args = {}) {
  const ready = await ensureReady();
  if (!ready.ok) return { ok: false, error: ready.hint, ...ready };
  return mcpClient.callTool(mcpUrl(), tool, args);
}

async function click(selectorOrRef) {
  // Playwright MCP uses accessibility refs from snapshot; accept either.
  if (/^\d+$/.test(String(selectorOrRef))) {
    return call('browser_click', { element: String(selectorOrRef), ref: String(selectorOrRef) });
  }
  return call('browser_click', { element: String(selectorOrRef), ref: String(selectorOrRef) });
}

async function type(selectorOrRef, text) {
  return call('browser_type', {
    element: String(selectorOrRef),
    ref: String(selectorOrRef),
    text: String(text || ''),
  });
}

async function researchAndSnapshot(url) {
  const nav = await navigate(url);
  const snap = await snapshot(url);
  return { ok: Boolean(snap.ok || nav.ok), navigate: nav, snapshot: snap, url };
}

module.exports = {
  ensureReady,
  navigate,
  snapshot,
  click,
  type,
  call,
  researchAndSnapshot,
  status: () => ({ ...playwright.status(), operator: true }),
};
