# TONY — Operator Roadmap

Last updated: 2026-11-09 (v2.9)

Incremental improvements only. Do not rebuild from scratch.

## Complete

- [x] ReAct agent + JARVIS UI + companion wake mode
- [x] Safety levels SAFE / NEEDS_APPROVAL / BLOCKED
- [x] Intent router with categories + Roman Urdu examples
- [x] Project scanner / test+build runners / delivery helper / clipboard
- [x] Pending approval queue + dashboard YES/NO
- [x] Operator strip (status, transcript, intent, task)
- [x] Local-first TTS + silence thresholds
- [x] Parameter extraction (search query, file path, app name, topics)
- [x] GitHub helpers: summarize repo, explain changes, commit draft, PR checklist
- [x] Web search + open_app tools
- [x] Preferences store (no secrets) + recent commands
- [x] Delivery export to `data/reports/`
- [x] Optional faster-whisper local STT bridge script
- [x] Large-file overwrite approval gate
- [x] Approve-and-run for tests/build/search/shell

## Next

### Voice
- [ ] Calibrate browser always-listen with silenceStopSeconds from settings
- [ ] Explicit voice-clone consent UI flow

### Operator
- [ ] Multi-repo workspace picker
- [ ] Auto-attach latest test report into delivery export
- [ ] Richer GitHub PR create via `gh` after approval

### Hardening
- [ ] Encrypted preference vault option
- [ ] Per-tool rate limits for shell

## New demos

```text
Tony repo summarize karo
Tony explain changed files
Tony commit message banao
Tony prepare pr
Tony VS Code kholo
Tony browser mein search karo groq models
Tony project note: client wants dark mode
Tony export delivery
```
