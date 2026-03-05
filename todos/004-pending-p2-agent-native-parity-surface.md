---
status: complete
priority: p2
issue_id: 004
tags: [code-review, agent-native, architecture]
dependencies: []
---

# Problem Statement

Core user actions are only accessible via interactive key events, with no agent/tool API surface.

## Findings

- Actions are wired in `useInput` only (`src/ui/screens/RSVPScreen.tsx:145`).
- No structured command/state API layer exists in `src/`.
- Non-interactive context throws in CLI when no interactive input stream is available (`src/cli/index.tsx:165`).

## Proposed Solutions

### Option 1: Expose engine commands as programmatic tool functions
Pros: Enables agent parity with low runtime overhead.  
Cons: Requires stable command/state contract design.  
Effort: Medium  
Risk: Low

### Option 2: Add JSON control mode (`--json` / command stdin protocol)
Pros: Great automation ergonomics.  
Cons: Adds product surface to support/maintain.  
Effort: Medium  
Risk: Medium

### Option 3: Keep MVP human-only; defer parity
Pros: No immediate implementation cost.  
Cons: Leaves parity gap for workflow automation.  
Effort: Small  
Risk: Medium

## Recommended Action

Option 1 for near-term parity.

## Technical Details

- Reuse existing engine primitives in `src/engine/reader.ts`.
- Add a thin API layer for actions and state retrieval.

## Acceptance Criteria

- [ ] Agent-accessible APIs exist for play/pause/step/jump/wpm/restart/state.
- [ ] Functionality matches current keybinding behavior.
- [ ] Documentation describes parity interface.

## Work Log

- 2026-03-05: Created from agent-native-reviewer findings.
- 2026-03-05: Implemented `src/agent/reader-api.ts` with command execution and structured state snapshot APIs.
- 2026-03-05: Added `tests/agent/reader-api.test.ts` covering play/pause, stepping, paragraph jumps, restart, and WPM control.

## Resources

- Review target: current branch (no PR remote configured).
