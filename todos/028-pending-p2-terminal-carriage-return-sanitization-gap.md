---
status: complete
priority: p2
issue_id: 028
tags: [code-review, security, terminal, sanitization]
dependencies: []
---

# Problem Statement

Terminal sanitization may still allow carriage-return style line spoofing in certain output paths.

## Findings

- Final output is sanitized and redacted in CLI (`src/cli/index.tsx:288`), but current sanitization policy should explicitly treat `\r` as unsafe in single-line status/error contexts.
- Runtime/state labels are displayed in terminal UI and may include provider/user-derived text paths (`src/ui/screens/RSVPScreen.tsx`, status rendering path).

## Proposed Solutions

### Option 1: Strengthen sanitizer to neutralize CR in display contexts (Recommended)
Pros: Simple defense-in-depth improvement.  
Cons: Might alter multiline formatting in some cases.
Effort: Small  
Risk: Low

### Option 2: Keep generic sanitizer and add context-specific sanitizer helpers
Pros: More precise per-output policy.  
Cons: More complexity and multiple call-site contracts.
Effort: Medium  
Risk: Medium

### Option 3: Keep current sanitizer behavior
Pros: No change.  
Cons: Potential terminal spoofing edge case remains.
Effort: Small  
Risk: Medium

## Recommended Action


## Technical Details

- Affected: `src/ui/sanitize-terminal-text.ts`, CLI output paths, UI status/help rendering tests.

## Acceptance Criteria

- [ ] Sanitization explicitly strips/neutralizes `\r` for single-line output contexts.
- [ ] Existing ANSI/OSC sanitization behavior remains intact.
- [ ] Regression tests include carriage-return payload assertions.

## Work Log

- 2026-03-05: Created from multi-agent review synthesis.
- 2026-03-05: Fixed by extending terminal sanitization to strip carriage-return control characters and adding regression coverage in `tests/ui/sanitize-terminal-text.test.ts`.

## Resources

- Known pattern: sanitize boundary guarantees in `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
