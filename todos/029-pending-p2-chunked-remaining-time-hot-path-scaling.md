---
status: complete
priority: p2
issue_id: 029
tags: [code-review, performance, ui, scalability]
dependencies: []
---

# Problem Statement

Chunked remaining-time estimation currently scans all remaining entries each render, which can create avoidable CPU overhead and pacing jitter on long documents/high WPM.

## Findings

- Remaining-time computation performs `slice + some + reduce` in render path (`src/ui/screens/RSVPScreen.tsx:64`, `src/ui/screens/RSVPScreen.tsx:77`, `src/ui/screens/RSVPScreen.tsx:266`).
- In chunked mode, `getDisplayTime` recursively sums source words (`src/processor/pacer.ts:34`), compounding per-render work.

## Proposed Solutions

### Option 1: Precompute suffix remaining-duration by index (Recommended)
Pros: Reduces render-time lookup to O(1).  
Cons: Requires memoization invalidation when WPM changes.
Effort: Medium  
Risk: Low

### Option 2: Incremental accumulator updated on index advances
Pros: Very cheap steady-state updates.  
Cons: More state bookkeeping complexity.
Effort: Medium  
Risk: Medium

### Option 3: Keep current linear scan
Pros: Simple implementation.  
Cons: Scales poorly with long content.
Effort: Small  
Risk: Medium

## Recommended Action


## Technical Details

- Affected: `src/ui/screens/RSVPScreen.tsx`, `src/processor/pacer.ts`.

## Acceptance Criteria

- [ ] Remaining-time lookup in render path is O(1) for chunked mode.
- [ ] Values remain accurate when `currentIndex` and `currentWpm` change.
- [ ] Full test suite remains green; add performance-focused regression assertion where practical.

## Work Log

- 2026-03-05: Created from multi-agent review synthesis.
- 2026-03-05: Fixed by replacing per-render linear remaining-time scans with memoized suffix lookup (`buildRemainingSecondsLookup`) and O(1) index lookup during render. Added remaining-time tests for RSVP and chunked semantics.

## Resources

- Performance review findings from `performance-oracle`.
