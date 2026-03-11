---
status: pending
priority: p2
issue_id: "125"
tags: [code-review, performance, algorithm]
dependencies: []
---

# Optimize Chunker Byte Boundary Search

Reduce worst-case CPU behavior in fallback chunk slicing loops.

## Problem Statement

Current fallback loops repeatedly decrement end index and recalculate byte length on growing slices, which can degrade to quadratic behavior on delimiter-poor long input.

## Findings

- `src/llm/long-input-chunking.ts:63-65` and `src/llm/long-input-chunking.ts:94-96` do repeated `Buffer.byteLength(segment.slice(...))` in decrement loops.
- This pattern sits in nested progression loops (`src/llm/long-input-chunking.ts:61`, `src/llm/long-input-chunking.ts:92`).
- Pathological cases: long base64 blobs, minified JSON, long URLs, very long no-space sequences.

## Proposed Solutions

### Option 1: Binary Search For Fitting End

**Approach:** Replace decrement loops with binary search over end boundary per slice.

**Pros:**
- Significant worst-case reduction
- Deterministic output unchanged

**Cons:**
- Slightly more complex logic

**Effort:** 3-5 hours

**Risk:** Medium

---

### Option 2: Incremental Byte Accounting

**Approach:** Track per-unit byte contributions to avoid repeated whole-slice recomputation.

**Pros:**
- Strong performance on long tokens

**Cons:**
- More invasive refactor

**Effort:** 5-8 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/llm/long-input-chunking.ts`
- `tests/llm/long-input-chunking-contract.test.ts`

## Acceptance Criteria

- [ ] Worst-case slicing avoids linear decrement scans.
- [ ] Deterministic chunk boundaries remain stable across runs.
- [ ] Existing chunk-size and order tests remain green.

## Work Log

### 2026-03-11 - Review Finding Created

**By:** OpenCode

**Actions:**
- Captured algorithmic hot path from performance review.

**Learnings:**
- Deterministic behavior can be preserved while improving asymptotic performance.
