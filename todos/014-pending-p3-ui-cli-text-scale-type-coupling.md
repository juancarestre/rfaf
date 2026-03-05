---
status: pending
priority: p3
issue_id: 014
tags: [code-review, architecture, typescript]
dependencies: []
---

# Problem Statement

UI configuration types currently depend on a CLI module type, introducing avoidable cross-layer coupling.

## Findings

- `src/ui/text-scale.ts:1` imports `TextScalePreset` from `src/cli/text-scale-option.ts`.
- This inverts expected dependency direction (UI domain depending on CLI parsing layer).

## Proposed Solutions

### Option 1: Move preset type/constants to shared domain module (e.g., `src/domain/text-scale.ts`)
Pros: Clean layering and reusable contract for CLI/UI/agent.  
Cons: Small refactor across imports.  
Effort: Small  
Risk: Low

### Option 2: Define UI-local type and map from CLI parser output
Pros: Isolates layers quickly.  
Cons: Potential type drift between modules.  
Effort: Small  
Risk: Medium

### Option 3: Keep as-is for MVP
Pros: No immediate churn.  
Cons: Carries architectural debt into future features.  
Effort: Small  
Risk: Low

## Recommended Action


## Technical Details

- Affected: `src/ui/text-scale.ts`, `src/cli/text-scale-option.ts`
- Impact area: module boundaries and maintainability.

## Acceptance Criteria

- [ ] Preset type is sourced from a layer-neutral module or explicit boundary.
- [ ] No duplicated preset literals across modules.
- [ ] Existing CLI/UI tests continue to pass.

## Work Log

- 2026-03-05: Created from multi-agent review synthesis.

## Resources

- Review context: `compound-engineering.local.md`
