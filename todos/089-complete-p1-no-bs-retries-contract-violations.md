---
status: complete
priority: p1
issue_id: "089"
tags: [code-review, performance, cost, no-bs]
dependencies: []
---

# Stop Retrying No-BS Contract Violations By Default

## Problem Statement

No-bs runtime currently retries on language/fact contract violations, which can multiply token cost and latency with low probability of recovery.

## Findings

- Retry gate in `src/llm/no-bs.ts` includes contract violations as retryable conditions.
- With configured retries, one bad contract response can trigger multiple paid calls.
- This is both a performance and cost-risk issue on hot summarize/no-bs paths.

## Proposed Solutions

### Option 1: Retry transient failures only (Recommended)

**Approach:** Restrict retries to transient network/provider classes (429/5xx/timeouts), treat contract violations as fail-fast deterministic schema failures.

**Pros:**
- Cuts unnecessary provider calls.
- Keeps deterministic behavior and lower latency.

**Cons:**
- Less chance to recover if model occasionally self-corrects on retry.

**Effort:** Small

**Risk:** Low

### Option 2: Separate tiny retry budget for contract violations

**Approach:** Keep transient retry budget and add optional single contract retry.

**Pros:**
- Some recovery chance.

**Cons:**
- More complexity and still extra cost.

**Effort:** Medium

**Risk:** Medium

## Recommended Action

Implemented transient-only retry behavior for no-bs runtime. Contract violations now fail deterministically without repeated paid calls.

## Technical Details

**Affected files:**
- `src/llm/no-bs.ts`
- `tests/llm/no-bs.test.ts`

## Resources

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`

## Acceptance Criteria

- [x] Contract-violation failures are not retried by default.
- [x] Transient retry policy remains bounded and deterministic.
- [x] Tests verify retry behavior split between transient vs contract failures.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Captured performance-oracle critical finding on retry cost inflation.

**Learnings:**
- Contract failures are usually deterministic quality violations, not transient transport failures.

### 2026-03-09 - Resolution

**By:** OpenCode

**Actions:**
- Tightened no-bs retry gate to transient-only in `src/llm/no-bs.ts`.
- Updated tests to assert no retry on language/fact contract violations and retry on transient 429.
- Re-ran targeted and full validation.

**Learnings:**
- Retry class boundaries significantly affect both latency and cost in LLM-heavy features.
