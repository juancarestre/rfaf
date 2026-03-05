---
status: pending
priority: p3
issue_id: 016
tags: [code-review, simplicity, tests, typescript]
dependencies: []
---

# Problem Statement

Text-scale config currently duplicates preset identity inside each config object, and tests spend effort asserting that duplicate identity rather than behavior.

## Findings

- `src/ui/text-scale.ts:4` includes `preset` in `TextScaleConfig` even though keys are already `small|normal|large`.
- `tests/ui/text-scale.test.ts:12` asserts identity field equality for each entry.

## Proposed Solutions

### Option 1: Remove `preset` from config shape and update tests to behavior fields
Pros: Cleaner data model and more meaningful tests.  
Cons: Minor refactor in callers/tests.  
Effort: Small  
Risk: Low

### Option 2: Keep `preset` but enforce via factory function
Pros: Preserves explicit self-describing objects.  
Cons: More boilerplate for little benefit.  
Effort: Small  
Risk: Medium

### Option 3: Keep current shape and deprioritize cleanup
Pros: No churn.  
Cons: Ongoing minor duplication and weaker test value.  
Effort: Small  
Risk: Low

## Recommended Action


## Technical Details

- Affected: `src/ui/text-scale.ts`, `tests/ui/text-scale.test.ts`
- Impact area: config clarity, test signal quality.

## Acceptance Criteria

- [ ] Config shape avoids redundant preset identity field.
- [ ] Tests focus on rendering-impacting behavior, not duplicate data identity.

## Work Log

- 2026-03-05: Created from multi-agent review synthesis.

## Resources

- Review context: `compound-engineering.local.md`
