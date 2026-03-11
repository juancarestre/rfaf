---
date: 2026-03-11
topic: rfaf-phase-6-long-input-summary-no-bs
---

# rfaf Phase 6: Long-Input Reliability for `--summary` and `--no-bs`

## What We're Building

Make `--summary` and `--no-bs` work reliably for long inputs (especially PDF-derived text) without changing user-facing flags.

The target behavior is automatic long-input handling that preserves strict quality contracts:

- `--summary` must stay proportionate to source length
- `--no-bs` must preserve core content fidelity (not accidental summarization)
- failures remain deterministic and fail-closed when contracts cannot be satisfied

## Why This Approach

Three approaches were considered:

1. **Deterministic chunk-and-merge** (chosen)
2. Two-pass map/reduce transform
3. Hybrid adaptive chunking with strict global budgets

We chose (1) because it is the best YAGNI fit: reuse existing contract checks/retry behavior, avoid new UX surface, and solve current long-input failures with minimal added complexity.

## Key Decisions

- **Keep strict guards**: Do not loosen summary proportionality or no-bs preservation checks globally.
- **No new flags**: Long-input handling is automatic when inputs exceed safe single-pass bounds.
- **Fail closed**: If any chunk cannot satisfy schema/contract checks after retries, return a clear typed error.
- **Deterministic behavior first**: Keep ordering and transform contracts stable with current pipeline semantics.
- **Scope boundary**: Focus only on long-input reliability for `--summary` and `--no-bs`; no new feature surface.

## Open Questions

(None remaining - all resolved below.)

## Resolved Questions

- **Guard strictness**: Keep strict guards and add chunking (not global threshold relaxation).
- **UX surface**: Automatic handling with no new flags.
- **Failure policy**: Fail closed with deterministic typed error if chunk-level validation cannot recover.

## Next Steps

-> `/ce:plan` to define contract tests, chunk-merge rules, and rollout sequencing.
