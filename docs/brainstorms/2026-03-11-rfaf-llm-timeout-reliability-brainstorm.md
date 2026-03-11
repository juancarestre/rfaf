---
date: 2026-03-11
topic: rfaf-llm-timeout-reliability
---

# RFAF LLM Timeout Reliability

## What We're Building
We are improving timeout reliability for long inputs so users can successfully run transforms on large files (for example full PDFs) without frequent timeout failures. The default product behavior should prioritize completion rate over strict speed for long documents, while still keeping bounded runtime limits.

This applies to all LLM transforms for consistency: `--summary`, `--no-bs`, `--translate-to`, and `--key-phrases`.

## Why This Approach
We chose a unified adaptive timeout policy (Approach A) instead of static timeout bumps or provider fallback chains. Static timeout increases are easy but brittle. Provider fallback adds complexity and cost variability that is not required right now.

A unified adaptive policy is the best YAGNI fit: simple enough to reason about, consistent across features, and directly aligned with the goal of making long docs succeed more often.

## Key Decisions
- Use one timeout strategy across all LLM transforms, not transform-specific behavior.
- Prioritize higher success for long documents, even with slower average runtime.
- Keep bounded limits (no unbounded waiting), with clear timeout messaging when limits are reached.
- If timeout still occurs, default UX is to offer continuation without the failed transform (for example continue reading original text when summary times out).
- Keep failure semantics deterministic and explicit; avoid silently returning partial low-confidence transform output by default.

## Resolved Questions
- **Root issue framing:** Current failures are primarily timeout-budget mismatch for long inputs, not user misuse.
- **Reliability target:** Long documents should succeed by default.
- **Scope:** Apply policy across all LLM transforms.
- **Performance posture:** Higher success is preferred over fast-fail behavior.
- **Timeout fallback UX:** Offer continue-without-transform when timeout persists.

## Open Questions
- None at this stage.

## Next Steps
Proceed to planning to define acceptance criteria and policy boundaries (for example adaptive budget tiers, hard caps, and consistent CLI user messaging).
