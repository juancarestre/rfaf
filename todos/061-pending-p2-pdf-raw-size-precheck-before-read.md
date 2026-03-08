---
status: completed
priority: p2
issue_id: "061"
tags: [code-review, performance, ingestion]
dependencies: []
---

# Enforce PDF Raw Size Before Full File Read

Apply raw file size guard before loading full bytes into memory.

## Problem Statement

`readPdfFile()` currently reads the entire file (`file.bytes()`) and only then checks raw-size limits. Large files can allocate significant memory before deterministic rejection.

## Findings

- `src/ingest/pdf.ts:57` reads full bytes first.
- Raw-size assertion happens after read at `src/ingest/pdf.ts:58`.
- This ordering weakens the intended "pre-parse" safety contract.

## Proposed Solutions

### Option 1: Metadata Precheck + Defensive Postcheck (Recommended)

**Approach:** Read file size metadata first; fail if over `maxRawBytes`; keep current post-read check as fallback.

**Pros:**
- Small and safe change
- Immediate memory pressure reduction

**Cons:**
- Relies on metadata availability/accuracy

**Effort:** Small

**Risk:** Low

---

### Option 2: Stream Read With Byte Cap

**Approach:** Stream file data with running cap and abort once exceeded.

**Pros:**
- Strongest local-file read protection

**Cons:**
- More implementation complexity for modest gain in this path

**Effort:** Medium

**Risk:** Low

## Recommended Action

Implemented metadata precheck before full byte read, with defensive post-read check retained.

## Technical Details

**Affected files:**
- `src/ingest/pdf.ts`
- `tests/ingest/pdf.test.ts`

**Database changes:**
- No

## Resources

- **Review target:** local branch `feat/phase-4-subphase-16-pdf-ingestion`
- **Known pattern:** `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`

## Acceptance Criteria

- [x] Raw-size precheck occurs before full byte read
- [x] Existing deterministic size error string remains unchanged
- [x] Tests assert parser is not invoked when metadata exceeds cap
- [x] Full suite and typecheck pass

### 2026-03-08 - Implemented

**By:** OpenCode

**Actions:**
- Added `getRawByteLength` and `readBytes` hooks to `readPdfFile()` and prechecked raw bytes before `bytes()` call.
- Kept post-read `assertInputWithinLimit` as defensive fallback.
- Expanded test to assert neither `readBytes` nor parser executes when metadata exceeds cap.

## Work Log

### 2026-03-08 - Initial Discovery

**By:** OpenCode

**Actions:**
- Captured repeated P2 finding from TS/security/perf reviews.
- Scoped minimal low-risk fix path.

**Learnings:**
- Ordering of guardrails matters as much as guard presence.
