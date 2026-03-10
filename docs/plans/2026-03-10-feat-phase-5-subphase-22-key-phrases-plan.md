---
title: "feat: Phase 5 Subphase 22 --key-phrases"
type: feat
status: completed
date: 2026-03-10
origin: docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-22-key-phrases-brainstorm.md
---

# feat: Phase 5 Subphase 22 `--key-phrases`

## Overview

Implement `--key-phrases` as an LLM-powered reading aid that adds:
- pre-read preview (top 5-10 phrases)
- in-stream phrase emphasis while reading
- standalone key phrase list output for quick study

This plan carries forward the brainstorm's chosen dual-output direction and strict behavior constraints (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-22-key-phrases-brainstorm.md`).

## Problem Statement / Motivation

rfaf currently supports transform-oriented LLM features (`--summary`, `--no-bs`, `--translate-to`) but lacks a semantic emphasis layer that helps readers immediately focus on core ideas.

Without a first-class `--key-phrases` contract, users cannot reliably get:
- a quick pre-read map of important concepts
- consistent emphasis during playback
- deterministic behavior when combined with existing transforms

The feature must preserve existing rfaf principles: deterministic CLI behavior, fail-closed LLM runtime, and CLI/agent parity.

## Brainstorm Decisions Carried Forward

From `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-22-key-phrases-brainstorm.md`:

- Chosen approach: dual output mode (preview + in-stream emphasis + standalone phrase list output) (see brainstorm: Why This Approach).
- Extraction source: LLM-generated phrases only (see brainstorm: Key Decisions).
- Default intensity: medium emphasis density (see brainstorm: Key Decisions).
- Preview scope: top 5-10 phrases before playback (see brainstorm: Key Decisions).
- Failure policy: fail closed with clear actionable error (see brainstorm: Key Decisions).
- Pipeline interaction: analyze final pre-reading text when composed with other flags (see brainstorm: Key Decisions).
- Open questions: none remaining (see brainstorm: Open Questions).

## Research Decision

External research is skipped. Repository patterns and institutional learnings are strong and directly applicable:
- existing LLM feature and contract patterns already cover parse determinism, fail-closed runtime handling, and parity
- this subphase extends an established architecture, not a novel framework domain

## Consolidated Research Findings

### Repository Patterns

- CLI flags and parse normalization pattern live in `src/cli/index.tsx:125`, `src/cli/index.tsx:156`, `src/cli/index.tsx:203`, `src/cli/index.tsx:244`.
- Canonical transform order is explicit in `src/cli/reading-pipeline.ts:55` through `src/cli/reading-pipeline.ts:127`.
- Existing order contract tests already exist (`tests/cli/no-bs-order-flow.test.ts:55`).
- Error taxonomy + exit semantics are centralized in `src/cli/errors.ts:1` and `src/cli/index.tsx:442`.
- Agent parity surface is centralized in `src/agent/reader-api.ts:564`, `src/agent/reader-api.ts:634`, `src/agent/reader-api.ts:705`, `src/agent/reader-api.ts:793`.
- Current emphasis mechanisms are render/metadata based (`src/ui/components/WordDisplay.tsx:46`, `src/processor/bionic.ts:67`, `src/processor/chunker.ts:48`).

### Institutional Learnings

- Preserve strict sequencing contracts and test them directly (`docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`).
- Do not rely on env/filesystem side effects during argument parsing (`docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`).
- Fail closed with typed errors for LLM ambiguity/schema/runtime failures (`docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`).
- Keep canonical content immutable; apply emphasis in presentation metadata (`docs/solutions/logic-errors/20260306-bionic-mode-p2-hardening-parity-validation-caching-unicode-safety.md`).
- Protect render/highlight correctness with width/sanitization-aware tests (`docs/solutions/ui-bugs/line-break-and-highlight-drift-guided-scroll-20260306.md`).

## Proposed Solution

Add a key-phrase stage with deterministic contracts:

1. Parse `--key-phrases` as explicit feature activation.
2. Run phrase extraction against final pre-reading text after mutating transforms.
3. Materialize a single phrase artifact per run.
4. Reuse that artifact for all three outputs:
   - preview before playback
   - in-stream emphasis annotations
   - standalone phrase list output
5. Fail closed on extraction/contract/runtime errors.
6. Mirror behavior in agent API in the same subphase.

## Technical Approach

### Architecture

Primary files/seams to update:
- `src/cli/index.tsx` (flag parse/validation)
- `src/cli/reading-pipeline.ts` (stage insertion and order)
- `src/cli/errors.ts` (typed key-phrases errors)
- `src/ui/components/WordDisplay.tsx` (emphasis rendering)
- `src/ui/screens/RSVPScreen.tsx` and `src/ui/screens/GuidedScrollScreen.tsx` (mode behavior)
- `src/agent/reader-api.ts` (agent parity)

Expected new modules:
- `src/cli/key-phrases-option.ts`
- `src/cli/key-phrases-flow.ts`
- `src/llm/key-phrases.ts`
- `src/processor/key-phrase-annotation.ts`

### Stage Ordering Contract

Mutating and analysis stages must execute in this order:

- `no-bs -> summary -> translate -> key-phrases -> tokenize -> mode transform`

This preserves brainstorm intent that key phrases analyze the final text the user will read (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-22-key-phrases-brainstorm.md`).

### Output Contract

Define explicit stable behavior:

- Preview block emits top 5-10 phrases in deterministic order before playback starts.
- In-stream emphasis applies only to extracted phrases; no source text mutation.
- Standalone phrase list output is deterministic, machine-readable enough for scripting, and contains no playback side effects.

### Deterministic Error Contract Matrix

Stable semantic classes (exact symbol names can be refined during implementation):

- `KEY_PHRASES_USAGE_INVALID` -> usage error, exit `2`
- `KEY_PHRASES_CONFIG_INVALID` -> config/usage error, exit `2`
- `KEY_PHRASES_RUNTIME_TIMEOUT` -> runtime error, exit `1`
- `KEY_PHRASES_RUNTIME_NETWORK` -> runtime error, exit `1`
- `KEY_PHRASES_RUNTIME_SCHEMA` -> runtime error, exit `1`
- `KEY_PHRASES_RUNTIME_PROVIDER` -> runtime error, exit `1`
- `KEY_PHRASES_CONTRACT_EMPTY` -> runtime error, exit `1`
- `KEY_PHRASES_CONTRACT_INVALID_SHAPE` -> runtime error, exit `1`

No silent fallback to non-emphasized playback when feature is explicitly requested.

## System-Wide Impact

- **Interaction graph:** CLI arg parse -> option resolver -> transform pipeline (`no-bs -> summary -> translate -> key-phrases`) -> tokenize/mode transform -> preview/render surfaces.
- **Error propagation:** provider/validation failures normalize to typed key-phrases errors, then map to existing deterministic CLI/agent error envelopes.
- **State lifecycle risks:** no database state; primary risk is artifact drift if preview/emphasis/list are derived separately. Mitigation: single shared artifact.
- **API surface parity:** CLI and agent must share extraction contract, ordering, and error mapping.
- **Integration scenarios:** combined flags, non-Latin text, long documents, malformed provider output, cancellation/non-interactive invocation.

## SpecFlow Gaps Incorporated

SpecFlow analysis added the following requirements to this plan:

- explicit argument contract for `--key-phrases` forms and invalid combinations
- deterministic phrase count bounds and ordering rules
- overlap/subphrase emphasis boundary handling
- explicit output schema for standalone list mode
- flag-order invariance tests
- no-partial-output guarantee on fail-closed paths

## TDD-First Implementation Phases

### Phase 1: CLI Option + Contract Tests (Red -> Green)

Tests first:
- `tests/cli/key-phrases-option.test.ts` (new)
- `tests/cli/key-phrases-cli-contract.test.ts` (new)

Start with failing coverage for:
- valid/invalid argv forms
- duplicate/conflicting values
- deterministic usage/config failures and exit code mapping

Then implement minimum option/parse behavior.

### Phase 2: Extraction Contract Tests (Red -> Green)

Tests first:
- `tests/llm/key-phrases.test.ts` (new)
- `tests/fixtures/key-phrases/*.txt` (new)

Start with failing coverage for:
- top 5-10 output bounds
- deterministic ordering and dedupe
- malformed provider payload/schema failures
- timeout/network/provider class mapping

Then implement constrained extraction runtime.

### Phase 3: Pipeline Composition Tests (Red -> Green)

Tests first:
- `tests/cli/key-phrases-flow.test.ts` (new)
- extend `tests/cli/no-bs-order-flow.test.ts` (ordering assertion update)

Start with failing coverage for:
- strict ordering: `no-bs -> summary -> translate -> key-phrases`
- composition invariance regardless of flag order in argv
- fail-closed behavior (no playback/list on extraction failure)

Then implement pipeline integration.

### Phase 4: Emphasis + Output Behavior Tests (Red -> Green)

Tests first:
- `tests/ui/word-display-key-phrases.test.tsx` (new)
- `tests/ui/guided-scroll-key-phrases.test.tsx` (new)
- `tests/cli/key-phrases-standalone-output.test.ts` (new)

Start with failing coverage for:
- phrase emphasis alignment in RSVP/chunked/scroll modes
- punctuation/case/overlap boundaries
- stable standalone list format

Then implement rendering/output behavior with shared phrase artifact.

### Phase 5: Agent Parity Tests (Red -> Green)

Tests first:
- extend `tests/agent/reader-api.test.ts`
- add `tests/agent/reader-api-key-phrases-parity.test.ts` (new)

Start with failing coverage for:
- same extraction and ordering semantics as CLI
- same fail-closed typed errors
- same preview/list contracts where applicable

Then implement parity path in `src/agent/reader-api.ts`.

### Phase 6: Full Validation + Refactor Guardrails

Validation gates:
- `bun test`
- `bun x tsc --noEmit`

Refactor only under green tests; no behavior changes.

## Acceptance Criteria

### Functional Requirements

- [x] `--key-phrases` shows a top 5-10 phrase preview before playback (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-22-key-phrases-brainstorm.md`).
- [x] Reading playback applies in-stream emphasis based on extracted phrases without mutating canonical text.
- [x] Standalone phrase list output is available in this subphase (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-22-key-phrases-brainstorm.md`).
- [x] Phrase extraction is LLM-only for this feature scope.
- [x] Default emphasis density is medium.

### Composition and Contract Requirements

- [x] Key phrases analyze final pre-reading text after `--no-bs`, `--summary`, and `--translate-to` transforms.
- [x] Pipeline order is test-enforced: `no-bs -> summary -> translate -> key-phrases -> tokenize -> mode transform`.
- [x] `--key-phrases` failures are fail-closed with deterministic typed errors.
- [x] CLI exit code contract remains consistent (`2` usage/config, `1` runtime).
- [x] No partial outputs are emitted on fail-closed paths.

### Quality Gates (TDD)

- [x] Every implementation phase begins with failing tests (red -> green).
- [x] Unit, integration, UI behavior, and parity suites pass.
- [x] Full suite and typecheck pass (`bun test`, `bun x tsc --noEmit`).

## Success Metrics

- Users can identify important ideas before playback from the preview block.
- Emphasis improves reading guidance without changing source meaning.
- Zero nondeterministic key-phrases contract failures in CI.
- No CLI/agent parity drift for key-phrases behavior.

## Dependencies & Risks

- **Risk:** phrase extraction variability causes unstable outputs.
  - **Mitigation:** strict schema validation, deterministic ordering/dedupe, fail-closed enforcement.
- **Risk:** added LLM stage increases latency.
  - **Mitigation:** bounded timeout/retry rules and single artifact reuse.
- **Risk:** emphasis mismatches around punctuation/overlaps.
  - **Mitigation:** explicit boundary fixtures and width/sanitization-aware UI tests.
- **Risk:** CLI/agent drift.
  - **Mitigation:** same-subphase parity tests and shared helper seams.

## Sources & References

### Origin

- Brainstorm document: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-22-key-phrases-brainstorm.md`
  - carried-forward decisions: dual output scope, LLM-only extraction, medium default emphasis, top 5-10 preview, fail-closed policy, final-text analysis rule.

### Internal References

- `src/cli/index.tsx:125`
- `src/cli/index.tsx:244`
- `src/cli/reading-pipeline.ts:55`
- `src/cli/reading-pipeline.ts:127`
- `src/cli/errors.ts:1`
- `src/agent/reader-api.ts:564`
- `src/agent/reader-api.ts:793`
- `src/ui/components/WordDisplay.tsx:46`
- `tests/cli/no-bs-order-flow.test.ts:55`

### Institutional Learnings

- `docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`
- `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`
- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/logic-errors/20260306-bionic-mode-p2-hardening-parity-validation-caching-unicode-safety.md`
- `docs/solutions/ui-bugs/line-break-and-highlight-drift-guided-scroll-20260306.md`
