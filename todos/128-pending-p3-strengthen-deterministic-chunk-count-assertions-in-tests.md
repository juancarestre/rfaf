---
status: pending
priority: p3
issue_id: "128"
tags: [code-review, tests, determinism]
dependencies: []
---

# Strengthen Deterministic Chunk Count Assertions In Tests

Tighten long-input tests to assert exact deterministic chunk behavior, not only `> 1` calls.

## Problem Statement

Boundary tests currently only assert that chunk mode made more than one call. This may miss regressions where chunk planning changes unintentionally.

## Findings

- `tests/llm/summary-long-input-boundary.test.ts:73` checks `calls > 1`.
- `tests/llm/no-bs-long-input-boundary.test.ts:75` checks `calls > 1`.
- Contract already claims deterministic chunking behavior in `tests/llm/long-input-chunking-contract.test.ts`.

## Proposed Solutions

### Option 1: Assert Exact Expected Chunk Count

**Approach:** Compute expected chunks via `splitIntoLongInputChunks(source).length` and assert exact call count.

**Pros:**
- Strong deterministic contract coverage
- Catches planner regressions earlier

**Cons:**
- Tests become more coupled to planner implementation

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Assert Stable Count Across Multiple Runs

**Approach:** Keep `>1` but run transform repeatedly and assert consistent call count each run.

**Pros:**
- Less tightly coupled than Option 1

**Cons:**
- Weaker than exact-value assertions

**Effort:** 1-2 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `tests/llm/summary-long-input-boundary.test.ts`
- `tests/llm/no-bs-long-input-boundary.test.ts`
- `src/llm/long-input-chunking.ts`

## Acceptance Criteria

- [ ] Long-input boundary tests verify deterministic chunk call count robustly.
- [ ] Tests fail when planner behavior changes unexpectedly.
- [ ] Existing test suite remains green.

## Work Log

### 2026-03-11 - Review Finding Created

**By:** OpenCode

**Actions:**
- Captured test-strengthening opportunity from simplicity review.

**Learnings:**
- Determinism claims should be asserted with exactness where practical.
