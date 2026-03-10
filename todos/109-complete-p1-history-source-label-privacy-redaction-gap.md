---
status: complete
priority: p1
issue_id: "109"
tags: [code-review, security, privacy, history]
dependencies: []
---

# Redact Sensitive Source Details in History Labels

## Problem Statement

History records persist sanitized terminal text but may still include full local paths or full URLs. This can leak sensitive metadata and conflicts with the intended v1 privacy contract of storing sanitized labels instead of raw source identifiers.

## Findings

- `src/history/session-record.ts:75` persists `sourceLabel` after terminal sanitization only.
- `src/ui/App.tsx:59` passes runtime `sourceLabel` directly to persistence path.
- For common ingest paths, source labels can be full file paths and URLs, including query/fragment data.
- Known Pattern: sanitize and constrain user-controlled terminal content at output/persistence boundaries (`docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`).

## Proposed Solutions

### Option 1: Privacy-Normalized Label Contract (Recommended)

**Approach:** Introduce a history-label normalization step that strips URL query/fragment, reduces local paths to basename or home-relative short form, then applies terminal sanitization and truncation.

**Pros:**
- Satisfies privacy goal while preserving human-readable context.
- Deterministic and testable contract.

**Cons:**
- Requires clear rules for URL/path shaping.

**Effort:** Medium

**Risk:** Low

---

### Option 2: Store Opaque Source Hash + Optional Display Name

**Approach:** Persist a stable hash identifier and a minimally descriptive label.

**Pros:**
- Strong confidentiality by default.

**Cons:**
- Less user-friendly without lookup support.

**Effort:** Medium-Large

**Risk:** Medium

## Recommended Action

Implemented Option 1 with deterministic privacy normalization for URLs and paths before persistence.

## Technical Details

**Affected files:**
- `src/history/session-record.ts`
- `src/ingest/plaintext.ts`
- `src/ingest/url.ts`
- `tests/engine/history-label-sanitization.test.ts`

## Resources

- `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-26-session-history-stats-brainstorm.md`
- `docs/plans/2026-03-10-feat-phase-5-subphase-26-session-history-stats-plan.md`
- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`

## Acceptance Criteria

- [x] Persisted source labels never include full raw file paths or full raw URLs by default.
- [x] URL labels strip query strings and fragments deterministically.
- [x] Path labels are normalized to privacy-preserving representation.
- [x] Contract tests lock expected transformations.

## Work Log

### 2026-03-10 - Initial Discovery

**By:** OpenCode

**Actions:**
- Synthesized security + architecture review findings for history source persistence.
- Mapped current call flow from UI source label to history store.

**Learnings:**
- Terminal-safe text is not equivalent to privacy-safe source metadata.

### 2026-03-10 - Resolution

**By:** OpenCode

**Actions:**
- Extended `sanitizeHistorySourceLabel` to normalize URL labels to host/leaf and path labels to basename.
- Preserved known transform suffixes (`summary`, `translated`, `no-bs`, `key-phrases`) after normalization.
- Added/updated tests in `tests/engine/history-label-sanitization.test.ts`.

**Learnings:**
- Privacy normalization and terminal sanitization must be separate, explicit layers.
