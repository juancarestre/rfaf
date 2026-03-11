---
status: pending
priority: p3
issue_id: "123"
tags: [code-review, quality, tests, cleanup]
dependencies: []
---

# Deduplicate ORP Contract Test Fixtures

Reduce duplicate ORP contract test setup and overlapping assertions to keep tests concise and maintainable.

## Problem Statement

Current ORP contract tests include duplicated scenario coverage and verbose inline fixtures, which increases maintenance cost and weakens signal clarity for future regressions.

## Findings

- `tests/ui/word-display-orp-whitespace-contract.test.tsx:5` and `tests/ui/word-display-orp-whitespace-contract.test.tsx:13` use the same input (`"ab cde"`) and expected pivot (`"c"`), creating overlapping coverage.
- `tests/processor/chunked-orp-contract.test.ts:8` defines a verbose inline `Word[]` fixture for a single behavior assertion.
- Both TypeScript and code-simplicity reviewers identified these as low-severity quality issues.

## Proposed Solutions

### Option 1: Keep Tests Separate but Use Distinct Inputs

**Approach:** Preserve both tests but change one to a truly distinct tie-break fixture (for example, `"a b"`) and keep first test as nearest-visible baseline.

**Pros:**
- Minimal code churn.
- Better semantic separation.

**Cons:**
- Still some repeated setup.

**Effort:** 1 hour

**Risk:** Low

---

### Option 2: Convert to Table-Driven ORP Cases + Small Word Fixture Helper

**Approach:** Consolidate ORP tests into a case table and add a tiny helper for `Word` fixture creation in processor contract test.

**Pros:**
- Less duplication.
- Easier to extend with new edge cases.

**Cons:**
- Slightly larger refactor in tests.

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 3: Leave As-Is

**Approach:** Keep current tests untouched.

**Pros:**
- Zero short-term effort.

**Cons:**
- Ongoing duplication and weaker test intent clarity.

**Effort:** 0 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `tests/ui/word-display-orp-whitespace-contract.test.tsx`
- `tests/processor/chunked-orp-contract.test.ts`

**Related components:**
- WordDisplay ORP fallback contract tests
- Chunked-mode ORP integration contract tests

**Database changes (if any):**
- Migration needed? No
- New columns/tables? None

## Resources

- **PR:** #2
- **Plan:** `docs/plans/2026-03-11-feat-phase-7-help-overlay-contracts-plan.md`

## Acceptance Criteria

- [ ] ORP contract test suite has no duplicate scenario assertions.
- [ ] Tie-break behavior is validated with a distinct fixture.
- [ ] Processor fixture setup is concise and readable.
- [ ] All related tests pass.

## Work Log

### 2026-03-11 - Initial Review Capture

**By:** OpenCode

**Actions:**
- Consolidated overlapping agent findings on test duplication.
- Identified exact duplicate scenario and verbose fixture location.
- Captured refactor options with low-risk path.

**Learnings:**
- Small test cleanups improve long-term contract clarity.

## Notes

- Nice-to-have; does not block merge.
