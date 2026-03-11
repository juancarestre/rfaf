---
status: pending
priority: p1
issue_id: "121"
tags: [code-review, performance, reliability, security]
dependencies: []
---

# Bound Total LLM Runtime For Chunked Transforms

Add a deterministic global budget for chunked `--summary` and `--no-bs` runs so wall-clock and call amplification stay bounded.

## Problem Statement

Chunked execution currently applies timeout/retry per chunk with no global ceiling. On long inputs, this multiplies runtime and provider calls, creating merge-blocking latency and cost risk.

## Findings

- `src/llm/summarize.ts:392` and `src/llm/summarize.ts:455` retry and timeout each chunk independently in a sequential loop.
- `src/llm/no-bs.ts:441` and `src/llm/no-bs.ts:502` use the same per-chunk budget pattern.
- In degraded provider conditions, worst-case runtime scales with `chunks * (maxRetries + 1) * timeoutMs`.
- Known Pattern: fail-closed and bounded-runtime contracts in `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`.

## Proposed Solutions

### Option 1: Global Deadline Propagation

**Approach:** Compute an absolute deadline at transform start, derive per-chunk timeout as remaining budget, and fail typed timeout when exhausted.

**Pros:**
- Strong deterministic wall-clock bound
- Minimal API surface change

**Cons:**
- Slightly more control-flow complexity

**Effort:** 3-5 hours

**Risk:** Medium

---

### Option 2: Global Attempt Budget + Existing Timeout

**Approach:** Keep per-chunk timeout but cap total chunk attempts across the entire run.

**Pros:**
- Simple to reason about cost/call amplification
- Easy to test deterministically

**Cons:**
- Wall-clock still less directly bounded

**Effort:** 2-4 hours

**Risk:** Medium

---

### Option 3: Hybrid Deadline + Attempt Cap

**Approach:** Enforce both absolute deadline and max total attempts.

**Pros:**
- Strongest safety envelope
- Covers both latency and cost dimensions

**Cons:**
- More implementation/test surface

**Effort:** 4-6 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/llm/summarize.ts`
- `src/llm/no-bs.ts`
- `tests/llm/summary-long-input-boundary.test.ts`
- `tests/llm/no-bs-long-input-boundary.test.ts`

**Database changes (if any):**
- Migration needed? No

## Resources

- `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`
- `docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`

## Acceptance Criteria

- [ ] Chunked summary/no-bs have deterministic global runtime budget.
- [ ] Exceeded budget returns typed fail-closed timeout error.
- [ ] Tests cover long-input degraded-provider scenario.
- [ ] CLI/agent parity remains intact.

## Work Log

### 2026-03-11 - Review Finding Created

**By:** OpenCode

**Actions:**
- Synthesized multi-agent review results.
- Captured unbounded runtime/cost amplification risk.

**Learnings:**
- Per-chunk retry loops need a global envelope for deterministic contracts.

## Notes

- P1 because this can block responsive UX and violate expected timeout semantics on large inputs.
