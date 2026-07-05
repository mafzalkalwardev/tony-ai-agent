# TONY + tony-ai Unified Architecture

Two repos, one assistant:

- **[tony-ai-agent](https://github.com/mafzalkalwardev/tony-ai-agent)** (this repo) — Node gateway, Groq, MCP, goals, Charlie OS, web Command Center
- **[tony-ai](https://github.com/mafzalkalwardev/tony-ai)** — Python PyQt6, local faster-whisper + pyttsx3, safety approvals, Windows operator

Bridge: `src/bridge/tony-desktop.js` + `scripts/tony-ai-bridge.py`

Safety policy from tony-ai ported to `src/safety/policy.js` for Node shell tool.
