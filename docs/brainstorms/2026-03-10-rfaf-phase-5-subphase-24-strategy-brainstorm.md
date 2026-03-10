---
date: 2026-03-10
topic: rfaf-phase-5-subphase-24-strategy
---

# rfaf Phase 5 Subphase 24 - Strategy Recommendation

## What We're Building

Add a new `--strategy` CLI flag that recommends the best reading mode for the current text before reading starts.

In v1, this is advisory only: it does not auto-switch modes. The feature returns one recommended mode from the existing set (`rsvp`, `chunked`, `bionic`, `scroll`) plus a short, human-readable reason. The user keeps full control over the active mode.

## Why This Approach

We considered three options:

1. **LLM recommendation with constrained output** (chosen)
2. Rules-only heuristic recommender
3. Hybrid rules + LLM refinement

We chose (1) because this phase is explicitly an LLM feature and benefits from semantic understanding of text style. Constraining output to existing modes keeps behavior deterministic while still capturing LLM flexibility. This gives better recommendations than fixed heuristics without introducing hybrid-system complexity in v1.

## Key Decisions

- **Recommendation-only v1**: `--strategy` suggests; it does not auto-apply mode changes.
- **Text-only input**: no profile/history/personalization in first version.
- **Output format**: print `recommended mode + one-line why`.
- **Flag interaction**: if both `--mode` and `--strategy` are passed, explicit `--mode` wins; strategy still reports what it would have chosen.
- **Failure behavior**: fail open with a warning, then continue normal reading flow.
- **Constrained domain**: strategy must resolve to one of the existing mode identifiers only.

## Open Questions

(None remaining.)

## Resolved Questions

- Should v1 auto-switch modes? **No** - recommendation only.
- Should recommendation use personalization? **No** - text only.
- Should output include rationale? **Yes** - one concise reason line.
- Should strategy override explicit mode? **No** - explicit mode wins.
- Should failures block reading? **No** - warn and continue.

## Next Steps

-> `/ce:plan` for implementation details and acceptance criteria.
