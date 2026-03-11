---
status: pending
priority: p2
issue_id: "129"
tags: [code-review, reliability, determinism]
dependencies: []
---

# Fail Closed On Unrepresentable Chunk Boundaries

Replace silent `break` behavior in chunk slicing edge paths with deterministic typed failure.

## Problem Statement

In two fallback loops, when no progress can be made (`end === start`), chunking exits the loop without throwing. This can silently drop remainder content under edge conditions.

## Findings

- `src/llm/long-input-chunking.ts:67` breaks out of the long-word slicing loop when `end === start`.
- `src/llm/long-input-chunking.ts:98` breaks out of the segment slicing loop in the same condition.
- Silent break conflicts with fail-closed contract expectations for transform integrity.

## Proposed Solutions

### Option 1: Throw Typed Chunking Error On No-Progress

**Approach:** Replace `break` with explicit error indicating chunking boundary failure.

**Pros:**
- Preserves fail-closed semantics
- Prevents silent truncation

**Cons:**
- Introduces new error path to map/classify

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Force Minimal Safe Slice + Continue

**Approach:** Choose smallest safe code-point slice and continue instead of breaking.

**Pros:**
- Avoids hard failure in rare edge cases

**Cons:**
- More complex; may hide problematic input conditions

**Effort:** 3-5 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/llm/long-input-chunking.ts`
- `tests/llm/long-input-chunking-contract.test.ts`

## Acceptance Criteria

- [ ] No chunking path can silently drop remaining content.
- [ ] Edge no-progress cases produce deterministic typed failures or guaranteed progress.
- [ ] Regression test covers the no-progress branch.

## Work Log

### 2026-03-11 - Review Finding Created

**By:** OpenCode

**Actions:**
- Added fail-closed edge-case todo from architecture review.

**Learnings:**
- Deterministic chunking requires explicit handling for no-progress branches.
