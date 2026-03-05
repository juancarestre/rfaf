---
status: complete
priority: p2
issue_id: 011
tags: [code-review, agent-native, api, parity]
dependencies: []
---

# Problem Statement

Text-scale is now a user-facing capability in CLI/UI, but agent interfaces do not expose equivalent control or state visibility.

## Findings

- New capability introduced in CLI/UI: `src/cli/index.tsx:117`, `src/ui/text-scale.ts:3`, `src/ui/screens/RSVPScreen.tsx:105`.
- Agent API surface was not extended in this branch (no text-scale command/state in `src/agent/reader-api.ts`).
- No agent tests were added for text-scale parity.

## Proposed Solutions

### Option 1: Add `textScale` to agent runtime initialization and state output
Pros: Minimal parity for configuration and observability.  
Cons: Does not support runtime changes unless command is also added.  
Effort: Medium  
Risk: Low

### Option 2: Add a `set_text_scale` agent command plus `textScale` in state
Pros: Full parity with user controls and inspection.  
Cons: Slightly larger API update and tests required.  
Effort: Medium  
Risk: Medium

### Option 3: Document intentional parity exception for UI-only concern
Pros: No API churn.  
Cons: Violates agent-native parity principle and may surprise integrators.  
Effort: Small  
Risk: High

## Recommended Action


## Technical Details

- Affected: `src/agent/reader-api.ts`, `tests/agent/*`.
- Impact area: agent feature parity and automation UX.

## Acceptance Criteria

- [ ] Agent runtime can set or receive effective `textScale`.
- [ ] Agent state returns active `textScale` value.
- [ ] Agent tests cover text-scale command/init and state reflection.

## Work Log

- 2026-03-05: Created from multi-agent review synthesis.
- 2026-03-05: Fixed by adding `textScale` to agent runtime/state, introducing `set_text_scale` command, and extending agent API tests for init/state/command parity.

## Resources

- Review context: `compound-engineering.local.md`
