---
status: pending
priority: p3
issue_id: 006
tags: [code-review, quality, maintainability]
dependencies: []
---

# Problem Statement

Small duplicated helpers/constants increase drift risk and maintenance overhead.

## Findings

- `countWords` duplicated in `src/ingest/plaintext.ts` and `src/ingest/stdin.ts`.
- WPM bounds duplicated between CLI validation and engine behavior.

## Proposed Solutions

### Option 1: Extract shared constants/helpers module
Pros: Single source of truth; easy future edits.  
Cons: Adds one utility file.  
Effort: Small  
Risk: Low

### Option 2: Keep duplication but add explicit tests for consistency
Pros: Minimal code movement.  
Cons: Duplication remains.  
Effort: Small  
Risk: Low

### Option 3: Remove `wordCount` from ingest `Document`
Pros: Avoids duplicate computation entirely.  
Cons: API change may affect future features.  
Effort: Medium  
Risk: Medium

## Recommended Action

Option 1.

## Technical Details

- Candidates: `src/shared/constants.ts`, `src/ingest/utils.ts`

## Acceptance Criteria

- [ ] WPM bounds are defined once and reused.
- [ ] Word-count logic is implemented once.
- [ ] No behavior changes in existing tests.

## Work Log

- 2026-03-05: Created from simplicity/performance synthesis.

## Resources

- Known Pattern: consistency with deterministic CLI behavior in `docs/institutional-learnings-analysis.md`.
