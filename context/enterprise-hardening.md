# Enterprise Hardening Baseline

Patterns from Claude Code enterprise security guides.

## Policy

- Never commit `.env` or API keys
- Use `TONY_API_TOKEN` on all gateway endpoints
- Restrict `shell` tool to read-only allowlist
- Confirm destructive actions explicitly

## MCP governance

Only approved MCP providers (configured via env):
- PERPLEXITY_API_KEY
- FIRECRAWL_API_KEY
- QUICKBOOKS_* (OAuth)
- HIGGSFIELD_API_KEY
- PLAYWRIGHT_MCP_URL

## Managed settings template

See `context/enterprise/managed-settings.template.json` for Claude Code deployment.

## Audit

- Tool traces stored in episodic SQLite memory
- Goal progress logged with timestamps
- CI runs `npm test` on every push

## TDD Guard integration

Use success criteria `test:npm test` on goals. See `integrations/repos/tdd-guardian` for pre-commit hooks.
