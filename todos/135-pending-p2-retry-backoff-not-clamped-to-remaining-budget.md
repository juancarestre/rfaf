---
status: pending
priority: p2
issue_id: "135"
tags: [code-review, performance, reliability, llm]
dependencies: []
---

# Retry Backoff Not Clamped to Remaining Budget

## Problem Statement

Retry loops may sleep full backoff delays even when little timeout budget remains, increasing tail latency and reducing chance of useful final attempts.

## Findings

- Remaining-time checks happen before calls, but backoff sleeps are not budget-clamped in several transforms:
  - `src/llm/summarize.ts`
  - `src/llm/no-bs.ts`
  - `src/llm/translate.ts`
  - `src/llm/key-phrases.ts`
- Performance reviewer flagged avoidable latency amplification near deadline exhaustion.

## Proposed Solutions

### Option 1: Clamp Backoff to Remaining Budget (Preferred)

**Approach:** Before sleeping, recompute remaining time and use `min(backoff, remaining - guard)`; skip retry when under guard threshold.

**Pros:**
- Reduces wasted wait time.
- Preserves deterministic budget semantics.

**Cons:**
- Requires touchpoints in each retry loop.

**Effort:** 2-4 hours

**Risk:** Low

---

### Option 2: Centralize Retry Loop Utility

**Approach:** Implement one shared retry runner with budget-aware sleep.

**Pros:**
- Reduces duplication long-term.

**Cons:**
- Larger refactor scope.

**Effort:** 6-10 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/llm/summarize.ts`
- `src/llm/no-bs.ts`
- `src/llm/translate.ts`
- `src/llm/key-phrases.ts`

## Resources

- **PR:** https://github.com/juancarestre/rfaf/pull/3
- **Known Pattern:** `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`

## Acceptance Criteria

- [ ] Retry sleep never exceeds remaining timeout budget
- [ ] Retries are skipped when remaining budget cannot support another attempt
- [ ] Contract tests validate bounded retry timing behavior

## Work Log

### 2026-03-11 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated performance review evidence across transform retry loops.

**Learnings:**
- Budget-aware retries need budget-aware sleep to avoid self-inflicted latency.
