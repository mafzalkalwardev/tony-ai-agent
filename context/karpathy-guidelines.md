# Karpathy-Inspired Guidelines

Derived from Andrej Karpathy's observations on LLM coding pitfalls.

## 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs. Ask when unclear.

## 2. Simplicity First

Minimum code that solves the problem. Nothing speculative. No abstractions for one use case.

## 3. Surgical Changes

Touch only what you must. Match existing style. Don't refactor unrelated code.

## 4. Goal-Driven Execution

Define success criteria. Loop until verified.

| Instead of... | Transform to... |
|--------------|-----------------|
| "Add validation" | "Write tests for invalid inputs, then make them pass" |
| "Fix the bug" | "Write a test that reproduces it, then make it pass" |
| "Integrate X" | "Criteria: test:npm test, response contains:integrated" |

TONY implements this via `goal_create` + `goal_run` tools.
