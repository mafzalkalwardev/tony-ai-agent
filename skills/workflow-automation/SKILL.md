# Workflow Automation

When the user asks TONY to **build**, **ship**, **deploy**, or run **multi-step work**:

1. Use `workflow_run` with `mode: auto` — picks agent, goal loop, or crew.
2. For voice requests, set `speak: true` so ElevenLabs reads the result.
3. Recorded tool chains auto-save for offline `task_replay`.

## Modes

| Mode | When |
|------|------|
| `agent` | Simple Q&A, single tool call |
| `goal` | Loop until success criteria (tests, file exists) |
| `crew` | Research + engineering + strategy combined |
| `task` | Replay a saved workflow |

## Code changes

- `codegraph_context` before editing unfamiliar files
- `write_file` + `shell` (with user approval for git push/commit)
