---
status: complete
priority: p2
issue_id: 034
tags: [code-review, quality, ui, internationalization]
dependencies: []
---

# Problem Statement

Bionic mode currently mutates token text by uppercasing prefix characters, which can introduce Unicode expansion and width-shift risks in terminal layout.

## Findings

- Prefix emphasis rewrites stored token text with `char.toUpperCase()` (`src/processor/bionic.ts:27`, `src/processor/bionic.ts:70`).
- Some Unicode characters can expand on uppercase conversion (for example, locale-specific cases), potentially affecting display width and ORP alignment.
- Rendering currently uses transformed text directly in layout logic (`src/ui/components/WordDisplay.tsx:68`).

## Proposed Solutions

### Option 1: Keep source text immutable and render emphasis via spans (Recommended)
Pros: Preserves canonical text; avoids Unicode rewrite surprises; clearer rendering contract.  
Cons: Requires moving some emphasis logic into UI rendering path.
Effort: Medium  
Risk: Low

### Option 2: Keep rewrite approach with stricter character guards
Pros: Smaller code churn.  
Cons: Hard to guarantee correctness across scripts/locales.
Effort: Medium  
Risk: Medium

### Option 3: Keep as-is
Pros: No additional work.  
Cons: Latent layout instability for non-ASCII input.
Effort: Small  
Risk: Medium

## Recommended Action

Store emphasis metadata only and apply visual emphasis at render time without mutating underlying token text.

## Technical Details

- Affected: `src/processor/bionic.ts`, `src/processor/types.ts`, `src/ui/components/WordDisplay.tsx`, associated tests.

## Acceptance Criteria

- [x] Canonical token text is unchanged by bionic transform.
- [x] Bionic emphasis remains visible and deterministic.
- [x] ORP alignment and layout stay stable with non-ASCII words.
- [x] Tests cover representative Unicode edge cases.

## Work Log

- 2026-03-06: Created from TypeScript quality review findings.
- 2026-03-06: Resolved by keeping canonical token text immutable in processor transform, applying emphasis at UI render-time, and adding unicode-focused coverage.

## Resources

- Branch under review: `feat/bionic-mode-phase3-sub12`
