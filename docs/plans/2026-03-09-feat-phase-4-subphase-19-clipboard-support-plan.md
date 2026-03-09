---
title: "feat: Add clipboard source ingestion with deterministic contracts"
type: feat
status: completed
date: 2026-03-09
origin: docs/brainstorms/2026-03-09-rfaf-phase-4-subphase-19-clipboard-support-brainstorm.md
---

# feat: Add clipboard source ingestion with deterministic contracts

## Overview

Add Phase 4 Subphase 19 clipboard support so users can run `rfaf --clipboard` and read copied text immediately, while preserving deterministic behavior and existing file/url/stdin semantics (see brainstorm: `docs/brainstorms/2026-03-09-rfaf-phase-4-subphase-19-clipboard-support-brainstorm.md`).

This plan is **TDD-first**: each phase starts red (failing tests), then green (implementation), then validation.

## Problem Statement / Motivation

Users currently must save copied text to a file or pipe manually before reading. Clipboard support should remove this friction with one-command reliability, without widening scope or changing existing input precedence.

Carried-forward constraints from brainstorm:

- explicit `--clipboard` trigger only,
- plain-text clipboard only,
- fail-fast deterministic conflict when combined with file/url/stdin,
- CLI and agent parity in the same subphase,
- no auto fallback, no rich clipboard formats, no clipboard history/watch mode

(see brainstorm: `docs/brainstorms/2026-03-09-rfaf-phase-4-subphase-19-clipboard-support-brainstorm.md`).

## Proposed Solution

Implement clipboard as a dedicated source-ingest contract that returns `Document`, then reuse the existing source-agnostic reading pipeline.

- **New:** `src/ingest/clipboard.ts` - clipboard read + normalization + deterministic error mapping
- **Modified:** `src/ingest/detect.ts` or CLI arg-resolution path - explicit conflict validation for `--clipboard` with file/url/stdin
- **Modified:** `src/cli/index.tsx` - add `--clipboard`, deterministic conflict handling, clipboard ingest branch, help/examples
- **Modified:** `src/agent/reader-api.ts` - add clipboard ingest command and stable clipboard error-code mapping
- **Optional shared typing:** extend `src/ingest/errors.ts` for clipboard-specific typed ingest errors

Chosen approach matches brainstorm Option A (dedicated clipboard source contract) and keeps YAGNI boundaries intact (see brainstorm).

## Technical Considerations

- **Architecture impacts**
  - Preserve shared `Document` contract (`src/ingest/types.ts:1`) and source-agnostic pipeline (`src/cli/reading-pipeline.ts:33`).
  - Keep routing thin and source logic inside ingestor.
- **Performance implications**
  - Clipboard reads should be bounded and deterministic (timeout + size boundaries where applicable).
  - No startup impact for non-clipboard flows.
- **Security/runtime hardening**
  - Preserve canonical size-limit error message (`src/ingest/constants.ts:3`).
  - Keep terminal-safe output sanitization on user-visible strings.
  - Fail closed on unavailable/unsupported clipboard backends.

## System-Wide Impact

- **Interaction graph**: `main()` -> parse args -> resolve clipboard conflict/selection -> `readClipboard()` -> `Document` -> `buildReadingPipeline()` -> unchanged runtime.
- **Error propagation**: clipboard backend/validation errors normalize at ingest boundary, then flow through existing CLI exit-code policy.
- **State lifecycle risks**: no persistence; risks are backend availability variance and ambiguous source conflicts.
- **API surface parity**: CLI `--clipboard` and agent clipboard ingest must share deterministic validation/error contract.
- **Integration scenarios**: success path, conflict matrix, unsupported backend, empty clipboard, oversize clipboard, parity with agent.

## Implementation Plan (TDD-First)

### Phase 1 - CLI Flag + Conflict Matrix (Red -> Green)

1. Add failing CLI arg/contract tests first:
   - `tests/cli/clipboard-cli-contract.test.ts` (new)
2. Required red cases:
   - `rfaf --clipboard -- <file>` -> deterministic usage error (exit `2`)
   - `rfaf --clipboard <url>` -> deterministic usage error (exit `2`)
   - `cat stdin.txt | rfaf --clipboard` -> deterministic usage error (exit `2`)
   - conflict validation occurs before any source read side effect
3. Implement conflict validation in `src/cli/index.tsx` (or input-resolution seam).
4. Validate phase:
   - `bun test tests/cli/clipboard-cli-contract.test.ts`

### Phase 2 - Clipboard Ingestor Contract (Red -> Green)

1. Add failing ingest tests first:
   - `tests/ingest/clipboard.test.ts` (new)
2. Required red cases:
   - successful plain-text clipboard read -> `Document`
   - empty clipboard -> deterministic error
   - clipboard unavailable/unsupported -> deterministic error
   - permission denied/backend failure -> deterministic error
   - raw/extracted size boundaries -> canonical size message
   - terminal-safe deterministic source label (fixed source like `clipboard`)
3. Implement `src/ingest/clipboard.ts` with injectable clipboard-read seam for deterministic tests.
4. Validate phase:
   - `bun test tests/ingest/clipboard.test.ts`

### Phase 3 - CLI Runtime + Help + PTY Contracts (Red -> Green)

1. Add/extend failing tests first:
   - `tests/cli/clipboard-pty-contract.test.ts` (new)
   - extend `tests/cli/help-cli-contract.test.ts`
2. Required cases:
   - `rfaf --clipboard` starts runtime for valid clipboard text
   - deterministic stderr + exit codes for clipboard failures
   - help text documents clipboard flag + examples
3. Implement CLI wiring/help updates in `src/cli/index.tsx`.
4. Validate phase:
   - `bun test tests/cli/clipboard-cli-contract.test.ts tests/cli/clipboard-pty-contract.test.ts tests/cli/help-cli-contract.test.ts`

### Phase 4 - Agent Parity + Error Contract (Red -> Green)

1. Add failing agent tests first:
   - extend `tests/agent/reader-api.test.ts`
2. Required parity cases:
   - successful clipboard ingest command
   - clipboard failure matrix -> stable agent error codes/messages
   - unknown clipboard failures -> deterministic clipboard-specific fallback code
3. Implement in `src/agent/reader-api.ts` (and `src/ingest/errors.ts` if using typed clipboard errors).
4. Validate phase:
   - `bun test tests/agent/reader-api.test.ts`

### Phase 5 - Regression + Full Validation

1. Add non-regression tests:
   - extend `tests/ingest/detect.test.ts` as needed to prove existing file/url/stdin precedence is unchanged when `--clipboard` is not used.
2. Run full suite:
   - `bun test`
   - `bun x tsc --noEmit`
3. Confirm no regressions in plaintext/stdin/url/pdf/epub/markdown flows.

## Alternative Approaches Considered

### Option A - Dedicated clipboard source contract (Chosen)

- Pros: strongest determinism and parity clarity with minimal architectural churn.
- Cons: requires explicit conflict matrix + backend normalization work.
- Chosen per brainstorm (see brainstorm).

### Option B - Clipboard as stdin wrapper

- Pros: smaller immediate code change.
- Cons: weaker explicit source semantics and less clear parity/error contracts.
- Rejected by brainstorm rationale.

### Option C - Broad clipboard backend abstraction first

- Pros: potentially future-ready.
- Cons: over-scope for subphase objective (YAGNI violation).
- Rejected by brainstorm rationale.

## Acceptance Criteria

### Functional Requirements

- [x] `rfaf --clipboard` ingests clipboard plain text and starts reading.
- [x] Clipboard output is normalized into existing `Document` contract with unchanged downstream mode behavior.
- [x] `--clipboard` cannot be combined with file/url/piped stdin; conflicts fail fast deterministically.
- [x] No auto fallback clipboard reads are introduced.
- [x] No rich HTML/image clipboard parsing is introduced in this subphase.
- [x] CLI and agent clipboard ingest parity ship together.

### Deterministic Failure Requirements

- [x] Empty clipboard returns deterministic error contract.
- [x] Unsupported/unavailable clipboard backend returns deterministic error contract.
- [x] Clipboard permission/backend failures return deterministic error contract.
- [x] Oversize clipboard payload returns canonical `Input exceeds maximum supported size`.
- [x] Unknown clipboard failures normalize to stable clipboard-specific fallback class.

### Non-Functional Requirements

- [x] Existing file/url/stdin detection precedence remains unchanged when `--clipboard` is absent.
- [x] Terminal-bound source/error strings remain sanitized.
- [x] Clipboard path does not introduce startup/perf regressions for non-clipboard runs.

### Quality Gates (TDD-First)

- [x] Tests are authored first in each phase (red -> green -> refactor).
- [x] Clipboard ingest unit tests cover success + full failure matrix.
- [x] CLI clipboard contract + PTY tests pass.
- [x] Agent parity/error-contract tests pass.
- [x] `bun test` passes.
- [x] `bun x tsc --noEmit` passes.

## Success Metrics

- `rfaf --clipboard` works reliably on supported environments with deterministic behavior.
- Clipboard conflict behavior is deterministic and unambiguous.
- No regressions to existing source ingestion behavior.
- Scope boundaries from brainstorm are preserved.

## Dependencies & Risks

### Dependencies

- Platform clipboard command/backends (OS-specific execution behavior)

### Risks

- **Cross-platform clipboard variance**: backend not present or unavailable in CI/headless shells.
  - Mitigation: injectable clipboard-read seam + deterministic fallback errors.
- **Conflict precedence regressions**: clipboard may accidentally override existing precedence.
  - Mitigation: explicit conflict tests and pre-read validation.
- **Parity drift**: CLI behavior diverges from agent behavior.
  - Mitigation: same-subphase parity tests + shared error mapping patterns.

## Resource Requirements

- Single engineer
- No DB/infrastructure changes
- Deterministic test seam for clipboard backend behavior

## Future Considerations

- Optional rich clipboard format support (HTML/image) can be evaluated in later subphase only if required.
- Clipboard history/watch mode remains out-of-scope unless explicit product need emerges.

## Documentation Plan

- Keep this plan as a living checklist during implementation.
- Mark acceptance boxes `[x]` as work completes.
- Set frontmatter `status: completed` at implementation end.
- Add `docs/solutions/` entry if non-trivial hardening findings are solved.

## Sources & References

### Origin

- `docs/brainstorms/2026-03-09-rfaf-phase-4-subphase-19-clipboard-support-brainstorm.md` (carried-forward decisions: explicit trigger, plain-text only, fail-fast conflicts, parity-now, no auto/rich/history scope).

### Internal References

- Source detection precedence: `src/ingest/detect.ts:14`
- CLI source branching + exit policy: `src/cli/index.tsx:232`
- Shared runtime pipeline: `src/cli/reading-pipeline.ts:33`
- Shared `Document` contract: `src/ingest/types.ts:1`
- Agent ingest parity seam: `src/agent/reader-api.ts:300`
- Size-limit contract: `src/ingest/constants.ts:3`

### Institutional Learnings

- `docs/solutions/integration-issues/markdown-ingestion-deterministic-contracts-timeout-size-guardrails-cli-agent-parity.md`
- `docs/solutions/integration-issues/pdf-ingestion-cli-agent-parity-runtime-guardrails.md`
- `docs/solutions/integration-issues/epub-ingestion-deterministic-guardrails-cli-agent-parity-hardening.md`
- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`

### Research Decision

- External research skipped: local patterns for source ingestion, deterministic error contracts, and CLI/agent parity are recent and sufficient.

### SpecFlow Notes Incorporated

- Added explicit deterministic clipboard error matrix.
- Added explicit conflict-validation-before-IO requirement.
- Added parity equivalence requirements and integration scenarios.
- Added malformed/unavailable backend and size-bound edge coverage.

### ERD

- Not applicable (no data model changes).
