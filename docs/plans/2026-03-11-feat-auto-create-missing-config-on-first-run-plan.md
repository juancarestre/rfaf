---
title: "feat: Auto-create missing config on first run"
type: feat
status: active
date: 2026-03-11
origin: docs/brainstorms/2026-03-11-auto-create-missing-config-brainstorm.md
---

# feat: Auto-create missing config on first run

## Overview

Add first-run onboarding for missing config: when a user runs transform commands and `~/.rfaf/config.yaml` is missing, interactive CLI sessions should offer creating the config automatically, then continue the same command in the same run (see brainstorm: `docs/brainstorms/2026-03-11-auto-create-missing-config-brainstorm.md`).

Non-interactive behavior remains deterministic and fail-closed with the existing config error contract (see brainstorm: `docs/brainstorms/2026-03-11-auto-create-missing-config-brainstorm.md`).

This plan is TDD-first.

## Problem Statement / Motivation

Current behavior blocks first-time users with a manual setup step:

- `Config error: missing config file at /Users/.../.rfaf/config.yaml. Create ~/.rfaf/config.yaml.`

This is correct but high-friction for interactive usage. The product goal is to keep strong deterministic contracts while reducing first-run friction for terminal users (see brainstorm: `docs/brainstorms/2026-03-11-auto-create-missing-config-brainstorm.md`).

## Brainstorm Decisions Carried Forward

From `docs/brainstorms/2026-03-11-auto-create-missing-config-brainstorm.md`:

- Interactive sessions only: offer auto-create in TTY, not in non-interactive mode.
- Non-interactive sessions remain fail-closed with current config error contract.
- Template source is `config.yaml.example`.
- After creation, continue command immediately in the same run.
- Enforce secure permissions `600` on created config.
- Scope is missing-config startup path for transform commands.

Open questions in brainstorm: none.

## Research Decision

Proceeding without external research.

Reason: this is a local CLI behavior change with strong existing patterns and tests in repo (`src/config/*`, `src/cli/*`, `tests/cli/*`, `tests/config/*`).

## Consolidated Local Findings

- Missing config is thrown by loader: `src/config/llm-config.ts:246`.
- CLI maps config/usage failures to deterministic exit code `2`: `src/cli/index.tsx:612` and `src/cli/index.tsx:624`.
- Existing bounded interactive prompt patterns already exist: `src/cli/timeout-recovery.ts:49`.
- Existing default path/override behavior exists:
  - default `~/.rfaf/config.yaml` resolution in `src/config/llm-config.ts:236`
  - `RFAF_CONFIG_PATH` override in `src/config/llm-config.ts:242`
- Existing permission-hardening precedent and tests:
  - warning behavior in `src/config/llm-config.ts:150`
  - tested in `tests/config/yaml-config-permissions-warning.test.ts:23`
- Existing missing-config transform contracts to extend:
  - `tests/cli/summary-cli-contract.test.ts:78`
  - `tests/cli/no-bs-cli-contract.test.ts:33`
  - `tests/cli/translate-cli-contract.test.ts:33`
  - `tests/cli/key-phrases-cli-contract.test.ts:41`

## Proposed Solution

Implement Approach A from brainstorm: interactive quick-create from template (see brainstorm: `docs/brainstorms/2026-03-11-auto-create-missing-config-brainstorm.md`).

Behavior contract:

1. When config is missing and mode is interactive (`stdin.isTTY && stdout.isTTY`), ask once whether to create config now.
2. On confirm, create parent dir if needed, copy `config.yaml.example` to `~/.rfaf/config.yaml`, set mode `600`, reload config, and continue original command exactly once.
3. On decline (or prompt timeout/error), preserve fail-closed behavior with deterministic config error.
4. In non-interactive mode, do not prompt and keep current config error + exit code `2`.

Scope boundary:

- Auto-create is only for the default path `~/.rfaf/config.yaml` in this phase; `RFAF_CONFIG_PATH` missing-file flows remain current fail-closed behavior.

## Alternative Approaches Considered

- Dedicated `--init-config` command: explicit but keeps first-run friction during normal transform commands.
- Full setup wizard: richer but unnecessary complexity and larger failure surface for current goal.

Both were rejected in favor of YAGNI and direct onboarding win (see brainstorm: `docs/brainstorms/2026-03-11-auto-create-missing-config-brainstorm.md`).

## Technical Considerations

- Reuse existing bounded prompt conventions to avoid hanging sessions.
- Keep typed/deterministic error classification and CLI exit code behavior.
- Use atomic/non-clobber write semantics to avoid race/corruption in concurrent first-run starts.
- Enforce `600` after write; chmod failure is fail-closed and surfaced clearly.
- Preserve existing invalid-config behavior (no auto-overwrite if file exists but YAML is invalid).

## System-Wide Impact

- **Interaction graph**: CLI command parse -> config load -> missing-config branch -> interactive prompt -> optional file create/chmod -> reload config -> transform flow (`summary/no-bs/translate/key-phrases`) -> existing runtime pipeline.
- **Error propagation**: prompt-decline/timeout/create-failure/chmod-failure all map to deterministic config/setup errors; non-interactive remains current fail-closed path.
- **State lifecycle risks**: partial file writes or races can create broken config; mitigate with atomic create + no overwrite + explicit cleanup rules.
- **API surface parity**: this is CLI startup onboarding only; agent APIs unchanged in this phase.
- **Integration test scenarios**:
  - interactive accept creates config and continues same command,
  - interactive decline returns deterministic config error,
  - non-interactive remains fail-closed,
  - concurrent create attempts do not corrupt file,
  - chmod failure remains fail-closed.

## TDD-First Plan

### Phase 1 - Red: Contract Tests

- Extend/add CLI/config contracts first:
  - `tests/cli/summary-cli-contract.test.ts`
  - `tests/cli/no-bs-cli-contract.test.ts`
  - `tests/cli/translate-cli-contract.test.ts`
  - `tests/cli/key-phrases-cli-contract.test.ts`
  - `tests/config/yaml-loader-contract.test.ts`
  - `tests/config/yaml-config-permissions-warning.test.ts`
  - new PTY integration test for interactive create/continue path:
    - `tests/cli/config-bootstrap-pty-contract.test.ts`

### Phase 2 - Green: Minimal Implementation

- Implement missing-config bootstrap orchestration and bounded prompt behavior:
  - `src/cli/index.tsx`
  - `src/config/llm-config.ts`
  - new helper for config bootstrap prompt/copy/permissions:
    - `src/cli/config-bootstrap.ts`

### Phase 3 - Hardening

- Add race-safe create semantics and explicit failure messaging contracts.
- Verify execute-once invariant for the original command after successful create.

### Phase 4 - Validation

- `bun test`
- `bun x tsc --noEmit`

## Acceptance Criteria

- [ ] Missing default config in interactive mode prompts once to auto-create (see brainstorm: `docs/brainstorms/2026-03-11-auto-create-missing-config-brainstorm.md`).
- [ ] Accepting prompt copies `config.yaml.example` to `~/.rfaf/config.yaml` and enforces mode `600`.
- [ ] After successful create, the original transform command continues in the same run and executes exactly once.
- [ ] Decline/prompt-timeout/create-failure/chmod-failure paths are deterministic and fail-closed.
- [ ] Non-interactive mode keeps existing config error contract and exit code `2`.
- [ ] Existing invalid-config (present but malformed) behavior remains unchanged.
- [ ] `RFAF_CONFIG_PATH` override missing-config behavior remains unchanged in this phase (explicit scope boundary).
- [ ] New and updated tests pass (TDD-first delivery).
- [ ] `bun test` and `bun x tsc --noEmit` pass.

## Success Metrics

- Reduced first-run friction for interactive users with missing config.
- No regressions in deterministic non-interactive contracts.
- No permission-warning regressions for auto-created files due to enforced `600` mode.

## Dependencies & Risks

- **Risk:** prompt hangs or confusing interaction.
  - **Mitigation:** bounded prompt timeout + deterministic abort behavior.
- **Risk:** race conditions in concurrent first run.
  - **Mitigation:** atomic create/no-clobber semantics + concurrency contract tests.
- **Risk:** accidental broad scope via `RFAF_CONFIG_PATH` path handling.
  - **Mitigation:** explicit phase boundary and tests for unchanged override behavior.
- **Risk:** contradictory output/exit behavior.
  - **Mitigation:** assert stderr/exit contracts in CLI tests before implementation.

## Sources & References

- **Origin brainstorm:** `docs/brainstorms/2026-03-11-auto-create-missing-config-brainstorm.md`
- Internal references:
  - `src/config/llm-config.ts:236`
  - `src/config/llm-config.ts:246`
  - `src/cli/index.tsx:612`
  - `src/cli/index.tsx:624`
  - `src/cli/timeout-recovery.ts:49`
  - `tests/config/yaml-loader-contract.test.ts:66`
  - `tests/config/yaml-config-permissions-warning.test.ts:23`
- Related institutional learnings:
  - `docs/solutions/integration-issues/unified-timeout-reliability-parity-p1-p2-hardening-20260311.md`
  - `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
  - `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
