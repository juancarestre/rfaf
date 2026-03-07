---
status: complete
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

Cache computed scroll line maps on the agent runtime keyed by `reader.words` identity and `contentWidth`, and invalidate the cache when mode/source words change.

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

- [x] Repeated agent line-step commands do not recompute the full line map unnecessarily
- [x] Cache invalidates correctly when reader words change
- [x] Existing scroll parity tests still pass

## Work Log

### 2026-03-07 - Initial Discovery

**By:** OpenCode review workflow

**Actions:**
- Inspected agent line-step path and noted full line-map recomputation per command

**Learnings:**
- This is isolated to the agent scroll stepping path; TUI has a separate render-time cost profile

### 2026-03-07 - Resolution

**By:** OpenCode

**Actions:**
- Added `lineMapCache` to `AgentReaderRuntime` in `src/agent/reader-api.ts`
- Reused cached line maps across repeated agent line-step commands when `reader.words` and `contentWidth` are unchanged
- Invalidated cache on mode/source-word changes and added regression coverage in `tests/agent/reader-api-scroll-parity.test.ts`

**Learnings:**
- Runtime-owned line-map caching was simpler than introducing a separate memoization layer for the agent path
