---
status: pending
priority: p3
issue_id: 036
tags: [code-review, ui, accessibility, readability]
dependencies: ["031"]
---

# Problem Statement

Current `subtle` ORP style in bionic mode may be visually indistinguishable from surrounding text, reducing clarity of the intended "subtle but present" cue.

## Findings

- `subtle` returns `{ bold: true }` (`src/ui/components/WordDisplay.tsx:52`).
- Surrounding prefix/suffix text is also rendered bold (`src/ui/components/WordDisplay.tsx:123`, `src/ui/components/WordDisplay.tsx:125`).
- Result can make pivot appear equivalent to adjacent text when color is absent or de-emphasized.

## Proposed Solutions

### Option 1: Define subtle style contract with minimal distinct cue (Recommended)
Pros: Preserves readability intent while avoiding strong visual noise.  
Cons: Requires explicit style-policy decision.
Effort: Small  
Risk: Low

### Option 2: Treat subtle as ORP-off and rename semantics
Pros: Makes behavior explicit and unambiguous.  
Cons: Requires API/label updates for clarity.
Effort: Small  
Risk: Low

### Option 3: Keep current behavior
Pros: No changes.  
Cons: Ambiguous UX contract for "subtle".
Effort: Small  
Risk: Medium

## Recommended Action

Clarify and codify subtle-style semantics, then update rendering/tests to match the chosen contract.

## Technical Details

- Affected: `src/ui/components/WordDisplay.tsx`, `src/ui/screens/RSVPScreen.tsx`, UI tests.

## Acceptance Criteria

- [ ] Subtle ORP behavior is explicitly documented as either "distinct" or "off".
- [ ] Rendering and tests enforce that contract consistently.
- [ ] Bionic mode continues to avoid aggressive dual emphasis.

## Work Log

- 2026-03-06: Created from code-simplicity reviewer finding; linked to configurability follow-up.

## Resources

- Related follow-up: `todos/031-pending-p3-bionic-orp-visual-style-configurability.md`
