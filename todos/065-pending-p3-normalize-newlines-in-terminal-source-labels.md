---
status: pending
priority: p3
issue_id: "065"
tags: [code-review, security, quality, terminal]
dependencies: []
---

# Normalize Newlines in Terminal-Bound Source Labels

Harden terminal rendering by replacing newline/tab characters in source labels.

## Problem Statement

ANSI/control stripping is already in place, but newline/tab characters can still reshape terminal output lines. Source labels derived from file names should be normalized to single-line safe text.

## Findings

- `src/ingest/epub.ts:135` sanitizes source via `sanitizeTerminalText`.
- Current sanitization strips escape/control chars, but newline shaping remains a readability/logging concern per security review.

## Proposed Solutions

### Option 1: Single-Line Label Normalization (Recommended)

**Approach:** Add a helper to replace `\r`, `\n`, and `\t` with spaces before terminal output.

**Pros:**
- Small, deterministic hardening
- Consistent single-line stderr/status rendering

**Cons:**
- Slight behavior change for unusual filenames

**Effort:** Small

**Risk:** Low

---

### Option 2: Keep Existing Behavior

**Approach:** Rely on current sanitizer only.

**Pros:**
- No code changes

**Cons:**
- Potential output-shaping ambiguity remains

**Effort:** None

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/terminal/sanitize-terminal-text.ts`
- `src/ingest/epub.ts`
- Potentially other source-label emitters

**Database changes:**
- No

## Resources

- **Review target:** local branch `feat/phase-4-subphase-17-epub-ingestion`

## Acceptance Criteria

- [ ] Terminal-bound source labels render as single-line text
- [ ] Existing sanitization guarantees remain intact
- [ ] Regression tests cover newline/tab label normalization

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Captured security review note on newline-based output shaping.
- Scoped low-risk normalization path.

**Learnings:**
- Terminal safety includes layout determinism, not only ANSI stripping.
