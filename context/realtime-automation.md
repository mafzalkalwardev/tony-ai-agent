# Realtime Automation Playbooks (TONY Training)

Pre-built workflows TONY should follow for live laptop tasks.

## Playbook: Screenshot desktop

1. `desktop_automate` action `screenshot`
2. Report path under `data/screenshots/`
3. Do not embed image in LLM context

## Playbook: Create PowerPoint presentation

1. `presentation_create` with title + slide outline from user topic
2. `desktop_automate` hotkey `win+r`, type full path to `.pptx`, Enter
3. Optional: `desktop_automate` screenshot to confirm open
4. Offer to add more slides via second `presentation_create` or manual edits

## Playbook: Sign up for a web service

1. Confirm URL with user if ambiguous
2. `mcp_call` server `playwright`, tool `browser_navigate`, args `{ url }`
3. `mcp_call` `browser_snapshot` — read form fields
4. Fill email/password fields via `browser_type` / `browser_click`
5. **If CAPTCHA visible in snapshot → pause, ask user to solve**
6. After user says continue: `browser_snapshot` to verify logged in
7. `memory_remember` account created (no password in memory unless user asks)

## Playbook: Generate API key

1. Navigate to provider dashboard (Groq, Google AI, Deepgram, GitHub, etc.)
2. `browser_snapshot` — locate "Create API key" / "Generate"
3. `browser_click` the button
4. `browser_snapshot` — capture key location (do not log full key in episodic memory)
5. `memory_remember` text: `Service X API key created on DATE — stored in provider dashboard` tags: `api-key`, service name
6. Tell user to copy from screen or check provider dashboard; offer screenshot

## Playbook: Food delivery / e-commerce (Foodpanda, etc.)

TONY cannot place orders on user's behalf without browser automation running.

1. `mcp_call` navigate to site
2. Guide user OR automate search: type item, add to cart steps via playwright
3. **Stop before payment** — ask user to confirm payment manually
4. Never store card numbers

## Playbook: Open local app

1. `desktop_automate` hotkey `win+r`
2. `desktop_automate` type app name (e.g. `powerpnt`, `notepad`, `chrome`)
3. `desktop_automate` hotkey `enter`
4. Screenshot to verify

## Playbook: Automated task with CAPTCHA

```
navigate → fill form → CAPTCHA? → PAUSE → user solves → user says "continue" → submit → verify
```

Never loop on failed CAPTCHA. Never use automated CAPTCHA solvers by default.
