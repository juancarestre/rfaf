# Runtime Mode Switching PTY Validation

Date: 2026-03-06
Owner: OpenCode
Plan: `docs/plans/2026-03-06-feat-phase-3-subphase-14-runtime-mode-switching-plan.md`

## Automated Validation

- `bun test`
- `bun x tsc --noEmit`

## Manual / PTY Validation Checklist

- [ ] Start in RSVP mode and confirm idle label shows `Press Space to start (RSVP)`.
- [ ] Advance into the document, press `2`, and confirm chunked mode renders at the equivalent reading position and playback is paused.
- [ ] Press `4` and confirm scroll mode renders with the current line aligned to the mapped position.
- [ ] Press `1` and confirm RSVP renders again with approximate position preserved.
- [ ] Verify the status bar shows the active mode tag (`[RSVP]`, `[Chunked]`, `[Bionic]`, `[Scroll]`).
- [ ] Open help with `?`, verify `1-4` bindings are listed, close help, and confirm mode switching works afterward.
- [ ] Rapidly press `1`, `2`, `3`, `4` and confirm the final mode is `scroll` without terminal corruption.
- [ ] Use a single-word input and confirm mode switching never crashes.
- [ ] Finish a document, switch modes, and confirm the finished state is preserved.

## Notes

- Automated tests cover shared transform extraction, App runtime state creation, mode switching, help-overlay blocking, and visual feedback contracts.
- PTY/manual validation is still required for terminal rendering details such as perceived flicker, screen swaps, and live input behavior.
