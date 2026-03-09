---
status: pending
priority: p3
issue_id: "079"
tags: [code-review, quality, cli, tests]
dependencies: []
---

# Centralize Clipboard CLI Policy and Test Helpers

## Problem Statement

Clipboard source-policy checks and CLI contract test harness code are split/duplicated, making future updates noisier and easier to drift.

## Findings

- Clipboard mutual-exclusion policy is inline in `main` at `src/cli/index.tsx:241`, separate from source-resolution logic.
- CLI spawn/decoding boilerplate is duplicated in `tests/cli/clipboard-cli-contract.test.ts:3` and `tests/cli/clipboard-cli-contract.test.ts:31`.
- `ClipboardCommand` wrapper type in `src/ingest/clipboard.ts:18` is effectively a one-field container and can be simplified.

## Proposed Solutions

### Option 1: Extract Small Shared Helpers

**Approach:**
- Add a source-selection helper to unify clipboard policy + source resolution.
- Add a shared CLI test runner helper for clipboard contract tests.
- Replace one-field command wrapper with `string[][]` or equivalent lightweight shape.

**Pros:**
- Less repetition.
- Easier future extension and test maintenance.

**Cons:**
- Minor refactor churn.

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Keep Existing Structure, Add Documentation Comments

**Approach:** Retain structure and document rationale near each duplicated section.

**Pros:**
- Minimal code movement.

**Cons:**
- Duplication and drift risk remain.

**Effort:** 1 hour

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/cli/index.tsx:241`
- `tests/cli/clipboard-cli-contract.test.ts:3`
- `src/ingest/clipboard.ts:18`

**Database changes (if any):**
- Migration needed? No

## Resources

- **Review target:** branch `feat/phase-4-subphase-19-clipboard-support`

## Acceptance Criteria

- [ ] Clipboard source-policy logic is centralized in one helper seam.
- [ ] Clipboard CLI contract tests use shared execution helper.
- [ ] Command-candidate typing is simplified without behavior change.
- [ ] Tests pass.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Grouped P3 simplification findings into one maintainability task.

**Learnings:**
- Centralized policy helpers reduce regressions for deterministic CLI contracts.

## Notes

- Nice-to-have cleanup; does not block merge.
