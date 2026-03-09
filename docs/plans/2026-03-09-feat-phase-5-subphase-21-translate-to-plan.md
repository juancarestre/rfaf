---
title: "feat: Phase 5 Subphase 21 --translate-to"
type: feat
status: completed
date: 2026-03-09
origin: docs/brainstorms/2026-03-09-rfaf-phase-5-subphase-21-translate-to-brainstorm.md
---

# feat: Phase 5 Subphase 21 `--translate-to`

## Overview

Implement explicit translation via `--translate-to` so users can intentionally read transformed content in a target language.

This keeps current defaults intact: no automatic translation in summarize/no-bs unless `--translate-to` is provided (see brainstorm: `docs/brainstorms/2026-03-09-rfaf-phase-5-subphase-21-translate-to-brainstorm.md`).

## Problem Statement / Motivation

rfaf now has strict language-preservation defaults in summarize and no-bs. Users still need an explicit way to translate content when desired. Without a first-class translation contract, language changes remain either unavailable or nondeterministic.

We need a deterministic translation stage that:
- accepts flexible target inputs (codes + names + variants like `english`, `English`, `ingles`)
- normalizes targets robustly
- fails closed on unresolved/ambiguous targets
- preserves CLI/agent parity and existing exit semantics

## Brainstorm Decisions Carried Forward

From `docs/brainstorms/2026-03-09-rfaf-phase-5-subphase-21-translate-to-brainstorm.md`:

- Explicit translation only via `--translate-to` (see brainstorm section “What We’re Building”).
- Chosen approach: hybrid parser + constrained LLM normalizer (see brainstorm “Why This Approach”).
- Transform order: `no-bs -> summary -> translate` (see brainstorm “Key Decisions”).
- Fail closed on translation failures, no silent fallback (see brainstorm “Key Decisions”).
- Full CLI + agent parity in this subphase (see brainstorm “Key Decisions”).
- Provider-supported language scope, but deterministic failure for unresolved/ambiguous targets (see brainstorm “Key Decisions”).
- If source is already target language, skip translation (see brainstorm “Resolved Questions”).

## Research Decision

External research is skipped. Local repository patterns and institutional learnings are strong and directly applicable for this feature class.

## Proposed Solution

Add a translation stage to the existing reading pipeline with strict contracts:

1. Parse `--translate-to` as an explicit feature flag with value.
2. Normalize target language using hybrid resolver:
   - deterministic local normalization first
   - constrained LLM normalization fallback for fuzzy names/variants
3. Run translation stage after no-bs and summary.
4. Skip translation when source language already matches normalized target.
5. Fail closed on any unresolved/ambiguous/unsupported/runtime failures.
6. Mirror behavior in agent API with parity tests.

## Technical Approach

### Architecture

Primary files/seams:
- `src/cli/index.tsx` (flag parse/validation/exit semantics)
- `src/cli/reading-pipeline.ts` (canonical stage ordering)
- `src/cli/errors.ts` (typed runtime error classes)
- `src/llm/summarize.ts` and `src/llm/no-bs.ts` (patterns to mirror)
- `src/config/llm-config.ts` (provider/model/key/retry/timeout conventions)
- `src/agent/reader-api.ts` (agent parity surface)

New modules (expected):
- `src/cli/translate-option.ts`
- `src/cli/translate-flow.ts`
- `src/llm/translate.ts`
- `src/llm/language-normalizer.ts` (or equivalent utility)

### Stage Ordering Contract

Mutating stages must execute in this exact order:
- `no-bs -> summary -> translate -> tokenize -> mode transform`

Preflight checks (target normalization/provider-support checks) are allowed before mutation, but may not reorder mutation stages.

### Deterministic Contract Matrix

Define explicit stable classes (names can be refined during implementation, semantics cannot):

- `TRANSLATE_TARGET_MISSING` -> usage error, exit `2`
- `TRANSLATE_TARGET_INVALID` -> usage error, exit `2`
- `TRANSLATE_TARGET_AMBIGUOUS` -> usage/config error, exit `2`
- `TRANSLATE_TARGET_UNRESOLVED` -> usage/config error, exit `2`
- `TRANSLATE_TARGET_UNSUPPORTED` -> runtime/config-classified deterministic failure, exit `1` or `2` based on final mapping
- `TRANSLATE_RUNTIME_TIMEOUT` -> runtime, exit `1`
- `TRANSLATE_RUNTIME_NETWORK` -> runtime, exit `1`
- `TRANSLATE_RUNTIME_SCHEMA` -> runtime, exit `1`
- `TRANSLATE_RUNTIME_PROVIDER` -> runtime, exit `1`

No silent fallback to untranslated output on failures.

### System-Wide Impact

- **Interaction graph:** CLI arg parse -> option resolvers -> reading pipeline (`no-bs -> summary -> translate`) -> tokenize -> mode transform -> UI runtime.
- **Error propagation:** lower-level normalize/translate typed errors map to deterministic CLI/agent contracts.
- **State lifecycle risks:** no persistent DB state; risk is contract drift/parity divergence.
- **API surface parity:** CLI and agent must align on normalization outcomes, stage sequencing decisions, and error classes.
- **Integration test scenarios:** valid target, ambiguous target, unresolved target, source==target skip, runtime timeout/network/schema/provider failures.

## SpecFlow Gaps Incorporated

Added from spec-flow analysis:
- explicit no-flag flow (`--translate-to` absent => translation stage never runs)
- malformed/empty/duplicate translate flag handling
- distinct ambiguous vs unresolved target contracts
- source-already-target skip policy with confidence threshold tests
- deterministic matrix for parse/config/runtime classes and exit codes
- parity oracle definition (contract-equal behavior across CLI and agent)

## TDD-First Implementation Phases

### Phase 1: Option + Parse Contracts (Red -> Green)

Tests first:
- `tests/cli/translate-option.test.ts` (new)
- `tests/cli/translate-cli-contract.test.ts` (new)

Add failing coverage for:
- missing/empty target value
- malformed valued forms
- duplicates
- deterministic usage failures and exit code semantics

Then implement minimal parse/resolve behavior.

### Phase 2: Target Normalization Contracts (Red -> Green)

Tests first:
- `tests/llm/language-normalizer.test.ts` (new)
- fixtures for code/name/variant normalization

Add failing coverage for:
- direct codes (`es`, `pt-BR`)
- names/variants (`english`, `English`, `ingles`)
- ambiguous targets (deterministic ambiguous failure)
- unresolved targets (deterministic unresolved failure)

Then implement hybrid normalization.

### Phase 3: Translate Runtime + Pipeline Ordering (Red -> Green)

Tests first:
- `tests/llm/translate.test.ts` (new)
- `tests/cli/translate-flow.test.ts` (new)
- extend `tests/cli/*-flow.test.ts` for ordering assertion

Add failing coverage for:
- strict stage order `no-bs -> summary -> translate`
- source==target skip behavior
- runtime timeout/network/schema/provider deterministic failures
- no fallback behavior

Then implement translate runtime and pipeline integration.

### Phase 4: Agent Parity (Red -> Green)

Tests first:
- extend `tests/agent/reader-api.test.ts`

Add failing coverage for:
- same normalization decisions as CLI
- same skip/failure semantics
- same deterministic error classes for translation flows

Then implement/adjust agent command path.

### Phase 5: Full Validation + Cleanup

- `bun test`
- `bun x tsc --noEmit`

Refactor only with green tests (no behavior changes).

## Acceptance Criteria

- [x] `--translate-to` is the only path that changes language (see brainstorm: `docs/brainstorms/2026-03-09-rfaf-phase-5-subphase-21-translate-to-brainstorm.md`).
- [x] Target input supports codes + names + variants through hybrid normalization.
- [x] Ambiguous and unresolved target cases fail deterministically with distinct contracts.
- [x] Stage ordering is enforced: `no-bs -> summary -> translate`.
- [x] If source is already target language, translation is skipped deterministically.
- [x] Translation failures are fail-closed (no silent untranslated fallback).
- [x] CLI and agent translation behavior are parity-aligned in the same subphase.
- [x] Tests are written first in each phase (red -> green).
- [x] `bun test` and `bun x tsc --noEmit` pass.

## Success Metrics

- Users can provide flexible translation targets without manual format lookup.
- Zero nondeterministic translate contract failures in CI suites.
- No parity drift findings for translation behavior in follow-up reviews.

## Dependencies & Risks

- **Risk:** normalization nondeterminism for fuzzy names.
  - **Mitigation:** constrained schema output + deterministic ambiguous/unresolved buckets.
- **Risk:** translation stage increases latency/cost.
  - **Mitigation:** skip when source==target and bounded retries/timeouts.
- **Risk:** CLI/agent drift.
  - **Mitigation:** parity tests in same change set.
- **Risk:** retry misclassification.
  - **Mitigation:** typed/signal-based retry classes, avoid message-substring routing.

## Sources & References

### Origin
- `docs/brainstorms/2026-03-09-rfaf-phase-5-subphase-21-translate-to-brainstorm.md`

### Internal References
- `src/cli/index.tsx`
- `src/cli/reading-pipeline.ts`
- `src/cli/summarize-flow.ts`
- `src/cli/no-bs-flow.ts`
- `src/llm/summarize.ts`
- `src/llm/no-bs.ts`
- `src/config/llm-config.ts`
- `src/agent/reader-api.ts`

### Institutional Learnings
- `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`
- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- `docs/solutions/integration-issues/markdown-ingestion-deterministic-contracts-timeout-size-guardrails-cli-agent-parity.md`
- `docs/solutions/integration-issues/epub-ingestion-deterministic-guardrails-cli-agent-parity-hardening.md`
- `docs/solutions/logic-errors/20260306-bionic-mode-p2-hardening-parity-validation-caching-unicode-safety.md`
