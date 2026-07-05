---
name: loop-engineering
description: Loop until goal done — patterns from cobusgreyling/loop-engineering
---

# Loop Engineering Skill

From [cobusgreyling/loop-engineering](https://github.com/cobusgreyling/loop-engineering) — design agents that loop with clear exit criteria.

## Loop pattern

```
while goal not complete:
  observe → plan → act → verify
  if verified: break
  if max_rounds: escalate
```

## TONY mapping

| Loop engineering | TONY |
|------------------|------|
| loop-init | `goal_create` |
| loop-audit | `verifyCriteria` in goal runner |
| loop-cost | track `iterations` + tool count |
| exit criteria | `success_criteria` array |

## CLI tools (from upstream repo)

After `npm run integrations:init`, see `integrations/repos/loop-engineering` for loop-audit, loop-init, loop-cost patterns.

## Rules

- Always define success criteria before looping
- Never infinite loop — respect `TONY_GOAL_MAX_ROUNDS`
- Log each round to goal progress
