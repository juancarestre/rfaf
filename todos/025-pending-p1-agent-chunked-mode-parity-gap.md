---
status: complete
priority: p1
issue_id: 025
tags: [code-review, agent-native, parity, architecture]
dependencies: []
---

# Problem Statement

Chunked mode is available to CLI users but not to the agent API surface, creating a first-class parity break for a user-visible capability.

## Findings

- CLI exposes mode selection and chunked path (`src/cli/index.tsx:188`, `src/cli/reading-pipeline.ts:61`).
- Agent API has no mode command/config for chunked operation (`src/agent/reader-api.ts:47`).
- Agent summarize path tokenizes summary but does not support summarize+chunked transform parity (`src/agent/reader-api.ts:147`).
- No agent tests cover chunked mode behavior (`tests/agent/reader-api.test.ts`).

## Proposed Solutions

### Option 1: Add explicit agent mode contract (Recommended)
Pros: Restores parity cleanly and predictably; aligns with agent-native expectations.  
Cons: Requires extending agent command/state/test matrix.  
Effort: Medium  
Risk: Medium

### Option 2: Add summarize+chunked only at initialization
Pros: Smaller API expansion than full runtime mode command.  
Cons: Partial parity only; less flexible automation.
Effort: Medium  
Risk: Medium

### Option 3: Document deferred parity
Pros: No immediate code churn.  
Cons: Leaves a known P1 parity break.
Effort: Small  
Risk: High

## Recommended Action


## Technical Details

- Affected: `src/agent/reader-api.ts`, `tests/agent/reader-api.test.ts`, chunked pipeline integration points.

## Acceptance Criteria

- [ ] Agent API can select `rsvp|chunked` mode.
- [ ] Agent summarize flow supports summarize+chunked ordering semantics.
- [ ] Agent state exposes active mode and chunked-summary context as needed.
- [ ] Agent tests cover chunked mode and summarize+chunked behavior.

## Work Log

- 2026-03-05: Created from multi-agent review synthesis.
- 2026-03-05: Fixed by adding `readingMode` to agent runtime/state, adding `set_reading_mode` command, and extending `executeAgentSummarizeCommand` with chunked-mode parity (`readingMode` override + chunk transform). Added agent tests for mode switching and summarize+chunked parity.

## Resources

- Known pattern: `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
