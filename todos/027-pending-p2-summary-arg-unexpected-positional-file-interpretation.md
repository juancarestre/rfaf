---
status: complete
priority: p2
issue_id: 027
tags: [code-review, security, cli, reliability]
dependencies: []
---

# Problem Statement

Invalid `--summary` value tokens can be silently reinterpreted as positional file inputs, leading to surprising behavior and unintended file reads in scripted contexts.

## Findings

- Arg normalization rewrites unknown `--summary <token>` to bare summary and leaves token positional (`src/cli/index.tsx:133`, `src/cli/index.tsx:135`).
- Flow then resolves positional input path normally (`src/cli/index.tsx:207`, `src/cli/index.tsx:220`).
- In automation, untrusted token sources could unintentionally target local paths.

## Proposed Solutions

### Option 1: Fail closed on non-preset values (Recommended)
Pros: Deterministic and safer; removes ambiguous interpretation.  
Cons: Slightly stricter than current forgiving behavior.
Effort: Small  
Risk: Low

### Option 2: Add explicit delimiter contract (`--`) and keep current behavior
Pros: Preserves backwards compatibility for some ambiguous calls.  
Cons: Still easier to misuse.
Effort: Small  
Risk: Medium

### Option 3: Keep as-is with documentation warning
Pros: No code change.  
Cons: Surprising behavior remains.
Effort: Small  
Risk: Medium

## Recommended Action


## Technical Details

- Affected: `src/cli/index.tsx`, summary CLI contract tests.

## Acceptance Criteria

- [ ] Invalid `--summary` values fail with usage-style error (exit `2`).
- [ ] Invalid summary token is never treated as positional file implicitly.
- [ ] Contract tests cover ambiguous forms and `--` separator semantics.

## Work Log

- 2026-03-05: Created from multi-agent review synthesis.
- 2026-03-05: Fixed by making `normalizeSummaryArgs` fail closed for unknown `--summary <token>` values (rewritten as explicit invalid value for resolver), and updating CLI contract tests to assert usage error for ambiguous forms.

## Resources

- Known pattern: deterministic CLI contracts in `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
