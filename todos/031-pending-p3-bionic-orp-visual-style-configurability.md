---
status: pending
priority: p3
issue_id: 031
tags: [follow-up, ui, accessibility, cli, bionic]
dependencies: []
---

# Problem Statement

`bionic` mode now uses a subtle ORP visual style by default, but users cannot configure that behavior. Some users may prefer full ORP emphasis (`default`) or no ORP emphasis (`off`) when using bionic mode.

## Findings

- Current ORP visual style is selected internally via mode-only logic (`src/ui/screens/RSVPScreen.tsx`).
- Pivot styling supports `default|subtle` in rendering code but has no CLI or runtime-facing configuration surface (`src/ui/components/WordDisplay.tsx`).
- Existing reading-mode and CLI contracts are deterministic and should stay that way if configurability is added (`src/cli/index.tsx`, `src/cli/mode-option.ts`).

## Proposed Solutions

### Option 1: Add bionic-only ORP style option (Recommended)
Pros: Smallest useful scope; preserves current defaults while enabling user preference.  
Cons: Adds one more CLI flag and validation path.  
Effort: Small  
Risk: Low

### Option 2: Add global ORP style option for all modes
Pros: Uniform control surface across modes.  
Cons: Larger behavior matrix and more testing scope than needed right now.
Effort: Medium  
Risk: Medium

### Option 3: Keep hardcoded behavior
Pros: Zero implementation cost.  
Cons: No user control over comfort/readability trade-offs.
Effort: Small  
Risk: Medium

## Recommended Action

Add a deterministic CLI/runtime option for bionic ORP style with allowed values `default|subtle|off`, keeping `subtle` as the bionic default.

## Technical Details

- Likely affected: `src/cli/index.tsx`, `src/ui/App.tsx`, `src/ui/screens/RSVPScreen.tsx`, `src/ui/components/WordDisplay.tsx`, plus CLI/UI tests.

## Acceptance Criteria

- [ ] New ORP style contract supports `default|subtle|off` with deterministic validation semantics.
- [ ] `mode=bionic` default remains `subtle` unless user overrides it.
- [ ] `off` keeps ORP geometric alignment but removes pivot emphasis styling.
- [ ] Existing `rsvp|chunked` defaults remain unchanged.
- [ ] CLI and UI tests cover valid/invalid inputs and rendering outcomes.

## Work Log

- 2026-03-06: Created follow-up from bionic-mode implementation discussion.

## Resources

- Related plan: `docs/plans/2026-03-06-feat-phase-3-subphase-12-bionic-reading-mode-plan.md`
