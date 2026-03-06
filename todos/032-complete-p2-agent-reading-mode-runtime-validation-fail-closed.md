---
status: complete
priority: p2
issue_id: 032
tags: [code-review, security, agent-native, reliability]
dependencies: []
---

# Problem Statement

The agent command surface accepts `readingMode` from runtime payloads but relies on compile-time typing instead of runtime validation, creating a fail-open path for untyped inputs.

## Findings

- `set_reading_mode` uses `command.readingMode` directly without an explicit runtime allowlist check (`src/agent/reader-api.ts:241`).
- summarize command also accepts optional `readingMode` without explicit runtime validation before mode-dependent branching (`src/agent/reader-api.ts:186`).
- Mode-dependent metadata formatting interpolates mode text into labels (`src/agent/reader-api.ts:108`), so invalid values can leak into output metadata if payload typing is bypassed.

## Proposed Solutions

### Option 1: Validate mode at agent command boundary (Recommended)
Pros: Fail-closed behavior; aligns with strict CLI mode contract; low churn.  
Cons: Requires extra guard code and tests.
Effort: Small  
Risk: Low

### Option 2: Validate only in transformer helper
Pros: Centralized validation point.  
Cons: Later validation means malformed values may reach other code paths first.
Effort: Small  
Risk: Medium

### Option 3: Keep type-only guarantees
Pros: No implementation work.  
Cons: Unsafe for JSON/tool-based callers that bypass static typing.
Effort: Small  
Risk: Medium

## Recommended Action

Add explicit runtime allowlist validation for agent `readingMode` inputs and reject invalid values before state mutation or label formatting.

## Technical Details

- Affected: `src/agent/reader-api.ts`, `tests/agent/reader-api.test.ts`.

## Acceptance Criteria

- [x] Invalid runtime `readingMode` values are rejected with explicit error.
- [x] Agent command execution remains deterministic for `rsvp|chunked|bionic`.
- [x] summarize+mode path fails closed on invalid mode.
- [x] Tests cover invalid and hostile mode payloads (unexpected strings/control chars).

## Work Log

- 2026-03-06: Created from multi-agent review synthesis (security-sentinel).
- 2026-03-06: Resolved by adding explicit runtime mode validation in agent command/summarize paths and new regression tests for invalid mode payloads.

## Resources

- Branch under review: `feat/bionic-mode-phase3-sub12`
