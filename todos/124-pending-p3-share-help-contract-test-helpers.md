---
status: pending
priority: p3
issue_id: "124"
tags: [code-review, quality, tests, cli]
dependencies: []
---

# Share CLI Help Contract Test Helpers

Extract duplicated `AI_FLAGS` and regex/count helpers used by source and compiled help section tests into a shared test utility.

## Problem Statement

Two new help-section test files duplicate canonical AI flag lists and option-count helper logic. This invites drift when flags are added or renamed and increases maintenance overhead for parity tests.

## Findings

- `tests/cli/help-cli-sections-contract.test.ts:3` and `tests/cli/compiled-help-sections-contract.test.ts:4` define duplicated `AI_FLAGS` arrays.
- Helper logic (`escapeRegExp`, option-count matching) is duplicated across both files.
- Code-simplicity review flagged this as avoidable duplication with a straightforward shared helper path.
- Known pattern: parity contracts should be centralized where possible to reduce divergence (`docs/solutions/workflow-issues/20260310-parallel-branch-reconciliation-contract-validation.md`).

## Proposed Solutions

### Option 1: Create `tests/cli/help-contract-helpers.ts`

**Approach:** Move shared constants and helper functions into a single helper module imported by both tests.

**Pros:**
- Single source of truth for AI flags and parsing helpers.
- Reduces future update cost.

**Cons:**
- One extra test utility file to maintain.

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Keep Files Independent but Add Drift Guard Test

**Approach:** Keep duplication but add a meta-test that compares both AI flag lists.

**Pros:**
- Minimal refactor.

**Cons:**
- Still duplicate code.
- More indirect than shared helper.

**Effort:** 1 hour

**Risk:** Low

---

### Option 3: Inline One Test Into the Other

**Approach:** Collapse source/compiled checks into one file to avoid helper duplication.

**Pros:**
- Fewer files.

**Cons:**
- Larger mixed-responsibility test file.
- Reduces readability of source vs compiled concerns.

**Effort:** 2 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `tests/cli/help-cli-sections-contract.test.ts`
- `tests/cli/compiled-help-sections-contract.test.ts`
- Potential new: `tests/cli/help-contract-helpers.ts`

**Related components:**
- CLI help section contract tests (source + compiled)

**Database changes (if any):**
- Migration needed? No
- New columns/tables? None

## Resources

- **PR:** #2
- **Known pattern:** `docs/solutions/workflow-issues/20260310-parallel-branch-reconciliation-contract-validation.md`

## Acceptance Criteria

- [ ] AI flag canonical list exists in one test helper source.
- [ ] Source and compiled tests use shared helper functions.
- [ ] No behavior regression in existing help contract tests.
- [ ] `bun test` passes.

## Work Log

### 2026-03-11 - Initial Review Capture

**By:** OpenCode

**Actions:**
- Identified duplicated constants/helpers in new help tests.
- Captured simplification alternatives and effort/risk.

**Learnings:**
- Shared parity helpers reduce maintenance burden and accidental drift.

## Notes

- Nice-to-have cleanup; can be bundled with other test-maintenance work.
