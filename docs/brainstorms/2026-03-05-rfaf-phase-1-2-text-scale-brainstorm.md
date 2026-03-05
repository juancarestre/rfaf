---
date: 2026-03-05
topic: rfaf-phase-1-2-text-scale
---

# rfaf Phase 1.2 - Text Scale & Readability

## What We're Building

We are adding a Phase 1.2 readability improvement to rfaf so the RSVP experience is easier to read by default. The feature introduces a new CLI flag, `--text-scale`, and increases the default text size/visual prominence from current behavior.

The user goal is straightforward: the current text feels too small in normal terminal usage, so the app should ship with a larger default presentation and still let users tune readability when needed.

## Why This Approach

We considered three options: app-level scaling (`--text-scale`), a `--font-size` alias, and default-only with no flag. We chose app-level scaling with `--text-scale` because it is technically accurate for terminal apps (rfaf can control rendered text style/layout emphasis, not OS terminal font settings) while still solving the readability problem.

Using one explicit flag plus a stronger default keeps scope tight (YAGNI), aligns with current CLI style, and avoids introducing ambiguous expectations about true terminal font control.

## Key Decisions

- **Add `--text-scale` in Phase 1.2**: Readability becomes user-adjustable from CLI.
- **Increase default readability**: The out-of-the-box display should be clearly larger/easier to read than current behavior.
- **Use preset levels, not free-form numeric values**: `small`, `normal`, `large` style presets for predictable output and simpler UX.
- **Keep scope focused on readability only**: No new reading modes or unrelated UI changes in this phase.
- **Apply changes to core reading UI surfaces**: RSVP word lane first, with supporting status/help readability aligned to the same intent.
- **Keep RSVP lane vertically centered across presets**: The active word should remain in terminal center independent of `--text-scale` choice.

## Open Questions

(None remaining.)

## Resolved Questions

- **Flag naming**: `--text-scale` chosen over `--font-size` for technical clarity in terminal context.
- **Value format**: Preset levels chosen over numeric multipliers.

## Next Steps

-> `/workflows:plan` to define implementation details, defaults, accepted preset values, validation rules, and tests.
