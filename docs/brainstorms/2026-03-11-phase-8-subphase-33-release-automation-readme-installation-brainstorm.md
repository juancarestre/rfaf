---
date: 2026-03-11
topic: phase-8-subphase-33-release-automation-readme-installation
---

# Phase 8.33 Release Automation + README Installation

## What We're Building
Implement Phase 8 subphase 33 from `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`: automated release flow on merges to `main`, including test/build validation, compiled binaries for supported platforms, and release artifacts.

In the same phase, update `README.md` so onboarding is prebuilt-binary first across macOS, Linux, and Windows, with direct GitHub release asset download steps. Bun/source install remains available but secondary.

## Why This Approach
We chose **Approach A**: a single workflow that fully automates patch releases on every merge to `main`.

This best matches the Phase 8.33 intent and keeps distribution simple for users. Repo scripts and tests already define deterministic compile and checksum contracts, so this can be implemented with existing foundations rather than introducing extra workflow complexity.

## Key Decisions
- Trigger release automation on every merge to `main`.
- Run quality gates before release publish (tests + compile + release checksum/manifest generation).
- Publish compiled binaries for the existing multi-platform target matrix already defined by build scripts.
- Update `README.md` to prioritize direct download/install of prebuilt binaries on macOS/Linux/Windows.
- Keep Bun/source install path documented as secondary option.
- Use direct GitHub release asset installs in this phase (no package-manager rollout in scope).

## Resolved Questions
- **Release trigger:** automatic on every merge to `main`.
- **README onboarding priority:** prebuilt binaries first.
- **Install method:** direct GitHub release downloads.

## Open Questions
- None at this stage.

## Next Steps
Proceed to planning to define version-bump semantics, release idempotency/rollback behavior, artifact naming/verification contracts, and exact README section structure for each platform.
