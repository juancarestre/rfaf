---
status: pending
priority: p1
issue_id: "138"
tags: [code-review, reliability, performance, cli]
dependencies: []
---

# Config Bootstrap Prompt Timer Must Be Cleared

## Problem Statement

The config bootstrap prompt uses `Promise.race` with `setTimeout`, but the timeout is never cleared when the user answers quickly. This can keep a live timer around and delay process completion in edge paths.

## Findings

- `src/cli/config-bootstrap.ts:40` creates a race between `rl.question(...)` and timeout.
- `src/cli/config-bootstrap.ts:45` creates a timer but does not clear it.
- Reviewers flagged potential deterministic-exit and PTY reliability regressions.

## Proposed Solutions

### Option 1: Clear Timeout Handle (Preferred)

**Approach:** Store timer handle, clear in success/error/finally, and optionally call `unref()`.

**Pros:**
- Minimal change.
- Restores deterministic event-loop behavior.

**Cons:**
- Small amount of extra prompt plumbing.

**Effort:** Small

**Risk:** Low

### Option 2: Replace with Reusable Bounded Prompt Utility

**Approach:** Reuse existing timeout prompt helper style from `timeout-recovery`.

**Pros:**
- Consistency with other bounded prompts.

**Cons:**
- Slightly broader refactor than required.

**Effort:** Medium

**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/cli/config-bootstrap.ts`

## Acceptance Criteria

- [ ] Prompt timeout handle is always cleared when question resolves/rejects.
- [ ] Prompt behavior remains bounded and deterministic.
- [ ] PTY/bootstrap tests remain green.

## Work Log

### 2026-03-11 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated TypeScript and performance review finding.

**Learnings:**
- Bounded prompts require explicit timer lifecycle cleanup to avoid latent process delays.
