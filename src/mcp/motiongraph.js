/**
 * Motiongraph — procedural motion graphics MCP (dmarsters/motion-graphics-mcp).
 * Generates Three.js/WebGL aesthetic parameters for HUD visuals and media.
 */
const config = require('../config');
const hub = require('./hub');

function mcpUrl() {
  return config.mcp.motiongraph.mcpUrl;
}

function status() {
  return hub.statusFor('motiongraph', mcpUrl(), {
    description: 'OBJECT/LOOK/ACTION motion graphics taxonomy',
  });
}

async function mapAesthetic(object, look, action) {
  const base = mcpUrl();
  if (!base) {
    return {
      ok: true,
      local: true,
      object: object || 'arc-reactor',
      look: look || 'holographic-cyan',
      action: action || 'pulse',
      hint: 'Set MOTIONGRAPH_MCP_URL for full MCP. Using JARVIS preset.',
      preset: {
        colors: ['#00d4ff', '#0066ff', '#00ffcc'],
        animation: 'pulse-glow',
        lineDensity: 0.7,
      },
    };
  }
  return hub.callServer(base, 'map_object_look_action', { object, look, action });
}

async function getMotionParameters(name = 'pulse') {
  const base = mcpUrl();
  if (base) return hub.callServer(base, 'get_motion_parameters', { name });
  return {
    ok: true,
    name,
    parameters: { easing: 'ease-in-out', duration: 2.4, loop: true },
    local: true,
  };
}

async function synthesisContext(intent) {
  const base = mcpUrl();
  if (base) return hub.callServer(base, 'get_synthesis_context', { intent });
  return {
    ok: true,
    intent,
    style: 'iron-man-hud',
    elements: ['arc-reactor', 'scan-lines', 'node-graph', 'status-rings'],
    local: true,
  };
}

module.exports = { status, mapAesthetic, getMotionParameters, synthesisContext };
