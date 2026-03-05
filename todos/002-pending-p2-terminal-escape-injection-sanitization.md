---
status: complete
priority: p2
issue_id: 002
tags: [code-review, security, terminal]
dependencies: []
---

# Problem Statement

User-controlled text is rendered directly in terminal UI, allowing ANSI/OSC escape-sequence injection.

## Findings

- `src/ui/components/WordDisplay.tsx:63` renders raw word content.
- `src/ui/components/StatusBar.tsx:29` renders raw source labels.
- Ingested content and file path labels are user-controlled (`src/ingest/plaintext.ts:38`, `src/cli/index.tsx:172`).

## Proposed Solutions

### Option 1: Add centralized terminal text sanitizer
Pros: Consistent protection across all render points; easy reuse.  
Cons: Requires careful regex/character policy.  
Effort: Small  
Risk: Low

### Option 2: Sanitize only high-risk fields (`word`, `sourceLabel`)
Pros: Minimal code changes.  
Cons: Future fields may be missed.  
Effort: Small  
Risk: Medium

### Option 3: Whitelist printable chars only
Pros: Strongest hardening.  
Cons: May remove legitimate unicode/symbol text unexpectedly.  
Effort: Medium  
Risk: Medium

## Recommended Action

Option 1.

## Technical Details

- Add helper in `src/ui` or shared utility to strip ANSI/OSC/control chars.
- Apply helper in `WordDisplay` and `StatusBar`.

## Acceptance Criteria

- [ ] ANSI/OSC sequences in file content are not executed/rendered as control sequences.
- [ ] Status/source labels are sanitized.
- [ ] Normal punctuation and basic unicode remain readable.

## Work Log

- 2026-03-05: Created from security-sentinel finding.
- 2026-03-05: Added `src/ui/sanitize-terminal-text.ts` and applied it in `WordDisplay` + `StatusBar`.
- 2026-03-05: Added tests in `tests/ui/sanitize-terminal-text.test.ts`, `tests/ui/word-display.test.tsx`, and `tests/ui/status-bar.test.tsx`.

## Resources

- Security review evidence in agent output for current branch.
