---
status: complete
priority: p2
issue_id: "117"
tags: [code-review, quality, testing, tty]
dependencies: []
---

# Expand Compiled PTY Lifecycle Coverage and Deflake Timing

## Problem Statement

Compiled PTY tests validate canonical/echo restoration but currently bypass alternate-screen restoration and rely on fixed sleeps, which can miss regressions and introduce CI flakiness.

## Findings

- `tests/cli/compiled-runtime-lifecycle-pty.test.ts:25` sets `RFAF_NO_ALT_SCREEN=1`.
- `tests/cli/compiled-signal-cleanup-pty.test.ts:23` sets `RFAF_NO_ALT_SCREEN=1`.
- Both tests rely on hardcoded timing (`sleep`), flagged as flaky under load.

## Proposed Solutions

### Option 1: Add Alt-Screen On Contract + Polling Synchronization (Recommended)

**Approach:** Add PTY contract tests with alt-screen enabled and replace fixed sleeps with output-driven polling plus timeout.

**Pros:**
- Better real-world coverage for terminal lifecycle invariants.
- Reduced CI timing flake.

**Cons:**
- Slightly more complex PTY harness logic.

**Effort:** Medium

**Risk:** Medium

---

### Option 2: Keep Current Tests and Increase Sleep Durations

**Approach:** Increase time buffers to reduce observed flakes.

**Pros:**
- Quick patch.

**Cons:**
- Slower suite and still brittle.

**Effort:** Small

**Risk:** Medium

## Recommended Action

Implemented Option 1 by adding alt-screen-enabled lifecycle coverage and polling-based PTY synchronization.

## Technical Details

**Affected files:**
- `tests/cli/compiled-runtime-lifecycle-pty.test.ts`
- `tests/cli/compiled-signal-cleanup-pty.test.ts`

## Resources

- Known Pattern: `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`

## Acceptance Criteria

- [x] At least one compiled PTY test runs with alternate-screen enabled and verifies restoration.
- [x] PTY synchronization uses polling/readiness checks instead of fixed sleeps.
- [x] CI runtime remains stable without increased flake rate.

## Work Log

### 2026-03-10 - Initial Discovery

**By:** OpenCode

**Actions:**
- Synthesized TypeScript + performance findings around PTY lifecycle contracts.

**Learnings:**
- Terminal lifecycle tests should validate real teardown paths, not only reduced-mode shortcuts.

### 2026-03-10 - Resolution

**By:** OpenCode

**Actions:**
- Added shared PTY helper `tests/cli/compiled-pty-helpers.ts` with output-driven polling and timeout-based synchronization.
- Updated lifecycle and signal PTY tests to use shared helper.
- Added alt-screen-enabled quit contract in `tests/cli/compiled-runtime-lifecycle-pty.test.ts`.

**Learnings:**
- Polling on expected terminal output is more reliable and faster than fixed sleep timing in PTY tests.
