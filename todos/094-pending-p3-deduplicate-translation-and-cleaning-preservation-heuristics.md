---
status: pending
priority: p3
issue_id: "094"
tags: [code-review, quality, simplification, llm]
dependencies: []
---

# Deduplicate LLM Preservation Heuristics Across Translate and No-BS

## Problem Statement

`translate` and `no-bs` now contain overlapping language/content-preservation heuristics with different thresholds and duplicate utility logic, increasing drift and maintenance risk.

## Findings

- Similar language marker/profile logic exists in `src/llm/translate.ts` and `src/llm/no-bs.ts`.
- Similar content-preservation threshold checks were implemented independently in both files.
- Independent evolution risks inconsistent fail-closed behavior over time.

## Proposed Solutions

### Option 1: Shared Preservation Utility (Recommended)

**Approach:** Extract shared language-profile + content-preservation helper module used by translate and no-bs.

**Pros:**
- Reduces drift.
- Fewer duplicated tests/helpers.

**Cons:**
- Requires careful API design for mode-specific thresholds.

**Effort:** Medium

**Risk:** Low-Medium

---

### Option 2: Keep Separate but Synchronize Through Contract Tests

**Approach:** Leave code duplicated but add cross-module contract tests asserting identical behavior on shared fixtures.

**Pros:**
- Lower refactor risk short-term.

**Cons:**
- Duplication remains.

**Effort:** Small-Medium

**Risk:** Medium

## Recommended Action

Triage pending.

## Technical Details

**Affected files:**
- `src/llm/translate.ts`
- `src/llm/no-bs.ts`
- `tests/llm/translate.test.ts`
- `tests/llm/no-bs.test.ts`

## Resources

- `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`

## Acceptance Criteria

- [ ] Shared heuristic utilities or equivalent contract-level synchronization is implemented.
- [ ] Translate and no-bs preservation checks stay behaviorally consistent on shared fixtures.
- [ ] Duplicate logic is reduced or explicitly justified.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated simplicity review findings around heuristic duplication.

**Learnings:**
- Fail-closed contracts are easiest to maintain when policy logic is centralized.
