---
name: research-multi
description: Multi-structure research via graphify, repos, Obsidian, Perplexity, Firecrawl, Playwright
---

# Multi-Structure Research

Use `deep_research` and `knowledge_structures` tools together.

## Knowledge structures

| Structure | Source |
|-----------|--------|
| graph | graphify.json — files, imports, wikilinks |
| tree | hierarchical view of graph |
| vault | Obsidian agentic brain |
| repo | integrations/manifest.json |
| web | Perplexity + Firecrawl |
| local_repos | cloned integration READMEs |

## Research workflow

1. `graph_build` — refresh workspace graph
2. `deep_research` — query all structures + optional scrape/browser
3. `perplexity_search` — internet with citations
4. `firecrawl_scrape` — specific URL content
5. `playwright_snapshot` — dynamic pages
6. `integration_search` — find bundled GitHub repos

## Repomix pattern

For full repo context, see `integrations/repos/repomix` — pack codebase into single LLM file.

## Internet + repos

Always check local integrations before rebuilding what exists in superpowers, wshobson/agents, or ECC.
