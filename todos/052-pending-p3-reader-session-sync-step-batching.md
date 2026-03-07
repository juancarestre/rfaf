---
status: pending
priority: p3
issue_id: "052"
tags: [code-review, performance, engine, quality]
dependencies: []
---

# Batch reader-session sync word-count updates

## Problem Statement

The shared reader/session sync helper increments `wordsRead` one step at a time in a loop, cloning state per word advanced. That is simple and correct, but it adds unnecessary allocation during jump-style actions.

## Findings

- `src/engine/reader-session-sync.ts:24` loops through `steps` and calls `markWordAdvanced()` repeatedly.
- Performance review flagged this as an avoidable allocation pattern on paragraph/line/jump actions.
- This is not currently a correctness bug; it is a small engine-level optimization opportunity.

## Proposed Solutions

### Option 1: Batch the `wordsRead` increment

**Approach:** Apply one arithmetic update for `steps` after play/pause bookkeeping instead of per-step cloning.

**Pros:**
- Less allocation and simpler hot-path work

**Cons:**
- Needs care to preserve semantics if session logic grows more complex later

**Effort:** 1 hour

**Risk:** Low

---

### Option 2: Keep the current loop for semantic clarity

**Approach:** Accept the existing implementation until profiling shows real cost.

**Pros:**
- Keeps current code straightforward

**Cons:**
- Leaves minor avoidable overhead in the shared helper

**Effort:** 0 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/engine/reader-session-sync.ts`
- `tests/engine/reader-session-sync.test.ts`

**Database changes:**
- Migration needed? No

## Resources

- **Branch:** `feat/runtime-mode-switching`

## Acceptance Criteria

- [ ] Reader/session sync avoids per-step cloning or has a documented reason not to
- [ ] Existing session-sync tests continue to pass

## Work Log

### 2026-03-07 - Initial Discovery

**By:** OpenCode review workflow

**Actions:**
- Reviewed shared session-sync helper introduced by the branch
- Noted per-step loop for word-count updates

**Learnings:**
- This is a micro-optimization candidate, not a behavioral defect
