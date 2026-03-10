---
title: "feat: Phase 5 Subphase 26 Session History + Stats"
type: feat
status: completed
date: 2026-03-10
origin: docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-26-session-history-stats-brainstorm.md
---

# feat: Phase 5 Subphase 26 Session History + Stats

## Overview

Implement a local session-history feature for personal progress tracking, exposed through a dedicated `history` command.

This plan is TDD-first and carries forward the brainstorm's lean/YAGNI scope: completed sessions only, sanitized source labels, and core metrics only (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-26-session-history-stats-brainstorm.md`).

## Problem Statement / Motivation

rfaf currently computes useful reading metrics in-memory during a run, but users lose that progress context after exiting. Subphase 26 adds continuity: users can inspect completed sessions over time and track consistency and improvement.

Without a deterministic history contract, a future command surface would be prone to state drift (completed vs aborted sessions), privacy regressions (raw source leakage), and unstable output semantics.

## Brainstorm Decisions Carried Forward

From `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-26-session-history-stats-brainstorm.md`:

- Primary outcome is personal progress tracking (see brainstorm: What We're Building).
- Access surface is a dedicated `history` command (see brainstorm: Key Decisions).
- Store sanitized source labels only, not raw full paths/URLs by default (see brainstorm: Key Decisions).
- Persist completed sessions only in v1 (see brainstorm: Key Decisions).
- Show core metrics only in v1: date/time, duration, words read, avg WPM, mode, source label (see brainstorm: Key Decisions).
- Approach is lean local history baseline; no trend/rollup analytics in this subphase (see brainstorm: Why This Approach).
- Open product questions are already resolved; none remain for brainstorming scope (see brainstorm: Open Questions).

## Research Decision

External research is skipped. The repository already has strong local patterns for deterministic CLI contracts, session lifecycle state, terminal sanitization, and test-first feature rollout.

## Consolidated Research Findings

### Repository Patterns

- Session state already exists in-memory via `Session` and `Reader` models: `src/engine/session.ts:1`, `src/engine/reader.ts:5`.
- Completion semantics currently live in `applyReaderAndSession` transition logic and finishing hooks: `src/engine/reader-session-sync.ts:10` and `src/engine/reader-session-sync.ts:40`.
- CLI is currently single-entrypoint yargs (`rfaf [input] [options]`) without existing subcommands: `src/cli/index.tsx:305` and `tests/cli/help-cli-contract.test.ts:27`.
- Local file persistence conventions already exist for config and temp-fixture tests: `src/config/llm-config.ts:236` and `tests/config/yaml-loader-contract.test.ts:31`.
- Terminal sanitization for user-controlled labels is centralized in `sanitizeTerminalText`: `src/terminal/sanitize-terminal-text.ts:5`.

### Institutional Learnings Applied

- Keep CLI parsing and feature behavior deterministic; avoid runtime/environment-coupled parsing branches (`docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`).
- Use typed contracts and stable error mapping, not message-heuristic behavior (`docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`).
- Enforce lifecycle correctness at state boundaries to prevent accidental partial-state persistence (`docs/solutions/logic-errors/runtime-mode-switching-hardening-cli-runtime-20260307.md`).
- Sanitize terminal-visible dynamic content at output boundaries (`docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`).
- Keep merge-hotspot logic modular and contract-tested (`docs/solutions/workflow-issues/20260310-parallel-branch-reconciliation-contract-validation.md`).

## Proposed Solution

Introduce a small, deterministic history system with explicit v1 contracts:

1. Add a dedicated `history` command surface.
2. Persist one record per completed reading session only.
3. Persist only sanitized source labels (no raw path/URL persistence by default).
4. Expose core metrics only in command output.
5. Keep output format deterministic (column order, sorting, empty state text).
6. Exclude trend analysis, rollups, and advanced analytics in this subphase.

## Technical Considerations

- **Architecture impacts:** introduces local session-history persistence boundary and read path from CLI.
- **Performance implications:** history should remain lightweight with bounded output and predictable startup cost.
- **Security/privacy:** sanitize source labels for storage/output and avoid accidental raw source persistence.

## System-Wide Impact

- **Interaction graph:** reader/session runtime -> completion transition -> history persistence write -> `history` command read/render.
- **Error propagation:** write/read failures must map to deterministic CLI error contracts; corrupted rows should follow explicit policy (skip-with-warning or fail-fast, but deterministic).
- **State lifecycle risks:** ensure only true completed transitions persist; aborted/crashed sessions must not be recorded.
- **API surface parity:** if/when history is exposed to agent APIs, parity requirements should be explicit; this subphase remains CLI-first unless scoped otherwise.
- **Integration test scenarios:** completed session persists once, aborted session excluded, malformed record handling, deterministic sorting/output, sanitized label persistence.

## SpecFlow Gaps Incorporated

SpecFlow analysis added explicit requirements to this plan:

- define session completion contract precisely
- lock history output schema/ordering/empty state text
- define timestamp semantics and formatting contract
- define metric formula + rounding behavior (duration/avg WPM)
- define sanitization/length policy for source labels
- define malformed-record handling behavior
- include explicit no-trends/no-rollups negative-scope assertions

## TDD-First Implementation Phases

### Phase 1: Domain Contract Tests (Red -> Green)

Tests first:
- `tests/engine/history-session-eligibility.test.ts` (new)
- `tests/engine/history-metrics-contract.test.ts` (new)
- `tests/engine/history-label-sanitization.test.ts` (new)

Failing coverage first for:
- completed vs aborted inclusion rules
- deterministic metric derivation and rounding
- sanitized source label contract and max-length behavior

### Phase 2: Persistence Contract Tests (Red -> Green)

Tests first:
- `tests/history/history-store-contract.test.ts` (new)
- `tests/history/history-store-malformed-records.test.ts` (new)

Failing coverage first for:
- one-record-per-completed-session persistence
- deterministic read/write schema and field whitelist
- malformed/corrupt record handling policy

### Phase 3: CLI Command Contract Tests (Red -> Green)

Tests first:
- `tests/cli/history-cli-contract.test.ts` (new)
- extend `tests/cli/help-cli-contract.test.ts`

Failing coverage first for:
- `history` command discovery/help behavior
- deterministic output columns/order and empty-state output
- deterministic exit behavior on storage read failures

### Phase 4: Lifecycle Integration Tests (Red -> Green)

Tests first:
- `tests/engine/history-completion-integration.test.ts` (new)
- `tests/ui/history-session-lifecycle-integration.test.ts` (new or equivalent engine-level integration)

Failing coverage first for:
- complete flow persists exactly once
- aborted/failed sessions are excluded
- no double-write on repeated finish/no-op transitions

### Phase 5: Scope Guard + Regression (Red -> Green)

Tests first:
- `tests/cli/history-v1-scope-guard.test.ts` (new)

Failing coverage first for:
- no trend/rollup fields in output
- no expanded analytics surface appears in v1

### Phase 6: Full Quality Gate

- `bun test`
- `bun x tsc --noEmit`

Refactor only with green tests; no behavior expansion during cleanup.

## Acceptance Criteria

- [x] `history` command exists as dedicated access surface (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-26-session-history-stats-brainstorm.md`).
- [x] Only completed sessions are recorded in history (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-26-session-history-stats-brainstorm.md`).
- [x] Stored source field is sanitized label only (not raw full path/URL by default) (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-26-session-history-stats-brainstorm.md`).
- [x] Output includes only v1 core metrics: date/time, duration, words read, avg WPM, mode, source label (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-26-session-history-stats-brainstorm.md`).
- [x] Output order and empty-state behavior are deterministic and test-locked.
- [x] Aborted/failed/incomplete sessions are excluded by contract.
- [x] Malformed persisted records follow explicit deterministic handling policy.
- [x] No trend/rollup analytics are present in this subphase.
- [x] All implementation phases begin with failing tests (red -> green).
- [x] `bun test` and `bun x tsc --noEmit` pass before completion.

## Success Metrics

- Users can reliably review completed reading sessions with consistent core metrics.
- No nondeterministic CLI contract regressions in history command output/exit behavior.
- No privacy regressions from raw source leakage in persisted history records.

## Dependencies & Risks

- **Risk:** completion boundary mismatch can overcount/undercount sessions.
  - **Mitigation:** contract tests around reader/session transition points.
- **Risk:** raw source leakage in persisted history.
  - **Mitigation:** sanitize at persistence boundary and at output boundary.
- **Risk:** scope creep into analytics/trending.
  - **Mitigation:** explicit v1 scope guard tests.
- **Risk:** command-surface drift from existing CLI behavior.
  - **Mitigation:** strict CLI contract tests and help-output assertions.

## Sources & References

### Origin

- Brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-26-session-history-stats-brainstorm.md`

### Internal References

- `src/engine/session.ts:1`
- `src/engine/reader.ts:5`
- `src/engine/reader-session-sync.ts:10`
- `src/engine/reader-session-sync.ts:40`
- `src/ui/screens/RSVPScreen.tsx:297`
- `src/cli/index.tsx:305`
- `tests/cli/help-cli-contract.test.ts:27`
- `src/config/llm-config.ts:236`
- `src/terminal/sanitize-terminal-text.ts:5`

### Institutional Learnings

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- `docs/solutions/logic-errors/runtime-mode-switching-hardening-cli-runtime-20260307.md`
- `docs/solutions/workflow-issues/20260310-parallel-branch-reconciliation-contract-validation.md`
