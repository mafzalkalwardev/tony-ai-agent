/**
 * Architectures of Mind — unified cognitive orchestration layer.
 *
 * Layers:
 * 1. Perception  — voice (Deepgram) + text input
 * 2. Working     — current session context
 * 3. Episodic    — conversation history
 * 4. Semantic    — facts and preferences
 * 5. Procedural  — playbooks and workflows
 * 6. Graph       — graphify structural understanding
 * 7. Obsidian    — agentic brain vault (externalized cognition)
 */

const memory = require('../memory');
const graphify = require('./graphify');
const obsidian = require('./obsidian');
const deepgram = require('../voice/deepgram');
const elevenlabs = require('../voice/elevenlabs');

function assembleContext({ sessionId, userMessage, includeGraph = true, includeObsidian = true }) {
  const layers = {};

  layers.working = {
    sessionId,
    messagePreview: userMessage.slice(0, 200),
  };

  const memorySearch = memory.searchAll(userMessage, 5);
  layers.episodic = memorySearch.episodic.slice(0, 3);
  layers.semantic = memorySearch.semantic.slice(0, 5);
  layers.procedural = memorySearch.procedural.slice(0, 3);

  if (includeGraph) {
    layers.graph = graphify.query(userMessage.split(/\s+/)[0] || 'agent', 6);
  }

  if (includeObsidian && obsidian.isConfigured()) {
    layers.obsidian = obsidian.searchNotes(userMessage, 5);
  }

  return layers;
}

function formatContextBlock(layers) {
  const sections = [];

  if (layers.semantic?.length) {
    sections.push(
      '## Semantic memory\n' + layers.semantic.map((f) => `- ${f.text}`).join('\n')
    );
  }

  if (layers.procedural?.length) {
    sections.push(
      '## Procedural playbooks\n' +
        layers.procedural.map((p) => `- ${p.intent}: ${(p.tools || []).join(', ')}`).join('\n')
    );
  }

  if (layers.graph?.nodes?.length) {
    sections.push(
      '## Knowledge graph\n' +
        layers.graph.nodes.map((n) => `- [${n.type}] ${n.label}`).join('\n')
    );
  }

  if (layers.obsidian?.hits?.length) {
    sections.push(
      '## Obsidian brain\n' +
        layers.obsidian.hits.map((h) => `- ${h.path}: ${h.excerpt}`).join('\n')
    );
  }

  return sections.join('\n\n');
}

async function perceiveVoice({ audioBase64, mimeType }) {
  const stt = await deepgram.transcribeBase64(audioBase64, mimeType);
  return { layer: 'perception', stt };
}

async function expressVoice(text) {
  const tts = await elevenlabs.speak(text);
  return { layer: 'expression', tts };
}

function status() {
  return {
    layers: ['perception', 'working', 'episodic', 'semantic', 'procedural', 'graph', 'obsidian'],
    graphify: graphify.status(),
    obsidian: obsidian.status(),
    voice: {
      stt: deepgram.status(),
      tts: elevenlabs.status(),
    },
  };
}

module.exports = {
  assembleContext,
  formatContextBlock,
  perceiveVoice,
  expressVoice,
  status,
};
