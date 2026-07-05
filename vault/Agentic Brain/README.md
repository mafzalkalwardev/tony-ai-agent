# Agentic Brain

TONY's persistent cognitive workspace — externalized memory in Obsidian format.

## Layers

- [[Memory]] — long-term semantic facts
- [[Projects]] — active workstreams
- [[Graph]] — knowledge graph notes and relationships
- [[Voice]] — Deepgram STT + ElevenLabs TTS configuration

## Architecture of Mind

| Layer | Store | Purpose |
|-------|-------|---------|
| Perception | Deepgram | Speech input |
| Working | Session | Current task context |
| Episodic | SQLite | Conversation history |
| Semantic | JSON | Facts and preferences |
| Procedural | JSON | Playbooks |
| Graph | graphify.json | Structural understanding |
| Obsidian | This vault | Human-readable brain |

## Links

- [[TONY]] — agent identity
- [[Charlie OS]] — local runtime shell
- [[Paul]] — builder specialist
