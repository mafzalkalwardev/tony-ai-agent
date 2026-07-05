---
name: collab-public
description: Agent collaboration patterns from collabs-inc/collab-public
---

# Collab Public Skill

From [collabs-inc/collab-public](https://github.com/collabs-inc/collab-public) — Collaborator is a place to create with agents.

## Patterns

- **Shared workspace** — Obsidian vault + graphify as team brain
- **Multi-agent** — Crew + Paul builder dispatch
- **Public artifacts** — goals and research saved to vault notes
- **Session handoff** — episodic memory + sessionId in WebSocket

## TONY collab flow

1. User creates goal in UI or API
2. Paul/crew specialists work subtasks
3. Results written to `vault/Agentic Brain/`
4. Graph rebuilt — team sees structure

## API

- `POST /api/goals/run` — collaborative goal loop
- `POST /api/crew` — multi-specialist task
- WebSocket `/ws` — real-time chat collab
