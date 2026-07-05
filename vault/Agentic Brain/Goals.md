# Goals

Active goals TONY works on until success criteria pass.

## How it works

1. Create goal with `goal_create` or `POST /api/goals`
2. Run `goal_run` — loops until criteria verified
3. Criteria: `test:npm test`, `file exists:path`, `response contains:text`

## Example

```json
{
  "title": "Verify MCP integrations",
  "success_criteria": [
    "test:npm test",
    "file exists:src/mcp/index.js",
    "response contains:mcp"
  ]
}
```

#goals #karpathy

Links: [[Memory]] · [[Paul]] · [[Charlie OS]]
