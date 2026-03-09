---
status: complete
priority: p1
issue_id: "088"
tags: [code-review, parity, reliability, summary, no-bs]
dependencies: []
---

# Apply Deterministic Cleaner in Agent No-BS Path

## Problem Statement

Agent no-bs execution currently skips the deterministic cleaner stage used by CLI, creating behavior drift and violating the hybrid contract.

## Findings

- CLI runs deterministic cleanup before LLM and fail-closes empty results in `src/cli/no-bs-flow.ts`.
- Agent no-bs sends raw source text directly to LLM in `src/agent/reader-api.ts` and does not mirror empty-result checks.
- This means identical input can produce different outcomes between CLI and agent.

## Proposed Solutions

### Option 1: Reuse CLI no-bs flow semantics in agent (Recommended)

**Approach:** Extract shared no-bs transform helper (deterministic cleaner + empty-result guard) and call it from both CLI and agent.

**Pros:**
- Restores CLI/agent parity.
- Reduces duplicate drift risk.

**Cons:**
- Requires small refactor across modules.

**Effort:** Small-Medium

**Risk:** Low

### Option 2: Duplicate cleaner logic in agent path

**Approach:** Add equivalent deterministic cleaner + empty guard directly in `executeAgentNoBsCommand`.

**Pros:**
- Fast patch.

**Cons:**
- Ongoing duplication and future drift risk.

**Effort:** Small

**Risk:** Medium

## Recommended Action

Implemented shared parity behavior in agent no-bs path: deterministic cleaner now runs before LLM, empty-clean result fails closed with typed schema error.

## Technical Details

**Affected files:**
- `src/agent/reader-api.ts`
- `src/cli/no-bs-flow.ts`
- `src/processor/no-bs-cleaner.ts`
- `tests/agent/reader-api.test.ts`

## Resources

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`

## Acceptance Criteria

- [x] Agent no-bs uses deterministic cleaner before LLM stage.
- [x] Agent no-bs fails closed on empty cleaned output, matching CLI semantics.
- [x] CLI and agent parity tests pass for identical no-bs inputs.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated parity findings from multi-agent review.

**Learnings:**
- Hybrid transform features must share the same pre-LLM invariant enforcement across all interfaces.

### 2026-03-09 - Resolution

**By:** OpenCode

**Actions:**
- Updated `executeAgentNoBsCommand` to apply deterministic cleaner and schema-empty fail-closed guard.
- Added agent tests to verify cleaner input handoff and empty-output rejection.
- Re-ran targeted and full test suites.

**Learnings:**
- Parity issues are easiest to prevent when shared invariants are enforced before surface-specific wrappers.
