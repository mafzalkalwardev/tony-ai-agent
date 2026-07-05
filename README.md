# TONY — Unified Personal AI (One Project)

**This is the one TONY.** Voice, workflows, goals, MCP, CodeGraph, web UI, and your original [tony-ai](https://github.com/mafzalkalwardev/tony-ai) desktop assistant — all in this repo.

**TONY** (Tactical Omniscient Neural Yielder) is a self-hosted autonomous AI for your laptop: **Groq brain**, **Deepgram + ElevenLabs voice**, **automated workflows**, **graphify**, **Obsidian brain**, **Paul builder**, and **Charlie OS** runtime.

| Source | Pattern adopted |
|--------|-----------------|
| [Microsoft JARVIS / HuggingGPT](https://github.com/microsoft/JARVIS) | 4-stage pipeline: plan → select → execute → synthesize |
| [OpenClaw](https://github.com/openclaw/openclaw) | Gateway, skills workspace, session model, local-first |
| [CrewAI](https://github.com/joaomdmoura/crewAI) | Role-based specialist routing (+ Paul builder) |
| [LangGraph](https://github.com/langchain-ai/langgraph) | Stateful multi-step graphs with checkpoints |
| [AutoGPT](https://github.com/Significant-Gravitas/AutoGPT) | Goal decomposition + tool loops |
| Architectures of Mind | 7-layer cognitive stack: perception → obsidian |

## Quick start (Charlie OS)

```powershell
Set-Location "D:\TONY AI AGENT"
Copy-Item .env.example .env
# Add GROQ_API_KEY, DEEPGRAM_API_KEY, ELEVENLABS_API_KEY
npm install
npm test
npm run charlie      # Boot graph + gateway locally
npm run chat         # Interactive CLI
```

## Stack

| Layer | Provider | Env |
|-------|----------|-----|
| Brain | Groq | `GROQ_API_KEY`, `TONY_LLM_PROVIDER=groq` |
| STT | Deepgram | `DEEPGRAM_API_KEY` |
| TTS | ElevenLabs | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` |
| Graph | graphify | `data/graphify.json` (auto-built) |
| Vault | Obsidian | `OBSIDIAN_VAULT_PATH=./vault` |
| Builder | Paul | `POST /api/agents/paul/build` |
| Runtime | Charlie OS | `npm run charlie` |
| MCP | Perplexity, Firecrawl, QuickBooks, Higgsfield, Playwright | See `.env.example` |
| Goals | Loop until success criteria met | `goal_run` tool, `POST /api/goals/run` |

### Playwright MCP (free, local — no API key)

Per [Playwright MCP docs](https://playwright.dev/docs/getting-started-mcp):

```powershell
npm run playwright:mcp    # Terminal 1 — starts @playwright/mcp on :8931
npm run test:live           # Terminal 2 — full live test
```

Set `PLAYWRIGHT_MCP_URL=http://localhost:8931/mcp` (default). Uses JSON-RPC over HTTP per [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp).

### Local-first mode (`TONY_LOCAL_FIRST=true`)

When Perplexity/QuickBooks/Higgsfield keys are missing, TONY falls back to:
- **graphify** + integration repos + Obsidian (free)
- **Firecrawl** or **fetch** for web content
- **Playwright MCP** for browser (free local)
- **Groq → OpenAI** LLM fallback on rate limits


```powershell
npm run integrations:init    # Clone 12 GitHub repos locally
npm run integrations:status
```

**MCP tools:** `perplexity_search`, `firecrawl_scrape`, `quickbooks_query`, `higgsfield_generate`, `playwright_snapshot`, `deep_research`

**Goal-driven:** Create goals with success criteria — TONY loops until `test:npm test`, `file exists:`, or LLM verification passes.

**Skills:** impeccable-design, ponytail, superpowers, goal-driven, research-multi

**Context:** `context/CLAUDE.md`, `context/AGENTS.md`, karpathy guidelines, subconscious, enterprise hardening

**Bundled repos:** superpowers, awesome-claude-code, claude-squad, karpathy-guidelines, claude-subconscious, playwright-mcp, tdd-guardian, wshobson-agents, repomix, everything-claude-code, ponytail, impeccable, **tony-ai** (original desktop assistant)

## JARVIS Desktop UI (Iron Man HUD)

The **default UI** is now the JARVIS desktop experience — arc reactor, neural graph lines, cyan HUD:

```powershell
npm run charlie          # starts gateway
npm run desktop          # opens JARVIS in Edge/Chrome app window (no browser tabs)
```

Open manually: `http://localhost:8787/jarvis`

### 24/7 continuous operation

```powershell
npm run mcp:stack        # Playwright + optional MCP servers
npm run tony:daemon      # Gateway watchdog + goal ticks + hourly graph rebuild
```

Set `TONY_DAEMON_ENABLED=true` in `.env` to auto-start daemon with Charlie.

### New MCP integrations

| MCP | Purpose | Env |
|-----|---------|-----|
| OpenWiki | Repo docs for coding agents | `OPENWIKI_MCP_URL` |
| Scraper Media | LLM-optimized web scrape | `SCRAPER_MEDIA_MCP_URL` |
| Motiongraph | HUD / motion graphics | `MOTIONGRAPH_MCP_URL` |
| obsidian-skills | Canvas, bases, vault CLI | `npm run integrations:init` |

Tools: `openwiki_search`, `scraper_media_scrape`, `motiongraph_aesthetic`, `obsidian_create_canvas`, `fullstack_scaffold`, `mcp_call`


Your first repo [tony-ai](https://github.com/mafzalkalwardev/tony-ai) is now bundled:

```powershell
npm run integrations:init          # clones tony-ai + 16 other repos
npm run codegraph:index            # index codebase for agent code intelligence
```

- **Web TONY** (this repo): Groq brain, Deepgram/ElevenLabs voice bar, workflows, MCP, goals
- **Desktop tony-ai**: `python run_tony.py` in `integrations/repos/tony-ai` — free local voice, PyQt6 UI
- **Bridge tools**: `tony_desktop_status`, `tony_desktop_command`, `workflow_run`, `codegraph_*`

See `context/tony-ai-integration.md` and `skills/tony-desktop/SKILL.md`.



```bash
npm run chat                    # Interactive session
npm run run -- "Summarize ROADMAP.md"
npm run remember -- "User prefers dark mode"
npm run skills                  # List loaded skills
npm run charlie                 # Boot Charlie OS + gateway
npm run charlie:status          # Status dashboard
npm run graph                   # Rebuild knowledge graph
npm run charlie:build -- "Wire voice endpoints"
```

## HTTP API

```bash
# Health (includes mind layers)
curl http://localhost:8787/health

# Chat (Bearer TONY_API_TOKEN)
curl -X POST http://localhost:8787/api/chat \
  -H "Authorization: Bearer $TONY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"What is SignalMint?"}'

# Voice converse (STT → Groq agent → TTS)
curl -X POST http://localhost:8787/api/voice/converse \
  -H "Authorization: Bearer $TONY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"audioBase64":"...","mimeType":"audio/wav"}'

# Paul builder
curl -X POST http://localhost:8787/api/agents/paul/build \
  -H "Authorization: Bearer $TONY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"task":"Run tests and report status"}'

# Graph query
curl "http://localhost:8787/api/brain/graph/query?q=voice&token=$TONY_API_TOKEN"

# WebSocket: ws://localhost:8787/ws?token=YOUR_TOKEN
# Voice WS: {"type":"voice","audioBase64":"...","mimeType":"audio/wav"}
```

## Architecture

```
D:\TONY AI AGENT\
├── src/
│   ├── core/        agent loop, planner, crew
│   ├── llm/         Groq, OpenAI, Anthropic, mock
│   ├── voice/       Deepgram STT, ElevenLabs TTS
│   ├── brain/       graphify, obsidian, architectures-of-mind
│   ├── agents/      Paul builder
│   ├── charlie-os/  local runtime shell
│   ├── memory/      episodic, semantic, procedural
│   ├── tools/       filesystem, graph, obsidian, paul, ...
│   ├── gateway/     Express + WebSocket + voice endpoints
│   └── knowledge/   curated agent patterns index
├── vault/           Obsidian agentic brain (markdown)
├── skills/          built-in + user skills
└── data/            memory DB + graphify graph (gitignored)
```

## Architectures of Mind

| Layer | Store | Purpose |
|-------|-------|---------|
| Perception | Deepgram | Speech → text |
| Working | Session | Current context |
| Episodic | SQLite | Conversation history |
| Semantic | JSON | Facts and preferences |
| Procedural | JSON | Playbooks |
| Graph | graphify | File/concept relationships |
| Obsidian | vault/ | Human-readable external brain |

## LLM providers

| Provider | Env |
|----------|-----|
| `groq` | `GROQ_API_KEY`, `GROQ_MODEL` (default brain) |
| `mock` | No key — pattern-matching for tests |
| `openai` | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| `anthropic` | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |

## Docker

```bash
docker compose up -d
```

## GitHub

```powershell
git remote add origin https://github.com/YOUR_USER/tony-ai-agent.git
git push -u origin master
```

CI runs `npm test` on push via `.github/workflows/ci.yml`.

## License

MIT
