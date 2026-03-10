---
status: pending
priority: p3
issue_id: "106"
tags: [code-review, simplicity, performance, config]
dependencies: []
---

# Remove Duplicate YAML Shape Validation In Loader Path

Simplify config resolution by validating shape once per load path.

## Problem Statement

The current loader validates YAML shape in both `loadLLMConfig` and `resolveLLMConfig`, creating duplicate validation work and two locations to keep behavior aligned.

## Findings

- `src/config/llm-config.ts:249` runs `validateShape(parsed)`.
- `src/config/llm-config.ts:252` then calls `resolveLLMConfig(shaped, env)`.
- `src/config/llm-config.ts:173` validates again inside resolver.

## Proposed Solutions

### Option 1: Introduce Internal `resolveValidated*` Path

**Approach:** Keep public `resolveLLMConfig` defensive, but add internal resolver assuming validated shape for loader path.

**Pros:**
- Preserves external safety
- Removes duplicate work on hot path

**Cons:**
- Adds one extra internal function

**Effort:** 1 hour

**Risk:** Low

---

### Option 2: Validate Only In Resolver

**Approach:** Remove loader-side `validateShape` and rely entirely on resolver.

**Pros:**
- Minimal code

**Cons:**
- Loader can no longer inspect shaped config before resolver call unless refactored

**Effort:** 30-45 minutes

**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/config/llm-config.ts`
- `tests/config/llm-config.test.ts`

**Related components:**
- Config parsing and validation path

**Database changes:**
- No

## Resources

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`

## Acceptance Criteria

- [ ] Loader path performs single shape validation per config load.
- [ ] Validation error contracts remain unchanged.
- [ ] Existing config tests continue passing.

## Work Log

### 2026-03-10 - Initial Discovery

**By:** Claude Code

**Actions:**
- Reviewed loader/resolver control flow
- Identified duplicate shape validation in normal load path

**Learnings:**
- Single-pass validation reduces drift risk between duplicated guard logic.
