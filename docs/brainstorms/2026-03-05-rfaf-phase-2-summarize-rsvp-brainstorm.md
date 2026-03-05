---
date: 2026-03-05
topic: rfaf-phase-2-summarize-rsvp
---

# rfaf Phase 2 - Summarize Then RSVP

## What We're Building

Phase 2 adds an AI summarization flow that transforms source text into a shorter version and then automatically starts RSVP on that summary (not the original text).

The primary user outcome is faster reading with less pre-read friction: users run one command, get compressed content, and immediately enter the reading experience.

## Why This Approach

We considered three options: automatic summarize+read, a two-step summarize workflow, and an interactive chooser. We chose automatic summarize+read because it matches the intended behavior exactly while keeping interaction simple and fast.

This keeps Phase 2 focused on one differentiated value (AI compression feeding RSVP) without introducing broader mode/UI complexity.

## Key Decisions

- **Phase 2 focus is LLM summarization**: Keep alignment with original phase roadmap and ship AI value next.
- **Summary becomes the reading source**: RSVP auto-starts on summarized text, not the original.
- **Default behavior is summary-only**: No summary-vs-original choice in this phase.
- **Failure is explicit, not silent fallback**: If summarization fails (key/config/provider/timeout), exit with a clear actionable error.
- **Summary length uses 3 presets**: `short`, `medium`, `long` for predictable outcomes.
- **Config file is included in Phase 2**: Introduce minimal `~/.rfaf/config.toml` scope for summarize settings/provider wiring.
- **Scope stays tight (YAGNI)**: No additional reading modes, no advanced prompt studio, no runtime model-switch UX.

## Open Questions

(None remaining.)

## Resolved Questions

- **Phase direction**: Keep Phase 2 centered on LLM summarize capability.
- **Summary UX**: Automatically start RSVP on the summary.
- **Reading source choice**: Summary-only default.
- **Provider/config scope**: Include config file in Phase 2.
- **Failure handling**: Fail clearly instead of falling back to original text.
- **Summary size controls**: 3 presets (`short|medium|long`).

## Next Steps

-> `/workflows:plan` to define CLI contract, config contract, summarize pipeline behavior, validation/error semantics, and tests.
