---
title: "feat: Phase 5 Subphase 25 YAML Full Config Migration"
type: feat
status: active
date: 2026-03-10
origin: docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-25-yaml-full-config-brainstorm.md
---

# feat: Phase 5 Subphase 25 YAML Full Config Migration

## Overview

Migrate rfaf runtime configuration from TOML to YAML with a hard switch to `~/.rfaf/config.yaml`, and ship the broader full config model (`llm`, `display`, `reading`, `defaults`) in this same subphase.

This plan is TDD-first and carries forward the brainstorm's selected big-bang approach, despite higher integration risk, to avoid multi-phase config churn (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-25-yaml-full-config-brainstorm.md`).

## Foundational Brainstorm

Found brainstorm from 2026-03-10: `rfaf-phase-5-subphase-25-yaml-full-config`. Using as foundation for planning.

## Problem Statement

rfaf currently loads only TOML (`~/.rfaf/config.toml`) with LLM-focused schema and TOML-centric examples/tests. Phase 5.25 requires a product-level shift to YAML and expanded config scope, while preserving deterministic CLI behavior, clear migration UX, and security hygiene.

Without an explicit migration contract, users with existing TOML files will encounter confusing breakage, and without strict precedence/error rules, CLI behavior can drift across environments.

## Brainstorm Decisions Carried Forward

From `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-25-yaml-full-config-brainstorm.md`:

- **Chosen approach:** big-bang full config redesign in this subphase (see brainstorm: "Why This Approach").
- **Canonical runtime config:** `~/.rfaf/config.yaml` (see brainstorm: "Key Decisions").
- **TOML runtime support:** removed in this subphase (hard switch) (see brainstorm: "Key Decisions").
- **TOML-only machine behavior:** fail with clear migration command/instructions (see brainstorm: "Key Decisions").
- **Inline provider keys:** allowed in YAML (see brainstorm: "Key Decisions").
- **Permissions policy:** warn on permissive file permissions, do not block (see brainstorm: "Key Decisions").
- **Precedence:** environment variables override YAML values on conflict (see brainstorm: "Key Decisions").
- **Scope:** include full config sections (`display`, `reading`, `defaults`) now, not LLM-only migration (see brainstorm: "Key Decisions").
- **Open questions:** none remaining for brainstorm scope (see brainstorm: "Open Questions").

## Research Decision

Proceeding without external research. Local repository patterns and institutional learnings are strong and directly applicable for deterministic contracts, migration UX, and security redaction.

## Consolidated Research Findings

### Repository Patterns

- Current loader is TOML-only and defaults to `~/.rfaf/config.toml` with `RFAF_CONFIG_PATH` override in `src/config/llm-config.ts:137` and `src/config/llm-config.ts:143`.
- Parse/validation failures are currently surfaced as `UsageError` with `Config error:` messages in `src/config/llm-config.ts:92`, `src/config/llm-config.ts:147`, and `src/config/llm-config.ts:155`.
- Current precedence behavior already blends env + config with env winning in key paths (`provider`, `model`, `api_key`) in `src/config/llm-config.ts:90`, `src/config/llm-config.ts:97`, and `src/config/llm-config.ts:104`.
- LLM feature flows depend on `loadLLMConfig` (`summary`, `no-bs`, `translate`, `key-phrases`, `quiz`, `strategy`) in:
  - `src/cli/summarize-flow.ts:34`
  - `src/cli/no-bs-flow.ts:34`
  - `src/cli/translate-flow.ts:41`
  - `src/cli/key-phrases-flow.ts:36`
  - `src/cli/quiz-flow.ts:53`
  - `src/cli/strategy-flow.ts:81`
- Existing example and docs still TOML-centric (`config.toml.example:2`, `config.toml.example:7`), so docs and fixture migration must be first-class scope.

### Institutional Learnings Applied

- Keep parsing deterministic and avoid filesystem/env side effects in arg semantics and config contracts: `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`.
- Prefer typed/deterministic error contracts over heuristic message matching: `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`.
- Preserve explicit contract ordering and parity guardrails for multi-feature composition: `docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`.
- Maintain boundary redaction/sanitization for secrets and terminal output: `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`.
- Use integration reconciliation discipline for shared hotspots (`index.tsx`, shared contracts): `docs/solutions/workflow-issues/20260310-parallel-branch-reconciliation-contract-validation.md`.

## Proposed Solution

Deliver a full YAML config contract with explicit migration and fail-fast behavior:

1. Introduce YAML schema and validation for `llm`, `display`, `reading`, and `defaults`.
2. Make `~/.rfaf/config.yaml` the only runtime file contract.
3. If only TOML exists, fail deterministically with one clear migration command + instructions.
4. Keep env vars as highest priority over YAML values.
5. Allow inline keys in YAML with warning-only permission checks.
6. Update all LLM-dependent CLI flows to rely on the new loader behavior.
7. Update tests, fixtures, sample config, and docs to remove TOML runtime assumptions.

## Technical Approach

### Architecture

Primary seams to update:
- `src/config/llm-config.ts` (or extracted config module set) for YAML load/validate/precedence.
- `src/cli/index.tsx` for deterministic config error/exit behavior compatibility.
- LLM flows using config loader (`src/cli/*-flow.ts`) to ensure unchanged runtime semantics.
- Example/documentation artifacts (`config.toml.example`, docs references, fixture setup in tests).

Expected new/updated config surfaces:
- YAML file contract: `~/.rfaf/config.yaml`.
- Full sections: `llm`, `display`, `reading`, `defaults`.
- Migration command contract (user-facing) for TOML-only installations.

### System-Wide Impact

#### Interaction Graph

CLI feature invocation (`--summary`, `--no-bs`, `--translate-to`, `--key-phrases`, `--quiz`, `--strategy`) -> config loader -> validation + env overlay -> feature flow -> typed runtime behavior.

#### Error & Failure Propagation

- Config not found/invalid/unsupported legacy state must map to deterministic usage-classified behavior.
- Runtime provider failures remain runtime-classified and unchanged by migration.
- Migration guidance errors should be explicit and stable (no ambiguous fallback behavior).

#### State Lifecycle Risks

- No database state changes.
- Main risk is user config state transition (TOML-only users) and accidental secret exposure in warnings/errors.

#### API Surface Parity

- CLI reads from disk config; agent surfaces generally accept explicit `llmConfig` object.
- Plan requires parity in semantic contracts (validation bounds/error taxonomy), even if file-path loading differs.

#### Integration Test Scenarios

- YAML success path across all LLM features.
- TOML-only machine hard-fail with guided migration message.
- YAML malformed and section-level invalid values.
- Env-over-YAML precedence conflicts.
- Permission warning for permissive YAML with inline keys.

## SpecFlow Gaps Incorporated

From spec-flow analysis, this plan explicitly adds:

- Full schema clarity for new sections and unknown-key policy.
- Deterministic file-discovery contract (YAML present, TOML present, both present, custom path).
- Stable migration guidance output contract.
- Source-attributed validation errors (field path + source context).
- Secret-safe diagnostics in all failure/warning paths.
- Explicit no-partial/ambiguous fallback behavior for TOML runtime usage.

## Alternative Approaches Considered

- **Strict YAML cutover + guided migration only:** lower scope/risk, but defers full config architecture and extends config churn.
- **Transitional dual-format support:** reduces immediate user friction, but increases complexity and ambiguity.
- **Chosen:** big-bang full config redesign now (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-25-yaml-full-config-brainstorm.md`).

## TDD-First Implementation Phases

### Phase 1: YAML Contract Unit Tests (Red -> Green)

Tests first:
- `tests/config/yaml-config-schema.test.ts` (new)
- `tests/config/yaml-config-precedence.test.ts` (new)
- extend `tests/config/llm-config.test.ts`

Failing coverage first for:
- required/optional field validation for `llm`, `display`, `reading`, `defaults`
- unknown/invalid keys behavior
- env-over-YAML precedence for overlapping fields
- deterministic bounds for timeout/retry/defaults

### Phase 2: Loader and Discovery Contract Tests (Red -> Green)

Tests first:
- `tests/config/yaml-loader-contract.test.ts` (new)
- `tests/cli/config-migration-cli-contract.test.ts` (new)

Failing coverage first for:
- YAML-only success
- TOML-only hard-fail + guided migration command text
- both-files behavior contract
- `RFAF_CONFIG_PATH` behavior with YAML target

### Phase 3: Security and Warning Contract Tests (Red -> Green)

Tests first:
- `tests/config/yaml-config-permissions-warning.test.ts` (new)
- `tests/cli/config-redaction-contract.test.ts` (new)

Failing coverage first for:
- permissive permission warning is emitted but execution continues
- inline keys never leak in stderr/stdout diagnostics
- warning and error envelopes remain terminal-safe

### Phase 4: Flow Integration Regression Tests (Red -> Green)

Tests first:
- extend existing CLI contract suites that currently scaffold TOML:
  - `tests/cli/summary-cli-contract.test.ts`
  - `tests/cli/no-bs-cli-contract.test.ts`
  - `tests/cli/translate-cli-contract.test.ts`
  - `tests/cli/key-phrases-cli-contract.test.ts`
  - `tests/cli/quiz-cli-contract.test.ts`
  - `tests/cli/strategy-cli-contract.test.ts`

Failing coverage first for:
- YAML fixtures replacing TOML assumptions
- unchanged feature behavior after config migration
- deterministic exit code mapping (`2` usage/config, `1` runtime)

### Phase 5: Documentation and Fixture Migration (Red -> Green)

Validation-first updates:
- Replace TOML-centric sample/reference docs with YAML equivalents.
- Update test fixtures and helper setup text to YAML path/contracts.
- Ensure migration command is documented in user-facing references.

### Phase 6: Full Quality Gate

- `bun test`
- `bun x tsc --noEmit`

Only refactor under green tests; no behavior changes during cleanup.

## Acceptance Criteria

### Functional Requirements

- [ ] Runtime config canonical file is `~/.rfaf/config.yaml` (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-25-yaml-full-config-brainstorm.md`).
- [ ] TOML runtime support is removed in this subphase (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-25-yaml-full-config-brainstorm.md`).
- [ ] TOML-only state fails with deterministic guided migration command/instructions (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-25-yaml-full-config-brainstorm.md`).
- [ ] Full config sections (`llm`, `display`, `reading`, `defaults`) are parsed and validated (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-25-yaml-full-config-brainstorm.md`).
- [ ] Inline provider keys in YAML are supported (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-25-yaml-full-config-brainstorm.md`).
- [ ] Env values override YAML values for overlapping fields (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-25-yaml-full-config-brainstorm.md`).
- [ ] Permissive config-file permissions emit warning-only behavior (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-25-yaml-full-config-brainstorm.md`).

### Contract and Reliability Requirements

- [ ] Config validation failures are deterministic and source-attributed.
- [ ] Usage/config failures remain exit code `2`; runtime provider failures remain exit code `1`.
- [ ] No ambiguous TOML fallback path executes at runtime.
- [ ] Diagnostics redact secret material consistently.

### Quality Gates (TDD)

- [ ] Every phase starts with failing tests (red -> green).
- [ ] Unit + integration + contract suites pass for migrated config behavior.
- [ ] `bun test` and `bun x tsc --noEmit` pass before completion.

## Success Metrics

- Zero TOML runtime dependency in active CLI behavior.
- Deterministic migration guidance for TOML-only users.
- No secret leakage regressions in config-related warnings/errors.
- No behavior regressions across existing LLM-powered commands after YAML cutover.

## Dependencies & Risks

- **Risk:** Big-bang scope increases merge and regression risk across shared config consumers.
  - **Mitigation:** strict TDD phase order + integration contract coverage per feature path.
- **Risk:** Hard switch may surprise existing TOML users.
  - **Mitigation:** clear migration command, deterministic message, and doc updates.
- **Risk:** Inline keys increase accidental exposure risk.
  - **Mitigation:** warning policy + strict redaction/sanitization at output boundaries.
- **Risk:** Drift between CLI expectations and agent runtime semantics.
  - **Mitigation:** shared validation contracts and explicit parity guard tests.

## Documentation Plan

- Replace TOML references in sample config and user-facing docs with YAML equivalents.
- Add migration guidance section for TOML-to-YAML hard switch.
- Update brainstorm/plan cross-links where config path assumptions changed.

## Sources & References

### Origin

- Brainstorm document: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-25-yaml-full-config-brainstorm.md`
- Key carried-forward decisions: hard YAML switch, env precedence over YAML, inline key allowance, warning-only permission policy, full-config scope.

### Internal References

- `src/config/llm-config.ts:84`
- `src/config/llm-config.ts:137`
- `src/config/llm-config.ts:147`
- `src/config/llm-config.ts:153`
- `src/cli/index.tsx:279`
- `src/cli/index.tsx:597`
- `src/cli/strategy-flow.ts:81`
- `config.toml.example:2`
- `tests/config/llm-config.test.ts:10`

### Institutional Learnings

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`
- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- `docs/solutions/workflow-issues/20260310-parallel-branch-reconciliation-contract-validation.md`
