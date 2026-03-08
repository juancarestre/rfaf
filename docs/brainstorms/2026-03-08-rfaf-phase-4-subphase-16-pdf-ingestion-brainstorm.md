---
date: 2026-03-08
topic: rfaf-phase-4-subphase-16-pdf-ingestion
phase: 4
subphase: 16
---

# rfaf Phase 4 Subphase 16: PDF Ingestion

## What We're Building

Add PDF ingestion so users can run `rfaf report.pdf` and read extracted text through the existing pipeline. The feature should behave like current sources (plaintext, stdin, URL): once content is ingested into the shared `Document` contract, all downstream behavior (`--summary`, `--mode`, runtime controls, status/exit semantics) remains unchanged.

Scope for this subphase is intentionally tight:
- local `.pdf` files only
- no OCR/decryption flows
- fail clearly when a PDF has no extractable text

## Why This Approach

We considered three approaches:

1. Direct PDF ingestor with minimal CLI extension routing
2. **Dispatcher layer for file ingestion (chosen)**
3. Dedicated PDF flag/subcommand

We chose (2) because Phase 4 still has additional file-like sources coming (EPUB, Markdown, clipboard). A small dispatcher keeps CLI input wiring stable while letting each source ingestor stay focused and testable. It adds only a thin abstraction now, but avoids repeating extension/type routing logic per future subphase.

## Key Decisions

- **Input scope:** Local `.pdf` files only in this phase.
- **Detection:** Extension-driven routing (`.pdf`) through file dispatcher.
- **Failure behavior:** Scanned/image-only or encrypted PDFs fail with deterministic, user-friendly errors.
- **Parity requirement:** PDF source must preserve existing CLI behavior and flag compatibility (`--summary`, `--mode`, warnings, exit contracts).
- **Contract consistency:** PDF ingestor returns the same `Document` shape used by existing sources.
- **YAGNI boundary:** No OCR, no password prompt/decryption workflow, no remote PDF URL handling in this subphase.

## Open Questions

(None remaining.)

## Resolved Questions

- Should PDF support include stdin/URL in this subphase? **No** (local `.pdf` files only).
- How to handle no-text PDFs? **Fail with clear deterministic error**.
- How should PDF detection work? **Extension `.pdf` routing in file dispatcher**.
- Should PDF support all existing flags and runtime behavior? **Yes, full parity**.

## Next Steps

-> `/ce:plan docs/brainstorms/2026-03-08-rfaf-phase-4-subphase-16-pdf-ingestion-brainstorm.md`
