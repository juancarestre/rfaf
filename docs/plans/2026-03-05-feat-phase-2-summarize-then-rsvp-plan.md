---
title: "feat: Add Phase 2 Summarize-Then-RSVP Flow"
type: feat
status: completed
date: 2026-03-05
origin: docs/brainstorms/2026-03-05-rfaf-phase-2-summarize-rsvp-brainstorm.md
---

# feat: Add Phase 2 Summarize-Then-RSVP Flow

## Overview

Found brainstorm from 2026-03-05: `rfaf-phase-2-summarize-rsvp`. Using it as foundation for planning.

Phase 2 adds an AI summarization flow that converts input into a shorter version and then automatically starts RSVP on the summary text (not the original) (see brainstorm: `docs/brainstorms/2026-03-05-rfaf-phase-2-summarize-rsvp-brainstorm.md`).

This plan also incorporates additional product constraints from request context:
- TDD-first delivery is mandatory.
- Add `--summary` CLI flag with preset values and default medium behavior.
- Show clear loading/progress feedback while summarization is running.
- Use Vercel AI SDK structured output for type-safe summary payloads.
- Initial config supports OpenAI, Anthropic, and Google models.

## Problem Statement / Motivation

rfaf currently excels at RSVP playback but requires users to read full source material every time. The next differentiated value is reducing pre-read friction by compressing content with AI before reading starts (see brainstorm: `docs/brainstorms/2026-03-05-rfaf-phase-2-summarize-rsvp-brainstorm.md`).

Phase 2 should deliver that value in one tight flow: summarize, then read summary. It must remain deterministic, visibly active during network waits, and explicit on failure.

## Research Summary

### Local Research (Always-on)

- **CLI contract patterns**
  - Flag parsing and startup orchestration live in `src/cli/index.tsx:105`.
  - Typed option resolvers are already established in `src/cli/text-scale-option.ts:11`.
  - Contract-level CLI tests use `Bun.spawnSync` patterns in `tests/cli/text-scale-cli-contract.test.ts:3`.

- **RSVP source pipeline pattern**
  - Tokenization starts from resolved document content in `src/cli/index.tsx:170`; Phase 2 should inject summary generation before this point so RSVP naturally consumes summary text.

- **Terminal/runtime safety invariants**
  - Session lifecycle wrapper is centralized in `src/cli/session-lifecycle.ts:18`.
  - Sanitization boundary exists at `src/ui/sanitize-terminal-text.ts:5`.
  - TTY/raw-mode and deterministic CLI behavior are explicit conventions in `compound-engineering.local.md:8`.

- **UI composition patterns**
  - Existing status/progress component style is in `src/ui/components/ProgressBar.tsx:8` and `src/ui/screens/RSVPScreen.tsx:292`.
  - Ink layout centering gotchas and resolution are documented in `docs/solutions/ui-bugs/20260305-rsvp-words-not-vertically-centered-terminal-layout.md`.

### Institutional Learnings

- Preserve lifecycle cleanup even on early failures, especially for pre-RSVP async work (`docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`).
- Keep sanitization at render boundaries for any model/provider-originated text (`docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`).
- Reuse explicit flex-axis contracts for loading UI to avoid centering regressions (`docs/solutions/ui-bugs/20260305-rsvp-words-not-vertically-centered-terminal-layout.md`).

### External Research Decision

External research included. This feature depends on external AI APIs/providers and model lifecycle risk, so documentation-backed constraints are required.

### External Research Highlights

- Use Vercel AI SDK structured generation with schema validation for type-safe outputs and explicit parse failures.
- Centralize provider selection and model resolution; avoid implicit provider fallbacks.
- Pin provider/model choices and account for deprecations and migration timelines.
- Use explicit timeout/abort/retry policy and map errors into stable CLI categories.

Key references:
- AI SDK structured data: `https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data`
- AI SDK provider management: `https://ai-sdk.dev/docs/ai-sdk-core/provider-management`
- AI SDK errors: `https://ai-sdk.dev/docs/reference/ai-sdk-errors`
- OpenAI deprecations: `https://platform.openai.com/docs/deprecations`
- Anthropic model deprecations: `https://docs.anthropic.com/en/docs/about-claude/model-deprecations`
- Vertex/Gemini deprecations: `https://cloud.google.com/vertex-ai/generative-ai/docs/deprecations`

## Proposed Solution

Implement a `--summary`-driven pre-processing flow that summarizes input via Vercel AI SDK and then starts RSVP on summary content only (see brainstorm: `docs/brainstorms/2026-03-05-rfaf-phase-2-summarize-rsvp-brainstorm.md`).

### Behavior Contract

- `rfaf --summary` means summarize with `medium` preset.
- `rfaf --summary short|medium|long` selects requested preset.
- `rfaf` without `--summary` preserves current behavior (RSVP original text) to avoid breaking existing workflows.
- In summarize mode, reading source is always summary text only (no in-session summary/original chooser) (see brainstorm: `docs/brainstorms/2026-03-05-rfaf-phase-2-summarize-rsvp-brainstorm.md`).
- Summarization failures are explicit and terminal: no silent fallback to original content (see brainstorm: `docs/brainstorms/2026-03-05-rfaf-phase-2-summarize-rsvp-brainstorm.md`).

### Error Contract (Explicit)

Define stable error classes and deterministic exit behavior:

- **Usage/config validation errors** (invalid flag value, invalid config/provider/model): exit `2`.
- **Summarization runtime errors** (auth, quota/rate-limit, timeout/network/provider/server/schema failure): exit `1`.
- **Success**: exit `0`.

Error messages must be actionable and include:
- failing stage (`config`, `provider`, `schema`, `network`, `timeout`)
- selected provider/model context (sanitized)
- next action hint (fix config, check key/quota, retry later)

### Timeout/Retry Contract

- Summarize request must use explicit timeout budget (no implicit infinite wait).
- Retries allowed only for transient classes (rate-limit/network/5xx), never for config/auth/schema errors.
- Retry count must be bounded and deterministic.
- `Ctrl+C` must cancel in-flight summarize attempts and stop loading immediately.

### Config Contract (`~/.rfaf/config.toml`)

Minimal Phase 2 config scope (see brainstorm: `docs/brainstorms/2026-03-05-rfaf-phase-2-summarize-rsvp-brainstorm.md`):
- Provider: `openai | anthropic | google`
- Model identifier per provider
- API key source strategy (env var references and/or local config field policy)
- Timeout and retry defaults for summarize call
- Default summary preset (defaults to `medium` if unset)

Out of scope in this phase:
- multi-step prompt builder UX
- runtime provider switching UI
- summarize+original side-by-side mode
- additional reading modes

### Structured Output Contract

Summary output must be schema-validated and typed before use as RSVP source.

Required at planning level:
- typed schema module for summary payload
- strict parse at response boundary
- explicit error mapping for schema failure
- sanitized text prior to terminal rendering

### Loading UX Contract

During summarize call, show visible loading feedback so users know work is in progress.

Requirements:
- starts before outbound AI request
- remains visible until success/failure/interrupt
- uses explicit Ink flex-axis layout to stay centered and stable
- no hanging spinner after completion/failure
- behavior is deterministic for TTY and non-TTY contexts

### Config & Secret Precedence Contract

- Precedence order: CLI flags > env vars > `~/.rfaf/config.toml` > defaults.
- Provider/model/source resolution must be deterministic and surfaced in debug-safe diagnostics.
- Secrets must never be printed in logs/errors; redact key-like values in all output paths.

### Summary Quality Contract

- Schema must enforce required summary text field(s).
- Empty or whitespace-only summaries are invalid and treated as failure.
- Enforce upper bound on summary payload size before tokenization.
- Define predictable target ranges for presets `short|medium|long` (character or token budget policy).

## Technical Considerations

- Add summary option resolver mirroring `text-scale` typed validation pattern (`src/cli/text-scale-option.ts:11`).
- Insert summarize pipeline before `tokenize(...)` call in CLI flow (`src/cli/index.tsx:170`).
- Keep lifecycle safety with current wrapper (`src/cli/session-lifecycle.ts:18`); summarize errors must still restore terminal state.
- Enforce deterministic error/exit behavior in same style as existing CLI contract tests (`tests/cli/text-scale-cli-contract.test.ts:26`).
- Protect terminal rendering by sanitizing provider/model strings and generated summary text (`src/ui/sanitize-terminal-text.ts:5`).
- Keep scope aligned with brainstorm decisions; no speculative abstractions beyond provider/config boundary (see brainstorm: `docs/brainstorms/2026-03-05-rfaf-phase-2-summarize-rsvp-brainstorm.md`).
- Explicitly handle TTY vs non-TTY output mode for loading UX (interactive spinner only when appropriate).

## Failure Modes Matrix

| Failure mode | Expected behavior | Exit | RSVP start |
|---|---|---:|---|
| Invalid `--summary` value | Usage error with valid preset hint | 2 | No |
| Missing/invalid config | Config error with actionable hint | 2 | No |
| Unsupported provider/model combo | Config/provider resolution error | 2 | No |
| Missing/invalid API key | Provider auth error (redacted) | 1 | No |
| 429 / quota / transient 5xx after bounded retries | Runtime summarize failure | 1 | No |
| Timeout / network abort | Runtime summarize failure | 1 | No |
| Structured output parse/schema failure | Schema error with remediation hint | 1 | No |
| Empty summary after validation | Validation failure | 1 | No |
| SIGINT during summarize | Cancel work, stop loading, clean exit path | 1 | No |

## System-Wide Impact

- **Interaction graph:** CLI parse (`src/cli/index.tsx`) -> input source resolution -> summarize pipeline (new) -> schema validation (new) -> tokenize summary -> RSVP render path.
- **Error propagation:** provider/config/schema/timeout errors should terminate summarize flow with explicit actionable output and non-zero exit; no fallback chain.
- **State lifecycle risks:** async summarize step can fail before RSVP startup; lifecycle cleanup must still execute; loading UI must cleanly terminate on every path.
- **API surface parity:** if summarization settings are exposed through agent APIs later, parity expectations should be documented; Phase 2 can defer agent support but must note it explicitly in implementation PR scope.
- **Integration test scenarios:** full CLI path tests must assert summarize-before-RSVP ordering and no-RSVP-on-failure behavior.

## SpecFlow Analysis Integration

SpecFlow gaps addressed in this plan:
- Lock `--summary` semantics (`--summary` => `medium`; explicit preset values).
- Define summary schema requirements and empty-output policy.
- Define stable failure classes and non-zero exit outcomes.
- Define loading behavior in TTY and interrupt paths.
- Define timeout/retry boundaries and no-fallback policy.

## Acceptance Criteria

### Functional

- [x] `--summary` flag is supported with presets `short|medium|long` and defaults to `medium` when no value is provided.
- [x] In summarize mode, rfaf always starts RSVP on summarized text, never the original source.
- [x] Initial provider config supports OpenAI, Anthropic, and Google model selection via `~/.rfaf/config.toml`.
- [x] Vercel AI SDK structured output is schema-validated and typed before tokenization.

### Failure & Error Semantics

- [x] Missing/invalid config, provider auth failure, timeout, provider errors, and schema validation failures produce clear actionable errors.
- [x] On any summarize failure, RSVP does not start and process exits non-zero.
- [x] No silent fallback to original content in summarize mode.
- [x] Usage/config validation errors return exit code `2`; runtime summarize failures return exit code `1`.
- [x] Errors redact secrets and never print raw API keys.
- [x] Provider/model context in error messages is sanitized before rendering.

### UX / Loading Behavior

- [x] A visible loading state is shown during summarization.
- [x] Loading starts before request, ends on success/failure/cancel, and never hangs.
- [x] Loading layout remains stable and centered in common terminal sizes.
- [x] Non-TTY runs degrade gracefully (no broken spinner artifacts) while still surfacing progress state text.

### Quality Gates (TDD Required)

- [x] Tests are written first for each behavior contract slice (red -> green -> refactor).
- [x] `bun test` passes with zero failures.
- [x] `bun x tsc --noEmit` passes.
- [x] PTY acceptance checks are updated for summarize loading and failure paths.
- [x] Contract tests cover retry/timeout policy and SIGINT cancellation behavior.

## Testing Strategy: TDD Is Mandatory

### TDD Loop

1. Add a focused failing test for one contract slice.
2. Run only the related test file.
3. Implement minimal change to pass.
4. Refactor while keeping green.
5. Re-run full suite and typecheck.

### Planned Test Work (by file)

- **CLI option resolver tests**
  - `tests/cli/summary-args.test.ts`
  - Covers preset parsing, default medium behavior, invalid values, duplicate args behavior.

- **CLI contract tests**
  - `tests/cli/summary-cli-contract.test.ts`
  - Covers exit codes/messages for missing config, provider failures, schema failures, no-fallback semantics, and TTY/non-TTY output behavior.

- **Config parsing/validation tests**
  - `tests/config/llm-config.test.ts`
  - Covers provider enum, model presence, key resolution policy, timeout bounds.

- **Structured summarize tests**
  - `tests/llm/summarize.test.ts`
  - Covers valid schema parse, malformed/partial response, empty summary, timeout behavior, retry boundaries, and token/size budget enforcement.

- **Loading UI tests**
  - `tests/ui/summarize-loading.test.tsx`
  - Covers loading visibility lifecycle and centered layout contract.

- **Flow integration tests**
  - `tests/cli/summarize-to-rsvp-flow.test.ts`
  - Asserts summarize -> RSVP(summary) ordering, that RSVP is skipped on summarize failure, and SIGINT cancellation path.

- **PTY validation artifact updates**
  - `docs/validation/2026-03-05-acceptance-pty.md`
  - Add summarize mode startup, loading, failure, and interrupt checks.

## Suggested Implementation Phases (Planning-Level)

### Phase A: Contract Lock

- Finalize `--summary` semantics and error taxonomy.
- Finalize config schema contract for provider/model/key/timeout.
- Finalize structured summary schema and size constraints.

### Phase B: Core Summarize Pipeline

- Add summarize pipeline before tokenization.
- Add provider registry and structured output boundary.
- Enforce explicit failure/no-fallback behavior.

### Phase C: Loading UX

- Implement centered loading state with deterministic lifecycle.
- Verify terminal behavior on success/failure/interrupt.

### Phase D: Hardening & Validation

- Complete full TDD matrix.
- Run full tests, typecheck, and PTY acceptance checks.
- Verify no regression to lifecycle/sanitization invariants.

## Success Metrics

- Summarize mode is one-command and deterministic.
- Users consistently see active progress while waiting on AI response.
- Error outcomes are actionable and predictable.
- No regressions in terminal lifecycle safety or CLI determinism.

## Dependencies & Risks

- **Risk:** Provider/model deprecations and API surface drift.
  - **Mitigation:** pin supported providers/models; document upgrade cadence and validation checks.

- **Risk:** Schema drift or malformed model output.
  - **Mitigation:** strict structured validation with explicit error handling and tests.

- **Risk:** Spinner/loading instability in terminal edge cases.
  - **Mitigation:** explicit Ink axis contracts + PTY checks.

- **Risk:** Config complexity over-expands Phase 2.
  - **Mitigation:** keep config scope minimal and locked to brainstorm decisions (see brainstorm: `docs/brainstorms/2026-03-05-rfaf-phase-2-summarize-rsvp-brainstorm.md`).

## Sources & References

### Origin

- **Brainstorm document:** `docs/brainstorms/2026-03-05-rfaf-phase-2-summarize-rsvp-brainstorm.md`
  - Carried-forward decisions:
    - summary is the RSVP reading source
    - explicit failure with no silent fallback
    - 3 summary presets (`short|medium|long`)
    - include config file in Phase 2
    - keep scope tightly focused

### Internal References

- CLI flow: `src/cli/index.tsx:105`
- Option validation pattern: `src/cli/text-scale-option.ts:11`
- Terminal lifecycle wrapper: `src/cli/session-lifecycle.ts:18`
- Sanitization boundary: `src/ui/sanitize-terminal-text.ts:5`
- Existing CLI contract test style: `tests/cli/text-scale-cli-contract.test.ts:3`
- Existing plan/test style reference: `docs/plans/2026-03-05-feat-rsvp-text-scale-readability-plan.md`

### Institutional Learnings

- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- `docs/solutions/ui-bugs/20260305-rsvp-words-not-vertically-centered-terminal-layout.md`

### External References

- `https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data`
- `https://ai-sdk.dev/docs/ai-sdk-core/provider-management`
- `https://ai-sdk.dev/docs/reference/ai-sdk-errors`
- `https://platform.openai.com/docs/deprecations`
- `https://docs.anthropic.com/en/docs/about-claude/model-deprecations`
- `https://cloud.google.com/vertex-ai/generative-ai/docs/deprecations`
