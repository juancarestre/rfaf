---
status: complete
priority: p2
issue_id: 013
tags: [code-review, performance, ink, ui]
dependencies: []
---

# Problem Statement

WordDisplay creates padding rows as new React nodes on each render tick, adding avoidable churn in the RSVP hot loop.

## Findings

- `src/ui/components/WordDisplay.tsx:87` and `src/ui/components/WordDisplay.tsx:99` generate arrays and blank `<Text>` nodes each render.
- Cost increases for `large` preset (`4 + 4` padding lines) and high WPM updates.

## Proposed Solutions

### Option 1: Use container layout padding/margin props instead of blank rows
Pros: Reduces node churn and simplifies rendering tree.  
Cons: Requires verifying visual equivalence in Ink.  
Effort: Small  
Risk: Low

### Option 2: Memoize reusable padding fragments by line count
Pros: Keeps exact visual output while reducing per-frame allocations.  
Cons: Slightly more component complexity.  
Effort: Small  
Risk: Low

### Option 3: Keep current behavior and monitor only
Pros: No immediate code change.  
Cons: Leaves known hot-path allocation inefficiency.  
Effort: Small  
Risk: Medium

## Recommended Action


## Technical Details

- Affected: `src/ui/components/WordDisplay.tsx`
- Impact area: long-session smoothness and GC frequency.

## Acceptance Criteria

- [ ] Padding implementation no longer allocates new blank-node arrays each tick.
- [ ] Visual spacing remains equivalent for small/normal/large presets.
- [ ] `bun test` remains green.

## Work Log

- 2026-03-05: Created from multi-agent review synthesis.
- 2026-03-05: Fixed by replacing per-render blank padding rows with `Box` top/bottom padding props in `WordDisplay`.

## Resources

- Review context: `compound-engineering.local.md`
