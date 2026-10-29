<div align="center">

# TONY AI Agent

<img src="https://readme-typing-svg.demolab.com?font=Inter&weight=700&size=28&duration=2800&pause=700&color=7C3AED&center=true&vCenter=true&width=900&lines=Groq+Brain+%2B+Realtime+Voice;Deepgram+%2F+ElevenLabs+Speech;Graphify+%2B+Obsidian+Agentic+Memory;Modern+agent+orchestration" alt="Typing SVG" />

<p>
  <img src="https://komarev.com/ghpvc/?username=mafzalkalwardev&label=Project%20Views&color=7c3aed&style=for-the-badge" alt="Project views" />
  <img src="https://img.shields.io/github/stars/mafzalkalwardev/tony-ai-agent?style=for-the-badge&color=22c55e" alt="GitHub stars" />
  <img src="https://img.shields.io/github/forks/mafzalkalwardev/tony-ai-agent?style=for-the-badge&color=f59e0b" alt="GitHub forks" />
  <img src="https://img.shields.io/github/license/mafzalkalwardev/tony-ai-agent?style=for-the-badge&color=64748b" alt="License" />
</p>

<p>
  <img src="https://skillicons.dev/icons?i=js,nodejs,react" alt="Skill icons" />
</p>

<p>
  <strong>TONY agent stack with Groq brain, Deepgram/ElevenLabs voice, graphify knowledge, and Obsidian-style agentic memory.</strong>
</p>

</div>

---

## Contribution Snake

<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mafzalkalwardev/google-voice-dispatch-agent/output/github-contribution-grid-snake-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/mafzalkalwardev/google-voice-dispatch-agent/output/github-contribution-grid-snake.svg">
    <img alt="Contribution snake" src="https://raw.githubusercontent.com/mafzalkalwardev/google-voice-dispatch-agent/output/github-contribution-grid-snake.svg">
  </picture>
</div>

---

## SEO Keywords

`Groq agent` `Deepgram` `ElevenLabs` `Obsidian agent`

---

## Quick start

```powershell
Set-Location "D:\TONY AI AGENT"
Copy-Item .env.example .env
# Add GROQ_API_KEY (or use Ollama/Jan offline), DEEPGRAM_API_KEY, ELEVENLABS_API_KEY
npm install
npm test
npm run charlie      # Boot graph + gateway locally
npm run chat         # Interactive CLI
```

### Optional Python (desktop automation)

```powershell
pip install -r requirements.txt
```

Enables `desktop_automate` (mouse, keyboard, screenshots) and `presentation_create` (PowerPoint). Set `TONY_AUTOMATION_ENABLED=true` in `.env`.

For browser automation (signup, API keys, forms): `npm run playwright:mcp` then ask TONY to automate — CAPTCHAs pause for you to solve manually.

## What TONY can do

### Core agent

- **ReAct loop** — Understand → Plan → Execute → Integrate → Reflect (`TONY_AUTO_REFLECT`)
- **52+ tools** — Filesystem, shell, memory, graph, MCP, goals, tasks, CodeGraph, SignalMint, GitHub
- **Skills** — 20+ built-in skills (superpowers, ponytail, impeccable-design, companion-wake, error-recovery, …)
- **Crew routing** — Researcher, Engineer, Operator, Strategist for multi-agent tasks
- **Paul builder** — Local integration builder agent (`paul_build`, `POST /api/agents/paul/build`)

### LLM providers (auto-fallback chain)

| Provider | Env | Notes |
|----------|-----|-------|
| `groq` | `GROQ_API_KEY`, `GROQ_MODEL` | Default fast cloud brain |
| `gemini` | `GOOGLE_AI_API_KEY`, `GEMINI_MODEL` | Google AI Studio |
| `openai` | `OPENAI_API_KEY`, `OPENAI_MODEL` | Fallback on rate limits |
| `anthropic` | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Claude |
| `ollama` | `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Fully local offline |
| `jan` | `JAN_API_URL` (localhost:1337) | Jan.ai OpenAI-compatible API |
| `mock` | No key | Pattern-matching for tests |

Set `TONY_LLM_PROVIDER` in `.env`. Offline mode (`TONY_OFFLINE_AUTO`) falls back to Ollama/Jan/mock when network is down.

### Voice & JARVIS UI

- **STT** — Deepgram Nova (`DEEPGRAM_API_KEY`)
- **TTS** — ElevenLabs (`ELEVENLABS_API_KEY`)
- **Noise cancellation** — Filters fan/background noise (`TONY_VOICE_NOISE_CANCEL`)
- **Always-on listen** — No mic click required (`TONY_ALWAYS_LISTEN`)
- **JARVIS HUD** — Arc reactor UI at `http://localhost:8787/jarvis`

```powershell
npm run charlie          # starts gateway
npm run desktop          # opens JARVIS in Edge/Chrome app window
```

### Companion mode

Say **"Wake up Tony"** (or Urdu: *utho Tony*) for:

- Time-based greeting + genuine praise
- Work briefing (goals, tasks done vs remaining)
- Mood-aware tone: best friend, caring partner, protective brother
- Automatic habit learning (wake times, topics, moods)

Set `TONY_COMPANION_MODE=true`, `TONY_USER_NAME`, and optional `TONY_WAKE_PHRASES` in `.env`.

### Memory & learning

| Layer | Store | Purpose |
|-------|-------|---------|
| Perception | Deepgram | Speech → text |
| Working | Session | Current context |
| Episodic | SQLite | Conversation history |
| Semantic | JSON | Facts and preferences |
| Procedural | JSON | Playbooks |
| Graph | graphify | File/concept relationships |
| Obsidian | `vault/` | Human-readable external brain |

- **User profile** — Learns name, interests from conversation (`user_profile_*` tools)
- **Error memory** — Stores fixes from failures (`error_log`, `error_learn`)
- **Self-healing** — Auto-retry with corrected args (`TONY_SELF_HEAL`, `self_heal` tool)
- **Reflexion** — Analyzes failures and proposes fixes before retry

### Goals, tasks & workflows

- **Goal-driven** — Create goals with success criteria; TONY loops until `test:npm test`, `file exists:`, or LLM verification passes
- **Task recorder** — Replay workflows offline (`repeat <name>`)
- **Workflow runner** — Auto-picks goal vs crew vs standard mode

### Integrations & MCP

```powershell
npm run integrations:init    # Clone 21 GitHub repos locally
npm run integrations:status
npm run playwright:mcp       # Free local browser MCP on :8931
npm run mcp:stack            # Playwright + optional MCP servers
```

| MCP | Purpose | Env |
|-----|---------|-----|
| Perplexity | Web research | `PERPLEXITY_API_KEY` |
| Firecrawl | Scrape / search | `FIRECRAWL_API_KEY` |
| QuickBooks | Accounting queries | `QUICKBOOKS_*` |
| Higgsfield | Image generation | `HIGGSFIELD_API_KEY` |
| Playwright | Browser automation | `PLAYWRIGHT_MCP_URL` (free, local) |
| OpenWiki | Repo docs for agents | `OPENWIKI_MCP_URL` |
| Scraper Media | LLM-optimized scrape | `SCRAPER_MEDIA_MCP_URL` |
| Motiongraph | HUD / motion graphics | `MOTIONGRAPH_MCP_URL` |
| Obsidian Skills | Canvas, vault CLI | via `integrations:init` |

**Local-first** (`TONY_LOCAL_FIRST=true`): When paid keys are missing, TONY falls back to graphify, Obsidian, fetch, Playwright MCP, and local repos.

**SignalMint** — SMS campaigns, contacts, compliance (`SIGNALMINT_*` env vars).

**CodeGraph** — Structural code intelligence (`codegraph_*` tools, `npm run codegraph:index`).

### Desktop bridges

- **tony-ai** — Original PyQt6 voice assistant (`npm run integrations:init` → `integrations/repos/tony-ai`)
- **Desktop automation** — pyautogui click/type/hotkey/screenshot (`desktop_automate`)
- **Presentations** — PowerPoint `.pptx` generation (`presentation_create`, `pip install python-pptx`)
- **Realtime playbooks** — Browser signup, API keys, CAPTCHA pause-and-continue (`skills/realtime-automation`)
- **Bridge tools** — `tony_desktop_status`, `tony_desktop_command`, `workflow_run`

### 24/7 daemon

```powershell
npm run tony:daemon      # Gateway watchdog + goal ticks + hourly graph rebuild
```

Set `TONY_DAEMON_ENABLED=true` in `.env` to auto-start with Charlie.

## CLI commands

```bash
npm run chat                    # Interactive session
npm run run -- "Summarize ROADMAP.md"
npm run remember -- "User prefers dark mode"
npm run skills                  # List loaded skills
npm run charlie                 # Boot Charlie OS + gateway
npm run charlie:status          # Status dashboard
npm run graph                   # Rebuild knowledge graph
npm run charlie:build -- "Wire voice endpoints"
npm run test                    # Full agent test suite (mock LLM)
npm run test:live               # Live test (needs API keys + Playwright MCP)
```

## HTTP API

```bash
# Health (mind layers, companion, voice, MCP, goals)
curl http://localhost:8787/health

# Chat (Bearer TONY_API_TOKEN)
curl -X POST http://localhost:8787/api/chat \
  -H "Authorization: Bearer $TONY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"What is SignalMint?"}'

# Voice converse (STT → agent → TTS)
curl -X POST http://localhost:8787/api/voice/converse \
  -H "Authorization: Bearer $TONY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"audioBase64":"...","mimeType":"audio/wav"}'

# Paul builder
curl -X POST http://localhost:8787/api/agents/paul/build \
  -H "Authorization: Bearer $TONY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"task":"Run tests and report status"}'

# Goals
curl -X POST http://localhost:8787/api/goals/run \
  -H "Authorization: Bearer $TONY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"goalId":"..."}'

# Graph query
curl "http://localhost:8787/api/brain/graph/query?q=voice&token=$TONY_API_TOKEN"

# WebSocket: ws://localhost:8787/ws?token=YOUR_TOKEN
# Voice WS: {"type":"voice","audioBase64":"...","mimeType":"audio/wav"}
```

## Architecture

```
D:\TONY AI AGENT\
├── src/
│   ├── core/        agent loop, planner, crew, reflexion
│   ├── llm/         Groq, Gemini, OpenAI, Anthropic, Ollama, Jan, mock
│   ├── voice/       Deepgram STT, ElevenLabs TTS, noise filter
│   ├── companion/   wake phrases, habits, mood, persona, briefing
│   ├── brain/       graphify, obsidian, codegraph, architectures-of-mind
│   ├── agents/      Paul builder
│   ├── charlie-os/  local runtime shell
│   ├── memory/      episodic, semantic, procedural, profile, errors
│   ├── tools/       52+ registered agent tools
│   ├── gateway/     Express + WebSocket + voice endpoints
│   ├── bridge/      tony-desktop, pyautogui automation
│   ├── mcp/         Perplexity, Firecrawl, Playwright, OpenWiki, …
│   └── knowledge/   curated agent patterns index
├── public/          JARVIS HUD (jarvis.html, voice.js, tony-api.js)
├── vault/           Obsidian agentic brain (markdown)
├── skills/          built-in + user skills
├── scripts/         tests, automation bridge, MCP stack
├── requirements.txt Python deps for desktop automation
└── data/            memory DB + graphify graph (gitignored)
```

## Configuration

Copy `.env.example` → `.env`. Key groups:

| Group | Variables |
|-------|-----------|
| LLM | `TONY_LLM_PROVIDER`, `GROQ_API_KEY`, `GOOGLE_AI_API_KEY`, `OLLAMA_*`, `JAN_*` |
| Voice | `DEEPGRAM_API_KEY`, `ELEVENLABS_*`, `TONY_VOICE_*`, `TONY_ALWAYS_LISTEN` |
| Companion | `TONY_COMPANION_MODE`, `TONY_USER_NAME`, `TONY_WAKE_PHRASES` |
| Agent | `TONY_MAX_ITERATIONS`, `TONY_AUTO_REFLECT`, `TONY_SELF_HEAL`, `TONY_GOAL_*` |
| Security | `TONY_API_TOKEN`, `TONY_SHELL_UNSAFE` (dev only) |
| Offline | `TONY_OFFLINE_AUTO`, `TONY_OFFLINE_FORCE`, `TONY_LOCAL_FIRST` |

See `TONY.md` for persona, operating loop, and identity.

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

---

## Discoverability

**Author:** Muhammad Afzal Kalwar ([@mafzalkalwardev](https://github.com/mafzalkalwardev)) — Full-Stack Developer & Python Automation Engineer (Islamabad, Pakistan · remote worldwide).

**Hire / contact:** [Email](mailto:kalwarmuhammadafzal3@gmail.com) · [WhatsApp](https://wa.me/923079670503) · [Portfolio](https://mafzalkalwardev.github.io) · [LinkedIn](https://www.linkedin.com/in/muhammad-afzal-2670b527b/)

### Who is this for?
Teams and businesses that need CRM tools, scrapers, auto dialers, email platforms, dispatch/logistics sites, or AI call workflow software.

### FAQ
- **Who built this?** Muhammad Afzal Kalwar (`mafzalkalwardev`).
- **Can I hire the author?** Yes — remote freelance and contract. See contact links above.
- **Related work?** Browse [all repositories](https://github.com/mafzalkalwardev?tab=repositories) and the [live portfolio](https://mafzalkalwardev.github.io).

<details>
<summary><strong>SEO / GEO / AEO keywords</strong></summary>

Muhammad Afzal Kalwar, mafzalkalwardev, tony-ai-agent, full-stack developer, Python automation engineer, Islamabad Pakistan, freelance remote developer, CRM scraping dialer email AI tools, deepgram, ai, groq, elevenlabs, voice-assistant, algorithms, automation, ai-agent, cpp, javascript

</details>

