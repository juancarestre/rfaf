---
status: pending
priority: p3
issue_id: 005
tags: [code-review, quality, simplicity, engine]
dependencies: []
---

# Problem Statement

Reader engine contains parallel state-management abstractions that increase maintenance complexity without clear runtime value.

## Findings

- Reducer-style API and direct transition functions coexist in `src/engine/reader.ts`.
- Unused per-instance bounds fields (`minWpm`, `maxWpm`) are stored in state.

## Proposed Solutions

### Option 1: Keep direct function API only
Pros: Simplest mental model; less drift risk.  
Cons: Removes alternative reducer entrypoint.  
Effort: Small  
Risk: Low

### Option 2: Keep reducer only and route all transitions through it
Pros: Single formal state-transition interface.  
Cons: More boilerplate for simple call sites.  
Effort: Medium  
Risk: Low

### Option 3: Keep both but add strict usage boundaries
Pros: Minimal immediate changes.  
Cons: Ongoing complexity remains.  
Effort: Small  
Risk: Medium

## Recommended Action

Option 1.

## Technical Details

- Affected: `src/engine/reader.ts`
- Preserve external behavior and tests.

## Acceptance Criteria

- [ ] One canonical state-transition interface remains.
- [ ] Unused fields are removed from runtime state.
- [ ] Existing engine tests remain green.

## Work Log

- 2026-03-05: Created from code-simplicity-reviewer findings.

## Resources

- Related tests: `tests/engine/reader.test.ts`
