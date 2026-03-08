---
status: complete
priority: p2
issue_id: "055"
tags: [code-review, security, performance, ingestion]
dependencies: []
---

# Enforce URL Response Byte Limits On Actual Payload

URL ingest currently relies on `Content-Length` pre-check before reading body text.

## Problem Statement

If `Content-Length` is missing or inaccurate, `readUrl` can still load very large responses into memory via `response.text()`. This weakens ingestion boundary hardening and can cause memory/CPU spikes.

## Findings

- `src/ingest/url.ts:102` only checks header value.
- `src/ingest/url.ts:110` reads full body into memory unconditionally.
- Security and performance reviewers flagged possible resource exhaustion.
- Known pattern: enforce limits early and deterministically at ingest boundary (`docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`).

## Proposed Solutions

### Option 1: Post-read Byte Check (Minimal)

**Approach:** After `response.text()`, check `Buffer.byteLength(payload)` against `maxResponseBytes` and throw if exceeded.

**Pros:**
- Small code change
- Preserves current implementation structure

**Cons:**
- Still buffers full oversized payload first
- Partial mitigation only

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Streamed Byte-Limited Read (Recommended)

**Approach:** Read `response.body` via reader, accumulate bytes up to `maxResponseBytes`, abort once exceeded, then decode bounded buffer.

**Pros:**
- True enforcement independent of headers
- Best memory safety for large responses

**Cons:**
- More implementation and test complexity

**Effort:** 4-6 hours

**Risk:** Medium

---

### Option 3: Lower Hard Cap + Dual Check

**Approach:** Keep header pre-check, add post-read check, and reduce default `maxResponseBytes` for CLI safety.

**Pros:**
- Better practical safety quickly
- Limited code churn

**Cons:**
- Still not full streaming protection
- Could reject some valid larger pages

**Effort:** 2-4 hours

**Risk:** Medium

## Recommended Action

Implemented Option 2 using streamed, byte-limited response reads that enforce `maxResponseBytes` on actual payload bytes (independent of headers).

## Technical Details

**Affected files:**
- `src/ingest/url.ts`
- `tests/ingest/url.test.ts`

**Related components:**
- Fetch timeout/cancellation path
- Readability extraction lifecycle

**Database changes:**
- No

## Resources

- **PR:** https://github.com/juancarestre/rfaf/pull/1
- **Reference doc:** `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- **Review sources:** security-sentinel, performance-oracle, kieran-typescript-reviewer

## Acceptance Criteria

- [x] URL ingest enforces `maxResponseBytes` even when `Content-Length` is absent/wrong
- [x] Oversized response fails with deterministic error
- [x] Tests cover missing header + oversized payload case
- [x] `bun test` and `bun x tsc --noEmit` pass

## Work Log

### 2026-03-07 - Code Review Finding Created

**By:** OpenCode

**Actions:**
- Synthesized repeated boundary-limit findings from three review agents
- Linked issue to existing ingest hardening learnings
- Scoped options from minimal to robust implementation

**Learnings:**
- Header-only guard is insufficient for deterministic resource safety.

### 2026-03-08 - Resolved

**By:** OpenCode

**Actions:**
- Replaced `response.text()` with streamed reader logic in `src/ingest/url.ts`.
- Added bounded decoding helper that counts bytes and aborts once `maxResponseBytes` is exceeded.
- Added regression test for oversized response with missing `Content-Length` in `tests/ingest/url.test.ts`.
- Verified with full suite and strict type-check.

**Learnings:**
- Enforcing limits on the actual stream is the only reliable safeguard when origin headers are absent or untrustworthy.

## Notes

- Classified P2 (important) due local CLI context, but should be prioritized before broad release.
