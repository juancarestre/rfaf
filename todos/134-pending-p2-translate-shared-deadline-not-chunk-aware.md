---
status: pending
priority: p2
issue_id: "134"
tags: [code-review, performance, llm, translate]
dependencies: []
---

# Translate Deadline Is Not Chunk-Count Aware

## Problem Statement

Translation uses one shared deadline for all chunks, but budget scaling is based only on input bytes. Large chunk counts can exceed wall-time needs even when each chunk is healthy.

## Findings

- Shared deadline is computed once in `src/cli/translate-flow.ts` and passed to all chunk calls.
- Chunk execution count/waves depends on `splitIntoTranslationChunks` and concurrency in `src/llm/translate-chunking.ts`.
- Performance review flagged risk of avoidable timeout failures for very long multi-chunk documents.

## Proposed Solutions

### Option 1: Wave-Aware Global Budget (Preferred)

**Approach:** Pre-split chunks, estimate waves (`ceil(chunks/concurrency)`), scale global budget with a hard cap.

**Pros:**
- Better completion reliability for long documents.
- Preserves one global budget concept.

**Cons:**
- Slightly more complexity in flow planning.

**Effort:** 4-6 hours

**Risk:** Medium

---

### Option 2: Keep Global Cap + Add Per-Chunk Floor

**Approach:** Retain global deadline but reserve minimum budget per remaining chunk.

**Pros:**
- Smaller logic change.

**Cons:**
- Harder to reason about and tune.

**Effort:** 3-5 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/cli/translate-flow.ts`
- `src/llm/translate.ts`
- `src/llm/translate-chunking.ts`
- `tests/cli/translate-flow.test.ts`

## Resources

- **PR:** https://github.com/juancarestre/rfaf/pull/3

## Acceptance Criteria

- [ ] Long multi-chunk translation does not timeout prematurely under healthy per-chunk latency
- [ ] Global timeout remains bounded by explicit cap
- [ ] Tests cover chunk-heavy workloads and budget behavior

## Work Log

### 2026-03-11 - Initial Discovery

**By:** OpenCode

**Actions:**
- Captured performance review finding on chunk-wave budgeting risk.

**Learnings:**
- Byte-based adaptation alone can underfit wall-time requirements for highly segmented workloads.
