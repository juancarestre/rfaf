---
date: 2026-03-09
topic: rfaf-phase-5-subphase-21-translate-to
---

# rfaf Phase 5 Subphase 21: `--translate-to`

## What We're Building

Add an explicit `--translate-to` feature that translates reading content into a user-requested target language before playback.

This is the only path that allows language changes. By default, rfaf continues preserving original language in summarize/no-bs flows.

For v1, translation should:
- accept flexible target inputs (codes and language names, including variants like `english`, `English`, `ingles`)
- normalize target language into a canonical internal representation
- fail closed on unresolved/ambiguous targets
- keep deterministic CLI/agent contracts and exit semantics

## Why This Approach

We considered three options:

1. **Hybrid parser + LLM normalizer (chosen)**
   - parse obvious forms locally
   - use constrained LLM normalization for flexible user phrasing
   - continue with deterministic translation contracts
2. **Strict static allowlist only**
   - simpler and highly deterministic
   - weaker UX for natural-language targets
3. **LLM-only freeform parsing**
   - most flexible
   - highest nondeterminism risk and weaker contract guarantees

We chose (1) to balance user-friendly input handling with deterministic runtime behavior and parity (same pattern used in other hardened rfaf LLM flows).

## Key Decisions

- **Feature scope:** implement explicit translation via `--translate-to` (Phase 5 Subphase 21 from the MVP roadmap; see `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`).
- **Ordering with other transforms:** `no-bs -> summary -> translate`.
- **Failure policy:** fail closed (no silent fallback to untranslated text).
- **Surface parity:** ship CLI + agent parity in this subphase.
- **Target input UX:** support codes and language names, including non-deterministic variants, via hybrid normalization.
- **Language catalog scope:** allow provider-supported languages, but reject unresolved/ambiguous target normalization results.
- **Default language behavior:** only `--translate-to` may change language; no other feature should auto-translate.

## Open Questions

(None remaining for brainstorm scope.)

## Resolved Questions

- **Target format:** support codes + names + natural variants (e.g., `english`, `English`, `ingles`) through normalization.
- **Transform order:** run translation after no-bs and summary.
- **Failure handling:** fail closed, no fallback.
- **Parity:** full CLI + agent parity now.
- **If source already equals target:** skip translation and keep text.
- **Language support scope:** provider-supported languages with deterministic unresolved-target failure.

## Next Steps

-> `/ce:plan` for implementation details and TDD sequencing.
