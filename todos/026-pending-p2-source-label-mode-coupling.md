---
status: complete
priority: p2
issue_id: 026
tags: [code-review, architecture, quality, ui]
dependencies: []
---

# Problem Statement

UI mode behavior is inferred from formatted `sourceLabel` text (`[chunked]`) instead of explicit mode state, coupling presentation text to control logic.

## Findings

- CLI appends `[chunked]` to `sourceLabel` (`src/cli/index.tsx:260`).
- UI detects chunked mode by string search (`src/ui/screens/RSVPScreen.tsx:55`).
- This is brittle for localization/format changes and cross-surface parity.

## Proposed Solutions

### Option 1: Pass explicit `mode` prop to `App/RSVPScreen` (Recommended)
Pros: Clear state contract; removes hidden coupling.  
Cons: Requires touch points across props/tests.
Effort: Small  
Risk: Low

### Option 2: Add structured metadata object and keep sourceLabel display-only
Pros: Extensible for future modes and status displays.  
Cons: Slightly broader refactor.
Effort: Medium  
Risk: Medium

### Option 3: Keep string marker contract
Pros: No immediate changes.  
Cons: Fragile and hard to maintain.
Effort: Small  
Risk: Medium

## Recommended Action


## Technical Details

- Affected: `src/cli/index.tsx`, `src/ui/App.tsx`, `src/ui/screens/RSVPScreen.tsx`, related UI tests.

## Acceptance Criteria

- [ ] Mode-dependent UI behavior uses explicit typed mode input.
- [ ] `sourceLabel` is treated as display-only text.
- [ ] Existing chunked label and start-state tests remain green.

## Work Log

- 2026-03-05: Created from multi-agent review synthesis.
- 2026-03-05: Fixed by passing explicit `mode` through `App -> RSVPScreen` and removing mode detection from `sourceLabel` content checks.

## Resources

- Architectural context from code-simplicity + agent-native reviews.
