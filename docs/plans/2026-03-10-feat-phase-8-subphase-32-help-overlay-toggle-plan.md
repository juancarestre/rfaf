---
title: "feat: Phase 8 Subphase 32 In-Program Help Overlay Toggle"
type: feat
status: active
date: 2026-03-10
origin: docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md
---

# feat: Phase 8 Subphase 32 In-Program Help Overlay Toggle

## Overview

Add a deterministic in-program keyboard shortcut contract for toggling the help overlay so readers can open and close guidance without leaving the reading session.

This subphase implements Phase 8 item 32 from the origin brainstorm: the overlay must clearly list all keybindings, including runtime controls, and stay consistent across active reading modes.

## Problem Statement / Motivation

rfaf already exposes controls in two places (CLI `--help` epilog and in-app overlay), but the interaction contract is not explicitly locked as a toggle-first behavior across mode surfaces.

Current behavior relies on local screen handlers and a lightweight overlay rendering contract. Without explicit toggle tests and copy contracts, regressions can easily appear in:

- open/close behavior while playback is active,
- parity between RSVP-family and scroll screen key handling,
- clarity and completeness of runtime control guidance.

## Brainstorm Decisions Carried Forward

From `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`:

- Scope is exactly Phase 8 subphase 32: keyboard shortcut to toggle in-program help (`docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md:88`).
- Help overlay content must be explanatory and include all keybindings, including runtime controls (`docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md:88`).
- Preserve phase-order discipline: no expansion into release automation (subphase 33) during this work (`docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md:89`).
- Keep CLI/TUI-first ergonomics and deterministic controls behavior (carried from overall MVP direction in the same brainstorm).

## Repository / Internal References

- Overlay rendering contract currently lives in `src/ui/components/HelpOverlay.tsx:10`.
- RSVP-family input handling and overlay open/close flow is implemented in `src/ui/screens/RSVPScreen.tsx:208`.
- Scroll input handling and overlay open/close flow is implemented in `src/ui/screens/GuidedScrollScreen.tsx:238`.
- App-level mode-key routing that coexists with overlay visibility is in `src/ui/App.tsx:80` and `src/ui/runtime-mode-state.ts:93`.
- Existing PTY runtime hotkey coverage touches help + mode switching in `tests/cli/runtime-mode-switching-pty-contract.test.ts:131`.
- Existing overlay copy-level tests are minimal in `tests/ui/help-overlay.test.tsx:7`.
- CLI help runtime-controls copy baseline is in `src/cli/index.tsx:378` with contract checks in `tests/cli/help-cli-contract.test.ts:35`.

## Institutional Learnings Applied

- Preserve deterministic input and contract behavior; avoid state-dependent ambiguity in user-visible controls (`docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`).
- Protect terminal lifecycle and interactive input safety while layering new key handling (`docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`).
- Keep runtime mode transitions robust and explicitly tested when adding behavior around shared controls (`docs/solutions/logic-errors/runtime-mode-switching-hardening-cli-runtime-20260307.md`).
- Minimize merge-hotspot risk by constraining shared-surface edits and backing them with focused contract tests (`docs/solutions/workflow-issues/20260310-parallel-branch-reconciliation-contract-validation.md`).

## Proposed Solution

Ship a unified, toggle-first help-overlay contract with explicit tests before implementation:

1. Define the keyboard toggle behavior contract (`?` opens/closes help, `Esc` closes help, non-close keys are ignored while overlay is active except global quit).
2. Normalize behavior across RSVP-family and guided-scroll screens using shared expectations.
3. Expand overlay copy to be explicitly explanatory and complete for runtime controls (playback, stepping, WPM, paragraph navigation, mode switching, restart, quit, help toggle semantics).
4. Keep CLI `--help` runtime-control summary aligned with in-app terminology.
5. Add regression coverage at component, app-state, and PTY integration levels.

## Technical / System Impact

- **Architecture impact:** no new subsystem; this is a contract hardening pass across existing UI input surfaces.
- **State lifecycle impact:** help visibility remains runtime state (`AppRuntimeState.helpVisible`) and must not corrupt reader/session progression.
- **Interaction graph:** keystroke -> screen `useInput` + app mode routing -> help visibility state -> overlay rendering.
- **Terminal impact:** no additional terminal mode changes expected; behavior must preserve existing lifecycle guarantees.
- **Cross-mode impact:** overlay must remain consistent while switching modes at runtime.

## TDD-First Implementation Phases

### Phase 1: Toggle Contract Tests (Red -> Green)

Add failing tests first:

- `tests/ui/help-overlay-toggle-contract.test.tsx` (new)
- extend `tests/ui/help-overlay.test.tsx`

Coverage:

- `?` toggles open/close contract at UI level,
- `Esc` closes when visible,
- overlay copy includes explicit runtime-control categories and close/toggle guidance.

### Phase 2: Screen Input Parity Tests (Red -> Green)

Add failing tests first:

- `tests/ui/rsvp-help-input-contract.test.tsx` (new)
- `tests/ui/scroll-help-input-contract.test.tsx` (new)

Coverage:

- identical toggle behavior in RSVP-family and scroll screens,
- playback pauses when help opens during playing state,
- non-close action keys are suppressed while help is visible.

### Phase 3: Runtime Integration PTY Contracts (Red -> Green)

Add failing tests first:

- extend `tests/cli/runtime-mode-switching-pty-contract.test.ts`
- `tests/cli/help-overlay-toggle-pty-contract.test.ts` (new)

Coverage:

- open/close toggle works in an interactive terminal,
- mode switching remains valid while help is visible,
- quit behavior remains deterministic from help-visible state.

### Phase 4: Copy and CLI Parity Contracts (Red -> Green)

Add failing tests first:

- extend `tests/cli/help-cli-contract.test.ts`
- `tests/ui/help-overlay-runtime-controls-copy.test.tsx` (new)

Coverage:

- in-app overlay and CLI epilog use consistent control terminology,
- runtime controls are represented completely and clearly,
- no silent drift in operator-facing help text.

### Phase 5: Implementation + Refactor (Green)

Implement minimal changes to:

- `src/ui/components/HelpOverlay.tsx`
- `src/ui/screens/RSVPScreen.tsx`
- `src/ui/screens/GuidedScrollScreen.tsx`
- `src/cli/index.tsx` (if wording alignment requires it)

Refactor only after tests are green; avoid feature expansion beyond help toggle/copy scope.

### Phase 6: Full Quality Gate

- `bun test`
- `bun x tsc --noEmit`

## Acceptance Criteria

- [ ] A documented keyboard shortcut toggles the in-program help overlay open and closed.
- [ ] Help overlay can be closed with `Esc` and reopened predictably.
- [ ] Overlay content includes all runtime keybindings with explanatory wording.
- [ ] Behavior is consistent across RSVP/chunked/bionic and scroll screens.
- [ ] Runtime mode switching remains functional while help is visible.
- [ ] CLI `--help` runtime-controls line remains aligned with in-app terminology.
- [ ] New behavior is covered by component and PTY contract tests.
- [ ] `bun test` and `bun x tsc --noEmit` pass.

## Dependencies & Risks

- **Risk:** conflicting key handlers between App-level mode input and screen-level help input.
  - **Mitigation:** explicit parity tests for help-visible + mode-switch flows.
- **Risk:** regressions in playback state transitions when opening help from playing state.
  - **Mitigation:** contract tests that assert deterministic pause behavior.
- **Risk:** copy drift between CLI and in-app help surfaces.
  - **Mitigation:** string-level contract tests for shared runtime control vocabulary.
- **Risk:** scope creep into unrelated Phase 8 release automation work.
  - **Mitigation:** hard scope guard to item 32 only.

## Sources

### Origin

- `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`

### Internal References

- `src/ui/components/HelpOverlay.tsx:10`
- `src/ui/screens/RSVPScreen.tsx:208`
- `src/ui/screens/GuidedScrollScreen.tsx:238`
- `src/ui/App.tsx:80`
- `src/ui/runtime-mode-state.ts:93`
- `src/cli/index.tsx:378`
- `tests/ui/help-overlay.test.tsx:7`
- `tests/cli/help-cli-contract.test.ts:35`
- `tests/cli/runtime-mode-switching-pty-contract.test.ts:131`

### Institutional Learnings

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- `docs/solutions/logic-errors/runtime-mode-switching-hardening-cli-runtime-20260307.md`
- `docs/solutions/workflow-issues/20260310-parallel-branch-reconciliation-contract-validation.md`
