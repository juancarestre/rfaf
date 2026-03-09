---
date: 2026-03-09
topic: rfaf-phase-4-subphase-18-markdown-readability
phase: 4
subphase: 18
---

# rfaf Phase 4 Subphase 18: Markdown Readability Ingestion

## What We're Building

Add Markdown support so users can run `rfaf notes.md` and get a reading experience optimized for fast comprehension, not raw syntax noise.

Scope is intentionally focused:
- local markdown files (`.md`, `.markdown`) in this subphase
- convert markdown to reader-friendly text before tokenization
- preserve lightweight structure cues (headings and list cues)
- collapse fenced code blocks to placeholders
- textify links (keep human text, drop URL noise)
- replace images/tables with short placeholders
- maintain parity across existing reading modes (`rsvp`, `chunked`, `bionic`, `scroll`)

## Why This Approach

We considered three approaches:

1. **Markdown normalizer + dedicated ingestor (chosen)**
2. Minimal `.md` routing + regex-only cleanup
3. Dual raw/readable markdown modes in this subphase

We chose (1) because it best matches the existing source-ingest architecture while delivering meaningful readability improvements without introducing unnecessary mode/UI complexity. It is the strongest YAGNI fit: enough semantic cleanup to improve comprehension, but no new user-facing mode matrix.

## Key Decisions

- **Primary goal:** Clean prose focus for markdown fast reading.
- **Success priority:** Mode parity first; markdown support should behave consistently across all current reading modes.
- **Code blocks:** Collapse fenced code blocks to deterministic placeholders.
- **Structure cues:** Preserve headings and list cues to keep navigational context.
- **Links/images/tables:** Keep link text and replace URLs/images/tables with concise placeholders to reduce noise.
- **Scope boundary:** Keep this subphase file-based and contract-focused; no extra runtime mode, no rich markdown renderer.
- **Contract alignment:** Reuse existing deterministic ingest/error patterns and source-agnostic downstream pipeline.

## Open Questions

(None remaining.)

## Resolved Questions

- Should markdown prioritize clean prose or source fidelity? **Clean prose focus**.
- How should fenced code blocks be handled? **Collapse to placeholders**.
- What structure should remain visible? **Headings + list cues**.
- How should links/images/tables be treated? **Textify links, placeholder non-prose blocks**.
- What is the top success signal? **Mode parity first**.
- Which implementation direction should we use? **Dedicated markdown normalizer + ingestor**.

## Next Steps

-> `/ce:plan docs/brainstorms/2026-03-09-rfaf-phase-4-subphase-18-markdown-readability-brainstorm.md`
