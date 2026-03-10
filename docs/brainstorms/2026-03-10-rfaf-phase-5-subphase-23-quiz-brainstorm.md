---
date: 2026-03-10
topic: rfaf-phase-5-subphase-23-quiz
---

# rfaf Phase 5 Subphase 23: `--quiz`

## What We're Building

An opt-in CLI quiz experience that checks reading retention with minimal friction. The feature is exposed through `--quiz` and focuses on a short, practical comprehension checkpoint using multiple-choice questions.

This subphase is intentionally scoped as a lightweight learning loop: users read (or choose quiz flow), complete a quick quiz, then immediately see a score and the key topics they likely missed. The goal is not formal assessment; the goal is better recall and better follow-up reading decisions.

## Why This Approach

Three approaches were considered:

1. **Standalone-first quiz** (chosen)
2. Post-read integrated quiz only
3. Hybrid dual-entry (standalone + post-read from day one)

We chose (1) because it delivers user value fastest with the smallest surface area. It aligns with existing Phase 5 LLM-style flags (single-purpose, opt-in, deterministic behavior) while avoiding early complexity from supporting two entry points and extra branching.

## Key Decisions

- **Primary outcome**: Quick retention check, not exam-grade evaluation.
- **Result format**: Score plus missed topics, so users know what to revisit.
- **Quiz length**: Adaptive to source length, avoiding one fixed question count.
- **Answer type**: Multiple-choice only for this subphase.
- **Entry model**: Standalone-first flow for `--quiz`.
- **Content basis**: Quiz generation uses the final displayed text as source of truth.
- **Scope guardrail (YAGNI)**: No rich pedagogy features (long explanations, mixed question formats, tutoring loops) in this subphase.

## Open Questions

(None currently.)

## Resolved Questions

- **Goal**: Prioritize rapid recall reinforcement over formal testing.
- **Output**: Return clear score + missed-topic feedback.
- **Length model**: Use adaptive question count based on text size.
- **Question format**: Use multiple-choice only.
- **Trigger model**: Start with standalone-first `--quiz` behavior.
- **Source text**: Build quiz from the transformed/final text users actually read.

## Next Steps

-> `/ce:plan` for Phase 5 Subphase 23 implementation details
