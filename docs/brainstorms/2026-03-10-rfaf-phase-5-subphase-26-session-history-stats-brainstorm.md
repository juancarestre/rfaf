---
date: 2026-03-10
topic: rfaf-phase-5-subphase-26-session-history-stats
---

# rfaf Phase 5 Subphase 26: Session History + Stats

## What We're Building

Add a first-class local history feature focused on **personal progress tracking**.

In this subphase, users get a dedicated `history` command that shows a concise list of completed reading sessions with core metrics:
- session date/time
- reading duration
- words read
- average WPM
- reading mode
- sanitized source label

The goal is to help users answer: "Am I reading consistently and improving over time?" without introducing heavy analytics or reporting complexity.

## Why This Approach

Three approaches were considered:

1. **Lean local history** (chosen)  
   Dedicated `history` command with completed sessions and core metrics only.
2. **History + basic trend summary**  
   Adds early trend interpretation in v1.
3. **History + early aggregate analytics**  
   Adds rollups and deeper breakdowns in v1.

We chose (1) because it matches the desired user value with the smallest viable scope. It establishes a reliable baseline data model and UX while avoiding premature analytics complexity (YAGNI).

## Key Decisions

- **Primary outcome:** personal progress tracking.
- **Access surface:** dedicated `history` command.
- **Stored source data:** sanitized labels only (not full raw paths/URLs by default).
- **Session inclusion rule:** completed sessions only in v1.
- **Stats scope in v1:** core metrics only (date/time, duration, words, avg WPM, mode, source label).
- **Approach selected:** lean local history baseline (no trend/rollup analytics in this subphase).

## Open Questions

(None remaining for brainstorm scope.)

## Resolved Questions

- **Main value of this subphase?** Personal progress tracking.
- **How should users access it?** Dedicated `history` command.
- **What source data should be stored?** Sanitized source labels only.
- **Which sessions should be saved?** Completed sessions only.
- **How much analytics in v1?** Core metrics only.

## Next Steps

-> `/ce:plan` to define data contract boundaries, CLI behavior contracts, and TDD-first implementation sequencing.
