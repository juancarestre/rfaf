---
status: complete
priority: p2
issue_id: "105"
tags: [code-review, security, config]
dependencies: []
---

# Validate `api_key_env` Names And Prevent Secret Echo In Config Errors

Harden YAML config key-env handling to avoid accidental secret reflection and ambiguous env lookups.

## Problem Statement

`llm.api_key_env` is accepted as arbitrary string. If a user mistakenly pastes a secret or malformed value there, current missing-key error guidance may echo that value in terminal/log output.

## Findings

- `src/config/llm-config.ts:187` takes `api_key_env` directly.
- `src/config/llm-config.ts:192` includes the chosen env var name in thrown message (`Set ${apiKeyEnv}`).
- Security pattern in repo expects strong redaction/sanitization at output boundaries.

## Proposed Solutions

### Option 1: Strict Env-Name Validation + Generic Error Messaging

**Approach:** Validate `api_key_env` against env-var naming regex, reject invalid values, and avoid echoing untrusted raw value in error text.

**Pros:**
- Prevents accidental secret disclosure
- Improves input hygiene

**Cons:**
- Slightly stricter config behavior for malformed values

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Keep Flexible Values + Force Redaction

**Approach:** Allow any string but always redact/sanitize echoed values in messages.

**Pros:**
- Backward-compatible for unusual env naming

**Cons:**
- Weaker input contract
- More redaction edge cases

**Effort:** 1-2 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/config/llm-config.ts`
- `tests/config/llm-config.test.ts`
- potentially CLI contract tests for config error output

**Related components:**
- Config validation and error guidance
- stderr redaction policy

**Database changes:**
- No

## Resources

- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`

## Acceptance Criteria

- [ ] Invalid `api_key_env` values fail with deterministic validation error.
- [ ] Config error messages never echo untrusted secret-like strings from `api_key_env`.
- [ ] Existing valid env var workflows continue to function.

## Work Log

### 2026-03-10 - Initial Discovery

**By:** Claude Code

**Actions:**
- Reviewed config key resolution and error messaging path
- Identified possible accidental secret reflection path

**Learnings:**
- Untrusted config strings should be validated before interpolation into user-facing guidance.

### 2026-03-10 - Resolution

**By:** Claude Code

**Actions:**
- Added strict env-var name validation for `llm.api_key_env` in `src/config/llm-config.ts`
- Added deterministic validation error for invalid env-var names without echoing untrusted values
- Added regression coverage in `tests/config/llm-config.test.ts`

**Learnings:**
- Validating config-provided env-var names up front prevents accidental secret reflection and lookup ambiguity.
