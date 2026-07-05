# TONY Integrations

Bundled Claude Code / agent ecosystem repos and MCP adapters.

## Initialize repos

```powershell
npm run integrations:init
npm run integrations:status
```

Clones 12 curated GitHub repos into `integrations/repos/` (gitignored — local only).

## Manifest

See `manifest.json` for full catalog:

| Repo | Purpose |
|------|---------|
| superpowers | TDD, brainstorming, subagent execution |
| awesome-claude-code | Curated skills/plugins index |
| claude-squad | Multi-agent terminal management |
| karpathy-guidelines | Think first, simplicity, goals |
| claude-subconscious | Background memory layer |
| playwright-mcp | Browser automation MCP |
| tdd-guardian | Test-first quality gates |
| wshobson-agents | 194 production subagents |
| repomix | Pack repo for LLM context |
| everything-claude-code (ECC) | Full hackathon-winner config |
| ponytail | YAGNI lazy senior dev |
| impeccable | Design vocabulary |

## MCP adapters (in `src/mcp/`)

Configured via `.env`:

- **Perplexity** — internet research
- **Firecrawl** — scrape + search
- **QuickBooks** — financial queries (OAuth)
- **Higgsfield** — image/video generation
- **Playwright** — browser snapshots

## Context files

- `context/CLAUDE.md` — project briefing
- `context/AGENTS.md` — agent instructions
- `context/karpathy-guidelines.md`
- `context/subconscious.md`
- `context/enterprise-hardening.md`
