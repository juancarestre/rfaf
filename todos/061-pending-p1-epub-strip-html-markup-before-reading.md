---
status: completed
priority: p1
issue_id: "061"
tags: [code-review, quality, ingestion, epub, ux]
dependencies: []
---

# Strip EPUB Chapter Markup Before Creating Reader Content

Ensure EPUB ingest yields readable plain text, not chapter HTML markup.

## Problem Statement

EPUB chapter extraction currently normalizes whitespace but does not strip HTML tags. Reader output can include raw markup (`<p>`, `<h1>`, etc.), degrading readability and violating the expected `Document.content` plain-text contract.

## Findings

- `src/ingest/epub.ts:34` uses `epub.getChapterAsync(chapter.id)`.
- `src/ingest/epub.ts:35` applies whitespace normalization only.
- `src/ingest/epub.ts:41` joins potentially HTML-containing chapter strings.
- No test currently asserts tag-free output in `tests/ingest/epub.test.ts`.

## Proposed Solutions

### Option 1: Extract Text Content from Chapter HTML (Recommended)

**Approach:** Parse chapter HTML and convert to plain text (`textContent`) before normalization and join.

**Pros:**
- Produces expected reader-ready plain text
- Small change with clear behavior

**Cons:**
- Requires one HTML parse per chapter

**Effort:** Small

**Risk:** Low

---

### Option 2: Regex Tag Stripping

**Approach:** Remove tags with regex.

**Pros:**
- Very small implementation

**Cons:**
- Fragile for malformed HTML/entities
- Harder to guarantee correctness

**Effort:** Small

**Risk:** Medium

## Recommended Action

Implemented chapter HTML-to-text extraction using DOM text content before normalization and join.

## Technical Details

**Affected files:**
- `src/ingest/epub.ts`
- `tests/ingest/epub.test.ts`

**Database changes:**
- No

## Resources

- **Review target:** local branch `feat/phase-4-subphase-17-epub-ingestion`
- **Known pattern:** `src/ingest/url.ts` readability-style text extraction before pipeline

## Acceptance Criteria

- [x] EPUB ingest output contains plain text (no HTML tags)
- [x] Existing happy-path sentence expectations still pass
- [x] New regression test asserts tag stripping behavior
- [x] Full tests + typecheck pass

### 2026-03-09 - Implemented

**By:** OpenCode

**Actions:**
- Added `extractChapterText()` in `src/ingest/epub.ts` using `linkedom` parsing and `textContent` extraction.
- Kept whitespace normalization after text extraction.
- Added regression assertion in `tests/ingest/epub.test.ts` ensuring output does not contain markup tags.

**Learnings:**
- Chapter extraction helpers should guarantee reader-ready plain text, not parser-intermediate HTML.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Flagged chapter extraction path as likely HTML-preserving.
- Identified missing contract assertion for tag-free content.

**Learnings:**
- Whitespace normalization alone is not equivalent to text extraction.
