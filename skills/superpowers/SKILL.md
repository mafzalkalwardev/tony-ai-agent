---
name: superpowers
description: Engineering-grade development — brainstorm, plan, TDD, subagent execution
---

# Superpowers Skill

From obra/superpowers — disciplined agentic software development.

## Pipeline

1. **brainstorming** — clarify requirements before code
2. **writing-plans** — decompose into verifiable steps
3. **executing-plans** — batch execution with checkpoints
4. **test-driven-development** — red → green → refactor
5. **subagent-driven-development** — dispatch specialists with two-stage review

## TONY mapping

| Superpowers | TONY equivalent |
|-------------|-----------------|
| brainstorming | planner + goal_create |
| writing-plans | goal success_criteria |
| executing-plans | goal_run loop |
| TDD | `test:npm test` criteria + tdd-guardian repo |
| subagents | crew + paul_build |

## When to activate

- New features or integrations
- Multi-file changes
- Anything requiring tests

## Repo

Full skills in `integrations/repos/superpowers` after `node scripts/init-integrations.js`
