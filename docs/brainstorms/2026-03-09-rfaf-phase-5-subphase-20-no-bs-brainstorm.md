---
date: 2026-03-09
topic: rfaf-phase-5-subphase-20-no-bs
---

# rfaf Phase 5 Subphase 20: `--no-bs`

## What We're Building

Add a new CLI feature flag, `--no-bs`, that removes low-value reading noise and preserves only high-signal content before playback.

For v1, the behavior targets:
- unreadable/distracting symbols (including emojis and noisy glyphs)
- cookie/legal boilerplate
- promo/clickbait lines
- navigation/link clutter

The output must stay in the original language, avoid introducing new facts, and work uniformly across file/url/stdin/clipboard with agent parity in the same subphase.

## Why This Approach

We considered three approaches:

1. **Hybrid deterministic + LLM (chosen)**
   - deterministic cleanup pass removes obvious noise first
   - constrained LLM focus pass compresses remaining text while preserving factual content
2. **Deterministic-only cleaner**
   - strongest determinism and simplest failure model
   - weaker relevance compression quality
3. **LLM-only transform**
   - fastest implementation path
   - highest nondeterminism and contract risk

We chose (1) because it balances quality and safety while fitting existing rfaf patterns (typed errors, deterministic CLI contracts, and CLI/agent parity).

## Key Decisions

- **Output style:** Hybrid cleanup + focus.
- **Summary interaction:** If both flags are present, run `--no-bs` before `--summary`.
- **Noise classes in scope (v1):** emojis/weird symbols, legal/cookie boilerplate, promo/clickbait lines, nav/link clutter.
- **Safety boundary:** no new facts; deletions/rephrasing allowed, fabrication disallowed.
- **Language scope:** same-language cleanup only; translation remains in subphase 21.
- **Surface parity:** ship across all sources and agent API in this subphase.
- **Contract constraints:** preserve deterministic parse/error behavior and existing exit semantics.

## Open Questions

(None remaining for brainstorm scope.)

## Resolved Questions

- **How aggressive should no-bs be?** Hybrid cleanup + focus.
- **How should it interact with summary?** Run no-bs first, then summary.
- **What does v1 remove?** Noise classes listed above.
- **What safety boundary applies?** No new facts.
- **Language scope?** Same language only.
- **Parity scope?** Full CLI + agent parity for this subphase.

## Next Steps

-> `/ce:plan` for implementation details and TDD sequencing.
