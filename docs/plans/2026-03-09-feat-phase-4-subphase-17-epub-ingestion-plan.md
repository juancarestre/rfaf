---
title: "feat: Add EPUB ingestion with dispatcher-based file routing"
type: feat
status: active
date: 2026-03-09
origin: docs/brainstorms/2026-03-09-rfaf-phase-4-subphase-17-epub-ingestion-brainstorm.md
---

# feat: Add EPUB ingestion with dispatcher-based file routing

## Overview

Add Phase 4 Subphase 17 EPUB ingestion so users can run `rfaf book.epub` and read extracted text through the existing pipeline. The implementation extends file dispatching with a dedicated EPUB ingestor and keeps downstream runtime behavior source-agnostic (see brainstorm: `docs/brainstorms/2026-03-09-rfaf-phase-4-subphase-17-epub-ingestion-brainstorm.md`).

This plan is **TDD-first**: each phase starts red (failing tests), then green (implementation), then validation.

## Problem Statement / Motivation

`rfaf` now supports plaintext, stdin, URL, and PDF, but not EPUB. Users still need manual conversion before reading books in EPUB format. This subphase fills that gap with strict scope and deterministic contracts:

- local `.epub` only,
- whole-book reading in spine order,
- fail-fast deterministic errors,
- same-subphase CLI + agent parity,
- no chapter UI, no remote EPUB URLs, no interactive recovery (see brainstorm: `docs/brainstorms/2026-03-09-rfaf-phase-4-subphase-17-epub-ingestion-brainstorm.md`).

## Proposed Solution

Implement EPUB as another source-specific ingestor behind the existing file dispatcher pattern:

- **New:** `src/ingest/epub.ts` — `readEpubFile(path, options?) => Promise<Document>`
- **Modified:** `src/ingest/file-dispatcher.ts` — route `.epub`/`.EPUB` to EPUB ingestor with lazy load
- **Modified:** `src/cli/index.tsx` — help text and file path flow continues through dispatcher
- **Modified:** `src/agent/reader-api.ts` — deterministic agent file-ingest mapping for EPUB failures
- **Dependencies:** add `epub2`

Chosen approach carries forward dispatcher + YAGNI decisions directly from brainstorm (see brainstorm: `docs/brainstorms/2026-03-09-rfaf-phase-4-subphase-17-epub-ingestion-brainstorm.md`).

## Technical Considerations

- **Architecture impacts**
  - Keep `resolveInputSource()` unchanged in `src/ingest/detect.ts:8`; EPUB remains file-based input.
  - Keep parser logic out of CLI and dispatcher; dispatcher routes only.
  - Keep `Document` contract unchanged (`src/ingest/types.ts:1`).
- **Performance implications**
  - Lazy-load EPUB parser only on EPUB path to avoid startup cost on non-EPUB runs.
  - Enforce byte limits before expensive extraction and again after extraction.
- **Security/runtime hardening**
  - Deterministic error normalization for parser variance.
  - Sanitize terminal-bound source labels and error text.
  - Preserve canonical size-limit error from `src/ingest/constants.ts:3`.

## System-Wide Impact

- **Interaction graph**: `main()` -> `resolveInputSource()` -> `readFileSource(path)` -> `readEpubFile(path)` -> `Document` -> `buildReadingPipeline()` -> existing runtime.
- **Error propagation**: EPUB parser errors normalize in ingestor; CLI still applies centralized runtime sanitization/exit mapping in `src/cli/index.tsx`.
- **State lifecycle risks**: no persistence; risks are CPU/memory spikes and parser drift; mitigated by ordering + timeout + normalization.
- **API surface parity**: CLI file ingest and agent `executeAgentIngestFileCommand()` must share identical EPUB semantics.
- **Integration test scenarios**: end-to-end success, deterministic failures, file-vs-stdin precedence, and mode/summary compatibility.

## Implementation Plan (TDD-First)

### Phase 1 - Dependency + Routing Contracts (Red -> Green)

1. Add dependency:
   - `bun add epub2`
2. Write failing dispatcher tests first:
   - `tests/ingest/file-dispatcher.test.ts`
   - cases: `.epub`, `.EPUB`, non-EPUB fallback, lazy loader only for EPUB, existing precedence unchanged
3. Implement dispatcher route/lazy-load updates in:
   - `src/ingest/file-dispatcher.ts`
4. Validate phase:
   - `bun test tests/ingest/file-dispatcher.test.ts`

### Phase 2 - EPUB Ingestor Contract (Red -> Green)

1. Add failing ingest contract tests first:
   - `tests/ingest/epub.test.ts`
2. Required red test cases:
   - valid EPUB returns `Document` with whole-book spine-order content
   - missing file -> deterministic error
   - invalid/corrupt EPUB -> deterministic error
   - encrypted/DRM/unsupported EPUB -> deterministic error
   - no extractable text -> deterministic error
   - raw byte limit enforced before full parse
   - extracted text limit enforced after extraction
   - unknown parser failures normalize to deterministic fallback
   - source label sanitization and deterministic basename policy
3. Implement EPUB ingestor:
   - `src/ingest/epub.ts`
4. Validate phase:
   - `bun test tests/ingest/epub.test.ts`

### Phase 3 - CLI Contracts + Help (Red -> Green)

1. Add failing CLI contract tests first:
   - `tests/cli/epub-cli-contract.test.ts`
   - `tests/cli/epub-pty-contract.test.ts`
   - extend `tests/cli/help-cli-contract.test.ts`
2. Required CLI cases:
   - `rfaf tests/fixtures/sample.epub` starts runtime
   - deterministic stderr + exit code for each EPUB failure class
   - `cat stdin.txt | rfaf tests/fixtures/sample.epub` preserves existing warning precedence
   - `--summary` and `--mode` continue working with EPUB input
3. Implement needed wiring/help updates in:
   - `src/cli/index.tsx`
4. Validate phase:
   - `bun test tests/cli/epub-cli-contract.test.ts tests/cli/epub-pty-contract.test.ts tests/cli/help-cli-contract.test.ts`

### Phase 4 - Agent Parity + Error Contract (Red -> Green)

1. Add failing agent tests first:
   - extend `tests/agent/reader-api.test.ts`
2. Required parity cases:
   - successful EPUB ingest via `executeAgentIngestFileCommand()`
   - deterministic error mapping for EPUB failure matrix
   - unknown EPUB parser failure normalization remains stable
3. Implement mapping updates in:
   - `src/agent/reader-api.ts`
4. Validate phase:
   - `bun test tests/agent/reader-api.test.ts`

### Phase 5 - Fixtures + Full Validation

1. Add deterministic fixtures:
   - `tests/fixtures/sample.epub`
   - `tests/fixtures/corrupt.epub`
   - optional synthetic fixtures for no-text/unsupported scenarios
2. Run full suite:
   - `bun test`
   - `bun x tsc --noEmit`
3. Confirm no regressions in existing source types.

## Alternative Approaches Considered

### Option A - Dispatcher + `epub2` ingestor (Chosen)

- Pros: matches existing architecture, minimal churn, fastest path to parity.
- Cons: still source-specific parser modules.
- Chosen per brainstorm and YAGNI (see brainstorm: `docs/brainstorms/2026-03-09-rfaf-phase-4-subphase-17-epub-ingestion-brainstorm.md`).

### Option B - Generalized container-ingest abstraction first

- Pros: potentially reusable for future archive-like formats.
- Cons: higher upfront complexity before proving EPUB needs it.
- Rejected for this subphase per brainstorm.

### Option C - Minimal EPUB now, hardening/parity later

- Pros: quicker initial demo.
- Cons: repeats prior drift mistakes (nondeterministic errors, CLI/agent mismatch).
- Rejected by brainstorm requirement for strict fail-fast and parity now.

## Acceptance Criteria

### Functional Requirements

- [ ] `rfaf <local.epub>` ingests EPUB and starts reading.
- [ ] EPUB content is extracted as whole-book text in spine order (see brainstorm origin).
- [ ] Dispatcher routes `.epub` case-insensitively and keeps non-EPUB behavior unchanged.
- [ ] No remote EPUB URL support is introduced in this subphase.
- [ ] No chapter-selection UI or interactive recovery prompts are introduced.
- [ ] CLI and agent file-ingest surfaces both support EPUB in the same subphase.

### Deterministic Failure Requirements

- [ ] Missing file, corrupt/invalid EPUB, unsupported/encrypted EPUB, no-text EPUB, oversize input, timeout/parse failures all return stable deterministic outcomes.
- [ ] Unknown parser errors normalize to one stable fallback class.
- [ ] URL-like inputs ending in `.epub` still follow URL detection semantics from `src/ingest/detect.ts`.

### Non-Functional Requirements

- [ ] Raw size guard is enforced before expensive extraction.
- [ ] Extracted text size guard is enforced before pipeline creation.
- [ ] Lazy-loading prevents EPUB parser initialization on non-EPUB runs.
- [ ] Terminal-bound source/error text is sanitized.

### Quality Gates (TDD-First)

- [ ] Tests are authored first in each phase (red -> green -> refactor).
- [ ] `tests/ingest/epub.test.ts` covers happy path + full failure matrix.
- [ ] `tests/ingest/file-dispatcher.test.ts` covers EPUB routing + lazy-load contract.
- [ ] CLI EPUB contract + PTY tests pass.
- [ ] Agent parity/error-contract tests pass.
- [ ] `bun test` passes.
- [ ] `bun x tsc --noEmit` passes.

## Success Metrics

- EPUB ingest works end-to-end without changing downstream runtime behavior.
- Failure behavior is deterministic and contract-tested across CLI and agent.
- No regressions in plaintext/stdin/url/pdf ingestion behavior.
- Scope boundaries from brainstorm remain intact (local-only, whole-book, strict fail-fast).

## Dependencies & Risks

- **Dependency:** `epub2` Bun compatibility and error behavior variability.
- **Risk: parser nondeterminism** -> normalize parser errors and assert exact contracts.
- **Risk: performance regressions** -> lazy-load parser + pre-extraction size guard.
- **Risk: parity drift** -> shared dispatcher path + explicit CLI/agent parity tests.
- **Risk: fixture instability** -> use deterministic local fixtures and test seams.

## Sources & References

- **Origin brainstorm:** `docs/brainstorms/2026-03-09-rfaf-phase-4-subphase-17-epub-ingestion-brainstorm.md` (carried-forward decisions: local-only scope, whole-book spine order, strict fail-fast, same-subphase parity, dispatcher + `epub2`).

### Internal References

- `src/ingest/file-dispatcher.ts:14`
- `src/ingest/detect.ts:8`
- `src/ingest/constants.ts:3`
- `src/ingest/pdf.ts:85`
- `src/cli/index.tsx:245`
- `src/agent/reader-api.ts:304`
- `tests/ingest/pdf.test.ts:55`
- `tests/cli/pdf-cli-contract.test.ts:1`

### Institutional Learnings

- `docs/solutions/integration-issues/pdf-ingestion-cli-agent-parity-runtime-guardrails.md`
- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`

### SpecFlow Notes Incorporated

- Finalize deterministic EPUB error matrix and precedence.
- Define spine text normalization contract (whitespace + section separators) as testable behavior.
- Ensure `Document.source` policy is explicit and sanitized.
- Require parity scenarios and integration tests as mandatory quality gate.

### ERD

- Not applicable (no data model changes).
