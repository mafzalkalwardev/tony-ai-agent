/**
 * Draft a new skill from successful procedural playbooks / recent tool traces.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const procedural = require('../memory/procedural');

function draftFromPlaybooks({ name, query = '', write = false } = {}) {
  const hits = procedural.findPlaybooks(query || name || '', 12).filter((p) => p.outcome === 'success');
  const id = slug(name || query || hits[0]?.name || `generated-${Date.now()}`);
  const title = name?.trim() || id.replace(/-/g, ' ');

  const steps = [];
  for (const pb of hits) {
    const arr = Array.isArray(pb.steps) ? pb.steps : [pb.steps];
    for (const step of arr) {
      const line = typeof step === 'string' ? step : JSON.stringify(step);
      if (line && !steps.includes(line)) steps.push(line);
    }
  }

  const body = `# ${title}

Auto-drafted by TONY from successful procedural traces.
Review before trusting in production.

## When to use
- Operator asks about: ${query || title}
- Similar past successes: ${hits.length}

## Playbook
${steps.length ? steps.map((s, i) => `${i + 1}. ${s}`).join('\n') : '1. Inspect context\n2. Prefer local tools\n3. Ask approval for risky actions'}

## Safety
- Never read/write secrets
- Never rm -rf
- Memorial voice needs consent
- Deceptive deepfakes blocked

## Sources
${hits.map((h) => `- ${h.name} @ ${h.at}`).join('\n') || '- (no matching playbooks yet)'}
`;

  const result = {
    ok: true,
    draftOnly: !write,
    id,
    title,
    content: body,
    playbooksUsed: hits.length,
  };

  if (write) {
    const dir = path.join(path.dirname(config.identityPath), 'skills', id);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'SKILL.md');
    fs.writeFileSync(file, body, 'utf8');
    result.savedPath = file;
    result.draftOnly = false;
  }

  return result;
}

function slug(text) {
  return String(text || 'skill')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || `skill-${Date.now()}`;
}

module.exports = { draftFromPlaybooks };
