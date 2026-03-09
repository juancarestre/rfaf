---
status: pending
priority: p3
issue_id: "085"
tags: [code-review, security, tests, summary]
dependencies: []
---

# Fail Closed on Unexpected Network Calls in Summary Preload Mock

## Problem Statement

The summary preload fetch mock forwards unknown URLs to real `fetch`, allowing accidental network egress in tests.

## Findings

- `tests/fixtures/preload-summary-mock.ts:58` forwards non-allowlisted requests to `originalFetch`.
- This can make tests less deterministic and leak outbound requests in CI/dev.

## Proposed Solutions

### Option 1: Strict Allowlist Fail-Closed (Recommended)

**Approach:** Throw on any non-allowlisted URL and only mock required endpoints.

**Pros:**
- Deterministic tests.
- Avoids accidental egress.

**Cons:**
- Tests may need explicit allowlist maintenance.

**Effort:** Small

**Risk:** Low

---

### Option 2: Keep Pass-Through with Warning

**Approach:** Continue pass-through but log unknown requests.

**Pros:**
- Lower friction initially.

**Cons:**
- Still permits unexpected egress.

**Effort:** Small

**Risk:** Medium

## Recommended Action

Triage pending.

## Technical Details

**Affected files:**
- `tests/fixtures/preload-summary-mock.ts`

## Resources

- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`

## Acceptance Criteria

- [ ] Unknown test network destinations fail closed.
- [ ] Summary contract tests remain deterministic.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Captured security-sentinel finding for preload network egress behavior.

**Learnings:**
- Test fixtures should default to explicit allowlists to prevent hidden side effects.
