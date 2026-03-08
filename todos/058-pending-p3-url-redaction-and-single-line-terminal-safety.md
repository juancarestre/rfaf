---
status: pending
priority: p3
issue_id: "058"
tags: [code-review, security, ui, terminal]
dependencies: []
---

# Harden URL/Title Terminal Output Safety

Terminal output currently prints full URLs and allows newline/tab characters in some displayed values.

## Problem Statement

Printing raw URLs can leak query tokens/credentials in logs, and newline/tab in terminal-facing text can create misleading multiline output. Risk is lower in local CLI but still relevant for CI logs, screenshots, and shared terminals.

## Findings

- URL included in progress and error text paths (`src/cli/index.tsx:250`, `src/ingest/url.ts:90`, `src/ingest/url.ts:99`).
- Terminal sanitizer removes ANSI/control chars but keeps `\n`/`\t` (`src/terminal/sanitize-terminal-text.ts:3`).
- Source label flows from extracted title to status outputs (`src/ingest/url.ts:139`, `src/cli/index.tsx:262`).
- Security review flagged leakage/spoofing risk.

## Proposed Solutions

### Option 1: Add Display-Safe Helpers (Recommended)

**Approach:**
- Add `redactUrlForDisplay(url)` stripping credentials and query string.
- Add single-line sanitizer helper for status lines (`\n`, `\t`, repeated whitespace -> spaces).

**Pros:**
- Better operational hygiene
- Consistent terminal output formatting

**Cons:**
- Slightly less verbose diagnostics

**Effort:** 2-4 hours

**Risk:** Low

---

### Option 2: Keep Full URL But Add Opt-In Redaction

**Approach:** Keep current default; add optional `RFAF_REDACT_URLS=1` behavior.

**Pros:**
- Backward-compatible output

**Cons:**
- Safety depends on user opting in

**Effort:** 1-2 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/cli/index.tsx`
- `src/ingest/url.ts`
- `src/terminal/sanitize-terminal-text.ts`
- relevant CLI contract tests

**Database changes:**
- No

## Resources

- **PR:** https://github.com/juancarestre/rfaf/pull/1
- **Review source:** security-sentinel

## Acceptance Criteria

- [ ] Terminal-bound URLs are display-redacted by default (or explicitly justified otherwise)
- [ ] Status/progress labels are single-line safe
- [ ] Tests cover query-string and newline/tab edge cases
- [ ] Existing error redaction behavior remains intact

## Work Log

### 2026-03-07 - Code Review Finding Created

**By:** OpenCode

**Actions:**
- Grouped related terminal-output security/UX findings into one hardening task
- Scoped helper-based implementation approach for minimal surface impact

**Learnings:**
- Local CLI still benefits from output hardening when logs/sessions are shared.
