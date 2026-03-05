---
status: pending
priority: p3
issue_id: 008
tags: [code-review, cli, behavior]
dependencies: []
---

# Problem Statement

CLI currently exits `0` for no-input/empty-stdin help paths, which may be ambiguous for automation scripts.

## Findings

- `source.kind === "none"` shows help and exits 0 (`src/cli/index.tsx:129`).
- Empty stdin also shows help and exits 0 (`src/cli/index.tsx:144`).

## Proposed Solutions

### Option 1: Keep current behavior
Pros: Matches current plan acceptance and UX expectation for help path.  
Cons: Harder for scripts to distinguish success vs missing input.
Effort: Small  
Risk: Low

### Option 2: Exit with usage code (2) for missing/empty input
Pros: Better automation semantics.  
Cons: Changes documented behavior and may break existing users.
Effort: Small  
Risk: Medium

### Option 3: Add explicit `--strict-exit-codes` mode
Pros: Backward compatible while supporting automation.  
Cons: Adds option surface for a niche case.
Effort: Medium  
Risk: Low

## Recommended Action

Option 1 for MVP; revisit if automation use case grows.

## Technical Details

- Relevant file: `src/cli/index.tsx`
- Keep aligned with plan acceptance criteria unless intentionally revised.

## Acceptance Criteria

- [ ] Exit code contract is explicitly documented in README/plan.
- [ ] Behavior is covered by tests.

## Work Log

- 2026-03-05: Created from TypeScript review nuance.

## Resources

- Plan reference: `docs/plans/2026-03-04-feat-rsvp-speed-reading-mvp-plan.md`
