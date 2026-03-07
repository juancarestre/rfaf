---
status: pending
priority: p2
issue_id: "048"
tags: [code-review, performance, architecture, quality]
dependencies: []
---

# Improve mode-switch position remap scaling

## Problem Statement

Position remapping currently scans the target rendered word array linearly for each mode switch. That keeps logic simple, but repeated runtime switching scales with document size.

## Findings

- `src/engine/position-mapping.ts:24` performs a `findIndex()` over `targetWords` for each remap.
- The path is used by both `src/ui/runtime-mode-state.ts:67` and `src/agent/reader-api.ts:289`.
- Performance review flagged this as medium severity for rapid `1-4` switching on larger inputs.
- Known pattern: per-mode caches already exist in `modeWordCache`; remap metadata may belong nearby (`docs/solutions/logic-errors/20260306-bionic-mode-p2-hardening-parity-validation-caching-unicode-safety.md`).

## Proposed Solutions

### Option 1: Cache source-index bounds to target-index lookup per mode

**Approach:** Build remap metadata the first time a mode variant is cached and reuse it for switches.

**Pros:**
- Fast repeated switching
- Shared benefit for TUI and agent runtime

**Cons:**
- Adds cache structure complexity

**Effort:** 3-5 hours

**Risk:** Medium

---

### Option 2: Binary search precomputed source bounds

**Approach:** Precompute sorted bounds and use binary search instead of linear scan.

**Pros:**
- Better asymptotic behavior
- Keeps mapping logic explicit

**Cons:**
- Slightly more implementation complexity than current scan

**Effort:** 2-4 hours

**Risk:** Medium

---

### Option 3: Keep O(n) remap and rely on current document sizes

**Approach:** Accept the current scan unless real latency is observed.

**Pros:**
- Keeps logic simplest

**Cons:**
- Leaves known scaling cost

**Effort:** 0 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/engine/position-mapping.ts:1`
- `src/ui/runtime-mode-state.ts:49`
- `src/agent/reader-api.ts:310`
- `src/processor/mode-transform.ts`

**Database changes:**
- Migration needed? No

## Resources

- **Branch:** `feat/runtime-mode-switching`
- **Known pattern:** `docs/solutions/logic-errors/20260306-bionic-mode-p2-hardening-parity-validation-caching-unicode-safety.md`

## Acceptance Criteria

- [ ] Position remapping has a bounded strategy for repeated mode switches
- [ ] Shared TUI/agent remap behavior remains correct
- [ ] Existing remap tests still pass or are expanded

## Work Log

### 2026-03-07 - Initial Discovery

**By:** OpenCode review workflow

**Actions:**
- Reviewed shared remap helper and its call sites in TUI and agent runtime
- Identified linear target scan on every switch

**Learnings:**
- The correctness fix for chunk/source identity increased the importance of remap cost on large inputs
