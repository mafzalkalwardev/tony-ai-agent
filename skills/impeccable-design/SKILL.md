---
name: impeccable-design
description: UI/UX design vocabulary — audit, polish, critique. Avoid generic AI design slop.
---

# Impeccable Design Skill

Based on pbakaus/impeccable — design guidance for AI-generated frontend.

## Principles

- No generic Inter + purple gradient defaults
- Fix hierarchy, spacing, typography before adding features
- Audit a11y, responsive, performance

## Commands mindset

| Command | When |
|---------|------|
| audit | Technical quality (a11y, perf) |
| critique | UX hierarchy and clarity |
| polish | Final pass before ship |
| normalize | Align with design system |
| typeset | Fix typography |
| arrange | Fix layout and spacing |

## Workflow

1. Read existing UI components first
2. Match project design system (check package.json for shadcn/MUI/etc.)
3. Apply Impeccable audit checklist
4. Minimal surgical CSS/component changes

## Integration

Use with Ponytail — prefer existing components over new libraries.
