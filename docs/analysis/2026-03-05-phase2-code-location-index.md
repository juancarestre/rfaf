---
title: "Phase 2 Summarize Implementation - Code Location Index"
date: 2026-03-05
type: reference
---

# Phase 2 Summarize Implementation - Code Location Index

Quick reference mapping plan requirements to implementation code locations.

## CLI Integration

### Flag Parsing & Normalization

| Requirement | File | Lines | Details |
|---|---|---|---|
| `--summary` flag definition | `src/cli/index.tsx` | 185-188 | Option definition with preset description |
| Arg normalization (preset/file disambiguation) | `src/cli/index.tsx` | 104-145 | `normalizeSummaryArgs()` handles `--summary` with/without value |
| Default to `medium` when no value | `src/cli/summary-option.ts` | - | `resolveSummaryOption()` logic |
| Preset validation (short\|medium\|long) | `src/cli/summary-option.ts` | - | Enum-based validation |

### Error Handling & Exit Codes

| Requirement | File | Lines | Details |
|---|---|---|---|
| Usage error exit code 2 | `src/cli/index.tsx` | 279-281 | `if (error instanceof UsageError) process.exit(2)` |
| Runtime error exit code 1 | `src/cli/index.tsx` | 283-291 | Default exit path for `SummarizeRuntimeError` |
| Secret redaction | `src/cli/index.tsx` | 267-277 | `redactSecrets()` function with pattern matching |
| Actionable error messages | `src/cli/errors.ts` | - | `SummarizeRuntimeError` with stage tracking |

### Summarize Flow Integration

| Requirement | File | Lines | Details |
|---|---|---|---|
| Summarize before tokenization | `src/cli/index.tsx` | 242-251 | `summarizeBeforeRsvp()` called before `tokenize()` |
| Summary becomes reading source | `src/cli/index.tsx` | 252-253 | `readingContent` from summarize result fed to `tokenize()` |
| No summarize = original behavior | `src/cli/summarize-flow.ts` | 26-30 | Early return if `!summaryOption.enabled` |
| Source label updated | `src/cli/index.tsx` | 254 | `sourceLabel` includes summary preset |

---

## Configuration

### Config File Parsing

| Requirement | File | Lines | Details |
|---|---|---|---|
| TOML parsing | `src/config/llm-config.ts` | 130-147 | `loadLLMConfig()` with try/catch |
| Config path resolution | `src/config/llm-config.ts` | 123-128 | `defaultConfigPath()` returns `~/.rfaf/config.toml` |
| Config file existence check | `src/config/llm-config.ts` | 125-129 | `existsSync()` with clear error message |

### Provider Resolution

| Requirement | File | Lines | Details |
|---|---|---|---|
| Provider enum (openai\|anthropic\|google) | `src/config/llm-config.ts` | 11-12 | `PROVIDERS` const and `LLMProvider` type |
| Provider validation | `src/config/llm-config.ts` | 37-39 | `isProvider()` type guard |
| Default API key env var | `src/config/llm-config.ts` | 41-45 | `resolveDefaultApiKeyEnv()` maps provider to env var |

### API Key Resolution

| Requirement | File | Lines | Details |
|---|---|---|---|
| Precedence: CLI > env > config > defaults | `src/config/llm-config.ts` | 82-100 | Env var checked first, then config, then error |
| Custom API key env var support | `src/config/llm-config.ts` | 94-95 | `api_key_env` field in config |
| API key validation | `src/config/llm-config.ts` | 96-100 | Non-empty check with clear error |

### Timeout & Retry Configuration

| Requirement | File | Lines | Details |
|---|---|---|---|
| Default timeout (20s) | `src/config/llm-config.ts` | 8 | `DEFAULT_SUMMARIZE_TIMEOUT_MS = 20_000` |
| Default max retries (1) | `src/config/llm-config.ts` | 9 | `DEFAULT_SUMMARIZE_MAX_RETRIES = 1` |
| Timeout bounds validation | `src/config/llm-config.ts` | 64-74 | `resolvePositiveInt()` validates non-negative |
| Retry bounds validation | `src/config/llm-config.ts` | 64-74 | `resolvePositiveInt()` validates non-negative |

### Summary Preset Configuration

| Requirement | File | Lines | Details |
|---|---|---|---|
| Default preset (medium) | `src/cli/summary-option.ts` | - | `DEFAULT_SUMMARY_PRESET = "medium"` |
| Preset validation | `src/config/llm-config.ts` | 47-62 | `resolveSummaryPreset()` validates short\|medium\|long |
| Config default preset | `src/config/llm-config.ts` | 107-109 | `summary.default_preset` field in config |

---

## Summarization Pipeline

### Provider Model Creation

| Requirement | File | Lines | Details |
|---|---|---|---|
| OpenAI provider | `src/llm/summarize.ts` | 58-62 | `createOpenAI()` factory |
| Anthropic provider | `src/llm/summarize.ts` | 64-66 | `createAnthropic()` factory |
| Google provider | `src/llm/summarize.ts` | 69-70 | `createGoogleGenerativeAI()` factory |

### Timeout & Abort Handling

| Requirement | File | Lines | Details |
|---|---|---|---|
| Explicit timeout budget | `src/llm/summarize.ts` | 73-100 | `mergedAbortSignal()` creates timeout controller |
| Parent signal merging | `src/llm/summarize.ts` | 79-89 | Handles both timeout and parent abort |
| Cleanup on abort | `src/llm/summarize.ts` | 91-99 | Removes listeners and clears timeout |

### Error Classification

| Requirement | File | Lines | Details |
|---|---|---|---|
| Transient error detection | `src/llm/summarize.ts` | 102-113 | `isTransientRuntimeError()` checks 429/timeout/network/5xx |
| Error stage classification | `src/llm/summarize.ts` | 115-145 | `classifyRuntimeError()` maps to provider/schema/network/timeout/runtime |
| Abort/SIGINT handling | `src/llm/summarize.ts` | 117-122 | Detects abort/sigint/cancel messages |
| Timeout detection | `src/llm/summarize.ts` | 124-128 | Detects timeout/timed out messages |
| Schema error detection | `src/llm/summarize.ts` | 130-135 | Detects schema/object/json messages |

### Structured Output Validation

| Requirement | File | Lines | Details |
|---|---|---|---|
| Zod schema definition | `src/llm/summarize.ts` | 13-15 | `SummaryResponseSchema` with trim/min/max |
| Empty summary rejection | `src/llm/summarize.ts` | 14 | `.min(1)` enforces non-empty |
| Upper bound enforcement | `src/llm/summarize.ts` | 14 | `.max(50_000)` enforces size limit |
| Schema validation in generateObject | `src/llm/summarize.ts` | 150-180 | Vercel AI SDK `generateObject()` with schema |

### Prompt Engineering

| Requirement | File | Lines | Details |
|---|---|---|---|
| Prompt builder | `src/llm/summarize.ts` | 35-51 | `buildSummaryPrompt()` constructs preset-specific prompt |
| Short preset guidance | `src/llm/summarize.ts` | 37-38 | "Target approximately 4-8 concise sentences" |
| Medium preset guidance | `src/llm/summarize.ts` | 39-40 | "Target approximately 8-14 concise sentences" |
| Long preset guidance | `src/llm/summarize.ts` | 41 | "Target approximately 14-22 concise sentences" |
| Summary text normalization | `src/llm/summarize.ts` | 54-56 | `normalizeSummaryText()` trims whitespace |

### Input Size Limits

| Requirement | File | Lines | Details |
|---|---|---|---|
| Max summary bytes constant | `src/llm/summarize.ts` | 11 | `MAX_SUMMARY_BYTES = 512 * 1024` |
| Input validation | `src/llm/summarize.ts` | 1-9 | Import `assertInputWithinLimit` from ingest |

---

## Summarize Flow Orchestration

### Flow Entry Point

| Requirement | File | Lines | Details |
|---|---|---|---|
| Flow function signature | `src/cli/summarize-flow.ts` | 23-25 | `summarizeBeforeRsvp()` async function |
| Dependency injection | `src/cli/summarize-flow.ts` | 8-16 | `SummarizeFlowInput` interface for testability |
| Early return for disabled | `src/cli/summarize-flow.ts` | 26-30 | Returns original content if not enabled |

### Config Loading

| Requirement | File | Lines | Details |
|---|---|---|---|
| Config resolution | `src/cli/summarize-flow.ts` | 34-36 | `loadLLMConfig()` called with env |
| Preset resolution | `src/cli/summarize-flow.ts` | 37 | Uses option preset or config default |

### Loading Indicator Lifecycle

| Requirement | File | Lines | Details |
|---|---|---|---|
| Loading indicator creation | `src/cli/summarize-flow.ts` | 39-44 | Factory pattern with message |
| Loading message | `src/cli/summarize-flow.ts` | 46-48 | Shows provider/model context |
| Loading start | `src/cli/summarize-flow.ts` | 56 | `loading.start()` before request |
| Loading stop on success | `src/cli/summarize-flow.ts` | 70-71 | `loading.stop()` + `loading.succeed()` |
| Loading stop on failure | `src/cli/summarize-flow.ts` | 78-79 | `loading.stop()` + `loading.fail()` |

### SIGINT Handling

| Requirement | File | Lines | Details |
|---|---|---|---|
| SIGINT listener setup | `src/cli/summarize-flow.ts` | 50-55 | `process.once("SIGINT")` + `abortController.abort()` |
| SIGINT cleanup | `src/cli/summarize-flow.ts` | 96 | `process.removeListener("SIGINT")` in finally |
| Abort signal propagation | `src/cli/summarize-flow.ts` | 67 | Signal passed to `summarizeText()` |

### Error Handling & Sanitization

| Requirement | File | Lines | Details |
|---|---|---|---|
| Error catch block | `src/cli/summarize-flow.ts` | 77-94 | Handles `SummarizeRuntimeError` and generic errors |
| Provider sanitization | `src/cli/summarize-flow.ts` | 82-83 | `sanitizeTerminalText()` on provider/model |
| Error re-throw with context | `src/cli/summarize-flow.ts` | 84-87 | Adds provider/model context to error |
| Generic error mapping | `src/cli/summarize-flow.ts` | 90-94 | Maps unknown errors to `SummarizeRuntimeError` |

### Success Path

| Requirement | File | Lines | Details |
|---|---|---|---|
| Summary return | `src/cli/summarize-flow.ts` | 73-76 | Returns summary as `readingContent` |
| Source label update | `src/cli/summarize-flow.ts` | 75 | Appends `(summary:preset)` to source label |

---

## Error Classes

### Error Taxonomy

| Error Class | File | Lines | Details |
|---|---|---|---|
| `UsageError` | `src/cli/errors.ts` | 1-5 | For CLI usage/config validation errors |
| `SummarizeRuntimeError` | `src/cli/errors.ts` | 7-19 | For runtime summarize failures with stage tracking |
| Error stage enum | `src/cli/errors.ts` | 8 | `"provider" | "schema" | "network" | "timeout" | "runtime"` |

---

## Loading Indicator

### Implementation

| Requirement | File | Lines | Details |
|---|---|---|---|
| Loading indicator factory | `src/cli/loading-indicator.ts` | - | `createLoadingIndicator()` function |
| Loading interface | `src/cli/loading-indicator.ts` | - | `LoadingIndicator` with start/stop/succeed/fail methods |
| Centered layout | `src/cli/loading-indicator.ts` | - | Uses explicit flex-axis contracts |

---

## Tests

### CLI Option Tests

| Test File | Lines | Coverage |
|---|---|---|
| `tests/cli/summary-args.test.ts` | 51 | Preset parsing, defaults, invalid values, duplicate args |

### CLI Contract Tests

| Test File | Lines | Coverage |
|---|---|---|
| `tests/cli/summary-cli-contract.test.ts` | 82 | Exit codes, error messages, no-fallback semantics, TTY/non-TTY |

### Config Tests

| Test File | Lines | Coverage |
|---|---|---|
| `tests/config/llm-config.test.ts` | 102 | Provider enum, model presence, key resolution, bounds, defaults |

### Summarize Tests

| Test File | Lines | Coverage |
|---|---|---|
| `tests/llm/summarize.test.ts` | 98 | Schema parse, malformed response, empty summary, timeout, retry, transient errors |

### Loading UI Tests

| Test File | Lines | Coverage |
|---|---|---|
| `tests/ui/summarize-loading.test.tsx` | 52 | Loading visibility lifecycle, centered layout contract |

### Flow Integration Tests

| Test File | Lines | Coverage |
|---|---|---|
| `tests/cli/summarize-to-rsvp-flow.test.ts` | 134 | Summarize→RSVP ordering, no-RSVP-on-failure, SIGINT cancellation, config loading |

---

## Configuration Example

### File Location

| Item | Location |
|---|---|
| Config example | `config.toml.example` |
| Config path | `~/.rfaf/config.toml` |

### Example Content

```toml
[llm]
provider = "openai"
model = "gpt-4o-mini"
api_key_env = "OPENAI_API_KEY"

[summary]
default_preset = "medium"
timeout_ms = 20000
max_retries = 1
```

---

## Validation & Acceptance

### PTY Validation

| Item | File | Lines |
|---|---|---|
| Phase 2 smoke checks | `docs/validation/2026-03-05-acceptance-pty.md` | 49-64 |
| Config error test | `docs/validation/2026-03-05-acceptance-pty.md` | 54 |
| Runtime failure test | `docs/validation/2026-03-05-acceptance-pty.md` | 55 |
| Non-TTY output test | `docs/validation/2026-03-05-acceptance-pty.md` | 56-58 |
| Timeout failure command | `docs/validation/2026-03-05-acceptance-pty.md` | 60-64 |

---

## Key Patterns & Utilities

### Sanitization

| Utility | File | Usage |
|---|---|---|
| `sanitizeTerminalText()` | `src/ui/sanitize-terminal-text.ts` | Sanitize provider/model in errors |
| `redactSecrets()` | `src/cli/index.tsx` | Redact API keys in error messages |

### Input Validation

| Utility | File | Usage |
|---|---|---|
| `assertInputWithinLimit()` | `src/ingest/constants.ts` | Validate summary size |

### Lifecycle

| Utility | File | Usage |
|---|---|---|
| `runSessionLifecycle()` | `src/cli/session-lifecycle.ts` | Wraps entire CLI session with cleanup |

---

## Summary

This index provides quick navigation to all plan requirements and their implementation locations. Use the file paths and line numbers to jump directly to relevant code during review or debugging.

**Total Implementation**: ~1,700 lines of code + 334 lines of tests across 19 files.
