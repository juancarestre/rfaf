---
status: complete
priority: p2
issue_id: "045"
tags: [code-review, agent, parity, quality]
dependencies: []
---

# Align agent same-mode switch semantics with TUI

## Problem Statement

The TUI treats selecting the current reading mode as a true no-op, but the agent API still rebuilds state and pauses playback when asked to switch to the already-active mode. This creates parity drift between agent and human-visible behavior.

## Findings

- `src/ui/runtime-mode-state.ts:55` returns `runtime` unchanged when `nextMode === runtime.activeMode`.
- `src/agent/reader-api.ts:310` always enters the `set_reading_mode` path and rebuilds reader state.
- Agent-native review flagged this as a real parity gap.
- Known pattern: CLI-visible capabilities should have matching agent semantics in the same release cycle (`docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`).

## Proposed Solutions

### Option 1: Add an early no-op return in agent `set_reading_mode`

**Approach:** Mirror the App logic and return `runtime` unchanged if `readingMode === runtime.readingMode`.

**Pros:**
- Restores TUI/agent parity
- Minimal change

**Cons:**
- Requires explicit regression coverage

**Effort:** < 1 hour

**Risk:** Low

---

### Option 2: Extract shared mode-switch guard logic

**Approach:** Move the no-op guard into a shared helper used by both App and agent runtime paths.

**Pros:**
- Prevents future drift

**Cons:**
- Slightly more refactoring surface

**Effort:** 1-2 hours

**Risk:** Low

## Recommended Action

Mirror the TUI no-op semantics in the agent runtime by returning the existing runtime unchanged when `set_reading_mode` requests the already-active mode.

## Technical Details

**Affected files:**
- `src/agent/reader-api.ts:310`
- `src/ui/runtime-mode-state.ts:49`
- `tests/agent/reader-api.test.ts`

**Database changes:**
- Migration needed? No

## Resources

- **Branch:** `feat/runtime-mode-switching`
- **Known pattern:** `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`

## Acceptance Criteria

- [x] Agent `set_reading_mode` is a no-op when the requested mode is already active
- [x] Regression test covers same-mode agent switch behavior
- [x] TUI and agent semantics match for this case

## Work Log

### 2026-03-07 - Initial Discovery

**By:** OpenCode review workflow

**Actions:**
- Compared App and agent mode-switch semantics
- Confirmed current branch still has a same-mode parity mismatch

**Learnings:**
- This is a semantics mismatch, not a transform or session-accounting bug

### 2026-03-07 - Resolution

**By:** OpenCode

**Actions:**
- Added an early return in `src/agent/reader-api.ts` when the requested mode already matches `runtime.readingMode`
- Added regression coverage in `tests/agent/reader-api.test.ts`

**Learnings:**
- This fix is self-contained and keeps agent semantics aligned with the App runtime helper
