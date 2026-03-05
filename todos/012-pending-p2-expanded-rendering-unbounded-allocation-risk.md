---
status: complete
priority: p2
issue_id: 012
tags: [code-review, security, performance, ui]
dependencies: []
---

# Problem Statement

Expanded rendering mode performs multiple full-string allocations per tick with no word-length bound, creating local DoS/GC-jitter risk for very long tokens.

## Findings

- `src/ui/components/WordDisplay.tsx:43` uses `split("").join(" ")` in hot path.
- `src/ui/components/WordDisplay.tsx:45` and `src/ui/components/WordDisplay.tsx:47` add `slice` + `toUpperCase` passes.
- At high WPM and long sessions, repeated transient allocations can increase GC churn.
- Crafted oversized tokens can significantly increase CPU/memory pressure in `--text-scale large`.

## Proposed Solutions

### Option 1: Cap renderable token length in expanded mode with ellipsis fallback
Pros: Strong bound on worst-case memory/CPU; simple safeguard.  
Cons: Very long words are visually truncated.  
Effort: Small  
Risk: Low

### Option 2: Precompute expanded display strings during tokenization/ingest
Pros: Removes repeated per-frame expansion work.  
Cons: Increases upfront memory and parser coupling.  
Effort: Medium  
Risk: Medium

### Option 3: Replace `split/join` with single-pass spacing builder and cache by word
Pros: Keeps full fidelity while reducing allocations.  
Cons: More implementation complexity than hard cap.  
Effort: Medium  
Risk: Medium

## Recommended Action


## Technical Details

- Affected: `src/ui/components/WordDisplay.tsx`
- Impact area: hot rendering loop, resilience under malformed/extreme input.

## Acceptance Criteria

- [ ] Expanded rendering has bounded complexity for oversized tokens.
- [ ] Long-token scenarios do not freeze UI in manual/PTy smoke checks.
- [ ] Existing layout/pivot tests remain green.

## Work Log

- 2026-03-05: Created from multi-agent review synthesis.
- 2026-03-05: Fixed by bounding expanded render input to 256 chars with truncation and switching spacing expansion to a single-pass builder; added oversized-word layout test.

## Resources

- Review context: `compound-engineering.local.md`
