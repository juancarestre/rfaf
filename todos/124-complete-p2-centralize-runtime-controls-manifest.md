---
status: complete
priority: p2
issue_id: "124"
tags: [code-review, architecture, ui, cli]
dependencies: []
---

# Centralize runtime controls metadata to prevent copy drift

## Problem Statement

Runtime controls are described in multiple places (CLI help epilog, in-app overlay, status hints). Maintaining separate strings increases drift risk and can cause inconsistent guidance across interfaces.

## Findings

- CLI controls text: `src/cli/index.tsx:378`.
- Overlay controls text: `src/ui/components/HelpOverlay.tsx:15`.
- Status hint text: `src/ui/components/StatusBar.tsx:50`.
- Agent-native review flagged cross-surface consistency risk.

## Proposed Solutions

### Option 1: Shared controls manifest module

**Approach:** Define a canonical runtime-controls data structure and render all surfaces from it.

**Pros:**
- Single source of truth
- Easier updates and fewer inconsistencies

**Cons:**
- Small refactor touching CLI + UI render paths

**Effort:** 3-5 hours

**Risk:** Medium

---

### Option 2: Keep strings separate, add strict parity contract tests

**Approach:** Add tests asserting required keys/actions are present in every surface.

**Pros:**
- Lower implementation effort
- Preserves current code shape

**Cons:**
- Still duplicates data
- Tests become copy-sensitive

**Effort:** 1-3 hours

**Risk:** Low

## Recommended Action

Implemented Option 1 by introducing a shared runtime-controls manifest and routing CLI/overlay/status rendering through that single source.

## Technical Details

**Affected files:**
- `src/cli/index.tsx`
- `src/ui/components/HelpOverlay.tsx`
- `src/ui/components/StatusBar.tsx`
- `tests/cli/help-cli-contract.test.ts`
- `tests/ui/help-overlay-runtime-controls-copy.test.tsx`

## Resources

- Branch: `feat/phase-8-subphase-32-help-shortcut`
- Agent-native finding: control metadata duplication across surfaces

## Acceptance Criteria

- [x] Canonical control set is enforced across CLI, overlay, and status surfaces
- [x] Drift is prevented by implementation design or explicit parity tests
- [x] Existing control discoverability remains clear in all modes

## Work Log

### 2026-03-11 - Initial Discovery

**By:** Claude Code

**Actions:**
- Consolidated architecture/parity finding from agent-native reviewer
- Mapped control strings across affected files
- Drafted two implementation paths

**Learnings:**
- Discoverability and determinism are both harmed when control docs drift between interfaces

### 2026-03-11 - Resolution

**By:** Claude Code

**Actions:**
- Added shared runtime controls module: `src/runtime-controls.ts`
- Updated `src/cli/index.tsx` to build runtime help lines from shared controls
- Updated `src/ui/components/HelpOverlay.tsx` to render grouped overlay rows from shared controls
- Updated `src/ui/components/StatusBar.tsx` to consume shared status hint variants
- Added parity coverage in `tests/ui/runtime-controls-contract.test.ts`

**Learnings:**
- A shared controls manifest reduces copy drift and keeps CLI + UI behavior documentation aligned
- Centralized control metadata makes future keybinding changes safer and easier to test
