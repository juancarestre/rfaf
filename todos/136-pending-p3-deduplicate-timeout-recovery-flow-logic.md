---
status: pending
priority: p3
issue_id: "136"
tags: [code-review, simplicity, maintainability, cli]
dependencies: []
---

# Deduplicate Timeout Recovery Logic Across Flows

## Problem Statement

Timeout recovery branching is duplicated in four CLI flows, increasing maintenance burden and drift risk.

## Findings

- Similar `if timeout -> resolve outcome -> warn -> fallback` logic exists in:
  - `src/cli/summarize-flow.ts`
  - `src/cli/no-bs-flow.ts`
  - `src/cli/translate-flow.ts`
  - `src/cli/key-phrases-flow.ts`
- Code-simplicity review flagged this as medium maintainability overhead.

## Proposed Solutions

### Option 1: Shared Recovery Helper (Preferred)

**Approach:** Add one small helper that handles timeout-stage branching and returns either fallback payload or throws.

**Pros:**
- Lower drift risk.
- Easier to test once.

**Cons:**
- Needs careful generic typing per flow output shape.

**Effort:** 3-5 hours

**Risk:** Low

---

### Option 2: Keep Duplication, Add Contract Snapshot Tests

**Approach:** Accept duplicated code but enforce consistency via stronger flow contract tests.

**Pros:**
- Smaller code motion.

**Cons:**
- Does not reduce maintenance surface.

**Effort:** 2-3 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/cli/summarize-flow.ts`
- `src/cli/no-bs-flow.ts`
- `src/cli/translate-flow.ts`
- `src/cli/key-phrases-flow.ts`
- `src/cli/timeout-recovery.ts`

## Resources

- **PR:** https://github.com/juancarestre/rfaf/pull/3

## Acceptance Criteria

- [ ] Timeout recovery branching exists in one shared helper path
- [ ] Flow behavior remains unchanged and contract-tested
- [ ] No regressions in CLI timeout tests

## Work Log

### 2026-03-11 - Initial Discovery

**By:** OpenCode

**Actions:**
- Captured simplicity reviewer deduplication suggestion.

**Learnings:**
- This is maintenance-focused; good candidate after P1/P2 concerns are addressed.
