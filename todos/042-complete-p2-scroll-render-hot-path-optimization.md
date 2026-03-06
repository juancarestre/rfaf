---
status: complete
priority: p2
issue_id: 042
tags: [code-review, performance, ui, scaling]
dependencies: []
---

# Problem Statement

Guided scroll updates per word tick and rebuilds visible line text each render. On large corpora/high WPM this can create avoidable CPU overhead and UI jank.

## Findings

- Playback timer advances per word (`src/ui/screens/GuidedScrollScreen.tsx:215`) even though visible progression is line-centric.
- Visible line text is rebuilt and sanitized each render (`src/ui/screens/GuidedScrollScreen.tsx:329`, `src/ui/screens/GuidedScrollScreen.tsx:105`).
- Resize recomputes full line map in O(n) over all words (`src/ui/screens/GuidedScrollScreen.tsx:193`, `src/processor/line-computation.ts:40`).

## Proposed Solutions

### Option 1: Memoize sanitized words and precomputed line text by line map (Recommended)
Pros: Keeps behavior unchanged; reduces per-render repeated work.  
Cons: Slightly more memory usage.
Effort: Small  
Risk: Low

### Option 2: Update state only when current line changes
Pros: Larger render reduction at high WPM.  
Cons: Requires careful session/progress synchronization.
Effort: Medium  
Risk: Medium

### Option 3: Move to line-level scheduler
Pros: Aligns timer with scroll semantics and lowers event frequency.  
Cons: Larger behavior change and more edge cases.
Effort: Large  
Risk: Medium

## Recommended Action

Implement Option 1 now; evaluate Option 2 after profiling with large fixtures.

## Technical Details

- Affected: `src/ui/screens/GuidedScrollScreen.tsx`, potentially `src/processor/scroll-line-pacer.ts` usage and performance tests.

## Acceptance Criteria

- [x] Guided scroll precomputes sanitized words and per-line text instead of rebuilding visible line strings every render.
- [x] No behavior regressions in stepping/progress/remaining time.
- [x] Resize and high-WPM interactions remain smooth under automated test coverage.

## Work Log

- 2026-03-06: Created from performance-oracle and security-sentinel scalability findings.
- 2026-03-06: Resolved by memoizing sanitized words and precomputing line text from the line map to reduce per-tick work.

## Resources

- Branch under review: `feat/guided-scroll-mode`
