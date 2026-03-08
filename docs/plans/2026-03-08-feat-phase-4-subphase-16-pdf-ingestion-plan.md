---
title: "feat: Add PDF ingestion with dispatcher-based file routing"
type: feat
status: active
date: 2026-03-08
origin: docs/brainstorms/2026-03-08-rfaf-phase-4-subphase-16-pdf-ingestion-brainstorm.md
---

# feat: Add PDF ingestion with dispatcher-based file routing

## Overview

Add Phase 4 Subphase 16 PDF ingestion so users can read local PDFs directly with `rfaf report.pdf`, while preserving existing runtime behavior and source contracts. The implementation will introduce a file-ingestion dispatcher that routes `.pdf` file arguments to a dedicated PDF ingestor and keeps plaintext behavior unchanged for non-PDF files (see brainstorm: `docs/brainstorms/2026-03-08-rfaf-phase-4-subphase-16-pdf-ingestion-brainstorm.md`).

This plan is **TDD-first**: every implementation step starts with failing tests, then production code, then full validation.

## Problem Statement / Motivation

`rfaf` currently ingests plaintext files, stdin, and URLs, but not PDFs. Users must manually extract or convert PDF content before reading. PDF support is a core "More Sources" milestone, and this subphase should ship a safe, deterministic first version:

- local `.pdf` file input only,
- no OCR/decryption workflows,
- deterministic errors for no-text/encrypted/corrupt PDFs,
- full parity with existing `--summary`, `--mode`, and runtime controls.

These constraints are required by the brainstorm and must be preserved exactly (see brainstorm: `docs/brainstorms/2026-03-08-rfaf-phase-4-subphase-16-pdf-ingestion-brainstorm.md`).

## Proposed Solution

Implement a dispatcher-based file-ingestion path and a dedicated PDF ingestor:

- **New:** `src/ingest/pdf.ts` — `readPdfFile(path, options?) => Promise<Document>`
- **New:** `src/ingest/file-dispatcher.ts` — extension-based route for file arguments
- **Modified:** `src/cli/index.tsx` — replace direct plaintext call with dispatcher
- **Dependencies:** `pdf-parse`
- **Tests:** ingest unit tests, dispatcher tests, CLI contract tests, and parity checks

The dispatcher layer is intentionally thin: route by file extension and delegate all extraction/validation to source-specific ingestors (see brainstorm chosen approach).

## Technical Approach

### Architecture

1. Keep `resolveInputSource()` unchanged (`file | url | stdin | none`).
2. For `source.kind === "file"`, call `readFileSource(path)` from dispatcher.
3. Dispatcher applies extension rule:
   - `.pdf` (case-insensitive) -> `readPdfFile(path)`
   - otherwise -> `readPlaintextFile(path)`
4. `readPdfFile()` enforces deterministic PDF contracts and returns shared `Document`.
5. Existing reading pipeline remains source-agnostic.

### Implementation Phases (TDD-First)

#### Phase 1: Dependencies + Dispatcher Contract (Red -> Green)

1. Add dependency:
   - `bun add pdf-parse`
2. Write failing tests first:
   - `tests/ingest/file-dispatcher.test.ts`
   - Cases:
     - routes `report.pdf` to PDF ingestor
     - routes `REPORT.PDF` to PDF ingestor (case-insensitive)
     - routes non-PDF files to plaintext ingestor
     - does not alter stdin-vs-file precedence behavior from detect layer
3. Implement dispatcher:
   - `src/ingest/file-dispatcher.ts`
   - injectable delegates for deterministic tests
4. Verify tests green.

#### Phase 2: PDF Ingestor Contracts (Red -> Green)

1. Write failing unit tests first:
   - `tests/ingest/pdf.test.ts`
2. Required contract cases:
   - Happy path: parse valid text PDF -> returns `Document`
   - `source` label defaults to file basename (sanitized)
   - Empty/no-extractable-text PDF -> deterministic error
   - Encrypted/password-protected PDF -> deterministic error
   - Corrupt/invalid PDF bytes -> deterministic error
   - File not found -> deterministic error parity with file ingest
   - Size limit for raw file bytes enforced before parse
   - Size limit for extracted text enforced via `assertInputWithinLimit`
   - Boundary tests (exact limit passes, over limit fails)
3. Implement `src/ingest/pdf.ts`:
   - read file bytes
   - raw byte guard
   - parse with `pdf-parse`
   - normalize parser failures into stable error messages
   - sanitize source label and return shared `Document`
4. Verify unit tests green.

#### Phase 3: CLI Wiring + Help/Contract Updates (Red -> Green)

1. Write failing CLI contract tests first:
   - `tests/cli/pdf-cli-contract.test.ts`
   - Cases:
     - `rfaf fixtures/sample.pdf` exits 0 and starts runtime
     - encrypted/no-text/corrupt PDF exits 1 with deterministic stderr
     - `file.pdf + piped stdin` preserves existing warning semantics
     - `--summary` works with PDF source path
2. Update `src/cli/index.tsx`:
   - file branch uses dispatcher
   - keep warning/exit behavior unchanged
3. Update help contracts if needed:
   - `tests/cli/help-cli-contract.test.ts`
   - ensure help remains correct and non-breaking
4. Verify contract tests green.

#### Phase 4: Agent/API Surface Parity (Red -> Green)

1. Add failing parity tests:
   - `tests/agent/reader-api.test.ts`
   - verify agent can ingest local PDF via shared ingest path (or explicit non-goal documented)
2. Implement parity path by reusing shared dispatcher/PDF ingestor.
3. Ensure runtime semantics align with existing agent state contracts.

#### Phase 5: Hardening + Full Validation

1. Add edge-case regressions from SpecFlow:
   - extension spoof (`fake.pdf` invalid bytes)
   - `.PDF` uppercase extension
   - unicode/space file paths
2. Run broad validation:
   - `bun test`
   - `bun x tsc --noEmit`
3. Confirm deterministic stderr contracts and no PTY regressions.

## Alternative Approaches Considered

### Option A: Direct PDF branch in CLI

- Pros: fewer files now
- Cons: source-routing logic spreads into CLI and repeats in future subphases
- Rejected because brainstorm selected dispatcher approach for maintainability with upcoming EPUB/Markdown/clipboard sources (see brainstorm).

### Option C: Dedicated PDF flag/subcommand

- Pros: explicit command semantics
- Cons: inconsistent with existing positional input model and adds unnecessary CLI surface
- Rejected per YAGNI for this subphase (see brainstorm).

## System-Wide Impact

### Interaction Graph

- `main()` -> `resolveInputSource()` -> `file` branch -> `readFileSource(path)` -> (`readPdfFile` or `readPlaintextFile`) -> `Document` -> `buildReadingPipeline()` -> tokenization/mode transforms/pacer -> Ink runtime.
- Warning flow remains: detection emits warning -> CLI prints warning after successful ingest.

### Error & Failure Propagation

- PDF parse failures normalize to deterministic user-facing errors in `readPdfFile`.
- Runtime-level error handling remains centralized in `main().catch` for sanitization/redaction and exit code assignment.
- No retry strategy introduced for local file parsing.

### State Lifecycle Risks

- No persistent state or DB writes.
- Risks are in-memory resource usage during parse; mitigated by raw byte guard before parse + extracted text size guard after parse.

### API Surface Parity

- CLI file ingest gains PDF route.
- Agent ingest path must reuse shared ingest contracts to prevent CLI/agent drift.
- Existing mode/summary/runtime APIs remain unchanged downstream.

### Integration Test Scenarios

1. `rfaf report.pdf --summary long` -> ingest + summarize + read starts successfully.
2. `cat note.txt | rfaf report.pdf` -> file wins, stdin warning preserved, PDF ingested.
3. Corrupt `report.pdf` -> deterministic stderr + exit 1.
4. Oversized PDF (raw or extracted text) -> deterministic size failure.

## Acceptance Criteria

### Functional Requirements

- [ ] `rfaf <local.pdf>` ingests PDF text and starts reading.
- [ ] File dispatcher routes `.pdf` (case-insensitive) to PDF ingestor and all other files to plaintext ingestor.
- [ ] No OCR/decryption flow is introduced in this subphase.
- [ ] No-text/encrypted/corrupt PDFs fail with deterministic error messages.
- [ ] PDF inputs preserve existing flag behavior (`--summary`, `--mode`, `--wpm`, `--text-scale`).
- [ ] `file + piped stdin` precedence/warning behavior is unchanged.

### Non-Functional Requirements

- [ ] Raw file size limit enforced before PDF parse.
- [ ] Extracted text size limit enforced with shared ingest limit guard.
- [ ] Terminal-bound output remains sanitized and deterministic.
- [ ] Dispatcher abstraction remains minimal (routing only, no parser logic).

### Quality Gates (TDD-First)

- [ ] Tests are written before implementation in each phase.
- [ ] `tests/ingest/pdf.test.ts` covers happy path + all documented failures.
- [ ] `tests/ingest/file-dispatcher.test.ts` covers routing/boundaries.
- [ ] `tests/cli/pdf-cli-contract.test.ts` validates process-level contracts.
- [ ] Parity tests cover agent path for local PDF ingest.
- [ ] `bun test` passes.
- [ ] `bun x tsc --noEmit` passes.

## Success Metrics

- Local PDF ingest works end-to-end for common text PDFs.
- Failure paths are deterministic and contract-tested.
- No regressions in existing file/stdin/url ingestion behavior.
- Plan remains within subphase scope boundaries from brainstorm.

## Dependencies & Risks

### Dependencies

- `pdf-parse` (Bun compatibility required)

### Risks

- **Parser variance:** encrypted/corrupt PDFs may throw inconsistent low-level errors. Mitigation: normalize errors in `readPdfFile`.
- **Resource spikes:** large PDFs can consume memory. Mitigation: raw byte pre-check + extracted text post-check.
- **Parity drift:** CLI-only behavior can diverge from agent. Mitigation: parity tests and shared ingest path.

## Resource Requirements

- Single engineer implementation
- No infrastructure/database changes
- Test fixtures required for valid, encrypted/no-text, and corrupt PDFs

## Future Considerations

- EPUB/Markdown/clipboard can extend dispatcher routing with new ingestors.
- OCR/password workflows can be considered in a future scoped subphase, not this one.

## Documentation Plan

- Update plan checklist during execution (`[ ]` -> `[x]`).
- Add `docs/solutions/` entry after implementation/hardening if non-trivial issues emerge.

## Sources & References

### Origin

- **Origin brainstorm:** `docs/brainstorms/2026-03-08-rfaf-phase-4-subphase-16-pdf-ingestion-brainstorm.md` — carried-forward decisions: dispatcher approach, local `.pdf` only, deterministic failure for no-text/encrypted PDFs, full flag/runtime parity.

### Internal References

- Ingest source detection: `src/ingest/detect.ts:8`
- CLI source branching: `src/cli/index.tsx:246`
- Shared ingest contract: `src/ingest/types.ts:1`
- Ingest limit guard: `src/ingest/constants.ts:1`
- URL ingest hardening precedent: `src/ingest/url.ts:68`
- Pipeline source-agnostic flow: `src/cli/reading-pipeline.ts:33`

### Institutional Learnings

- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/logic-errors/20260306-bionic-mode-p2-hardening-parity-validation-caching-unicode-safety.md`
- `docs/solutions/ui-bugs/line-break-and-highlight-drift-guided-scroll-20260306.md`
- `docs/solutions/logic-errors/runtime-mode-switching-hardening-cli-runtime-20260307.md`

### SpecFlow Notes

- Added requirements for deterministic error matrix, extension edge cases (`.PDF`, spoofed `.pdf`), and explicit byte-limit ordering based on SpecFlow analysis.

### ERD

- Not applicable (no data model changes).
