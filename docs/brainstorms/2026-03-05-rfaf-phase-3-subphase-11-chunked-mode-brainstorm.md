---
date: 2026-03-05
topic: rfaf-phase-3-subphase-11-chunked-mode
---

# rfaf Phase 3 Sub-phase 11 - Chunked Reading Mode

## What We're Building

We are adding a new chunked reading mode for rfaf that displays short groups of words (adaptive 3-5 words) instead of a single word at a time. This mode targets better comprehension while preserving rfaf's fast reading workflow.

The immediate goal for sub-phase 11 is a focused, shippable mode addition, not a full mode-system redesign.

## Why This Approach

We considered three approaches: adaptive chunks with existing controls (chosen), fixed-size chunks first, and a richer chunk mode with new controls.

We chose adaptive chunks with existing controls because it best fits comprehension goals, keeps user mental models stable (same WPM semantics and keybindings), and respects the phase boundary where runtime mode switching is planned later in Phase 3 (item 14 in `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`).

## Key Decisions

- **Primary outcome is comprehension**: Chunked mode should improve context retention vs single-word RSVP.
- **Adaptive chunk sizing in v1**: Use 3-5 word groups, adapting to punctuation/word flow.
- **Speed remains WPM-based**: Keep compatibility with current speed controls and user expectations.
- **Entry via CLI flag in sub-phase 11**: Use a mode-selection flag path (exact flag naming finalized in planning), with no runtime mode-switch UI in this sub-phase.
- **Control parity with RSVP**: Same keyboard controls/help to avoid retraining.
- **Scope discipline (YAGNI)**: No chunk-specific keymap, no mode-switch framework expansion in this step.

## Open Questions

(None remaining.)

## Resolved Questions

- **Mode objective**: Prioritize comprehension over max speed bursts.
- **Chunk sizing**: Adaptive 3-5 words.
- **Speed semantics**: Keep WPM, not chunks-per-minute.
- **Activation in this sub-phase**: CLI flag only.
- **Control model**: Keep existing RSVP keybindings/help.

## Next Steps

-> `/workflows:plan` to define mode contract, CLI flag shape, adaptive chunking rules, pacing behavior, and tests.
