---
status: pending
priority: p3
issue_id: "101"
tags: [code-review, maintainability, typescript, quality]
dependencies: []
---

# Deduplicate Runtime Error Stage Type

Runtime error stage union is duplicated across multiple classes.

## Problem Statement

`provider|schema|network|timeout|runtime` stage type is repeated in each runtime error class. This increases drift risk when adding new stages or updating error semantics.

## Findings

- Duplicate stage union appears in:
  - `src/cli/errors.ts:9`
  - `src/cli/errors.ts:22`
  - `src/cli/errors.ts:35`
  - `src/cli/errors.ts:48`
- New `QuizRuntimeError` extends the duplication.
- Simplicity review flagged this as low-risk maintainability debt.

## Proposed Solutions

### Option 1: Extract shared `RuntimeErrorStage` type

**Approach:** Define one exported type and reuse it in all runtime error classes.

**Pros:**
- Very low-cost cleanup
- Prevents drift

**Cons:**
- Minor refactor touching multiple class signatures

**Effort:** Small (15-30 min)

**Risk:** Low

---

### Option 2: Create shared base runtime error class

**Approach:** Add a base class with `stage` and common constructor behavior, then subclass per feature.

**Pros:**
- Centralizes logic and type

**Cons:**
- Bigger abstraction than needed for current scope

**Effort:** Small-Medium (45-90 min)

**Risk:** Low-Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/cli/errors.ts:1`

**Related components:**
- Runtime error typing across summary/no-bs/translate/quiz

**Database changes (if any):**
- None

## Resources

- **Review target:** current branch `feat/phase-5-subphase-23`

## Acceptance Criteria

- [ ] Runtime stage union is defined once and reused
- [ ] Existing runtime error behavior remains unchanged
- [ ] Typecheck remains clean

## Work Log

### 2026-03-10 - Initial Review Finding

**By:** Claude Code

**Actions:**
- Reviewed `errors.ts` for duplication introduced during quiz additions
- Confirmed repeated union type across all runtime error classes

**Learnings:**
- Small type centralizations reduce future maintenance mistakes

## Notes

- Keep this as cleanup-only; do not change runtime error semantics.
