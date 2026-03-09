---
status: complete
priority: p2
issue_id: "092"
tags: [code-review, reliability, runtime, no-bs]
dependencies: []
---

# Guarantee SIGINT Listener Cleanup in No-BS Flow

## Problem Statement

If spinner startup throws before entering protected execution block, SIGINT listener may remain attached.

## Findings

- `src/cli/no-bs-flow.ts` registers `process.once("SIGINT", ...)` before `loading.start()`.
- `loading.start()` currently runs before `try/finally`, so synchronous throw can bypass cleanup.

## Proposed Solutions

### Option 1: Move `loading.start()` inside try/finally (Recommended)

**Approach:** Place listener registration and spinner start within a guarded block that always executes cleanup.

**Pros:**
- Eliminates listener leak edge case.
- Minimal change.

**Cons:**
- Minor control-flow reshuffle.

**Effort:** Small

**Risk:** Low

### Option 2: Outer guard wrapper for listener lifecycle

**Approach:** Add dedicated helper for signal registration/cleanup around the full flow.

**Pros:**
- Reusable for summarize/no-bs.

**Cons:**
- Slightly more refactor scope.

**Effort:** Medium

**Risk:** Low

## Recommended Action

Implemented guarded listener/spinner lifecycle so SIGINT handler is always cleaned up even when spinner startup throws.

## Technical Details

**Affected files:**
- `src/cli/no-bs-flow.ts`
- `tests/cli/no-bs-flow.test.ts`

## Resources

- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`

## Acceptance Criteria

- [x] SIGINT listener is always removed, even if spinner start throws.
- [x] Added test for startup-throw cleanup path.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Recorded lifecycle leak risk from TypeScript review.

**Learnings:**
- Signal-listener ownership must be fully enclosed by cleanup guarantees.

### 2026-03-09 - Resolution

**By:** OpenCode

**Actions:**
- Moved no-bs loading startup under guarded try path with start-state checks.
- Added regression test that forces loading.start throw and verifies listener count is restored.
- Re-ran targeted/full tests.

**Learnings:**
- Lifecycle cleanup tests should include startup failures, not only runtime failures.
