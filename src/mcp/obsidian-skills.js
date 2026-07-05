/**
 * Obsidian Skills — kepano/obsidian-skills integration (markdown, canvas, bases, CLI).
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

const SKILL_NAMES = ['obsidian-markdown', 'obsidian-bases', 'json-canvas', 'obsidian-cli', 'defuddle'];

function skillsRoot() {
  const candidates = [
    path.join(config.integrationsDir, 'repos', 'obsidian-skills', 'skills'),
    path.join(config.workspaceRoot, 'skills', 'obsidian-skills'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function status() {
  const root = skillsRoot();
  const loaded = root
    ? SKILL_NAMES.filter((n) => fs.existsSync(path.join(root, n, 'SKILL.md')))
    : [];
  return {
    name: 'obsidian-skills',
    configured: loaded.length > 0,
    skillsRoot: root,
    loaded,
    vault: config.obsidian.vaultPath,
    repo: 'https://github.com/kepano/obsidian-skills',
  };
}

function readSkill(name) {
  const root = skillsRoot();
  if (!root) return { ok: false, error: 'obsidian-skills not cloned — npm run integrations:init' };
  const file = path.join(root, name, 'SKILL.md');
  if (!fs.existsSync(file)) return { ok: false, error: `Skill not found: ${name}` };
  return { ok: true, name, content: fs.readFileSync(file, 'utf8').slice(0, 12000) };
}

function listSkills() {
  const st = status();
  return { ok: true, skills: st.loaded, available: SKILL_NAMES };
}

async function createCanvas(title, nodes = [], edges = []) {
  const vault = config.obsidian.vaultPath;
  const canvasDir = path.join(vault, 'Canvas');
  fs.mkdirSync(canvasDir, { recursive: true });
  const safe = title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60);
  const file = path.join(canvasDir, `${safe || 'tony-canvas'}.canvas`);
  const canvas = {
    nodes: nodes.length
      ? nodes
      : [
          { id: '1', type: 'text', text: title, x: 0, y: 0, width: 320, height: 120 },
          { id: '2', type: 'text', text: 'TONY JARVIS HUD', x: 400, y: 0, width: 280, height: 80 },
        ],
    edges: edges.length ? edges : [{ id: 'e1', fromNode: '1', toNode: '2' }],
  };
  fs.writeFileSync(file, JSON.stringify(canvas, null, 2), 'utf8');
  return { ok: true, path: file, canvas };
}

module.exports = { status, readSkill, listSkills, createCanvas, SKILL_NAMES };
