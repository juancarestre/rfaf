---
status: pending
priority: p2
issue_id: "124"
tags: [code-review, performance, cost-control]
dependencies: []
---

# Cap Chunk Count For Long Input Transforms

Add an explicit maximum chunk count to bound provider call fanout and cost amplification.

## Problem Statement

Long-input chunking currently has no hard chunk-count cap. Pathological inputs can generate many chunks and force excessive sequential external calls.

## Findings

- `src/llm/long-input-chunking.ts:109` returns all generated chunks with no hard upper bound.
- `src/llm/summarize.ts:455` and `src/llm/no-bs.ts:502` process every chunk.
- Security/performance review identified potential cost/resource amplification under adversarial or malformed long inputs.

## Proposed Solutions

### Option 1: Hard Cap + Typed Runtime Error

**Approach:** Define `MAX_LONG_INPUT_CHUNKS`; throw typed fail-closed error when exceeded.

**Pros:**
- Deterministic and simple protection
- Strong cost bound

**Cons:**
- Extremely large inputs fail earlier

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Adaptive Chunk Size Up to Cap

**Approach:** Increase effective chunk byte target when projected chunk count exceeds cap.

**Pros:**
- Handles larger inputs without immediate failure

**Cons:**
- More algorithm complexity

**Effort:** 4-6 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/llm/long-input-chunking.ts`
- `src/llm/summarize.ts`
- `src/llm/no-bs.ts`

## Acceptance Criteria

- [ ] Chunk count is explicitly bounded.
- [ ] Exceeded cap fails with deterministic typed error.
- [ ] CLI and agent surfaces preserve parity for this failure envelope.

## Work Log

### 2026-03-11 - Review Finding Created

**By:** OpenCode

**Actions:**
- Added todo from security/performance review synthesis.

**Learnings:**
- Long-input reliability work needs explicit cost ceilings, not only correctness guards.
