---
status: complete
priority: p2
issue_id: "101"
tags: [code-review, security, performance, agent]
dependencies: []
---

# Harden Agent Key-Phrases Runtime Envelope

Strengthen agent runtime safety around retries/timeouts, error redaction, and repeated source reconstruction.

## Problem Statement

Agent key-phrases command currently trusts caller-provided runtime config and rebuilds source text repeatedly. This creates avoidable reliability/performance and observability risks.

## Findings

- Security review flagged unbounded timeout/retry usage risk in agent path (`src/agent/reader-api.ts:835-836`).
- Security review flagged potential sensitive upstream error leakage in wrapped runtime errors (`src/agent/reader-api.ts:850`).
- Performance review flagged repeated `sourceWords.map(...).join(" ")` across commands (`src/agent/reader-api.ts:589`, `:661`, `:750`, `:826`).

## Proposed Solutions

### Option 1: Boundary Validation + Cached Source Text

**Approach:** Validate finite bounded `timeoutMs`/`maxRetries`, redact message payloads, and cache source text in runtime.

**Pros:**
- Better security and operational resilience
- Reduces repeated large-string allocations

**Cons:**
- Runtime type updates and migration for agent state

**Effort:** 3-5 hours

**Risk:** Medium

---

### Option 2: Error Mapping Only + Partial Caching

**Approach:** Keep config as-is but replace raw upstream errors with fixed stage messages and cache only for key-phrases path.

**Pros:**
- Smaller change set

**Cons:**
- Leaves retry/timeout abuse vector less constrained

**Effort:** 2-3 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/agent/reader-api.ts`
- `tests/agent/reader-api.test.ts`

**Related components:**
- Agent command envelope
- LLM runtime error mapping

**Database changes:**
- No

## Resources

- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`

## Acceptance Criteria

- [ ] Agent command validates and bounds timeout/retry inputs deterministically
- [ ] Runtime errors are redacted/sanitized consistently with CLI policy
- [ ] Large source text is not reconstructed repeatedly across LLM commands
- [ ] Agent tests cover invalid config bounds and redaction behavior

## Work Log

### 2026-03-10 - Code Review Discovery

**By:** Claude Code

**Actions:**
- Consolidated security and performance findings into single runtime-hardening task
- Identified cross-command source reconstruction hotspot

**Learnings:**
- Agent runtime contracts need the same boundary hardening standards as CLI surfaces.

### 2026-03-10 - Resolution

**By:** Claude Code

**Actions:**
- Added bounded runtime validation for `timeoutMs` and `maxRetries` in `src/agent/reader-api.ts`
- Added runtime message redaction/sanitization for agent LLM error wrapping paths
- Added `sourceText` caching in agent runtime to avoid repeated `sourceWords.map(...).join(" ")` reconstruction across summarize/no-bs/translate/key-phrases commands
- Added tests for list mode parity and invalid key-phrases runtime bounds in `tests/agent/reader-api.test.ts`

**Learnings:**
- Centralized runtime bounds + error redaction improves both resilience and observability safety.

## Notes

- Keep behavior deterministic for agent clients relying on stable error contracts.
