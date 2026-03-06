---
status: pending
priority: p3
issue_id: 038
tags: [code-review, agent-native, parity, architecture]
dependencies: []
---

# Problem Statement

Summary source label formatting diverges between CLI and agent flows, introducing avoidable metadata inconsistency.

## Findings

- Agent summary label appends mode suffix for non-RSVP (`[chunked]`/`[bionic]`) (`src/agent/reader-api.ts:108`).
- CLI summary flow label remains mode-agnostic (`source (summary:preset)` pattern in summarize flow path).
- Structured mode already exists in agent state (`readingMode`), making label-level mode encoding redundant.

## Proposed Solutions

### Option 1: Share one summary label formatter across CLI and agent (Recommended)
Pros: Strong parity, fewer formatting drifts.  
Cons: Small refactor in summary metadata paths.
Effort: Small  
Risk: Low

### Option 2: Keep divergence but document explicitly
Pros: No behavior change.  
Cons: Ongoing inconsistency cost for consumers.
Effort: Small  
Risk: Medium

### Option 3: Encode mode only in structured state, never in labels
Pros: Clean metadata boundaries.  
Cons: Potential compatibility impact for existing consumers reading label text.
Effort: Medium  
Risk: Medium

## Recommended Action

Unify summary label policy and keep mode identity in structured fields wherever possible.

## Technical Details

- Affected: `src/agent/reader-api.ts`, CLI summarize label path, parity tests.

## Acceptance Criteria

- [ ] CLI and agent summary labels follow the same formatting policy.
- [ ] Mode identity remains available through structured `readingMode` state.
- [ ] Tests cover parity for summary metadata across surfaces.

## Work Log

- 2026-03-06: Created from agent-native and code-simplicity synthesis.

## Resources

- Branch under review: `feat/bionic-mode-phase3-sub12`
