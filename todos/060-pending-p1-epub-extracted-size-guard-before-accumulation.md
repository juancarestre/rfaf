---
status: completed
priority: p1
issue_id: "060"
tags: [code-review, security, performance, ingestion, epub]
dependencies: []
---

# Enforce EPUB Extracted-Size Guard During Chapter Accumulation

Prevent EPUB parser output from growing unbounded in memory before size rejection.

## Problem Statement

`readEpubFile()` checks extracted text size only after all chapter content is read and joined. A crafted EPUB can inflate to very large extracted text and consume memory/CPU before the deterministic size guard runs.

## Findings

- `src/ingest/epub.ts:27` accumulates chapter sections in-memory.
- `src/ingest/epub.ts:41` joins full content into one large string.
- `src/ingest/epub.ts:130` applies extracted size guard only after full accumulation.
- Security/performance review flagged this as parser-bomb DoS risk.
- Known pattern: guardrail ordering is contractual (`docs/solutions/integration-issues/pdf-ingestion-cli-agent-parity-runtime-guardrails.md`).

## Proposed Solutions

### Option 1: Incremental Byte Budget Enforcement (Recommended)

**Approach:** Track cumulative extracted UTF-8 bytes per chapter and fail as soon as total exceeds `maxExtractedBytes`.

**Pros:**
- Minimal code churn
- Preserves current architecture and deterministic contracts

**Cons:**
- Still parses chapter content before counting each chunk

**Effort:** Medium

**Risk:** Low

---

### Option 2: Parse In Isolated Worker/Subprocess

**Approach:** Run EPUB parsing in a separate process with strict memory/time boundary and terminate on overrun.

**Pros:**
- Strongest containment for parser DoS

**Cons:**
- More implementation complexity and test harness work

**Effort:** Large

**Risk:** Medium

## Recommended Action

Implemented incremental extracted-byte accounting in `parseEpubText()` and retained post-parse extracted-size guard as a defensive fallback.

## Technical Details

**Affected files:**
- `src/ingest/epub.ts`
- `tests/ingest/epub.test.ts`

**Related components:**
- `src/ingest/file-dispatcher.ts`
- CLI/agent file ingest path via `readFileSource`

**Database changes:**
- No

## Resources

- **Review target:** local branch `feat/phase-4-subphase-17-epub-ingestion`
- **Known pattern:** `docs/solutions/integration-issues/pdf-ingestion-cli-agent-parity-runtime-guardrails.md`
- **Known pattern:** `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`

## Acceptance Criteria

- [x] Extracted byte limit is enforced incrementally during chapter accumulation
- [x] Oversize EPUB fails before full string join
- [x] Deterministic size error message remains unchanged
- [x] `bun test` and `bun x tsc --noEmit` pass

### 2026-03-09 - Implemented

**By:** OpenCode

**Actions:**
- Added cumulative chapter-byte tracking before `sections.push(...)` in `src/ingest/epub.ts`.
- Enforced `assertInputWithinLimit` on running extracted total, including section separators.
- Preserved size-limit error determinism in parser normalization and added regression coverage.

**Learnings:**
- Early guardrails are effective only when applied in the authoritative hot path, not after full accumulation.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated security and performance findings on late extracted-size enforcement.
- Mapped failing guard order in EPUB ingest path.

**Learnings:**
- Post-accumulation checks are insufficient for parser-bomb resilience.
