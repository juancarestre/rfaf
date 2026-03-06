# Guided Scroll PTY Acceptance Validation

Date: 2026-03-06

## Scope

Validated interactive terminal checks for guided scroll mode from:

`docs/plans/2026-03-06-feat-phase-3-subphase-13-guided-scroll-mode-plan.md`

## Method

- Used a Python PTY harness from Bun tests to run `rfaf` inside a pseudo-terminal.
- Ran with `RFAF_NO_ALT_SCREEN=1` for stable output capture.
- Simulated key input (`?`, `l`, `j`, `q`) and window resize events.
- Captured ANSI output, stripped escape sequences, and asserted expected user-visible state.

## Results

Automated PTY coverage now verifies:

1. `--mode scroll` starts in paused guided-scroll state.
2. `q` exits cleanly from scroll mode.
3. `?` opens the help overlay in a real PTY session.
4. `l` steps by one visible line and updates paused/progress state.
5. `j` lowers WPM and updates the status bar.
6. Resizing below `40x8` shows the small-terminal guard message.

## Notes

- Coverage is implemented in `tests/cli/scroll-pty-contract.test.ts`.
- This complements the existing unit and render tests for scroll mode.
- Natural-feel reading quality still requires manual human validation.
