---
date: 2026-03-09
topic: rfaf-phase-4-subphase-19-clipboard-support
phase: 4
subphase: 19
---

# rfaf Phase 4 Subphase 19: Clipboard Support

## What We're Building

Add clipboard ingestion so users can read copied text directly with `rfaf` without saving temp files first.

Scope is intentionally constrained for reliability:
- explicit trigger via `--clipboard`
- plain-text clipboard content only
- deterministic fail-fast behavior when clipboard is empty/unavailable/unsupported
- deterministic fail-fast conflict when `--clipboard` is combined with file/url/stdin
- CLI and agent parity in the same subphase

Once clipboard text is normalized into the existing `Document` contract, all downstream reading behavior remains unchanged across modes and summary flow.

## Why This Approach

We considered three approaches:

1. **Dedicated clipboard source contract (chosen)**
2. CLI wrapper over existing stdin path
3. Broad clipboard backend abstraction first

We chose (1) because it best preserves determinism and existing source-ingest patterns while staying YAGNI. It delivers one-command reliability without changing current file/url/stdin precedence semantics or introducing unnecessary backend complexity.

## Key Decisions

- **Trigger model:** Explicit `--clipboard` flag only.
- **Input format:** Plain text clipboard content only in this subphase.
- **Conflict behavior:** If `--clipboard` is used with file/url/piped stdin, fail fast with deterministic usage error.
- **Parity requirement:** Ship CLI and agent support in the same subphase.
- **Success priority:** One-command reliability with deterministic behavior and errors.
- **Scope boundary:** No auto-fallback clipboard reads, no rich HTML/image clipboard parsing, no clipboard history/watch mode.
- **Contract alignment:** Reuse existing deterministic ingest/error boundaries and shared runtime pipeline.

## Open Questions

(None remaining.)

## Resolved Questions

- How should clipboard be triggered? **Explicit flag (`--clipboard`)**.
- Which clipboard format should be supported now? **Plain text only**.
- What happens if `--clipboard` is combined with other sources? **Fail fast deterministic conflict**.
- Should parity ship now? **Yes, CLI + agent in same subphase**.
- What is top success signal? **One-command reliability (`rfaf --clipboard`)**.
- Which implementation direction should we use? **Dedicated clipboard source contract**.

## Next Steps

-> `/ce:plan docs/brainstorms/2026-03-09-rfaf-phase-4-subphase-19-clipboard-support-brainstorm.md`
