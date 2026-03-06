---
date: 2026-03-06
topic: rfaf-phase-3-subphase-14-runtime-mode-switching
origin: docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md
---

# rfaf Phase 3 Subphase 14 Runtime Mode Switching

## What We're Building

Subphase 14 adds runtime reading-mode switching inside the TUI using `1-4` keys for `rsvp`, `chunked`, `bionic`, and `scroll`.

The goal is to let readers change presentation style mid-session without losing their place. Switching should preserve the same reading position as closely as possible, then pause playback so the user can reorient before continuing.

This extends the original Phase 3 roadmap from `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`, now that chunked, bionic, and guided scroll already exist as startup-selectable modes.

## Why This Approach

Three approaches were considered:

1. **App-level runtime mode state** (chosen) - `App` owns canonical source words, active mode, and per-mode transformed caches, while screens render the current mode.
2. **Screen-local switching callbacks** - each screen keeps most of its own state and asks the parent to swap modes.
3. **Shared runtime controller abstraction** - introduce a dedicated controller for mode transforms, caches, and screen transitions.

We chose (1) because it is the simplest structure that still matches the real product shape. Runtime switching crosses screen boundaries, especially for `scroll`, so keeping mode state only inside screens would create drift. A full controller abstraction is likely overbuilt for this phase.

## Key Decisions

- **Runtime switching uses `1-4` keys**: `1=rsvp`, `2=chunked`, `3=bionic`, `4=scroll`, matching the four existing modes.
- **Preserve reading place on switch**: switching should keep the user at the equivalent reading location rather than restarting or jumping by rough percentage only.
- **Pause on switch**: after switching modes, playback pauses so the user can reorient before resuming.
- **App owns canonical words + mode cache**: runtime switching should operate from one canonical source corpus and derive/cache per-mode variants as needed.
- **Screen swap is explicit**: `App` should decide whether to render `RSVPScreen` or `GuidedScrollScreen` based on active mode.
- **Stay within Phase 14 scope**: this is about user-triggered runtime switching, not a broader mode framework redesign.

## Open Questions

(None remaining - resolved during brainstorming.)

## Resolved Questions

- **Should switching preserve place or restart?** Preserve the same reading place.
- **Should switching continue playback automatically?** No. Pause on switch.
- **Where should runtime switching state live?** In `App`, with canonical source words and per-mode caches owned above the screens.

## Next Steps

-> `/workflows:plan` for implementation details, contracts, and test strategy
