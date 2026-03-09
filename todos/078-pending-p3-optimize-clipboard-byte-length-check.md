---
status: pending
priority: p3
issue_id: "078"
tags: [code-review, performance, ingest]
dependencies: []
---

# Optimize Clipboard Byte-Length Measurement

## Problem Statement

Clipboard byte-limit validation currently allocates a full encoded buffer via `TextEncoder().encode`, creating unnecessary memory churn for large clipboard payloads.

## Findings

- Byte length is measured by allocation in `src/ingest/clipboard.ts:142`.
- `Buffer.byteLength(content, "utf8")` can provide the same result without creating a second full buffer.

## Proposed Solutions

### Option 1: Use `Buffer.byteLength`

**Approach:** Replace encoder allocation with `Buffer.byteLength(content, "utf8")`.

**Pros:**
- Lower peak memory.
- Simpler code.

**Cons:**
- Node/Bun-specific API dependency (already acceptable in this repo).

**Effort:** < 1 hour

**Risk:** Low

---

### Option 2: Keep Current Encoder

**Approach:** No change.

**Pros:**
- Zero churn.

**Cons:**
- Avoidable allocation remains.

**Effort:** 0

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/ingest/clipboard.ts:142`

**Database changes (if any):**
- Migration needed? No

## Resources

- **Review target:** branch `feat/phase-4-subphase-19-clipboard-support`

## Acceptance Criteria

- [ ] Clipboard byte-length check avoids unnecessary full-buffer allocation.
- [ ] Size-limit behavior and error contract remain unchanged.
- [ ] Tests pass.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Captured performance micro-optimization recommendation.

**Learnings:**
- Small allocation improvements matter on repeated ingest paths.

## Notes

- Keep as low-risk cleanup unless broader performance hardening is prioritized.
