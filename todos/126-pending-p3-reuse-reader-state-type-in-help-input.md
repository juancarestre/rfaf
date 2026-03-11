---
status: pending
priority: p3
issue_id: "126"
tags: [code-review, typescript, maintainability]
dependencies: []
---

# Reuse canonical reader state type in help-input module

## Problem Statement

`help-overlay-input.ts` defines a local reader-state union, which can drift from the canonical engine reader state over time.

## Findings

- `src/ui/help-overlay-input.ts:12` defines local `ReaderPlaybackState`.
- `src/ui/help-overlay-input.ts:35` uses this local type in `shouldPauseForHelpOverlayOpen`.
- TypeScript review flagged future maintenance drift if reader states change.

## Proposed Solutions

### Option 1: Use `Reader["state"]` from engine type

**Approach:** Import `Reader` type and use `Reader["state"]` directly.

**Pros:**
- Eliminates drift risk
- Keeps type definitions canonical

**Cons:**
- Adds type import dependency

**Effort:** 15-30 minutes

**Risk:** Low

---

### Option 2: Accept boolean `isPlaying`

**Approach:** Narrow function signature to `isPlaying: boolean` and compute at callsite.

**Pros:**
- Very small helper surface
- No cross-module type dependency

**Cons:**
- Slightly less expressive API

**Effort:** 15-30 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/ui/help-overlay-input.ts`
- `src/ui/screens/RSVPScreen.tsx`
- `src/ui/screens/GuidedScrollScreen.tsx`

## Resources

- Branch: `feat/phase-8-subphase-32-help-shortcut`
- TypeScript review finding

## Acceptance Criteria

- [ ] Local duplicate reader-state type removed or justified
- [ ] Helper signature remains clear and type-safe
- [ ] Existing tests continue to pass

## Work Log

### 2026-03-11 - Initial Discovery

**By:** Claude Code

**Actions:**
- Captured maintainability finding from TypeScript review
- Documented two low-risk remediation paths

**Learnings:**
- Canonical type reuse prevents subtle divergence in event-driven runtime modules
