---
status: complete
priority: p2
issue_id: 040
tags: [code-review, agent-native, parity, architecture]
dependencies: []
---

# Problem Statement

Guided scroll UI steps by line (`h/l`), but agent `step_next` / `step_prev` still step by word. This creates behavior divergence for the same mode across user and agent surfaces.

## Findings

- UI scroll stepping is line-based via `stepForwardByLine` and `stepBackwardByLine` (`src/ui/screens/GuidedScrollScreen.tsx:116`, `src/ui/screens/GuidedScrollScreen.tsx:137`, `src/ui/screens/GuidedScrollScreen.tsx:273`).
- Agent commands `step_next` / `step_prev` call word-level reader steps (`src/agent/reader-api.ts:276`, `src/agent/reader-api.ts:279`).
- Plan/contract emphasizes strong control parity across surfaces for guided scroll mode.

## Proposed Solutions

### Option 1: Add mode-aware line-step behavior for agent commands in scroll mode (Recommended)
Pros: True parity with UI semantics; consistent automation behavior.  
Cons: Requires line-map utility wiring in agent runtime.
Effort: Medium  
Risk: Medium

### Option 2: Add dedicated agent commands `step_next_line` / `step_prev_line`
Pros: Explicit API semantics; avoids changing existing command meaning.  
Cons: Expands command surface and requires orchestration changes.
Effort: Medium  
Risk: Low

### Option 3: Keep divergence and document it
Pros: No code change.  
Cons: Ongoing parity mismatch.
Effort: Small  
Risk: Medium

## Recommended Action

Implement Option 1 or 2 in the same parity cycle; avoid silent divergence.

## Technical Details

- Affected: `src/agent/reader-api.ts`, potential shared line-map helper usage, agent parity tests.

## Acceptance Criteria

- [x] Agent stepping semantics for `scroll` are defined and tested.
- [x] CLI/UI/agent documentation reflects identical or explicitly differentiated behavior.
- [x] Agent parity tests cover stepping under `readingMode: "scroll"`.

## Work Log

- 2026-03-06: Created from agent-native reviewer findings.
- 2026-03-06: Resolved by adding explicit `step_next_line` / `step_prev_line` agent commands and scroll parity tests.

## Resources

- Branch under review: `feat/guided-scroll-mode`
- Related learnings: `docs/solutions/logic-errors/20260305-chunked-mode-behavior-parity-hardening-fixes.md`
