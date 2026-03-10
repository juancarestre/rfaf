---
status: complete
priority: p2
issue_id: "097"
tags: [code-review, cli, quality, contracts]
dependencies: []
---

# Harden Key-Phrases Arg Normalization

Make `--key-phrases` normalization deterministic without misclassifying positional inputs.

## Problem Statement

Current normalization heuristics can consume extensionless positional inputs as mode values, producing an invalid value error instead of normal input resolution.

## Findings

- `src/cli/index.tsx:231-241` uses a path/url heuristic for `--key-phrases` value capture.
- Values like `notes` or `README` can be interpreted as mode value instead of file input.
- This conflicts with deterministic CLI contracts used elsewhere in the codebase.

## Proposed Solutions

### Option 1: Explicit Mode Allowlist

**Approach:** Only consume next token when it is exactly `preview` or `list` (case-insensitive). Otherwise treat as bare flag and keep token positional.

**Pros:**
- Deterministic and predictable
- Matches existing contract-hardening precedent

**Cons:**
- Slightly stricter than heuristic convenience

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Keep Heuristic + Extra Exceptions

**Approach:** Expand heuristic rules for common extensionless inputs.

**Pros:**
- Minimal refactor

**Cons:**
- Brittle and likely to regress

**Effort:** 1-2 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/cli/index.tsx`
- `tests/cli/key-phrases-cli-contract.test.ts`

**Related components:**
- CLI arg normalization stack (summary/translate/key-phrases)

**Database changes:**
- No

## Resources

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`

## Acceptance Criteria

- [ ] `--key-phrases <positional-input>` behaves deterministically when token is not an allowed mode
- [ ] `--key-phrases preview|list` works for both spaced and equals forms
- [ ] CLI contract tests cover extensionless positional input cases

## Work Log

### 2026-03-10 - Code Review Discovery

**By:** Claude Code

**Actions:**
- Recorded parse-contract issue from TypeScript review
- Mapped to known deterministic parser learnings

**Learnings:**
- Arg normalization must avoid value guesses that depend on path-like heuristics.

### 2026-03-10 - Resolution

**By:** Claude Code

**Actions:**
- Replaced heuristic value capture in `normalizeKeyPhrasesArgs` (`src/cli/index.tsx`) with explicit allowlist parsing (`preview|list` only)
- Preserved bare-flag semantics for extensionless positional inputs
- Added CLI contract coverage in `tests/cli/key-phrases-cli-contract.test.ts` for extensionless positional token handling

**Learnings:**
- Explicit mode-token parsing avoids nondeterministic interpretation of positional arguments.

## Notes

- Keep this aligned with existing summary/translate contract behavior.
