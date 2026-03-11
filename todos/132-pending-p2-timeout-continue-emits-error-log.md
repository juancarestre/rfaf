---
status: pending
priority: p2
issue_id: "132"
tags: [code-review, quality, observability, cli]
dependencies: []
---

# Timeout Continue Path Emits Error Status

## Problem Statement

When timeout recovery chooses continue, flows still emit `[error] ... failed` before returning successful fallback content. This creates contradictory operator and automation signals.

## Findings

- Error status logging occurs before timeout outcome decision in:
  - `src/cli/summarize-flow.ts`
  - `src/cli/no-bs-flow.ts`
  - `src/cli/translate-flow.ts`
  - `src/cli/key-phrases-flow.ts`
- Outcome may still be success path (`continue` + fallback content), so log level does not match final state.

## Proposed Solutions

### Option 1: Defer Error Emission Until Outcome Resolved (Preferred)

**Approach:** Decide timeout outcome first; emit `[warn]` for continue, `[error]` only for abort.

**Pros:**
- Clear, truthful logs.
- Better for machine parsing.

**Cons:**
- Minor refactor in each flow.

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Add Distinct Recovery Status Channel

**Approach:** Keep existing fail logs but add explicit `recovered` status line.

**Pros:**
- Minimal behavior change.

**Cons:**
- Still noisy/ambiguous in tooling that keys on `[error]`.

**Effort:** 1-2 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/cli/summarize-flow.ts`
- `src/cli/no-bs-flow.ts`
- `src/cli/translate-flow.ts`
- `src/cli/key-phrases-flow.ts`
- flow tests under `tests/cli/*flow.test.ts`

## Resources

- **PR:** https://github.com/juancarestre/rfaf/pull/3

## Acceptance Criteria

- [ ] Continue outcomes do not emit `[error]` status
- [ ] Abort outcomes still emit deterministic `[error]`
- [ ] Existing CLI contract tests updated
- [ ] Full suite passes

## Work Log

### 2026-03-11 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated TypeScript reviewer findings around logging semantics.

**Learnings:**
- Final outcome classification must drive log level, not intermediate catch-path defaults.
