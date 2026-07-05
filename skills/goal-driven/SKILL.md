---
name: goal-driven
description: Create goals with success criteria and loop until complete (Karpathy principle #4)
---

# Goal-Driven Execution

TONY keeps working until goals are verified complete.

## Create a goal

```json
{
  "title": "Integrate Perplexity MCP",
  "description": "Wire perplexity_search tool and verify",
  "success_criteria": [
    "test:npm test",
    "response contains:perplexity",
    "file exists:src/mcp/perplexity.js"
  ]
}
```

## Success criteria formats

| Format | Example |
|--------|---------|
| test: | `test:npm test` |
| file exists: | `file exists:src/mcp/index.js` |
| response contains: | `response contains:completed` |
| (plain text) | LLM-verified on completion |

## Tools

- `goal_create` — persist goal
- `goal_run` — loop agent until done
- `goal_list` — view active/completed

## API

```bash
POST /api/goals/run
POST /api/goals
GET /api/goals
```

## Max rounds

Set `TONY_GOAL_MAX_ROUNDS=10` in `.env`
