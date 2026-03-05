---
status: pending
priority: p3
issue_id: 007
tags: [code-review, performance, engine]
dependencies: []
---

# Problem Statement

Paragraph jump operations scan the full word array on each invocation, which may become sluggish for very large documents.

## Findings

- `jumpToNextParagraph` uses `Array.find` from the current reader word list.
- `jumpToPreviousParagraph` repeatedly computes paragraph starts with linear search.
- Evidence: `src/engine/reader.ts:78`, `src/engine/reader.ts:92`.

## Proposed Solutions

### Option 1: Precompute paragraph start indexes in reader state
Pros: O(1)/O(log n) jumps; predictable responsiveness.  
Cons: Slightly more state setup logic.  
Effort: Medium  
Risk: Low

### Option 2: Keep linear search with micro-optimizations only
Pros: Minimal code change.  
Cons: Scaling issue remains.  
Effort: Small  
Risk: Medium

### Option 3: Defer as non-MVP optimization
Pros: Zero immediate scope increase.  
Cons: Large-text UX may degrade under load.  
Effort: Small  
Risk: Medium

## Recommended Action

Option 3 unless profiling shows user-facing lag.

## Technical Details

- Target module: `src/engine/reader.ts`

## Acceptance Criteria

- [ ] If optimized, paragraph jumps remain behaviorally identical.
- [ ] Tests cover large paragraph counts.

## Work Log

- 2026-03-05: Created from performance-oracle finding.

## Resources

- Engine tests: `tests/engine/reader.test.ts`
