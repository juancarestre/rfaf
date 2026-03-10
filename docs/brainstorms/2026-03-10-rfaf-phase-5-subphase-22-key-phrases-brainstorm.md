---
date: 2026-03-10
topic: rfaf-phase-5-subphase-22-key-phrases
---

# rfaf Phase 5 Subphase 22: `--key-phrases`

## What We're Building

Add `--key-phrases` as an LLM-powered emphasis feature that helps users spot the most important ideas before and during reading.

For v1, the experience includes:
- a top 5-10 key phrase preview before playback starts
- in-stream emphasis of those phrases while reading
- a standalone key phrase list output path for quick review/study

This feature analyzes the final text the user will read (after other enabled transforms) and should preserve deterministic CLI behavior with explicit errors.

## Why This Approach

We considered three approaches:

1. **Lean annotation pass (recommended baseline)**
   - preview + in-stream emphasis only
   - smallest scope and lowest risk
2. **Tunable extraction controls**
   - adds density/limits/tuning in v1
   - more flexibility but more complexity
3. **Dual output mode (chosen)**
   - preview + in-stream emphasis + standalone phrase list output
   - adds immediate study utility without broad mode-system expansion

We chose (3) because it keeps the core reading assist value while also giving a second practical use case (quick phrase review) with limited additional product surface.

## Key Decisions

- **Core UX:** `--key-phrases` provides both pre-read preview and in-stream emphasis.
- **Extraction source:** LLM-generated phrases only for this subphase.
- **Default intensity:** medium emphasis density.
- **Preview scope:** show top 5-10 phrases before reading starts.
- **Failure policy:** fail closed with clear, actionable errors.
- **Pipeline interaction:** analyze the final pre-reading text when combined with other flags.
- **Dual-output scope:** include standalone key phrase list output in v1.

## Open Questions

(None remaining for brainstorm scope.)

## Resolved Questions

- **Primary UX outcome?** Both preview and in-stream emphasis.
- **How are phrases identified?** LLM-generated only.
- **How aggressive is emphasis by default?** Medium density.
- **What does preview look like?** Top 5-10 list before playback.
- **What if extraction fails?** Fail closed with clear error.
- **Which text is analyzed with multiple flags?** Final text before reading.
- **Which approach was chosen?** Dual output mode.
- **What is the dual output in v1?** Standalone phrase list output.

## Next Steps

-> `/ce:plan` for implementation details and TDD sequencing.
