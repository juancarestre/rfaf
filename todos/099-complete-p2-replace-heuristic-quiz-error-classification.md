---
status: complete
priority: p2
issue_id: "099"
tags: [code-review, reliability, llm, error-handling]
dependencies: []
---

# Reduce Heuristic Error Classification in Quiz LLM

Quiz runtime error classification relies heavily on message substring checks.

## Problem Statement

`src/llm/quiz.ts` currently maps error stages primarily by text matching (`includes("timeout")`, `includes("network")`, etc.). This can drift across providers and cause nondeterministic error classification.

## Findings

- Heuristic classification is concentrated in `src/llm/quiz.ts:186`.
- Retry transient detection also uses message substring matching in `src/llm/quiz.ts:170`.
- Learnings review flagged mismatch against prior typed/signal-driven guidance.
- Known pattern: avoid free-form message routing when typed/signal boundaries are available (`docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`).

## Proposed Solutions

### Option 1: Introduce typed internal errors for quiz invariants

**Approach:** Throw typed `QuizRuntimeError` (or specific subclasses) at invariant boundaries and short-circuit reclassification in catch path.

**Pros:**
- More deterministic stage mapping
- Easier reasoning and maintenance

**Cons:**
- Requires moderate refactor of catch/classify logic

**Effort:** Medium (2-4 hours)

**Risk:** Low-Medium

---

### Option 2: Keep heuristics but constrain and test matrix explicitly

**Approach:** Retain classification function, but reduce branches and add a deterministic mapping test matrix for known error shapes.

**Pros:**
- Lower immediate refactor cost
- Improves confidence quickly

**Cons:**
- Still relies on provider message semantics

**Effort:** Small-Medium (1-3 hours)

**Risk:** Medium

## Recommended Action

Implemented Option 1 with a targeted hardening pass: preserve and rethrow typed `QuizRuntimeError` values directly, reduce internal sentinel-message routing, and keep bounded fallback classification only for external unknown errors.

## Technical Details

**Affected files:**
- `src/llm/quiz.ts:170`
- `src/llm/quiz.ts:186`
- `tests/llm/quiz.test.ts:159`

**Related components:**
- LLM error envelope consistency across summary/no-bs/translate/quiz

**Database changes (if any):**
- None

## Resources

- **Known pattern:** `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- **Known pattern:** `docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`

## Acceptance Criteria

- [x] Error stage mapping is deterministic for timeout/network/schema/provider/runtime classes
- [x] Message-substring dependence is reduced or tightly bounded with tests
- [x] Retry behavior remains correct
- [x] Full test suite passes

## Work Log

### 2026-03-10 - Initial Review Finding

**By:** Claude Code

**Actions:**
- Audited quiz classification and retry detection logic
- Mapped classification strategy against institutional learnings

**Learnings:**
- Typed boundary errors simplify deterministic contracts significantly

### 2026-03-10 - Resolution

**By:** Claude Code

**Actions:**
- Updated `src/llm/quiz.ts` to preserve typed errors in `classifyRuntimeError`
- Removed internal reason-string reclassification branches for schema invariants
- Added/updated tests in `tests/llm/quiz.test.ts` and verified deterministic behavior under retries and cancellation

**Learnings:**
- Typed errors at boundary checks reduce reliance on fragile provider message text and simplify future maintenance

## Notes

- This is primarily a reliability hardening and future-proofing task.
