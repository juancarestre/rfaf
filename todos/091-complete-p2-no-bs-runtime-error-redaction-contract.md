---
status: complete
priority: p2
issue_id: "091"
tags: [code-review, security, reliability, no-bs]
dependencies: []
---

# Stabilize and Redact No-BS Runtime Error Envelope

## Problem Statement

No-bs runtime path can surface raw upstream error text into CLI error output, risking data leakage and inconsistent operator messaging.

## Findings

- Runtime error classification in `src/llm/no-bs.ts` includes passthrough message interpolation for unknown errors.
- CLI prints sanitized terminal text, but not all provider payload leakage is normalized to stable envelope classes.

## Proposed Solutions

### Option 1: Typed stable fallback message (Recommended)

**Approach:** Replace raw unknown passthrough with deterministic generic runtime envelope; keep detailed provider text only under explicit debug mode.

**Pros:**
- Lower leakage risk.
- More stable contracts.

**Cons:**
- Less immediate context without debug mode.

**Effort:** Small

**Risk:** Low

### Option 2: Continue passthrough + stronger redaction

**Approach:** Keep passthrough but improve pattern redaction list.

**Pros:**
- Richer immediate logs.

**Cons:**
- Hard to fully sanitize arbitrary provider output.

**Effort:** Medium

**Risk:** Medium

## Recommended Action

Implemented stable generic runtime fallback for unknown no-bs provider failures (no raw passthrough payload).

## Technical Details

**Affected files:**
- `src/llm/no-bs.ts`
- `src/cli/no-bs-flow.ts`
- `src/cli/index.tsx`
- `tests/cli/no-bs-cli-contract.test.ts`

## Resources

- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`

## Acceptance Criteria

- [x] Unknown no-bs runtime failures emit stable generic envelope.
- [x] No raw provider/body payload leaks in non-debug mode.
- [x] Existing typed error classes remain unchanged for known failures.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Logged security-sentinel finding on no-bs runtime error passthrough.

**Learnings:**
- Safe terminal output requires stable envelopes, not arbitrary upstream text.

### 2026-03-09 - Resolution

**By:** OpenCode

**Actions:**
- Updated runtime fallback classification in `src/llm/no-bs.ts` to emit deterministic generic message.
- Kept typed known-stage mapping for schema/network/provider/timeout paths.
- Validated CLI error contract tests still pass.

**Learnings:**
- Stable fallback envelopes reduce leakage and make operational triage more predictable.
