---
status: complete
priority: p2
issue_id: "100"
tags: [code-review, performance, ui, processor]
dependencies: []
---

# Optimize Key-Phrase Matching And Scroll Rendering

Reduce CPU/memory churn introduced by key-phrase matching and guided scroll line recomputation.

## Problem Statement

Current matching and render paths are correct but may regress responsiveness on very large texts or high-WPM sessions.

## Findings

- `src/processor/key-phrase-annotation.ts:74` scans all phrase patterns at each token position (worst-case O(W*P*T)).
- `src/ui/screens/GuidedScrollScreen.tsx:333` rebuilds visible line strings during playback ticks.
- `src/processor/key-phrase-annotation.ts:98` allocates new objects for matched paths and can increase GC churn on large corpora.

## Proposed Solutions

### Option 1: First-Token Index + Line Text Cache

**Approach:** Index phrase patterns by first token and separate line-text caching from current-line highlight state.

**Pros:**
- Significant reduction in repeated comparisons
- Lower churn during continuous scroll rendering

**Cons:**
- Additional implementation complexity

**Effort:** 4-6 hours

**Risk:** Medium

---

### Option 2: Incremental Optimization Only

**Approach:** Keep current algorithm, but add cheap micro-optimizations and benchmark guardrails.

**Pros:**
- Lower implementation risk
- Faster to ship

**Cons:**
- May not be enough at high scale

**Effort:** 2-3 hours

**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/processor/key-phrase-annotation.ts`
- `src/ui/screens/GuidedScrollScreen.tsx`
- `tests/processor/key-phrase-annotation.test.ts`
- `tests/ui/guided-scroll-screen-layout.test.tsx`

**Related components:**
- Reading pipeline annotation stage
- Guided scroll playback loop

**Database changes:**
- No

## Resources

- `docs/solutions/ui-bugs/line-break-and-highlight-drift-guided-scroll-20260306.md`

## Acceptance Criteria

- [ ] Matching complexity reduced or bounded with measurable benchmark improvement
- [ ] Guided scroll no longer rebuilds full visible text unnecessarily on each tick
- [ ] Existing visual/behavioral tests remain green

## Work Log

### 2026-03-10 - Code Review Discovery

**By:** Claude Code

**Actions:**
- Consolidated performance findings from `performance-oracle`
- Identified two highest-impact hotspots for large documents

**Learnings:**
- Scale issues are mostly CPU/allocation related, not I/O bound.

### 2026-03-10 - Resolution

**By:** Claude Code

**Actions:**
- Added first-token candidate indexing in `src/processor/key-phrase-annotation.ts` to reduce full-pattern scans
- Improved annotation merge behavior with structural sharing and deterministic flag cleanup
- Split guided-scroll line recomputation in `src/ui/screens/GuidedScrollScreen.tsx` into cached visible text + lightweight current-line mapping
- Verified behavior with full processor/UI/CLI regression suites

**Learnings:**
- Caching text construction separately from highlight state reduces per-tick render churn.

## Notes

- Keep optimization work behind behavioral regression tests.
