---
status: pending
priority: p3
issue_id: "125"
tags: [code-review, simplicity, ui]
dependencies: []
---

# Remove passthrough help-input exports from screen components

## Problem Statement

Screen components export thin wrapper functions that only forward to a shared helper. This increases public API surface without adding domain behavior.

## Findings

- `src/ui/screens/RSVPScreen.tsx:66` exports `getRsvpHelpOverlayInputResult` as a passthrough.
- `src/ui/screens/GuidedScrollScreen.tsx:125` exports `getScrollHelpOverlayInputResult` as a passthrough.
- Related tests import these wrappers directly instead of the canonical helper in `src/ui/help-overlay-input.ts`.

## Proposed Solutions

### Option 1: Test shared helper directly

**Approach:** Remove wrapper exports and update tests to import `resolveHelpOverlayInput` from shared module.

**Pros:**
- Smaller API surface
- Clear single source of contract logic

**Cons:**
- Minor test rewiring

**Effort:** 30-90 minutes

**Risk:** Low

---

### Option 2: Keep wrappers but mark as test-only intent

**Approach:** Keep exports and document them as test seams.

**Pros:**
- No behavior change

**Cons:**
- Retains unnecessary indirection
- Encourages future API clutter

**Effort:** 15-30 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/ui/screens/RSVPScreen.tsx`
- `src/ui/screens/GuidedScrollScreen.tsx`
- `tests/ui/rsvp-help-input-contract.test.tsx`
- `tests/ui/scroll-help-input-contract.test.tsx`

## Resources

- Branch: `feat/phase-8-subphase-32-help-shortcut`
- Simplicity review findings

## Acceptance Criteria

- [ ] Wrapper exports removed (or explicitly justified)
- [ ] Tests validate shared helper contract directly
- [ ] No behavior regressions in help-toggle input handling

## Work Log

### 2026-03-11 - Initial Discovery

**By:** Claude Code

**Actions:**
- Captured simplification finding about screen-level passthrough exports
- Identified impacted tests and source modules

**Learnings:**
- Shared pure logic should generally be tested at source to minimize component API leakage
