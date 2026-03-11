---
status: pending
priority: p1
issue_id: "139"
tags: [code-review, security, reliability, cli]
dependencies: []
---

# Make Config Bootstrap Write Atomic and Symlink-Safe

## Problem Statement

Current bootstrap does `copyFileSync(..., COPYFILE_EXCL)` then `chmodSync(path, 0o600)` in separate operations. This can create race windows for partial visibility and symlink swap attacks.

## Findings

- `src/cli/config-bootstrap.ts:65` writes directly to final path.
- `src/cli/config-bootstrap.ts:75` applies chmod in a separate step.
- On concurrent first-run starts, follower path may observe an incomplete file state.
- Security review flagged TOCTOU risk if path is swapped before chmod.

## Proposed Solutions

### Option 1: FD-Based Secure Create + fchmod (Preferred)

**Approach:** Open with `O_CREAT|O_EXCL|O_NOFOLLOW`, write content through FD, `fsync`, `fchmod`, then close.

**Pros:**
- Strong security boundary.
- Eliminates path-based TOCTOU for chmod.

**Cons:**
- Slightly more low-level fs code.

**Effort:** Medium

**Risk:** Medium

### Option 2: Temp Write + Atomic Rename + Post-Verify

**Approach:** Write temp file in same dir, set perms, rename atomically, then verify final mode.

**Pros:**
- Strong reader atomicity.
- Good concurrency behavior.

**Cons:**
- Still needs symlink-safe checks around destination path.

**Effort:** Medium

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/cli/config-bootstrap.ts`
- `tests/cli/config-bootstrap-pty-contract.test.ts`

## Acceptance Criteria

- [ ] Config creation is atomic from reader perspective.
- [ ] Symlink/path swap does not allow chmod of unintended target.
- [ ] Concurrent first-run processes produce valid final config without corruption.
- [ ] Final file permissions are `600`.

## Work Log

### 2026-03-11 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated security and TypeScript findings into one hardening item.

**Learnings:**
- File bootstrap logic should be treated as a security-sensitive write path, not a best-effort utility.
