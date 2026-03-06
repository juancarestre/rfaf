---
status: complete
priority: p2
issue_id: 041
tags: [code-review, testing, cli, tty, reliability]
dependencies: []
---

# Problem Statement

Guided scroll currently has strong unit/render coverage but lacks dedicated PTY interaction coverage for keybindings, resize, and lifecycle cleanup.

## Findings

- UI tests validate static render output but not interactive TTY behavior (`tests/ui/guided-scroll-controls.test.tsx:42`).
- Plan criteria still leave PTY validation unchecked for scroll mode.
- Product context prioritizes raw-mode and terminal lifecycle safety for Ink app flows.

## Proposed Solutions

### Option 1: Add targeted PTY integration tests for `--mode scroll` (Recommended)
Pros: Verifies real keyboard/resize lifecycle behavior and cleanup paths.  
Cons: Slower test execution and harness maintenance.
Effort: Medium  
Risk: Low

### Option 2: Add manual validation doc only
Pros: Fast to author.  
Cons: Not regression-safe in CI.
Effort: Small  
Risk: Medium

### Option 3: Add lightweight smoke PTY plus manual deep checks
Pros: Balanced confidence/cost.  
Cons: Partial automation coverage.
Effort: Medium  
Risk: Low

## Recommended Action

Implement Option 1 for startup, controls, resize, `q`, and `Ctrl+C` cleanup.

## Technical Details

- Affected: PTY harness tests under `tests/cli/`, validation docs under `docs/validation/`.

## Acceptance Criteria

- [x] PTY tests cover representative guided-scroll controls (`l`, `j`, `?`, `q`) in scroll mode.
- [x] PTY tests cover resize behavior and verify continued rendering stability.
- [x] PTY tests verify terminal cleanup on quit paths.

## Work Log

- 2026-03-06: Created from TS reviewer and learnings synthesis.
- 2026-03-06: Resolved with Python PTY harness coverage in `tests/cli/scroll-pty-contract.test.ts` and validation notes in `docs/validation/2026-03-06-guided-scroll-acceptance-pty.md`.

## Resources

- Branch under review: `feat/guided-scroll-mode`
- Related learnings: `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
