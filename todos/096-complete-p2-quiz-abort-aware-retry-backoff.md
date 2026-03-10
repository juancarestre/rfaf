---
status: complete
priority: p2
issue_id: "096"
tags: [code-review, llm, retry, cancellation]
dependencies: []
---

# Make Quiz Retry Backoff Abort-Aware

Quiz generation retry delay does not currently stop immediately on cancellation.

## Problem Statement

`generateQuizWithGenerator` can continue sleeping during retry backoff after SIGINT/abort, delaying shutdown and making CLI cancellation feel sluggish.

## Findings

- Retry backoff uses non-abortable `sleep` in `src/llm/quiz.ts:291`.
- Cancellation is modeled through abort signals in the main request path, but not in retry wait.
- Type/performance reviews flagged this as an interactive responsiveness gap.
- Known pattern: bounded retries should align with deterministic cancellation behavior (`docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`).

## Proposed Solutions

### Option 1: Abortable delay helper

**Approach:** Replace `sleep` with an abort-aware delay utility that rejects immediately on signal abort.

**Pros:**
- Directly solves responsiveness issue
- Minimal changes to current flow

**Cons:**
- Needs careful error mapping for timeout vs cancel

**Effort:** Small (45-90 min)

**Risk:** Low

---

### Option 2: Unified retry helper across LLM modules

**Approach:** Extract shared retry + abort behavior used by summary/no-bs/translate/quiz.

**Pros:**
- Reduces drift between LLM modules
- Improves consistency

**Cons:**
- Broader refactor scope

**Effort:** Medium (2-4 hours)

**Risk:** Medium

## Recommended Action

Implemented Option 1 by introducing abort-aware retry delay behavior in quiz generation and adding a timing-sensitive contract test that verifies prompt cancellation during backoff.

## Technical Details

**Affected files:**
- `src/llm/quiz.ts:240`
- `src/llm/quiz.ts:291`

**Related components:**
- LLM retry/cancellation contract handling

**Database changes (if any):**
- None

## Resources

- **Known pattern:** `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`
- **Known pattern:** `docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`

## Acceptance Criteria

- [x] Cancelling quiz generation during backoff exits promptly
- [x] Error stage/message classification remains deterministic
- [x] Retry behavior remains bounded and test-covered
- [x] Full test suite passes

## Work Log

### 2026-03-10 - Initial Review Finding

**By:** Claude Code

**Actions:**
- Inspected retry loop and delay handling in quiz generator
- Compared cancellation behavior expectations with existing LLM patterns

**Learnings:**
- Abort signal coverage needs to include both request and inter-retry delay paths

### 2026-03-10 - Resolution

**By:** Claude Code

**Actions:**
- Replaced non-abortable backoff wait with abort-aware delay path in `src/llm/quiz.ts`
- Removed random jitter for deterministic retry timing
- Added cancellation-during-backoff coverage in `tests/llm/quiz.test.ts`

**Learnings:**
- Backoff cancellation support materially improves interactive CLI responsiveness without changing retry bounds

## Notes

- Prioritize minimal abort-aware patch before broader retry abstraction.
