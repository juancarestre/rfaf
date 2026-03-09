---
status: pending
priority: p2
issue_id: "082"
tags: [code-review, performance, summary]
dependencies: ["080"]
---

# Precompute Source Language Profile Across Retries

## Problem Statement

Source language classification is recalculated per attempt in the summarize retry loop, adding repeated O(n) scans on large inputs.

## Findings

- Source classification helpers are invoked from the retry path in `src/llm/summarize.ts`.
- On retry, source re-scans add avoidable CPU/GC overhead even though source text is unchanged.

## Proposed Solutions

### Option 1: Precompute Source Profile Once (Recommended)

**Approach:** Derive source language/script profile before entering retry loop and reuse for each summary attempt.

**Pros:**
- Reduces repeated work and allocations.
- Keeps behavior deterministic.

**Cons:**
- Requires small refactor around mismatch function signature.

**Effort:** Small

**Risk:** Low

---

### Option 2: Keep Current Structure

**Approach:** No optimization.

**Pros:**
- No code movement.

**Cons:**
- Ongoing avoidable overhead.

**Effort:** None

**Risk:** Low

## Recommended Action

Triage pending.

## Technical Details

**Affected files:**
- `src/llm/summarize.ts`
- `tests/llm/summarize.test.ts`

## Resources

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`

## Acceptance Criteria

- [ ] Source language profile is computed once per summarize request.
- [ ] Retry attempts only classify summary output.
- [ ] Existing behavior/tests remain stable.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Logged performance-oracle recommendation on retry-path overhead.

**Learnings:**
- Network dominates latency, but repeated local scans still add avoidable cost at scale.
