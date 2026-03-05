---
status: pending
priority: p3
issue_id: 017
tags: [code-review, quality, simplicity, cli, tests]
dependencies: []
---

# Problem Statement

Several small simplification opportunities exist in CLI error checks and tests that improve clarity with low risk.

## Findings

- `src/cli/index.tsx:203` checks `message.includes("--text-scale")` and `message.includes("text-scale")`; first check is redundant.
- `src/cli/text-scale-option.ts:7` has a single-use type guard wrapper that can be inlined for readability.
- `tests/ui/help-overlay.test.tsx:13` claims to test padding but only reasserts static text content.
- Perf review also noted low-priority allocation cleanups (constant object creation in render path and repeated status text composition) that can be bundled as opportunistic cleanup.

## Proposed Solutions

### Option 1: Apply targeted micro-cleanups now
Pros: Improves signal/noise quickly; very low risk.  
Cons: Additional small PR churn.  
Effort: Small  
Risk: Low

### Option 2: Bundle with next related UI/CLI refactor
Pros: Fewer tiny standalone commits.  
Cons: Cleanups may linger longer.  
Effort: Small  
Risk: Low

### Option 3: Leave as-is
Pros: No immediate work.  
Cons: Ongoing minor readability/test quality debt.  
Effort: Small  
Risk: Low

## Recommended Action


## Technical Details

- Affected: `src/cli/index.tsx`, `src/cli/text-scale-option.ts`, `tests/ui/help-overlay.test.tsx`, plus optional small render-path cleanups in UI components.

## Acceptance Criteria

- [ ] Redundant CLI condition branches are removed.
- [ ] Single-use guard abstraction is simplified (or justified).
- [ ] Help overlay test either validates padding behavior or is renamed/scoped to actual assertions.

## Work Log

- 2026-03-05: Created from multi-agent review synthesis.

## Resources

- Review context: `compound-engineering.local.md`
