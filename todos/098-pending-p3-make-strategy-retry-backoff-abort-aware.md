---
status: pending
priority: p3
issue_id: "098"
tags: [code-review, performance, reliability, cli]
dependencies: []
---

# Make Strategy Retry Delay Abort-Aware

Improve strategy responsiveness by making retry backoff immediately cancellable.

## Problem Statement

During transient failures, strategy retries wait on fixed sleep. If cancellation happens during backoff, command responsiveness can feel delayed.

## Findings

- Retry loop sleeps unconditionally before next attempt in `src/llm/strategy.ts:208`.
- `sleep` helper at `src/llm/strategy.ts:166` is not signal-aware.
- This is mostly a tail-latency polish issue but affects perceived responsiveness under failure.

## Proposed Solutions

### Option 1: Abort-Aware Sleep Helper

**Approach:** Replace `sleep` with helper that resolves/rejects on either timeout or signal abort.

**Pros:**
- Minimal change
- Better Ctrl+C responsiveness

**Cons:**
- Slight extra helper complexity

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Global Deadline Loop

**Approach:** Track hard deadline and skip backoff when remaining budget is exhausted/aborted.

**Pros:**
- Better bounded behavior end-to-end
- Future-proof for more retries

**Cons:**
- More refactor than needed for current path

**Effort:** 2-4 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/llm/strategy.ts`
- `tests/llm/strategy.test.ts`

**Database changes:**
- Migration needed? No

## Resources

- `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`

## Acceptance Criteria

- [ ] Cancellation interrupts retry delay without waiting full backoff.
- [ ] Existing retry semantics remain deterministic.
- [ ] Unit tests cover abort during backoff.

## Work Log

### 2026-03-10 - Review Finding Created

**By:** Claude Code

**Actions:**
- Confirmed retry delay path in `src/llm/strategy.ts`.
- Logged as performance/reliability polish finding.

**Learnings:**
- Abort-aware backoff improves perceived quality in interactive terminal workflows.
