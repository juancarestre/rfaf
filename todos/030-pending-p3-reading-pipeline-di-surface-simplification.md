---
status: pending
priority: p3
issue_id: 030
tags: [code-review, simplicity, architecture, testing]
dependencies: []
---

# Problem Statement

`buildReadingPipeline` exposes a relatively wide dependency-injection surface that may add complexity beyond current production needs.

## Findings

- `ReadingPipelineDeps` includes multiple injectable functions (`src/cli/reading-pipeline.ts:14`).
- This improves unit test isolation but increases API surface and cognitive load for a small feature path.

## Proposed Solutions

### Option 1: Keep only one injectable seam (summarize) and inline others (Recommended)
Pros: Preserves testability where needed with simpler API.  
Cons: Some tests may need adjustment.
Effort: Small  
Risk: Low

### Option 2: Keep current DI surface with explicit documentation
Pros: Minimal code churn.  
Cons: Ongoing complexity overhead.
Effort: Small  
Risk: Low

### Option 3: Remove DI and test via integration only
Pros: Simplest runtime code.  
Cons: Slower tests and less isolated unit coverage.
Effort: Medium  
Risk: Medium

## Recommended Action


## Technical Details

- Affected: `src/cli/reading-pipeline.ts`, associated unit tests.

## Acceptance Criteria

- [ ] Reading pipeline API surface is minimal and intentional.
- [ ] Tests remain clear and deterministic after simplification.

## Work Log

- 2026-03-05: Created from multi-agent review synthesis.

## Resources

- Code simplicity review findings.
