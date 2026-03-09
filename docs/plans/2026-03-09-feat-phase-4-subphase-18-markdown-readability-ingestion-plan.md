---
title: "feat: Add markdown readability ingestion with deterministic contracts"
type: feat
status: completed
date: 2026-03-09
origin: docs/brainstorms/2026-03-09-rfaf-phase-4-subphase-18-markdown-readability-brainstorm.md
---

# feat: Add markdown readability ingestion with deterministic contracts

## Overview

Add Phase 4 Subphase 18 markdown support so users can run `rfaf notes.md` and read markdown content optimized for fast comprehension, while keeping all existing reading modes and runtime behavior unchanged (see brainstorm: `docs/brainstorms/2026-03-09-rfaf-phase-4-subphase-18-markdown-readability-brainstorm.md`).

This plan is **TDD-first**: each phase starts with failing tests (red), followed by implementation (green), then validation.

## Problem Statement / Motivation

`rfaf` currently ingests plaintext, stdin, URL, PDF, and EPUB, but markdown files still flow as raw plaintext. Raw markdown syntax adds visual noise (`#`, fences, links, tables, image syntax), reducing fast-reading comprehension.

Subphase 18 must deliver readability-first markdown ingest with strict boundaries from the brainstorm:

- local markdown files only (`.md`, `.markdown`),
- clean prose focus,
- headings + list cues preserved,
- fenced code blocks collapsed to placeholders,
- links textified and images/tables placeholdered,
- mode parity first across `rsvp`, `chunked`, `bionic`, `scroll`,
- no new runtime mode and no rich markdown renderer (see brainstorm).

## Proposed Solution

Implement a dedicated markdown ingestor and keep downstream runtime source-agnostic:

- **New:** `src/ingest/markdown.ts` - markdown parse + normalization -> `Document`
- **Modified:** `src/ingest/file-dispatcher.ts` - route `.md`/`.markdown` (case-insensitive) to markdown ingestor
- **Modified:** `src/cli/index.tsx` - help text includes markdown input
- **Modified:** `src/agent/reader-api.ts` - deterministic markdown file-ingest error mapping for agent parity
- **Dependencies:** add markdown parser (`marked`) and keep behavior deterministic via explicit normalization rules

This carries forward the brainstorm’s selected approach: markdown normalizer + dedicated ingestor (see brainstorm).

## Technical Considerations

- **Architecture impacts**
  - Keep `resolveInputSource()` unchanged (`src/ingest/detect.ts:8`) so URL protocol detection remains authoritative.
  - Keep parser/normalization logic in source ingestor, not in CLI runtime.
  - Preserve shared `Document` contract (`src/ingest/types.ts:1`) and source-agnostic reading pipeline (`src/cli/reading-pipeline.ts:33`).
- **Performance implications**
  - Keep markdown normalization bounded and deterministic.
  - Preserve canonical byte-limit guards before and after transform where applicable.
- **Security/runtime hardening**
  - Maintain deterministic error normalization.
  - Keep terminal-bound output sanitized.
  - Preserve canonical size-limit message (`Input exceeds maximum supported size`).

## System-Wide Impact

- **Interaction graph**: `main()` -> `resolveInputSource()` -> `readFileSource(path)` -> `readMarkdownFile(path)` -> `Document` -> `buildReadingPipeline()` -> existing reading modes/runtime.
- **Error propagation**: markdown parser/normalization failures are converted to deterministic user-facing messages in ingestor; CLI keeps centralized sanitized error output and exit-code policy.
- **State lifecycle risks**: no persistence; risks are transform determinism and content-size/resource boundaries.
- **API surface parity**: markdown behavior must be equivalent for CLI file ingest and agent `executeAgentIngestFileCommand()`.
- **Integration test scenarios**: markdown success path, malformed markdown resilience, deterministic failures, file-vs-stdin precedence, and mode parity.

## Implementation Plan (TDD-First)

### Phase 1 - Dependency + Dispatcher Routing (Red -> Green)

1. Add parser dependency:
   - `bun add marked`
2. Write failing dispatcher tests first:
   - extend `tests/ingest/file-dispatcher.test.ts`
   - cases:
     - routes `.md` to markdown ingestor
     - routes `.markdown` and uppercase variants (`.MD`, `.MARKDOWN`) case-insensitively
     - keeps non-markdown routing unchanged
     - preserves existing lazy-load behavior guarantees for other source types
3. Implement dispatcher updates in `src/ingest/file-dispatcher.ts`.
4. Validate phase:
   - `bun test tests/ingest/file-dispatcher.test.ts`

### Phase 2 - Markdown Ingest Contract (Red -> Green)

1. Add failing ingest tests first:
   - `tests/ingest/markdown.test.ts`
2. Required contract cases:
   - valid markdown -> deterministic readable text `Document`
   - preserves heading/list cues in normalized output
   - fenced code blocks collapsed to deterministic placeholder
   - links textified (drop URL noise, keep human text)
   - images/tables converted to deterministic placeholders
   - malformed markdown (unterminated fences/broken links) handled deterministically without crash
   - missing file -> deterministic error
   - normalized output empty -> deterministic markdown-empty error
   - raw and normalized size boundaries enforced with canonical size message
   - source label deterministic and terminal-safe
3. Implement `src/ingest/markdown.ts` with explicit normalization precedence rules.
4. Validate phase:
   - `bun test tests/ingest/markdown.test.ts`

### Phase 3 - CLI Contract + Help (Red -> Green)

1. Add failing CLI tests first:
   - `tests/cli/markdown-cli-contract.test.ts`
   - `tests/cli/markdown-pty-contract.test.ts`
   - extend `tests/cli/help-cli-contract.test.ts`
2. Required CLI cases:
   - `rfaf tests/fixtures/sample.md` starts runtime
   - malformed/invalid markdown path emits deterministic stderr + exit semantics
   - `cat stdin.txt | rfaf tests/fixtures/sample.md` preserves file-over-stdin warning behavior
   - markdown works with `--summary` and all existing `--mode` values
3. Implement CLI help/wiring updates in `src/cli/index.tsx`.
4. Validate phase:
   - `bun test tests/cli/markdown-cli-contract.test.ts tests/cli/markdown-pty-contract.test.ts tests/cli/help-cli-contract.test.ts`

### Phase 4 - Agent Parity + Error Contract (Red -> Green)

1. Add failing agent tests first:
   - extend `tests/agent/reader-api.test.ts`
2. Required parity cases:
   - successful markdown file ingest via `executeAgentIngestFileCommand()`
   - markdown failure matrix maps to stable agent error codes/messages
   - unknown markdown failures map to markdown-specific parse fallback (not PDF/EPUB codes)
3. Implement mapping changes in `src/agent/reader-api.ts`.
4. Validate phase:
   - `bun test tests/agent/reader-api.test.ts`

### Phase 5 - Fixtures + Full Validation

1. Add deterministic fixtures:
   - `tests/fixtures/sample.md` (headings/lists/code/link/image/table coverage)
   - `tests/fixtures/malformed.md`
   - optional `tests/fixtures/large.md` synthetic boundary fixture
2. Run full validation:
   - `bun test`
   - `bun x tsc --noEmit`
3. Confirm no regressions in plaintext/stdin/url/pdf/epub ingestion behavior.

## Alternative Approaches Considered

### Option A - Markdown normalizer + dedicated ingestor (Chosen)

- Pros: best readability impact with minimal architecture change; aligns with existing ingest patterns.
- Cons: requires explicit normalization contract definition and tests.
- Chosen per brainstorm (see brainstorm).

### Option B - Minimal regex cleanup

- Pros: fastest to ship.
- Cons: brittle edge cases, inconsistent readability output, higher long-term maintenance.
- Rejected by brainstorm rationale.

### Option C - Dual raw/readable markdown modes

- Pros: flexible user behavior.
- Cons: extra surface area and mode complexity in a source-ingest subphase.
- Rejected by brainstorm scope/YAGNI.

## Acceptance Criteria

### Functional Requirements

- [x] `rfaf <local.md>` and `rfaf <local.markdown>` ingest markdown and start reading.
- [x] Markdown ingest returns clean prose output while preserving headings + list cues (see brainstorm).
- [x] Fenced code blocks collapse to deterministic placeholders.
- [x] Links are textified and image/table constructs are replaced with deterministic placeholders.
- [x] Mode parity is preserved across `rsvp`, `chunked`, `bionic`, and `scroll` (see brainstorm).
- [x] No new markdown-specific runtime mode or rich markdown renderer is introduced (see brainstorm).

### Deterministic Failure Requirements

- [x] Missing markdown files fail with deterministic file-ingest error semantics.
- [x] Malformed markdown never crashes ingest and yields deterministic behavior.
- [x] Empty normalized markdown content fails with deterministic markdown-empty error.
- [x] Unknown parser failures normalize to a markdown-specific stable fallback class.
- [x] URL-like markdown paths with `http(s)://` still follow URL detection semantics from `src/ingest/detect.ts`.

### Non-Functional Requirements

- [x] Raw and normalized size guards use canonical message `Input exceeds maximum supported size`.
- [x] Terminal-bound source/error text remains sanitized.
- [x] Dispatcher remains minimal (routing only, no parser logic leakage).

### Quality Gates (TDD-First)

- [x] Tests are written first in each phase (red -> green -> refactor).
- [x] `tests/ingest/markdown.test.ts` covers normalization and failure matrix.
- [x] Dispatcher routing and case-insensitive extension behavior are contract-tested.
- [x] CLI markdown contract + PTY tests pass.
- [x] Agent parity/error-contract tests pass.
- [x] `bun test` passes.
- [x] `bun x tsc --noEmit` passes.

## Success Metrics

- `rfaf notes.md` reads significantly cleaner than raw markdown text by default.
- Markdown behavior is deterministic and contract-tested across CLI + agent surfaces.
- Existing source ingests and reading modes show no regressions.
- Scope boundaries from brainstorm remain intact (file-based, readability-first, no new mode/UI).

## Dependencies & Risks

### Dependencies

- `marked` parser dependency and deterministic configuration

### Risks

- **Normalization nondeterminism:** parser output variations can drift behavior. Mitigation: explicit normalization precedence + golden fixtures.
- **Parity drift:** CLI and agent can diverge if mapping logic is asymmetric. Mitigation: shared ingest path + parity test matrix.
- **Over-aggressive cleanup:** removing too much structure can hurt comprehension. Mitigation: preserve heading/list cues explicitly.
- **Boundary regressions:** transformed output may exceed limits unexpectedly. Mitigation: enforce limits in authoritative order and test both raw/transformed boundaries.

## Resource Requirements

- Single engineer implementation
- No infrastructure/database changes
- Deterministic markdown fixtures covering mixed syntax and malformed edge cases

## Future Considerations

- Optional advanced markdown features (table summarization, richer code summarization, notes metadata extraction) can be considered in later subphases, not now.
- Potential user-tunable markdown readability profiles should be deferred unless a clear need emerges.

## Documentation Plan

- Keep this plan as a living checklist (`[ ]` -> `[x]`) during implementation.
- Set frontmatter `status` to `completed` at the end of execution.
- Add `docs/solutions/` write-up if non-trivial hardening issues are discovered/resolved.

## Sources & References

### Origin

- **Origin brainstorm:** `docs/brainstorms/2026-03-09-rfaf-phase-4-subphase-18-markdown-readability-brainstorm.md` - carried forward: clean-prose goal, mode parity first, headings/list cues, code placeholder policy, links/images/tables handling, local-file scope, no new mode/UI.

### Internal References

- Source detection precedence: `src/ingest/detect.ts:8`
- Dispatcher routing seam: `src/ingest/file-dispatcher.ts:14`
- Shared `Document` contract: `src/ingest/types.ts:1`
- Pipeline source-agnostic flow: `src/cli/reading-pipeline.ts:33`
- CLI file ingest branch: `src/cli/index.tsx:246`
- Agent file ingest parity seam: `src/agent/reader-api.ts:294`
- Canonical ingest size limit: `src/ingest/constants.ts:3`

### Institutional Learnings

- `docs/solutions/integration-issues/epub-ingestion-deterministic-guardrails-cli-agent-parity-hardening.md`
- `docs/solutions/integration-issues/pdf-ingestion-cli-agent-parity-runtime-guardrails.md`
- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- `docs/solutions/logic-errors/runtime-mode-switching-hardening-cli-runtime-20260307.md`
- `docs/solutions/logic-errors/20260305-chunked-mode-behavior-parity-hardening-fixes.md`
- `docs/solutions/ui-bugs/line-break-and-highlight-drift-guided-scroll-20260306.md`

### Research Decision

- External research skipped: existing local patterns are strong and recent for this class of source-ingest work; risk profile is low-to-moderate and internally well-covered.

### SpecFlow Notes Incorporated

- Added explicit markdown normalization precedence expectations.
- Added extension matrix and protocol-precedence regression requirements.
- Added deterministic markdown error taxonomy and agent parity fallback requirements.
- Added mandatory malformed-markdown resilience scenarios.

### ERD

- Not applicable (no data model changes).
