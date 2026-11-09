/**
 * Lightweight TONY MCP-style tool server for Cursor / local agents.
 * Exposes list_tools + call_tool over HTTP JSON.
 */
const { listTools, executeTool, getTool } = require('../tools/registry');

function listMcpTools() {
  return listTools().map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.parameters || { type: 'object', properties: {} },
  }));
}

async function callMcpTool(name, args = {}, sessionId = 'mcp') {
  if (!getTool(name)) return { ok: false, error: `Unknown tool: ${name}` };
  try {
    const result = await executeTool(name, args, sessionId);
    return { ok: true, tool: name, result };
  } catch (e) {
    return { ok: false, tool: name, error: e.message };
  }
}

function status() {
  return {
    mode: 'tony-mcp-http',
    tools: listMcpTools().length,
    endpoints: {
      tools: 'GET /api/mcp/tony/tools',
      call: 'POST /api/mcp/tony/call',
    },
  };
}

module.exports = { listMcpTools, callMcpTool, status };
