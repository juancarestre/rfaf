# RSVP MVP PTY Acceptance Validation

Date: 2026-03-05

## Scope

Validated the previously unchecked interactive acceptance criteria from:

`docs/plans/2026-03-04-feat-rsvp-speed-reading-mvp-plan.md`

## Method

- Used a Python PTY harness to run `rfaf` inside a pseudo-terminal.
- Simulated key input (`Space`, `?`, `r`, `q`, `Ctrl+C`) and window resize events.
- Captured ANSI output and asserted expected status text and behavior.

## Results

All targeted checks passed:

1. File input starts paused on first word.
2. Piped stdin starts paused with `source=stdin`.
3. Word lane appears centered and ORP pivot column remains fixed.
4. ORP pivot renders with bold + red styling.
5. `?` shows help overlay and pauses playback.
6. Completion status shows words/time/avg WPM.
7. Restart from finished returns to paused start state.
8. `q` quits cleanly from normal and finished states.
9. `Ctrl+C` exits cleanly.
10. Terminal resize triggers re-render and small-terminal guard message.
11. Alternate screen enter/exit sequences are emitted and restored on quit.

## Notes

- Added `RFAF_NO_ALT_SCREEN=1` test mode to make PTY output assertions stable.
- Kept default production behavior with alternate-screen enabled.

## Phase 1.2 Text Scale Extension

Validated additional PTY smoke checks for Phase 1.2 text readability presets:

1. `--text-scale small` starts in paused state without startup errors.
2. `--text-scale normal` starts in paused state without startup errors.
3. `--text-scale large` starts in paused state without startup errors.
4. With `--text-scale large`, resizing to constrained dimensions still triggers the existing "Terminal too small" guard.

These checks were executed with the same PTY harness pattern and `RFAF_NO_ALT_SCREEN=1` for stable output capture.
