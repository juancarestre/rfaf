---
status: completed
priority: p2
issue_id: "067"
tags: [code-review, architecture, parity, agent-api, markdown]
dependencies: []
---

# Replace Message-Coupled Agent Error Mapping with Typed Mapping

Reduce drift risk in agent ingest contracts by avoiding raw string matching for error mapping.

## Problem Statement

`toAgentIngestFileError` currently maps many errors by exact message strings. Small wording changes in ingestors can silently break agent error-code parity.

## Findings

- `src/agent/reader-api.ts` contains a long message-based conditional chain.
- Review flagged repeated parse-failure branches and message-coupled mapping as brittle.
- Agent parity reliability depends on stable codes, not message text internals.

## Proposed Solutions

### Option 1: Shared typed ingest errors/constants (Recommended)

**Pros:**
- Contract stability across ingest + agent layers
- Less code-path drift over time

**Cons:**
- Requires light refactor across source ingestors

**Effort:** Medium

**Risk:** Low

---

### Option 2: Central message-to-code map object

**Pros:**
- Smaller change than full typed-error refactor

**Cons:**
- Still message-coupled, just centralized

**Effort:** Small

**Risk:** Medium

## Recommended Action

Implemented typed ingest error support for markdown path and updated agent mapper to prioritize typed codes before message fallback.

## Technical Details

**Affected files:**
- `src/agent/reader-api.ts`
- `src/ingest/markdown.ts`
- `src/ingest/epub.ts`
- `src/ingest/pdf.ts`
- `tests/agent/reader-api.test.ts`

## Acceptance Criteria

- [x] Agent ingest mapping no longer depends primarily on raw message equality
- [x] Markdown/PDF/EPUB fallback codes remain source-correct
- [x] Agent contract tests cover typed mapping behavior
- [x] Full tests + typecheck pass

## Work Log

### 2026-03-09 - Created from review synthesis

**By:** OpenCode

**Actions:**
- Captured simplicity + agent-native parity findings around message-coupled mapping.

### 2026-03-09 - Implemented

**By:** OpenCode

**Actions:**
- Added `IngestFileError` class in `src/ingest/errors.ts`.
- Updated markdown ingest to throw typed errors.
- Updated `toAgentIngestFileError(...)` in `src/agent/reader-api.ts` to map typed errors first, then fallback.
- Preserved source-aware parse fallback for markdown/epub/pdf.
