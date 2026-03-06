---
status: complete
priority: p2
issue_id: 039
tags: [code-review, quality, security, ui, terminal]
dependencies: []
---

# Problem Statement

Guided scroll computes line wrapping from raw token length but renders sanitized text, which can cause visual line breaks and navigation/highlight drift for terminal-control payloads.

## Findings

- `computeLineMap` uses `word.text.length` (`src/processor/line-computation.ts:41`).
- Guided scroll line rendering sanitizes each word (`src/ui/screens/GuidedScrollScreen.tsx:108`).
- When control sequences are removed at render time, displayed width can differ from computed width, so line boundaries can become inaccurate.

## Proposed Solutions

### Option 1: Use sanitized text width in line map (Recommended)
Pros: Directly aligns wrapping with rendered text; low implementation cost.  
Cons: Still approximates width with JS code-unit length.
Effort: Small  
Risk: Low

### Option 2: Introduce shared display-width helper (sanitized + width-aware)
Pros: Single source of truth for wrapping and render calculations; future Unicode safety.  
Cons: Slightly larger refactor.
Effort: Medium  
Risk: Low

### Option 3: Keep current behavior and document limitation
Pros: No code change.  
Cons: Leaves correctness gap for hostile/complex text.
Effort: Small  
Risk: Medium

## Recommended Action

Implement Option 1 now and track Option 2 as a follow-up hardening task.

## Technical Details

- Affected: `src/processor/line-computation.ts`, `src/ui/screens/GuidedScrollScreen.tsx`, related processor/UI tests.

## Acceptance Criteria

- [x] Line wrapping uses the same normalized representation as rendered output.
- [x] Tests cover ANSI/OSC/CR-heavy text for line map correctness.
- [x] Current-line highlight and line stepping remain aligned with visible lines.

## Work Log

- 2026-03-06: Created from multi-agent review synthesis (TS + security + performance).
- 2026-03-06: Resolved by moving sanitization into shared terminal helper and using sanitized display width in `computeLineMap` with regression tests.

## Resources

- Branch under review: `feat/guided-scroll-mode`
- Related learnings: `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
