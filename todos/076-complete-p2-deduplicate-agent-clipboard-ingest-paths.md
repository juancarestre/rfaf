---
status: complete
priority: p2
issue_id: "076"
tags: [code-review, quality, agent, ingest]
dependencies: []
---

# Deduplicate Agent Clipboard Ingest Plumbing

## Problem Statement

Clipboard ingest introduced duplicate runtime-construction and error-mapping paths that increase drift risk between source handlers and make future changes harder.

## Findings

- Runtime creation sequence is repeated in `executeAgentIngestFileCommand` (`src/agent/reader-api.ts:348`) and `executeAgentIngestClipboardCommand` (`src/agent/reader-api.ts:377`).
- Clipboard message fallback mapping duplicates ingest-side semantics in `toAgentIngestClipboardError` (`src/agent/reader-api.ts:506`).
- Nested size-check try/catch in `src/ingest/clipboard.ts:143` is redundant with outer normalization flow.

## Proposed Solutions

### Option 1: Shared Runtime Builder + Typed-First Mapping

**Approach:** Extract a small helper for `Document -> Agent runtime/result` and keep agent error mapping typed-first with minimal string fallback.

**Pros:**
- Reduces drift and maintenance overhead.
- Preserves deterministic contracts.

**Cons:**
- Requires small refactor touching stable API internals.

**Effort:** 2-4 hours

**Risk:** Low

---

### Option 2: Keep Structure, Add Explicit Guard Comments/Tests

**Approach:** Avoid refactor; retain duplication but tighten tests documenting expected parity.

**Pros:**
- Lowest immediate churn.

**Cons:**
- Duplication persists.
- Future updates remain error-prone.

**Effort:** 1-2 hours

**Risk:** Medium

## Recommended Action

Implemented: shared ingest-runtime helper now removes duplicated agent ingest assembly, and redundant nested normalization blocks were removed in clipboard ingest.

## Technical Details

**Affected files:**
- `src/agent/reader-api.ts:333`
- `src/agent/reader-api.ts:362`
- `src/agent/reader-api.ts:488`
- `src/ingest/clipboard.ts:143`

**Database changes (if any):**
- Migration needed? No

## Resources

- **Review target:** branch `feat/phase-4-subphase-19-clipboard-support`
- **Known pattern:** `docs/solutions/integration-issues/markdown-ingestion-deterministic-contracts-timeout-size-guardrails-cli-agent-parity.md`

## Acceptance Criteria

- [x] Shared helper removes duplicated agent runtime assembly for ingest commands.
- [x] Clipboard mapping remains deterministic and typed-first.
- [x] Redundant nested normalization blocks are removed.
- [x] Tests pass.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Combined simplicity findings around duplicated clipboard/agent flow code.

**Learnings:**
- Deterministic contracts are easier to preserve when runtime and mapping logic are centralized.

### 2026-03-09 - Resolution

**By:** OpenCode

**Actions:**
- Added `buildAgentIngestResult` helper in `src/agent/reader-api.ts` and reused it across URL/file/clipboard ingest commands.
- Kept fail-closed readingMode validation before source reads.
- Removed redundant nested size-limit normalization in `src/ingest/clipboard.ts`.
- Verified with targeted and full test runs.

**Learnings:**
- Shared result builders reduce drift while preserving deterministic side-effect ordering.

## Notes

- Keep public agent API signatures unchanged.
