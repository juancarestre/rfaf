---
status: pending
priority: p2
issue_id: "140"
tags: [code-review, security, cli, quality]
dependencies: []
---

# Sanitize Config Path in Bootstrap Prompt and Status Output

## Problem Statement

Bootstrap prompt and status lines interpolate raw config path text. Since path sources can come from environment-influenced home resolution, control characters may reach terminal output.

## Findings

- Raw path appears in prompt: `src/cli/config-bootstrap.ts:42`.
- Raw path appears in setup status lines: `src/cli/config-bootstrap.ts:110`, `src/cli/config-bootstrap.ts:112`.
- Existing CLI already uses sanitization for user-facing error text in `src/cli/index.tsx:619`.

## Proposed Solutions

### Option 1: Reuse Existing Terminal Sanitizer (Preferred)

**Approach:** Apply `sanitizeTerminalText` to all path interpolations in bootstrap prompt/messages.

**Pros:**
- Matches existing output-hardening pattern.
- Minimal code change.

**Cons:**
- None material.

**Effort:** Small

**Risk:** Low

### Option 2: Escape Path Rendering Utility

**Approach:** Add dedicated path escaping helper and centralize path rendering.

**Pros:**
- Explicit path rendering policy.

**Cons:**
- Larger scope for small issue.

**Effort:** Medium

**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/cli/config-bootstrap.ts`

## Acceptance Criteria

- [ ] Bootstrap prompt and follow-up messages sanitize rendered paths.
- [ ] No control characters can spoof terminal lines in setup output.
- [ ] Existing output text contracts remain stable where expected.

## Work Log

### 2026-03-11 - Initial Discovery

**By:** OpenCode

**Actions:**
- Captured security finding on unsanitized path interpolation.

**Learnings:**
- Startup/setup paths must follow the same terminal sanitization policy as runtime error paths.
