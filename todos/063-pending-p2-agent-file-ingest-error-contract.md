---
status: completed
priority: p2
issue_id: "063"
tags: [code-review, parity, agent-api, quality, security]
dependencies: []
---

# Add Stable Agent Error Contract For File Ingest

Agent file ingest currently propagates mostly free-form errors without structured codes.

## Problem Statement

CLI has deterministic runtime error handling semantics (message sanitization + exit code classes), but agent file ingest lacks stable error codes and robust parity assertions for PDF-specific failures. This makes integrations brittle and can leak parser-specific drift.

## Findings

- `src/agent/reader-api.ts:284` uses `readFileSource` path but has no typed ingest error contract.
- Unknown parser failures in `src/ingest/pdf.ts:38` pass through as-is.
- Agent tests currently validate happy path + invalid mode, but not full PDF failure matrix parity.
- Known pattern: explicit parity contracts across CLI + agent surfaces (`docs/solutions/logic-errors/runtime-mode-switching-hardening-cli-runtime-20260307.md`).

## Proposed Solutions

### Option 1: Introduce Typed Agent Ingest Errors (Recommended)

**Approach:** Define stable agent error codes (e.g. `FILE_NOT_FOUND`, `PDF_INVALID`, `PDF_ENCRYPTED`, `PDF_EMPTY_TEXT`, `INPUT_TOO_LARGE`, `PDF_PARSE_FAILED`) and map ingest failures before surfacing.

**Pros:**
- Predictable consumer contract
- Strong parity with CLI deterministic behavior

**Cons:**
- Slight API surface expansion
- Requires tests and migration notes

**Effort:** Medium

**Risk:** Low

---

### Option 2: Keep Message-Only Errors + Expand Tests

**Approach:** Do not add codes; only enforce message strings with broader tests.

**Pros:**
- Less implementation change

**Cons:**
- Still brittle to dependency message drift

**Effort:** Small

**Risk:** Medium

## Recommended Action

Implemented typed agent ingest errors with stable codes and deterministic fallback mapping.

## Technical Details

**Affected files:**
- `src/agent/reader-api.ts`
- `src/ingest/pdf.ts`
- `tests/agent/reader-api.test.ts`

**Database changes:**
- No

## Resources

- **Review target:** local branch `feat/phase-4-subphase-16-pdf-ingestion`
- **Known pattern:** `docs/solutions/logic-errors/runtime-mode-switching-hardening-cli-runtime-20260307.md`
- **Known pattern:** `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`

## Acceptance Criteria

- [x] Agent file ingest failures expose stable contract (code + message)
- [x] PDF failure matrix covered in agent tests (missing/corrupt/encrypted/no-text/size)
- [x] Unknown parser failures normalize to deterministic top-level class
- [x] Existing agent runtime behavior unchanged for success paths

### 2026-03-08 - Implemented

**By:** OpenCode

**Actions:**
- Added `AgentIngestFileError` with stable `code` values.
- Mapped known ingest failure messages to deterministic agent error codes.
- Normalized unknown ingest failures to `PDF_PARSE_FAILED` + `Failed to parse PDF file`.
- Added file-ingest error-matrix tests in `tests/agent/reader-api.test.ts`.

## Work Log

### 2026-03-08 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated parity and security review findings around agent ingest error semantics.

**Learnings:**
- Message-only contracts are fragile when upstream parser internals change.
