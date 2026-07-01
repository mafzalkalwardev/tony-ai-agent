# Coding skill

Use when the user asks to read, edit, test, or refactor code in the workspace.

## Workflow

1. Search memory for prior decisions about this codebase
2. `read_file` target files before editing
3. Prefer minimal diffs; match existing conventions
4. Run `npm test` or project-specific tests when available
5. Remember non-obvious decisions with `memory_remember`

## SignalMint stack (when `TONY_WORKSPACE_ROOT` points at that repo)

- API: `server/` (Node, Express, Postgres)
- UI: `client-app/` (React)
- Worker: `automation-worker/` (Python Playwright)

Default workspace is this TONY project root (`D:\TONY AI AGENT`).

## Safety

- Never commit secrets
- Confirm before destructive git operations
