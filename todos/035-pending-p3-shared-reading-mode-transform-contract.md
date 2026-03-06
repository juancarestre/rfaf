---
status: completed
priority: p3
issue_id: 035
tags: [code-review, architecture, quality, maintainability]
dependencies: []
---

# Problem Statement

Mode transformation behavior is implemented in multiple places (CLI and agent), increasing drift risk as new modes are added.

## Findings

- CLI pipeline branches mode transforms locally (`src/cli/reading-pipeline.ts:64`).
- Agent runtime has a separate transform function with duplicated mode branching (`src/agent/reader-api.ts:90`).
- Both paths currently align, but duplicated branch logic increases maintenance burden.

## Proposed Solutions

### Option 1: Extract shared mode-transform module (Recommended)
Pros: Single source of truth; easier parity guarantees across interfaces.  
Cons: Small refactor touching both code paths.
Effort: Small  
Risk: Low

### Option 2: Keep duplication but enforce exhaustive switch in each path
Pros: Reduced accidental fallback risk with minimal movement.  
Cons: Still duplicated behavior logic.
Effort: Small  
Risk: Low

### Option 3: Keep current structure
Pros: No code churn.  
Cons: Higher chance of mode drift in future subphases.
Effort: Small  
Risk: Medium

## Recommended Action

Centralize mode transform routing in a shared helper and use exhaustive switch semantics.

## Technical Details

- Affected: `src/cli/reading-pipeline.ts`, `src/agent/reader-api.ts`, related tests.

## Acceptance Criteria

- [ ] Mode transform routing lives in one shared module.
- [ ] Unsupported future modes fail at compile-time (exhaustive switch).
- [ ] CLI and agent mode outputs remain behaviorally aligned.

## Work Log

- 2026-03-06: Created from code-simplicity and TypeScript review synthesis.
- 2026-03-06: Extracted shared mode transform routing into `src/processor/mode-transform.ts` and updated CLI + agent consumers.

## Resources

- Branch under review: `feat/bionic-mode-phase3-sub12`
