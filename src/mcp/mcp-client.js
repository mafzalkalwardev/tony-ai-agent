/**
 * MCP JSON-RPC client for Streamable HTTP transport (Playwright MCP).
 * @see https://playwright.dev/docs/getting-started-mcp
 * @see https://github.com/microsoft/playwright-mcp
 */

let sessionId = null;
let requestId = 0;

function normalizeUrl(baseUrl) {
  const url = (baseUrl || 'http://localhost:8931/mcp').replace(/\/$/, '');
  return url.endsWith('/mcp') ? url : `${url}/mcp`;
}

async function rpc(baseUrl, method, params = {}) {
  const url = normalizeUrl(baseUrl);
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;

  const body = {
    jsonrpc: '2.0',
    id: ++requestId,
    method,
    params,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  });

  const newSession = response.headers.get('mcp-session-id');
  if (newSession) sessionId = newSession;

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream')) {
    const text = await response.text();
    const dataLine = text.split('\n').find((l) => l.startsWith('data: '));
    if (!dataLine) throw new Error('No SSE data in MCP response');
    return JSON.parse(dataLine.slice(6));
  }

  return response.json();
}

async function initialize(baseUrl) {
  sessionId = null;
  requestId = 0;
  const init = await rpc(baseUrl, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'tony-agent', version: '2.1.0' },
  });
  if (init.error) throw new Error(init.error.message || 'MCP initialize failed');
  await rpc(baseUrl, 'notifications/initialized', {});
  return init.result;
}

async function callTool(baseUrl, name, args = {}) {
  await initialize(baseUrl);
  const result = await rpc(baseUrl, 'tools/call', { name, arguments: args });
  if (result.error) {
    return { ok: false, error: result.error.message || JSON.stringify(result.error) };
  }
  const content = result.result?.content || [];
  const text = content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
  return { ok: true, tool: name, result: result.result, text };
}

async function listTools(baseUrl) {
  await initialize(baseUrl);
  const result = await rpc(baseUrl, 'tools/list', {});
  if (result.error) throw new Error(result.error.message);
  return result.result?.tools || [];
}

async function isReachable(baseUrl) {
  try {
    await initialize(baseUrl);
    return true;
  } catch {
    return false;
  }
}

module.exports = { callTool, listTools, isReachable, normalizeUrl };
