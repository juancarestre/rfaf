---
status: pending
priority: p3
issue_id: "100"
tags: [code-review, security, terminal-safety, cli]
dependencies: []
---

# Sanitize Strategy Runtime Warning Envelope

Harden strategy warning rendering so all runtime-derived warning text is consistently terminal-sanitized.

## Problem Statement

Most strategy warning paths sanitize dynamic values, but the `StrategyRuntimeError` message branch is interpolated directly into warning text before stderr output.

## Findings

- `src/cli/strategy-flow.ts:119` formats warning with `${error.message}` directly.
- Other dynamic fields in same branch are sanitized (`provider`, `model`) at:
  - `src/cli/strategy-flow.ts:115`
  - `src/cli/strategy-flow.ts:116`
- Current error strings are mostly controlled, so risk is low, but consistency gap exists.

## Proposed Solutions

### Option 1: Sanitize Error Message In Branch

**Approach:** Wrap `error.message` with `sanitizeTerminalText(...)` before composing warning.

**Pros:**
- Tiny, targeted fix
- Consistent with neighboring warning formatting

**Cons:**
- Minimal additional processing on warning path

**Effort:** < 1 hour

**Risk:** Low

---

### Option 2: Centralize Warning Envelope Builder

**Approach:** Add helper for warning composition that always sanitizes fields.

**Pros:**
- Consistency across future warning sites
- Reduces copy/paste drift

**Cons:**
- Slight abstraction overhead

**Effort:** 1-2 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/cli/strategy-flow.ts`
- `tests/cli/strategy-flow.test.ts`

**Database changes:**
- Migration needed? No

## Resources

- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`

## Acceptance Criteria

- [ ] Strategy runtime warning path sanitizes all dynamic text fields.
- [ ] Existing behavior/exit semantics stay unchanged.
- [ ] Tests verify terminal-safe warning contract.

## Work Log

### 2026-03-10 - Review Finding Created

**By:** Claude Code

**Actions:**
- Captured TypeScript reviewer warning-envelope hardening note.
- Verified interpolation site in strategy runtime branch.

**Learnings:**
- Consistent sanitization policy lowers future log/TTY safety regressions.
