---
status: complete
priority: p2
issue_id: "121"
tags: [code-review, quality, cli, parity]
dependencies: []
---

# Strengthen Compiled Help Section Placement Parity

Ensure compiled `--help` contract checks section placement/order semantics, not only presence/count.

## Problem Statement

The source help contract verifies AI flags appear inside the `AI Processing` section boundaries, but compiled help contract currently verifies only section presence and option singularity. This leaves a parity gap where compiled output could misplace options and still pass tests.

## Findings

- `tests/cli/help-cli-sections-contract.test.ts:53` and `tests/cli/help-cli-sections-contract.test.ts:63` assert section boundary placement for AI flags.
- `tests/cli/compiled-help-sections-contract.test.ts:32` verifies flag presence/count but does not assert section placement relative to section headers.
- Agent-native review flagged this as a medium parity coverage gap in PR #2.
- Related known pattern: keep source/compiled and interface contracts aligned (`docs/solutions/workflow-issues/20260310-parallel-branch-reconciliation-contract-validation.md`).

## Proposed Solutions

### Option 1: Mirror Source Section-Boundary Assertions in Compiled Test

**Approach:** Reuse the same boundary assertions used by source help (`AI Processing` starts before option positions, `Options` header follows), then apply to compiled output.

**Pros:**
- Highest confidence in compiled/source parity.
- Minimal code changes.

**Cons:**
- Some duplication if helpers are not shared.

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Add Shared Section-Contract Helper Used by Both Suites

**Approach:** Extract section boundary assertion helpers into a shared test helper and run against source + compiled output.

**Pros:**
- Avoids assertion drift.
- Centralizes contract logic.

**Cons:**
- Slightly larger refactor than immediate patch.

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 3: Snapshot Full Help Output for Compiled and Source

**Approach:** Add snapshot-style expectations for whole output in both suites.

**Pros:**
- Catches broad regressions quickly.

**Cons:**
- Brittle to formatting/wrapping variance.
- Lower signal-to-noise than semantic assertions.

**Effort:** 2-4 hours

**Risk:** Medium

## Recommended Action

Mirror source section-boundary assertions in the compiled suite and assert equivalent semantics for source and compiled help outputs.

## Technical Details

**Affected files:**
- `tests/cli/compiled-help-sections-contract.test.ts`
- `tests/cli/help-cli-sections-contract.test.ts`
- Optional shared helper file under `tests/cli/`

**Related components:**
- yargs help grouping in `src/cli/index.tsx`

**Database changes (if any):**
- Migration needed? No
- New columns/tables? None

## Resources

- **PR:** #2
- **Plan:** `docs/plans/2026-03-11-feat-phase-7-help-overlay-contracts-plan.md`
- **Known pattern:** `docs/solutions/workflow-issues/20260310-parallel-branch-reconciliation-contract-validation.md`
- **Known pattern:** `docs/solutions/logic-errors/runtime-mode-switching-hardening-cli-runtime-20260307.md`

## Acceptance Criteria

- [x] Compiled help test asserts AI flags are inside expected section boundaries.
- [x] Source and compiled tests validate equivalent section semantics.
- [x] All related CLI help tests pass.
- [x] `bun test` passes.

## Work Log

### 2026-03-11 - Initial Review Capture

**By:** OpenCode

**Actions:**
- Synthesized agent-native-reviewer finding from PR #2.
- Verified source vs compiled contract assertion asymmetry.
- Documented options and risks for parity hardening.

**Learnings:**
- Presence/count parity is not sufficient when section IA is part of product contract.

### 2026-03-11 - Resolution

**By:** OpenCode

**Actions:**
- Added boundary-aware helpers (`firstOptionIndex`, `assertFlagsInAiSection`) in `tests/cli/compiled-help-sections-contract.test.ts`.
- Updated compiled parity test to validate section ordering/placement for each AI flag in both compiled and source output.
- Ran targeted suites and full suite:
  - `bun test tests/cli/compiled-help-sections-contract.test.ts tests/cli/help-cli-sections-contract.test.ts tests/ui/word-display-orp-whitespace-contract.test.tsx`
  - `bun test`

**Learnings:**
- Compiled/source parity should assert section boundaries, not just presence and cardinality.

## Notes

- Protected artifact policy observed: no deletion proposals for `docs/plans/` or `docs/solutions/`.
