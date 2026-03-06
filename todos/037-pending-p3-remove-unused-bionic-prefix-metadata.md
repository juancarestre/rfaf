---
status: pending
priority: p3
issue_id: 037
tags: [code-review, quality, cleanup, simplicity]
dependencies: []
---

# Problem Statement

`bionicPrefixLength` was added to `Word` but is not consumed by rendering or pacing paths, increasing model surface without current runtime value.

## Findings

- `Word` now includes optional `bionicPrefixLength` (`src/processor/types.ts:26`).
- Bionic transform writes `bionicPrefixLength` (`src/processor/bionic.ts:71`).
- No current read-path depends on this field in UI or pacing code.

## Proposed Solutions

### Option 1: Remove unused field until needed (Recommended)
Pros: Keeps core model minimal; less cognitive overhead.  
Cons: Might be reintroduced in future if render model changes.
Effort: Small  
Risk: Low

### Option 2: Start consuming it in render path now
Pros: Justifies field existence.  
Cons: Expands scope beyond current requirement.
Effort: Medium  
Risk: Medium

### Option 3: Keep as forward-compat metadata
Pros: Future-proofing.
Cons: YAGNI and dead-state risk.
Effort: Small  
Risk: Medium

## Recommended Action

Remove the field for now unless a concrete render contract requires it immediately.

## Technical Details

- Affected: `src/processor/types.ts`, `src/processor/bionic.ts`, tests if they assert field presence.

## Acceptance Criteria

- [ ] `Word` schema contains only actively consumed runtime fields.
- [ ] Bionic behavior remains unchanged from user perspective.
- [ ] Tests pass after cleanup.

## Work Log

- 2026-03-06: Created from code-simplicity review findings.

## Resources

- Branch under review: `feat/bionic-mode-phase3-sub12`
