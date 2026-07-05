# tony-ai Desktop Integration

Original repo: https://github.com/mafzalkalwardev/tony-ai

## Setup

```powershell
npm run integrations:init   # clones tony-ai to integrations/repos/tony-ai
cd integrations/repos/tony-ai
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Optional: `TONY_DESKTOP_PATH=./integrations/repos/tony-ai`

## When to use

| Layer | Use for |
|-------|---------|
| **Node TONY (this repo)** | Groq brain, MCP, goals, web UI, ElevenLabs/Deepgram cloud voice |
| **Python tony-ai** | Free local STT/TTS, PyQt6 desktop, wake mode, Windows git/project tools |

Tools: `tony_desktop_status`, `tony_desktop_command`

Run desktop UI: `python run_tony.py` inside tony-ai clone.
