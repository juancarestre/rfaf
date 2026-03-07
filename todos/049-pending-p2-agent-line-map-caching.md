---
status: pending
priority: p2
issue_id: "049"
tags: [code-review, performance, agent]
dependencies: []
---

# Cache agent scroll line maps across line-step commands

## Problem Statement

The agent API recomputes the full scroll line map on every line-step command, even when the word array has not changed. Repeated `step_next_line` and `step_prev_line` actions do unnecessary wrapping work.

## Findings

- `src/agent/reader-api.ts:160` calls `computeLineMap()` each time line stepping runs.
- The width is fixed for the current agent path, so repeated commands reuse the same inputs.
- Performance review flagged this as medium severity for repeated agent line-step usage.

## Proposed Solutions

### Option 1: Cache line map on the agent runtime

**Approach:** Store the computed line map in runtime state and invalidate it when `reader.words` changes.

**Pros:**
- Fast repeated line-step commands
- Straightforward invalidation rule

**Cons:**
- Adds another cache to runtime state

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Cache in a helper keyed by words identity and width

**Approach:** Keep runtime state minimal and memoize externally.

**Pros:**
- Cleaner runtime shape

**Cons:**
- Requires careful cache lifetime decisions

**Effort:** 2-4 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/agent/reader-api.ts:160`
- `src/processor/line-computation.ts`
- `tests/agent/reader-api-scroll-parity.test.ts`

**Database changes:**
- Migration needed? No

## Resources

- **Branch:** `feat/runtime-mode-switching`

## Acceptance Criteria

- [ ] Repeated agent line-step commands do not recompute the full line map unnecessarily
- [ ] Cache invalidates correctly when reader words change
- [ ] Existing scroll parity tests still pass

## Work Log

### 2026-03-07 - Initial Discovery

**By:** OpenCode review workflow

**Actions:**
- Inspected agent line-step path and noted full line-map recomputation per command

**Learnings:**
- This is isolated to the agent scroll stepping path; TUI has a separate render-time cost profile
