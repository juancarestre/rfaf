---
status: completed
priority: p2
issue_id: "062"
tags: [code-review, parity, agent-api, ingestion, epub]
dependencies: []
---

# Make Agent EPUB Fallback Errors Source-Aware

Prevent unknown EPUB failures from defaulting to PDF parse error codes.

## Problem Statement

Agent file-ingest fallback currently defaults unknown failures to `PDF_PARSE_FAILED`. If an EPUB failure bypasses explicit message mapping, agent consumers receive the wrong source code and deterministic parity drifts.

## Findings

- `src/agent/reader-api.ts:366` returns `PDF_PARSE_FAILED` as default fallback.
- EPUB-specific mappings exist, but unmapped EPUB failures still collapse to PDF fallback.
- Agent-native and learnings review flagged this as parity drift risk.

## Proposed Solutions

### Option 1: Source-Aware Fallback by Path Extension (Recommended)

**Approach:** Pass file path/context into mapper and choose fallback (`EPUB_PARSE_FAILED` for `.epub`, `PDF_PARSE_FAILED` for `.pdf`).

**Pros:**
- Minimal diff
- Maintains existing contract shape

**Cons:**
- Relies on extension as source signal

**Effort:** Small

**Risk:** Low

---

### Option 2: Structured Ingest Error Objects

**Approach:** Ingestors throw typed errors with stable source/code metadata; agent maps by code, not strings.

**Pros:**
- Most robust long-term contract

**Cons:**
- Broader refactor across ingestors

**Effort:** Medium

**Risk:** Medium

## Recommended Action

Implemented source-aware fallback by passing ingest file path into agent error mapping and selecting EPUB fallback codes for `.epub` inputs.

## Technical Details

**Affected files:**
- `src/agent/reader-api.ts`
- `tests/agent/reader-api.test.ts`

**Database changes:**
- No

## Resources

- **Review target:** local branch `feat/phase-4-subphase-17-epub-ingestion`
- **Known pattern:** `docs/solutions/integration-issues/pdf-ingestion-cli-agent-parity-runtime-guardrails.md`

## Acceptance Criteria

- [x] Unknown EPUB failures map to `EPUB_PARSE_FAILED`
- [x] Unknown PDF failures continue mapping to `PDF_PARSE_FAILED`
- [x] Agent parity tests cover both fallback classes
- [x] Full tests + typecheck pass

### 2026-03-09 - Implemented

**By:** OpenCode

**Actions:**
- Updated `executeAgentIngestFileCommand()` to pass `command.path` into `toAgentIngestFileError(...)`.
- Added extension-aware EPUB fallback branch in `src/agent/reader-api.ts`.
- Added regression test in `tests/agent/reader-api.test.ts` verifying unknown `.epub` failures map to `EPUB_PARSE_FAILED`.

**Learnings:**
- Deterministic message mapping still needs source-aware fallback to prevent cross-source code drift.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Identified source-agnostic fallback branch in agent mapper.
- Confirmed deterministic parity risk when error strings drift.

**Learnings:**
- Message mapping alone needs a source-aware fallback path.
