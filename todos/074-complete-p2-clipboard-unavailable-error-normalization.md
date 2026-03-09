---
status: complete
priority: p2
issue_id: "074"
tags: [code-review, reliability, error-handling, ingest]
dependencies: ["073"]
---

# Harden Clipboard Unavailable Error Normalization

## Problem Statement

Unavailable clipboard environments can be misclassified as generic read failures, reducing deterministic error semantics promised by the clipboard contract.

## Findings

- `normalizeClipboardReadError` only matches a narrow unavailable set in `src/ingest/clipboard.ts:68`.
- Unknown unavailable-like backend errors currently fall into `CLIPBOARD_READ_FAILED` at `src/ingest/clipboard.ts:96`.
- This can blur operator/user remediation paths and weakens parity contracts.

## Proposed Solutions

### Option 1: Expand Pattern Coverage

**Approach:** Add known unavailable patterns (missing display/session/backend daemon) to unavailable classification.

**Pros:**
- Minimal refactor.
- Improves determinism quickly.

**Cons:**
- Pattern lists may need future maintenance.

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Structured Backend Failure Reasons

**Approach:** Return typed failure reasons from `readSystemClipboard` and map by reason instead of message substrings.

**Pros:**
- Strong deterministic contract.
- Less brittle than string matching.

**Cons:**
- Larger refactor.

**Effort:** 3-5 hours

**Risk:** Medium

## Recommended Action

Implemented: unavailable classification now covers display/session/backend-unavailable conditions with deterministic `CLIPBOARD_UNAVAILABLE` mapping.

## Technical Details

**Affected files:**
- `src/ingest/clipboard.ts:61`
- `tests/ingest/clipboard.test.ts`

**Database changes (if any):**
- Migration needed? No

## Resources

- **Review target:** branch `feat/phase-4-subphase-19-clipboard-support`
- **Known pattern:** `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`

## Acceptance Criteria

- [x] Unavailable backend scenarios map to `CLIPBOARD_UNAVAILABLE` deterministically.
- [x] Unknown true backend crashes still map to `CLIPBOARD_READ_FAILED`.
- [x] Coverage added for newly supported unavailable signatures.
- [x] Tests pass.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Synthesized reviewer finding about narrow unavailable matching.

**Learnings:**
- Source contracts become fragile when unavailable vs generic failure boundaries are not explicit.

### 2026-03-09 - Resolution

**By:** OpenCode

**Actions:**
- Expanded unavailable detection and centralized backend-unavailable classification in `src/ingest/clipboard.ts`.
- Added deterministic unavailable contract test coverage in `tests/ingest/clipboard.test.ts`.
- Ran full validation (`bun test`, `bun x tsc --noEmit`).

**Learnings:**
- Explicit unavailable/permission/failure buckets remove brittle message-only behavior.

## Notes

- Depends on issue `073` so fallback flow and classification changes stay coherent.
