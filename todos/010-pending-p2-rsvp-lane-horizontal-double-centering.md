---
status: complete
priority: p2
issue_id: 010
tags: [code-review, ui, readability, ink]
dependencies: []
---

# Problem Statement

The RSVP lane now applies centering both in parent layout and in word-level padding, which can shift the pivot right and reduce readability on narrow terminals.

## Findings

- `src/ui/screens/RSVPScreen.tsx:271` sets `alignItems` from `getReadingLaneLayout(...)` to `center`.
- `src/ui/screens/RSVPScreen.tsx:282` still computes `pivotColumn` from half the terminal width.
- `src/ui/components/WordDisplay.tsx:64` adds left padding to place the pivot column.
- Combined offsets can effectively double horizontal centering intent.

## Proposed Solutions

### Option 1: Keep vertical centering, revert lane horizontal alignment to `flex-start`
Pros: Preserves existing pivot math and fixes drift risk.  
Cons: Slightly less visually centered container framing.  
Effort: Small  
Risk: Low

### Option 2: Keep `alignItems="center"` and refactor pivot math to local lane width
Pros: Unified container-centered model.  
Cons: Larger refactor and more edge-case math.  
Effort: Medium  
Risk: Medium

### Option 3: Add explicit layout mode for centering strategy and test both paths
Pros: Clear future extension point.  
Cons: More abstraction for MVP scope.  
Effort: Medium  
Risk: Medium

## Recommended Action


## Technical Details

- Affected: `src/ui/screens/RSVPScreen.tsx`, `src/ui/components/WordDisplay.tsx`
- Impact area: terminal readability, clipping behavior.

## Acceptance Criteria

- [ ] Pivot stays at intended visual center across typical widths (80/100/120 columns).
- [ ] Large words do not appear shifted right compared to previous baseline.
- [ ] Narrow-terminal guard behavior remains unchanged.

## Work Log

- 2026-03-05: Created from multi-agent review synthesis.
- 2026-03-05: Fixed by keeping vertical centering (`justifyContent: center`) while restoring horizontal lane alignment to `flex-start`; added regression test coverage for layout contract.

## Resources

- Review context: `compound-engineering.local.md`
