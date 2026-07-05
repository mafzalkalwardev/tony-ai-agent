/**
 * Generic MCP HTTP hub — call tools on any Streamable HTTP MCP server.
 */
const mcpClient = require('./mcp-client');

async function callServer(baseUrl, toolName, args = {}) {
  if (!baseUrl) return { ok: false, error: 'MCP URL not configured' };
  try {
    const reachable = await mcpClient.isReachable(baseUrl);
    if (!reachable) return { ok: false, error: `MCP unreachable: ${baseUrl}` };
    return mcpClient.callTool(baseUrl, toolName, args);
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function listServerTools(baseUrl) {
  if (!baseUrl) return [];
  try {
    return await mcpClient.listTools(baseUrl);
  } catch {
    return [];
  }
}

function statusFor(name, baseUrl, extra = {}) {
  return {
    name,
    mcpUrl: baseUrl || null,
    configured: Boolean(baseUrl),
    ...extra,
  };
}

module.exports = { callServer, listServerTools, statusFor };
