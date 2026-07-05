---
name: offline-tasks
description: Record and replay tasks offline — local agent when no internet
---

# Offline Task Recorder

TONY records multi-step workflows and replays them without cloud LLM.

## Record a task

After completing work online (2+ tool steps), TONY auto-records. Or say:

- "Remember this task as **daily standup**"
- "Record this task as **run tests**"

## Replay offline

- `repeat run tests`
- `run task daily standup`
- `do run tests again`
- Urdu: `run tests phir se` / `dobara chalao`

## Offline commands (no internet)

| Command | Action |
|---------|--------|
| `list tasks` | Show recorded workflows |
| `status` | Local agent status |
| `remember <fact>` | Save to semantic memory |
| `search memory <q>` | Search local memory |
| `graph <term>` | Query graphify |

## LLM fallback chain

Online: Groq → **Gemini** → OpenAI → Ollama  
Offline: Ollama (local) → task replay → local commands

## Setup

```env
GOOGLE_AI_API_KEY=     # Google AI Studio
OLLAMA_ENABLED=true    # ollama.com for fully offline brain
TONY_AUTO_RECORD_TASKS=true
```
