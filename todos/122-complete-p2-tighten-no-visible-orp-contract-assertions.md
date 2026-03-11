---
status: complete
priority: p2
issue_id: "122"
tags: [code-review, quality, tests, ui]
dependencies: []
---

# Tighten No-Visible ORP Contract Assertions

Harden the all-whitespace/no-visible test to verify full stable layout contract instead of a weak partial assertion.

## Problem Statement

The no-visible-character test currently validates `pivot === ""` and that `before + after` contains a space. This can pass while layout semantics drift (padding, before/after partition, or position invariants). The Phase 7 contract should remain explicit and deterministic for this edge case.

## Findings

- `tests/ui/word-display-orp-whitespace-contract.test.tsx:18` uses a permissive assertion (`toContain(" ")`) for no-visible behavior.
- Runtime logic in `src/ui/components/WordDisplay.tsx:142` has dedicated `orp === null` behavior that deserves stronger test pinning.
- Code-simplicity reviewer marked this as important test-quality risk due to weak contract coverage.
- Related known pattern: keep display/highlight contracts aligned to avoid drift (`docs/solutions/ui-bugs/line-break-and-highlight-drift-guided-scroll-20260306.md`).

## Proposed Solutions

### Option 1: Assert Exact Layout Fields for No-Visible Input

**Approach:** Replace permissive assertion with exact expected `before`, `pivot`, `after`, and left-padding invariants for representative no-visible inputs.

**Pros:**
- Strongest deterministic contract.
- Prevents accidental regressions.

**Cons:**
- Slightly more brittle if layout contract intentionally evolves.

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Add Invariant-Based Assertions (Not Full Exact Strings)

**Approach:** Assert deterministic invariants (`pivot === ""`, `after === ""`, padding relationship, no crash) without pinning every string shape.

**Pros:**
- More resilient to benign formatting changes.

**Cons:**
- Less strict than exact contract assertions.

**Effort:** 1 hour

**Risk:** Low

---

### Option 3: Add Table-Driven Edge-Case Matrix

**Approach:** Introduce a small case matrix for `""`, spaces, tabs, mixed whitespace with expected layout outcomes.

**Pros:**
- Broader edge-case coverage.
- Documents behavior clearly.

**Cons:**
- More test boilerplate.

**Effort:** 2-3 hours

**Risk:** Low

## Recommended Action

Tighten no-visible ORP tests with deterministic field-level assertions for whitespace-only and empty inputs.

## Technical Details

**Affected files:**
- `tests/ui/word-display-orp-whitespace-contract.test.tsx`
- `src/ui/components/WordDisplay.tsx` (reference only unless behavior changes)

**Related components:**
- ORP fallback flow in `getWordDisplayLayout`

**Database changes (if any):**
- Migration needed? No
- New columns/tables? None

## Resources

- **PR:** #2
- **Plan:** `docs/plans/2026-03-11-feat-phase-7-help-overlay-contracts-plan.md`
- **Known pattern:** `docs/solutions/ui-bugs/line-break-and-highlight-drift-guided-scroll-20260306.md`

## Acceptance Criteria

- [x] No-visible test enforces deterministic layout contract beyond `contains(" ")`.
- [x] Assertions cover at least one whitespace-only input and one empty/sanitized-empty input.
- [x] All WordDisplay tests pass.
- [x] `bun test` passes.

## Work Log

### 2026-03-11 - Initial Review Capture

**By:** OpenCode

**Actions:**
- Consolidated code-simplicity finding on weak no-visible assertion.
- Mapped impacted files and contract expectations.
- Drafted options balancing strictness vs maintainability.

**Learnings:**
- Edge-case tests need strong invariants when behavior is safety-oriented.

### 2026-03-11 - Resolution

**By:** OpenCode

**Actions:**
- Strengthened `tests/ui/word-display-orp-whitespace-contract.test.tsx` no-visible assertions to check exact `before/pivot/after` and padding invariants.
- Added explicit empty-input contract test for deterministic no-visible layout behavior.
- Ran targeted and full validation:
  - `bun test tests/cli/compiled-help-sections-contract.test.ts tests/cli/help-cli-sections-contract.test.ts tests/ui/word-display-orp-whitespace-contract.test.tsx`
  - `bun test`

**Learnings:**
- Safety-path tests should pin layout invariants directly to prevent silent behavior drift.

## Notes

- Keep scope to test hardening unless behavior defects are confirmed.
