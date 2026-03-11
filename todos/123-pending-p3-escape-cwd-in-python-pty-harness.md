---
status: pending
priority: p3
issue_id: "123"
tags: [code-review, security, test, cli]
dependencies: []
---

# Avoid string interpolation of cwd inside embedded Python

## Problem Statement

The embedded Python PTY script interpolates `process.cwd()` directly into Python source. If the path contains quotes or crafted characters, the generated Python code can break or execute unintended code in test environments.

## Findings

- `tests/cli/help-overlay-toggle-pty-contract.test.ts:28` embeds `cwd='${process.cwd()}'` directly in a Python template literal.
- This is test-only scope, but still a subprocess-code injection footgun.

## Proposed Solutions

### Option 1: Inherit cwd only from Bun.spawnSync

**Approach:** Remove Python `cwd=` argument and rely on parent process working directory.

**Pros:**
- Simplest change
- Removes interpolation risk entirely

**Cons:**
- Slightly less explicit inside Python snippet

**Effort:** 15-30 minutes

**Risk:** Low

---

### Option 2: Pass cwd via JSON env var

**Approach:** Send cwd via environment variable, parse with `json.loads` in Python.

**Pros:**
- Explicit and safe
- Reusable for other PTY scripts

**Cons:**
- Minor plumbing overhead

**Effort:** 30-60 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `tests/cli/help-overlay-toggle-pty-contract.test.ts`

## Resources

- Branch: `feat/phase-8-subphase-32-help-shortcut`
- Security finding evidence: `tests/cli/help-overlay-toggle-pty-contract.test.ts:28`

## Acceptance Criteria

- [ ] No direct interpolation of cwd into embedded Python code
- [ ] PTY test behavior remains unchanged functionally
- [ ] Security risk reduced to none for path-based code injection in test harness

## Work Log

### 2026-03-11 - Initial Discovery

**By:** Claude Code

**Actions:**
- Recorded security-sentinel finding
- Scoped impact to test harness only
- Proposed low-risk remediation options

**Learnings:**
- Test code can still accumulate avoidable injection vectors and should follow safe interpolation patterns
