---
date: 2026-03-09
topic: rfaf-phase-4-subphase-17-epub-ingestion
phase: 4
subphase: 17
---

# rfaf Phase 4 Subphase 17: EPUB Ingestion

## What We're Building

Add EPUB ingestion so users can run `rfaf book.epub` and read extracted book text through the existing reading pipeline.

Scope is intentionally tight:
- local `.epub` files only
- read whole-book text in spine order as one document
- deterministic fail-fast behavior for unsupported/encrypted/problematic EPUBs
- full CLI + agent parity in the same subphase

Once text is normalized into the existing `Document` contract, all downstream behavior stays unchanged (`--summary`, `--mode`, runtime controls, exit/status semantics).

## Why This Approach

We considered three approaches:

1. **Dispatcher + `epub2` ingestor with deterministic contracts (chosen)**
2. Generalized container-ingest abstraction first
3. Minimal EPUB support now, hardening/parity later

We chose (1) because it is the best YAGNI fit for current architecture. The repo already has a file dispatcher and source-specific ingestors (plaintext/PDF) with strong deterministic contracts and parity tests. Reusing that pattern ships value quickly without over-designing abstractions before they are needed.

## Key Decisions

- **Input scope:** Local `.epub` files only in this subphase.
- **Default read behavior:** Extract readable chapter/body text and concatenate in spine order into one document.
- **Routing model:** Extend file dispatcher to route `.epub` to a dedicated EPUB ingestor.
- **Failure behavior:** Fail fast with deterministic user-facing errors for missing files, unsupported/encrypted EPUBs, no extractable text, oversize input, and parser failures.
- **Parity requirement:** Ship CLI and agent file-ingest parity together, with contract tests.
- **Guardrail consistency:** Preserve existing ingest boundary patterns (size limits, sanitization, stable error semantics).
- **YAGNI boundary:** No remote EPUB URLs, no chapter-selection UI, no interactive recovery prompts in this subphase.

## Open Questions

(None remaining.)

## Resolved Questions

- Should EPUB scope include remote URLs now? **No** (local `.epub` only).
- Should default reading be single chapter or whole book? **Whole book in spine order**.
- Should extraction be best-effort partial or strict? **Strict fail-fast deterministic errors**.
- Should agent parity ship now or later? **Now, in the same subphase**.
- Which implementation direction should we use? **Dispatcher + `epub2` ingestor**.

## Next Steps

-> `/ce:plan docs/brainstorms/2026-03-09-rfaf-phase-4-subphase-17-epub-ingestion-brainstorm.md`
