---
status: pending
priority: p3
issue_id: 015
tags: [code-review, quality, simplicity, ui]
dependencies: []
---

# Problem Statement

`getReadingLaneLayout(...)` currently ignores input and returns constant values, adding indirection without behavior.

## Findings

- `src/ui/screens/RSVPScreen.tsx:38` helper always returns `justifyContent: "center"` and `alignItems: "center"`.
- `tests/ui/rsvp-screen-layout.test.ts` asserts this constant helper rather than user-observable behavior.

## Proposed Solutions

### Option 1: Inline static layout props and remove helper/test
Pros: Simplest code path; less test noise.  
Cons: Removes a potential extension hook.  
Effort: Small  
Risk: Low

### Option 2: Keep helper but make it truly preset-aware with branching + tests
Pros: Legitimate abstraction if per-scale lane policy is needed.  
Cons: Adds complexity if no current requirement.  
Effort: Medium  
Risk: Medium

### Option 3: Keep helper with explicit TODO and rationale
Pros: Minimal code churn.  
Cons: Carries dead abstraction.  
Effort: Small  
Risk: Low

## Recommended Action


## Technical Details

- Affected: `src/ui/screens/RSVPScreen.tsx`, `tests/ui/rsvp-screen-layout.test.ts`
- Impact area: readability and maintainability of layout code.

## Acceptance Criteria

- [ ] No-op abstraction removed or made behaviorally meaningful.
- [ ] Tests validate observable layout behavior, not constant-return helpers.

## Work Log

- 2026-03-05: Created from multi-agent review synthesis.

## Resources

- Review context: `compound-engineering.local.md`
