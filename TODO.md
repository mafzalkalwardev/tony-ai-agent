# TONY — Operator Roadmap

Last updated: 2026-11-09

Incremental improvements only. Do not rebuild from scratch.

## Complete

- [x] ReAct agent + JARVIS UI + companion wake mode
- [x] Safety levels SAFE / NEEDS_APPROVAL / BLOCKED
- [x] Intent router with categories (`chat`, `github_task`, `project_scan`, …)
- [x] Roman Urdu command examples (`repo check karo`, `test run karo`, …)
- [x] Project scanner (file tree, package/requirements, tests folder)
- [x] Test + build runners with approval gates + command logs
- [x] Client delivery helper (draft only, never auto-send)
- [x] Pending approval queue + dashboard YES/NO buttons
- [x] Operator strip (status, transcript, intent, task)
- [x] Local-first TTS preference (edge-tts/pyttsx3 before ElevenLabs)
- [x] Configurable silence / VAD thresholds in `.env`

## Next

### Voice
- [ ] Optional faster-whisper local STT bridge when Deepgram is offline
- [ ] Push silence thresholds into browser always-listen path
- [ ] Explicit voice-clone consent UI (currently blocked by policy)

### Operator
- [ ] Parameter extraction for search queries / file paths
- [ ] GitHub changed-files explanation + PR body draft from local diff
- [ ] Delivery package export button in JARVIS systems panel

### Hardening
- [ ] Large-file overwrite size threshold
- [ ] Per-workspace “always allow npm test” preference (default off)
- [ ] Secrets audit: ensure no API keys land in SQLite/JSON memory

## Roman Urdu demos

```text
Tony repo check karo
Tony test run karo
Tony client ke liye message banao
Tony browser mein search karo
Tony ye copy karo
Tony mujhe status batao
Tony project scan karo
Tony build project karo
```
