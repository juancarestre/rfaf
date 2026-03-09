---
status: pending
priority: p2
issue_id: "084"
tags: [code-review, quality, tests, summary]
dependencies: []
---

# Deduplicate Summary Language Contract Test Plumbing

## Problem Statement

Summary contract tests duplicate command runner and error string wiring, increasing maintenance drift risk.

## Findings

- `tests/cli/summary-cli-contract.test.ts` has overlapping process runner helpers for preloaded vs non-preloaded CLI execution.
- `src/llm/summarize.ts` duplicates long language-preservation failure strings in multiple branches.

## Proposed Solutions

### Option 1: Shared Helper + Shared Constant (Recommended)

**Approach:** Consolidate CLI runner into one helper with optional preload and centralize repeated failure strings/constants.

**Pros:**
- Lower maintenance overhead.
- Reduces accidental contract drift.

**Cons:**
- Minor refactor churn.

**Effort:** Small

**Risk:** Low

---

### Option 2: Keep Duplicates, Add Comments

**Approach:** Leave code as-is, document duplication rationale.

**Pros:**
- Minimal change.

**Cons:**
- Drift risk remains.

**Effort:** Small

**Risk:** Medium

## Recommended Action

Triage pending.

## Technical Details

**Affected files:**
- `tests/cli/summary-cli-contract.test.ts`
- `src/llm/summarize.ts`

## Resources

- `docs/solutions/integration-issues/markdown-ingestion-deterministic-contracts-timeout-size-guardrails-cli-agent-parity.md`

## Acceptance Criteria

- [ ] One CLI contract test runner helper supports preload and non-preload runs.
- [ ] Language-preservation failure text is centralized.
- [ ] All summary contract tests stay green.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated code-simplicity reviewer findings into one maintainability task.

**Learnings:**
- Contract text duplication is a common source of subtle inconsistency over time.
