---
status: complete
priority: p2
issue_id: 033
tags: [code-review, performance, agent-native, scalability]
dependencies: []
---

# Problem Statement

Agent mode switching recomputes full transformed word arrays on every mode change, causing avoidable stalls for large documents.

## Findings

- `set_reading_mode` recalculates transformed words from `runtime.sourceWords` on every switch (`src/agent/reader-api.ts:242`).
- `bionic` transform is O(n) across all words (`src/processor/bionic.ts:65`), so repeated toggles scale linearly with corpus size.
- No cache is retained for already transformed modes in runtime state.

## Proposed Solutions

### Option 1: Cache transformed arrays by mode in runtime (Recommended)
Pros: Large latency reduction for repeated mode toggles; simple invalidation on source change.  
Cons: Slight runtime state expansion.
Effort: Medium  
Risk: Low

### Option 2: Incremental index-only remap without full transform cache
Pros: Lower memory than full cache.  
Cons: More complex bookkeeping and likely mode-specific logic branches.
Effort: Medium  
Risk: Medium

### Option 3: Keep recomputation behavior
Pros: Minimal code complexity.  
Cons: Avoidable UI stalls at scale.
Effort: Small  
Risk: Medium

## Recommended Action

Introduce lazy per-mode transform caching in agent runtime, invalidated when `sourceWords` changes (e.g., post-summarize).

## Technical Details

- Affected: `src/agent/reader-api.ts`, possibly shared transform helpers.

## Acceptance Criteria

- [x] Repeated `set_reading_mode` calls do not recompute already cached transforms.
- [x] Cache invalidates correctly when source corpus changes.
- [x] Reader index mapping remains stable across mode toggles.
- [x] Tests verify cache hit behavior and correctness.

## Work Log

- 2026-03-06: Created from performance-oracle findings.
- 2026-03-06: Resolved by introducing `modeWordCache` in agent runtime with lazy cache hits for mode transforms and summarize-triggered cache reset; added cache reuse/invalidation tests.

## Resources

- Branch under review: `feat/bionic-mode-phase3-sub12`
