# Claude Subconscious Patterns

Inspired by letta-ai/claude-subconscious — persistent background cognition.

## What runs in the background

- Semantic memory (`memory_remember`) for durable facts
- Obsidian vault notes in `vault/Agentic Brain/`
- Procedural playbooks from successful tool traces
- Active goals in `data/goals.json`

## Subconscious retrieval

Every agent turn automatically loads:
- Episodic history (last 20 turns)
- Semantic + procedural search for current query
- Graphify structural context
- Obsidian vault hits

## Writing back

After goal completion or successful multi-tool runs:
- `TONY_AUTO_REFLECT=true` records playbooks
- Important facts → `memory_remember` or Obsidian notes
- Goal progress → goal store

## Sleep / consolidate

Run `npm run graph` to rebuild knowledge graph from workspace + wikilinks.
