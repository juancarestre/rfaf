---
status: pending
priority: p3
issue_id: 024
tags: [code-review, simplicity, architecture, cli]
dependencies: []
---

# Problem Statement

Summary flow currently carries extra state/indirection that can be simplified for maintainability without changing behavior.

## Findings

- `src/cli/summary-option.ts` uses `enabled + preset` where `preset | null` may be sufficient.
- `src/llm/summarize.ts` has detailed stage classification heuristics that may exceed current UX needs.
- `src/cli/summarize-flow.ts` injects multiple seams (`env`, `loadConfig`, `summarize`, `createLoading`) for testability, increasing API surface.

## Proposed Solutions

### Option 1: Simplify summary option shape and narrow flow API
Pros: Reduced cognitive load and fewer branches.  
Cons: Requires test updates and small refactor.  
Effort: Small  
Risk: Low

### Option 2: Keep structure but add clearer docs/types for intent
Pros: Minimal behavior risk.  
Cons: Complexity remains.  
Effort: Small  
Risk: Low

### Option 3: Keep as-is
Pros: No work.  
Cons: Ongoing maintenance overhead.  
Effort: Small  
Risk: Low

## Recommended Action


## Technical Details

- Affected: `src/cli/summary-option.ts`, `src/cli/summarize-flow.ts`, `src/llm/summarize.ts`, test files.
- Impact: maintainability and future feature extension cost.

## Acceptance Criteria

- [ ] Summary option representation is minimal and unambiguous.
- [ ] Summarize-flow API exposes only seams needed by current tests.
- [ ] Error-stage complexity aligns with actual branching needs.

## Work Log

- 2026-03-05: Created from multi-agent review synthesis.

## Resources

- Simplicity review evidence from branch analysis.
