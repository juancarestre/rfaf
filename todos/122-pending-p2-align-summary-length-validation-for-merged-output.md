---
status: pending
priority: p2
issue_id: "122"
tags: [code-review, quality, determinism]
dependencies: []
---

# Align Summary Length Validation For Merged Output

Ensure summary length contracts are enforced at the right level for chunked summaries, avoiding boundary-driven false rejections.

## Problem Statement

Current chunk path applies summary proportional-length checks to each chunk before merge. Small tail chunks can trigger short-input constraints and fail otherwise-valid long-input summaries.

## Findings

- `src/llm/summarize.ts:417` validates length contract inside `runSinglePass(sourceText)`.
- `src/llm/summarize.ts:455` calls `runSinglePass` per chunk in chunk mode.
- `resolveSummaryLengthContract` uses short-input behavior at `<=120` words (`src/llm/summarize.ts:116`), which can overconstrain remainder chunks.
- Known Pattern: strict contracts should be deterministic and scope-correct from `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`.

## Proposed Solutions

### Option 1: Merge-Level Length Validation Only (Chunk mode)

**Approach:** Skip chunk-level proportional length checks when chunking is active; keep merge-level validation against full source.

**Pros:**
- Removes boundary artifact failures
- Preserves strict global contract

**Cons:**
- Chunk-level summary quality less constrained

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Chunk-Scaled Contract

**Approach:** Derive per-chunk min/max from global target proportion and chunk weights.

**Pros:**
- Keeps chunk-level guardrails
- Better local quality control

**Cons:**
- More math and edge-case surface

**Effort:** 4-6 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/llm/summarize.ts`
- `tests/llm/summary-long-input-boundary.test.ts`

## Resources

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`

## Acceptance Criteria

- [ ] No false failures from tiny tail chunks in chunk mode.
- [ ] Full-source merged summary still enforces proportional bounds.
- [ ] Deterministic boundary tests cover long input with short remainder chunk.

## Work Log

### 2026-03-11 - Review Finding Created

**By:** OpenCode

**Actions:**
- Captured chunk-level vs merge-level contract mismatch risk.

**Learnings:**
- Validation scope is as important as validation strictness.
