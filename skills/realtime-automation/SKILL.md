# Realtime Laptop Automation

When the user asks TONY to **do something on their laptop right now** — open apps, fill forms, create accounts, generate API keys, build presentations, order food, automate browser tasks:

## Tool priority

| Task type | Primary tools | Fallback |
|-----------|---------------|----------|
| Browser / web signup / API keys | `mcp_call` (playwright) → navigate, snapshot, click, type | `playwright_snapshot` + `web_fetch` |
| Native Windows apps (PowerPoint, Notepad, settings) | `desktop_automate` (click, type, hotkey, screenshot) | `tony_desktop_command` |
| Presentations | `presentation_create` then `desktop_automate` to open file | `write_file` + manual steps |
| Multi-step workflows | `workflow_run` mode auto | `task_record` for replay |
| Code / files | `write_file`, `shell`, `codegraph_context` | — |

**Always start Playwright MCP for browser work:** `npm run playwright:mcp` (or `npm run mcp:stack`).

## Realtime execution loop

1. **Confirm goal** — one sentence: what success looks like
2. **Snapshot state** — `desktop_automate` screenshot or `playwright_snapshot` before acting
3. **Act in small steps** — one tool per action; verify after each step
4. **Save secrets safely** — API keys → `memory_remember` with tag `api-key`; never paste keys in chat twice
5. **Record workflow** — after 2+ steps, auto-saves for `repeat <name>`

## Presentation creation

```
presentation_create → { title, slides: [{ title, bullets: [] }] }
desktop_automate hotkey → Win+R, type path, Enter to open
```

Use professional titles, 4–6 bullets per slide, max 15 slides unless user asks more.

## Account creation & API keys

1. `playwright_snapshot` or `mcp_call` navigate to signup/dashboard URL
2. Fill fields via `mcp_call` playwright `browser_type` / `browser_click`
3. **Stop at CAPTCHA** — see CAPTCHA policy below
4. After signup: navigate to API keys page, snapshot, copy key
5. `memory_remember` with tags `api-key`, service name
6. Tell user where key is stored (semantic memory, not repeated in full)

## CAPTCHA policy (required)

**Never bypass CAPTCHAs.** When a CAPTCHA, 2FA, or "verify you're human" appears:

1. `desktop_automate` screenshot — show user current state
2. **Pause automation** and say: *"CAPTCHA detected — please solve it in the browser, then say 'continue' or 'captcha done'."*
3. Wait for user confirmation before next `mcp_call` or `desktop_automate` step
4. Do not use third-party captcha-solving services unless user explicitly configures and approves one

## Common Windows shortcuts (desktop_automate hotkey)

| Action | Keys |
|--------|------|
| Run dialog | `win`, `r` |
| Switch app | `alt`, `tab` |
| Copy / Paste | `ctrl`, `c` / `ctrl`, `v` |
| Save | `ctrl`, `s` |
| New tab | `ctrl`, `t` |
| Address bar | `ctrl`, `l` |

## Error recovery

- Tool fails → `self_heal` → `error_learn`
- Playwright offline → remind user: `npm run playwright:mcp`
- pyautogui missing → `pip install -r requirements.txt`
- Context too large → screenshots save to `data/screenshots/` (path only in LLM)

## Urdu / Roman Urdu

User may say: *"screen ka screenshot lo"*, *"account banao"*, *"presentation bana do"* — same tool chain, reply in user's language.
