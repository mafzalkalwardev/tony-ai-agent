# TONY AI Agent

**TONY** (Tactical Omniscient Neural Yielder) is a self-hosted autonomous AI agent combining the strongest patterns from modern open-source agent systems — now with **Groq brain**, **Deepgram + ElevenLabs voice**, **graphify knowledge graph**, **Obsidian agentic brain**, **Paul builder**, and **Charlie OS** local runtime.

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

## v2.1 — MCP + Goals + Integrations

```powershell
npm run integrations:init    # Clone 12 GitHub repos locally
npm run integrations:status
```

**MCP tools:** `perplexity_search`, `firecrawl_scrape`, `quickbooks_query`, `higgsfield_generate`, `playwright_snapshot`, `deep_research`

**Goal-driven:** Create goals with success criteria — TONY loops until `test:npm test`, `file exists:`, or LLM verification passes.

**Skills:** impeccable-design, ponytail, superpowers, goal-driven, research-multi

**Context:** `context/CLAUDE.md`, `context/AGENTS.md`, karpathy guidelines, subconscious, enterprise hardening

**Bundled repos:** superpowers, awesome-claude-code, claude-squad, karpathy-guidelines, claude-subconscious, playwright-mcp, tdd-guardian, wshobson-agents, repomix, everything-claude-code, ponytail, impeccable


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
