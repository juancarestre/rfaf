---
status: completed
priority: p2
issue_id: "062"
tags: [code-review, performance, cli, architecture]
dependencies: []
---

# Lazy-Load PDF Parser On PDF Paths Only

Avoid loading heavy PDF parser dependencies for non-PDF workflows.

## Problem Statement

`pdf-parse` is currently imported eagerly through dispatcher/ingestor wiring. This can add startup overhead to plaintext, URL, and `--help` paths where PDF parsing is never used.

## Findings

- `src/ingest/file-dispatcher.ts:1` imports PDF ingestor eagerly.
- `src/ingest/pdf.ts:2` imports `pdf-parse` (`PDFParse`) eagerly.
- CLI and agent file ingest paths can pay initialization cost even for non-PDF inputs.

## Proposed Solutions

### Option 1: Dynamic Import in PDF Branch (Recommended)

**Approach:** Keep dispatcher logic, but dynamically import PDF ingestor/parser only when `.pdf` path is selected.

**Pros:**
- Preserves architecture
- Reduces cold-start cost for common non-PDF runs

**Cons:**
- Slightly more async indirection

**Effort:** Small

**Risk:** Low

---

### Option 2: Keep Eager Import

**Approach:** Do nothing.

**Pros:**
- Simpler code

**Cons:**
- Ongoing startup regression on non-PDF flows

**Effort:** None

**Risk:** Medium

## Recommended Action

Implemented dynamic PDF reader loading only when the input path resolves to PDF.

## Technical Details

**Affected files:**
- `src/ingest/file-dispatcher.ts`
- `src/ingest/pdf.ts`

**Related components:**
- CLI startup path
- Agent file ingest startup path

**Database changes:**
- No

## Resources

- **Review target:** local branch `feat/phase-4-subphase-16-pdf-ingestion`

## Acceptance Criteria

- [x] Non-PDF inputs do not load PDF parser eagerly
- [x] PDF path still works deterministically
- [x] Tests remain green

### 2026-03-08 - Implemented

**By:** OpenCode

**Actions:**
- Refactored `readFileSource()` to dynamically import `./pdf` only on `.pdf` paths.
- Added loader injection seam for tests.
- Added tests asserting lazy loader is skipped for non-PDF and invoked for PDF paths.

## Work Log

### 2026-03-08 - Initial Discovery

**By:** OpenCode

**Actions:**
- Captured startup overhead finding from performance review.

**Learnings:**
- Heavy optional dependencies should be loaded only on the paths that need them.
