# TONY Project Context (Claude Code / Cursor)

You are working on **TONY AI Agent** — a self-hosted autonomous agent with Groq brain, voice lane, graphify, Obsidian brain, MCP integrations, and goal-driven execution.

## Stack

- **Brain:** Groq (`TONY_LLM_PROVIDER=groq`)
- **Voice:** Deepgram STT + ElevenLabs TTS
- **Memory:** episodic (SQLite), semantic, procedural, graphify, Obsidian vault
- **MCP:** Perplexity, Firecrawl, QuickBooks, Higgsfield, Playwright
- **Goals:** loops until success criteria met (`goal_run` tool)
- **Builder:** Paul specialist + Charlie OS local runtime

## Commands

```bash
npm test
npm run charlie
npm run graph
node scripts/init-integrations.js
```

## Karpathy principles (always apply)

1. Think before coding — surface assumptions and tradeoffs
2. Simplicity first — minimum code that solves the problem
3. Surgical changes — touch only what's required
4. Goal-driven execution — define success criteria, loop until verified

## Design (Impeccable)

For UI work: audit hierarchy, spacing, typography. Avoid generic AI slop (Inter + purple gradient). Use `/polish` mindset.

## Build discipline (Ponytail + Superpowers)

- Climb the YAGNI ladder before writing new code
- TDD when criteria include `test:npm test`
- Use existing tools/skills before creating new abstractions

## Integrations

Bundled repos live in `integrations/repos/` — run `node scripts/init-integrations.js` to clone.
