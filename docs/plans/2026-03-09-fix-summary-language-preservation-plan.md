---
title: "fix: Preserve source language in --summary output"
type: fix
status: completed
date: 2026-03-09
---

# fix: Preserve source language in --summary output

## Overview

Fix a production bug where `--summary` sometimes returns English output even when the source text is in another language.

New hard requirement: summary output must preserve the original language. Translation is out of scope unless a future explicit `--translate-to` flag is provided.

This plan is TDD-first: each phase starts red, then green, then validation.

## Problem Statement / Motivation

- Current summarization prompt asks for meaning/chronology but does not explicitly forbid translation.
- Some providers/models opportunistically normalize to English, causing user-visible language drift.
- Language drift violates user intent and makes summaries less useful for non-English reading workflows.

## Proposed Solution

Harden the summarization contract in two layers:

1. Prompt-level guarantee
   - Update `buildSummaryPrompt()` in `src/llm/summarize.ts` to explicitly require output in the same language as input and to never translate.

2. Runtime output validation
   - Add a lightweight language-preservation guard after model output normalization.
   - If input appears non-English and output appears English-only (or otherwise different language/script), treat as deterministic schema/runtime failure and retry using existing retry loop.
   - If retries are exhausted, return a deterministic summarization error that explicitly states language preservation failed.

This dual approach reduces model non-compliance while preserving deterministic CLI/agent behavior.

## Technical Considerations

- Keep scope limited to summary behavior only; no new CLI flags in this fix.
- Preserve existing timeout/retry/error wiring in `summarizeTextWithGenerator()`.
- Use heuristic language/script checks (fast and dependency-light) to avoid introducing heavy i18n dependencies.
- Keep false-positive risk low by validating only high-confidence mismatch cases (especially non-English -> English drift).

## Implementation Plan (TDD-First)

### Phase 1 - Prompt Contract Hardening (Red -> Green)

1. Add failing unit tests in `tests/llm/summarize.test.ts`:
   - Prompt includes explicit instruction: preserve input language.
   - Prompt includes explicit instruction: do not translate unless explicitly requested.
2. Implement prompt update in `src/llm/summarize.ts`.
3. Validate phase:
   - `bun test tests/llm/summarize.test.ts`

### Phase 2 - Language Preservation Guard (Red -> Green)

1. Add failing tests in `tests/llm/summarize.test.ts` for:
   - non-English input + English translated output -> rejected and retried.
   - non-English input + same-language output -> accepted.
   - English input + English output -> accepted.
   - retry exhaustion on repeated language mismatch -> deterministic failure class/message.
2. Implement guard in `src/llm/summarize.ts`:
   - add helper(s) to infer script/language class from source and summary.
   - integrate guard after `normalizeSummaryText()` and before byte-limit validation return.
3. Validate phase:
   - `bun test tests/llm/summarize.test.ts`

### Phase 3 - CLI/Agent Contract Regression Coverage (Red -> Green)

1. Add or extend integration tests to prove surfaced failure is deterministic and non-flaky:
   - `tests/cli/summary-cli-contract.test.ts` (language-preservation failure message formatting)
   - `tests/agent/reader-api.test.ts` (agent parity for language-mismatch failure classification)
2. Ensure existing success-path summary tests continue to pass unchanged.
3. Validate phase:
   - `bun test tests/cli/summary-cli-contract.test.ts tests/agent/reader-api.test.ts`

### Phase 4 - Full Regression and Type Safety

1. Run full validation:
   - `bun test`
   - `bun x tsc --noEmit`
2. Confirm no regressions across other source types (stdin/url/pdf/epub/markdown) where summary is enabled.

## Acceptance Criteria

### Functional

- [x] `--summary` preserves source language for non-English inputs.
- [x] `--summary` does not translate content to English by default.
- [x] English source continues producing English summaries.
- [x] No new translation behavior is introduced without explicit future flag work.

### Deterministic Failure Contracts

- [x] When model output violates language-preservation requirement, behavior is deterministic (retry then stable failure).
- [x] Failure message is actionable and clearly indicates language-preservation violation.
- [x] CLI and agent surfaces stay parity-aligned.

### Non-Functional

- [x] No significant performance regression in summary path.
- [x] No changes to non-summary reading behavior.
- [x] Existing timeout/retry boundaries remain enforced.

## Risks & Mitigations

- Heuristic misclassification risk
  - Mitigation: only enforce on high-confidence mismatch cases; add targeted fixtures for Latin/CJK/Cyrillic/Arabic scripts.
- Provider variability risk
  - Mitigation: keep prompt strict and retain retry fallback.
- Error-noise risk
  - Mitigation: use concise deterministic error text and avoid leaking raw provider output.

## Out of Scope

- Implementing `--translate-to`.
- Automatic language selection UX changes.
- New provider integrations or large summarization architecture changes.

## Future Considerations

- Add explicit `--translate-to <lang>` flag with opt-in translation semantics.
- When that ships, language guard should permit translation only when the flag is set and target language differs from source.
