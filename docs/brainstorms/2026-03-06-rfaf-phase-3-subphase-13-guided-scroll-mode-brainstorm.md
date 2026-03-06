---
date: 2026-03-06
topic: rfaf-phase-3-subphase-13-guided-scroll-mode
---

# rfaf Phase 3 Sub-phase 13 - Guided Scroll Mode

## What We're Building

We are adding a guided scroll reading mode for rfaf that shows continuous text context while automatically advancing at a user-controlled WPM pace. This mode is intended for readers who want more sentence and paragraph continuity than single-word RSVP or chunked mode.

For sub-phase 13, the goal is a focused mode addition that is shippable and predictable, not a broader mode-system expansion.

## Why This Approach

We considered three approaches: focused guided-scroll mode MVP (chosen), a comfort-first variant with stronger readability bias, and an explicit beta contract with narrower expectations.

We chose the focused guided-scroll MVP because it best matches the selected primary goal (continuous context), keeps existing user mental models intact (WPM semantics and key controls), and respects scope boundaries where runtime mode switching is already planned later in Phase 3 (item 14 in `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`).

## Key Decisions

- **Primary outcome is continuous context**: Guided scroll should preserve sentence/paragraph flow better than RSVP/chunked.
- **Pacing stays WPM-based**: Auto-scroll speed is defined by the existing WPM model rather than introducing a new speed concept.
- **Strong control parity**: Keep pause/resume, speed up/down, paragraph navigation, and quit aligned with current mode expectations.
- **Sub-phase 13 is mode addition only**: Guided scroll is startup-selectable in this step; runtime mode switching remains out of scope for now.
- **Success criterion is reading feel at target speed**: The mode should feel natural and stable at user-selected WPM, not just technically functional.
- **Planning must include a TDD-first quality gate**: The implementation plan should require tests/acceptance checks to be defined first and used as a gate before completion.
- **YAGNI scope discipline**: No new mode-switch framework work or extra guided-scroll-only feature surface in this sub-phase.

## Open Questions

(None remaining.)

## Resolved Questions

- **Primary goal**: Continuous context.
- **Pacing model**: Auto-scroll driven by WPM.
- **Control model**: Strong parity with existing controls.
- **Scope boundary**: Keep runtime mode switching out of sub-phase 13.
- **Success signal**: Feels natural at target WPM.
- **Quality gate preference**: Use a TDD-first gate in planning.

## Next Steps

-> `/workflows:plan` to define guided-scroll mode contract, pacing behavior expectations, control semantics, acceptance criteria, and validation checks.
