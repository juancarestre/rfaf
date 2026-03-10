---
status: pending
priority: p3
issue_id: "120"
tags: [code-review, performance, release, build]
dependencies: []
---

# Stream Checksum Hashing for Large Artifacts

## Problem Statement

Checksum generation currently reads each artifact fully into memory. This is acceptable for small binaries but can cause avoidable memory spikes and slower release jobs as artifacts grow.

## Findings

- `scripts/release/generate-checksums.ts:19` hashes by reading full file bytes synchronously.
- Performance review flagged this as scaling risk at larger artifact sizes.

## Proposed Solutions

### Option 1: Streamed SHA256 Hashing (Recommended)

**Approach:** Use stream-based hashing (`createReadStream`) with async processing for each artifact.

**Pros:**
- Bounded memory usage.
- Better behavior for large release bundles.

**Cons:**
- Slightly more implementation complexity.

**Effort:** Small-Medium

**Risk:** Low

---

### Option 2: Keep Sync Reads with Size Guardrails

**Approach:** Retain current implementation but enforce max artifact size and warn.

**Pros:**
- Minimal refactor.

**Cons:**
- Does not remove root memory overhead pattern.

**Effort:** Small

**Risk:** Medium

## Recommended Action

Triage pending.

## Technical Details

**Affected files:**
- `scripts/release/generate-checksums.ts`
- `tests/build/release-checksum-manifest.test.ts`

## Resources

- Known Pattern: `docs/solutions/integration-issues/markdown-ingestion-deterministic-contracts-timeout-size-guardrails-cli-agent-parity.md`

## Acceptance Criteria

- [ ] Checksum generation uses stream-based hashing.
- [ ] Output format remains unchanged and deterministic.
- [ ] Release checksum tests remain green.

## Work Log

### 2026-03-10 - Initial Discovery

**By:** OpenCode

**Actions:**
- Captured performance review findings on release hashing approach.

**Learnings:**
- Release-time reliability improves when memory profile is bounded by design.
