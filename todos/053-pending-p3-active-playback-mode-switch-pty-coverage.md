---
status: pending
priority: p3
issue_id: "053"
tags: [code-review, testing, quality, tty]
dependencies: []
---

# Add PTY coverage for mode switching during active playback

## Problem Statement

Current PTY coverage validates mode switching while paused, but does not exercise the more failure-prone case where playback is active and a timer is mid-flight during a mode switch or screen swap.

## Findings

- `tests/cli/runtime-mode-switching-pty-contract.test.ts` validates switching, help, and scroll rendering, but only in paused flows.
- Performance review flagged the missing active-playback coverage as a gap that could miss stale timer or double-advance regressions.
- Known pattern: terminal behavior should be proven in PTY tests, not just unit/integration tests (`docs/institutional-learnings-analysis.md`).

## Proposed Solutions

### Option 1: Add PTY test for play -> switch mode -> assert paused-once

**Approach:** Start playback, switch modes mid-run, and verify the old timer stops and the new mode pauses exactly once.

**Pros:**
- Covers the highest-risk live TTY path
- Guards against screen-swap timer regressions

**Cons:**
- PTY tests can be timing-sensitive

**Effort:** 2-3 hours

**Risk:** Medium

---

### Option 2: Add non-PTY integration test only

**Approach:** Simulate timer + switch behavior in a pure runtime/integration test.

**Pros:**
- Easier to keep deterministic

**Cons:**
- Does not prove real TTY input/render behavior

**Effort:** 1-2 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `tests/cli/runtime-mode-switching-pty-contract.test.ts`
- `tests/ui/mode-switching-integration.test.ts`
- `src/ui/App.tsx`

**Database changes:**
- Migration needed? No

## Resources

- **Branch:** `feat/runtime-mode-switching`
- **Known pattern:** `docs/institutional-learnings-analysis.md`
- **Validation doc:** `docs/validation/2026-03-06-runtime-mode-switching-acceptance-pty.md`

## Acceptance Criteria

- [ ] Automated coverage exercises mode switching during active playback
- [ ] Test proves no stale timer / double-advance regression on screen swap
- [ ] TTY tests remain stable in CI/local runs

## Work Log

### 2026-03-07 - Initial Discovery

**By:** OpenCode review workflow

**Actions:**
- Reviewed PTY coverage added on the branch
- Identified that mode switching is only validated in paused flows

**Learnings:**
- The branch has good PTY coverage overall; this is a targeted gap in a riskier live-playback scenario
