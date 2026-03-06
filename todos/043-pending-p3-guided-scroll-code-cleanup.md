---
status: pending
priority: p3
issue_id: 043
tags: [code-review, cleanup, maintainability, tests]
dependencies: []
---

# Problem Statement

Guided scroll includes minor dead code and misleading test naming that can create maintenance drag and false confidence.

## Findings

- Unused imports in `GuidedScrollScreen` (`getLineDwellTime`, `stepForward`) were flagged by reviewers and indicate implementation drift.
- `src/processor/scroll-line-pacer.ts` currently has limited production wiring and may be effectively test-only.
- `tests/ui/guided-scroll-controls.test.tsx:42` test title implies help-overlay behavior while asserting initial start-state text.

## Proposed Solutions

### Option 1: Remove unused imports and correct test naming (Recommended)
Pros: Immediate clarity with no behavior change.  
Cons: Does not address deeper architecture decisions.
Effort: Small  
Risk: Low

### Option 2: Fully wire `scroll-line-pacer` into runtime or remove module
Pros: Eliminates ambiguity about intended pacing architecture.  
Cons: Could trigger broader behavioral changes.
Effort: Medium  
Risk: Medium

### Option 3: Keep as-is and document intent
Pros: Zero code churn.  
Cons: Ongoing confusion and potential drift.
Effort: Small  
Risk: Medium

## Recommended Action

Execute Option 1 immediately; decide Option 2 as part of pacing follow-up.

## Technical Details

- Affected: `src/ui/screens/GuidedScrollScreen.tsx`, `src/processor/scroll-line-pacer.ts`, `tests/ui/guided-scroll-controls.test.tsx`.

## Acceptance Criteria

- [ ] No unused imports/identifiers in guided scroll source files.
- [ ] Test names accurately describe asserted behavior.
- [ ] Pacing helper intent (runtime-used vs test-only) is explicit.

## Work Log

- 2026-03-06: Created from code-simplicity and TS reviewer synthesis.

## Resources

- Branch under review: `feat/guided-scroll-mode`
