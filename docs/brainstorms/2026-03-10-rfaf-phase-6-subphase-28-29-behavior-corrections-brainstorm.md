---
date: 2026-03-10
topic: rfaf-phase-6-subphase-28-29-behavior-corrections
---

# rfaf Phase 6: Behavior Corrections (Summary Proportionality + No-BS at Scale)

## What We're Building

Phase 6 defines product behavior corrections for two linked outcomes that are treated as equal release priorities:

1. `--summary` output length must scale proportionally with source length so short inputs stay short and long inputs do not collapse into a near-fixed summary length.
2. `--no-bs` must handle large inputs (including large PDF-derived text) reliably while preserving content contracts.

This phase is a behavior-quality pass, not a feature expansion. The focus is predictable user-facing results under realistic input sizes.

## Why This Approach

We considered three options:

1. Strict proportional summary + strict no-bs reliability (chosen)
2. Proportional summary first, no-bs hardening later
3. Guardrail-first size limits with tighter rejections

We chose (1) because it aligns with rfaf's existing deterministic, fail-closed product philosophy and closes both known Phase 6 gaps together. Shipping only one half would leave trust and quality inconsistent across core AI transforms.

## Key Decisions

- **Equal priority scope**: Summary proportionality and large-input no-bs reliability are both Phase 6 blockers.
- **Keep fail-closed semantics**: When contracts cannot be satisfied, fail clearly with actionable errors; no silent fallback.
- **Proportionality anchor**: `--summary` scales primarily from source word count, with sensible lower/upper bounds.
- **Preset continuity**: `short|medium|long` remain, but become proportional ratio tiers instead of fixed sentence-band behavior.
- **Short-input behavior**: Very short inputs may remain near-original to avoid forced over-compression.
- **No-BS success definition**: Large-input `--no-bs` should process full content reliably under preservation constraints (not partial-by-default output).

## Open Questions

(None remaining - ready for planning.)

## Next Steps

-> `/ce:plan` for implementation details and validation criteria
