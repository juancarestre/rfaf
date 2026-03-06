---
date: 2026-03-06
topic: rfaf-phase-3-subphase-12-bionic-mode
---

# rfaf Phase 3 Subphase 12: Bionic Reading Mode

## What We're Building

Add a first-class **Bionic reading mode** as Phase 3 subphase 12, selectable via the same mode surface as existing modes. The user goal is better comprehension at the same WPM mental model, not a new interaction model.

This mode stays exclusive (single mode selection per run), preserves existing controls and navigation expectations, and keeps session behavior consistent across reading modes. Bionic mode may reshape tokens, but only when it clearly improves readability (for example, very long or visually dense words). Most words should remain stable and easy to track.

## Why This Approach

We considered three options: minimal adaptive bionic, broad structural segmentation, and configurable profiles in this subphase. We chose **minimal adaptive bionic** because it delivers the intended value quickly while keeping risk and complexity low.

This keeps the phase aligned with YAGNI: ship a focused, usable mode now, validate value, and defer broader customization to later phases if needed.

## Key Decisions

- Optimize for **comprehension at same WPM**, not maximum visual intensity.
- Keep `--mode` **exclusive** for this subphase (no mode composition).
- Allow token changes, but apply them **selectively** only when beneficial.
- Use **conservative prefix emphasis** as the default visual policy.
- Preserve core control/navigation/session expectations from existing modes.
- Keep `--summary` compatibility as **summary first, then bionic**, with fail-closed behavior.
- Ship **CLI and agent API parity in the same release**.
- Keep scope constrained to subphase 12; runtime mode switching remains phase 3.14.

## Open Questions

(None remaining - all resolved below.)

## Resolved Questions

- Primary optimization target: comprehension at same WPM.
- Token strategy: allowed, but only where beneficial.
- Mode interaction: exclusive mode selection.
- Parity: CLI + agent in the same release.
- Summary interaction: summarize first, then apply bionic mode.
- Visual intensity: conservative emphasis baseline.

## Next Steps

-> `/workflows:plan` for implementation details and acceptance-test sequencing
