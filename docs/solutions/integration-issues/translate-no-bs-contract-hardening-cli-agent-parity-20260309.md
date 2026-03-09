---
module: CLI + Agent Integration
date: 2026-03-09
problem_type: integration_issue
component: tooling
symptoms:
  - "`--translate-to` could return summary-like/truncated output for long inputs without `--summary`."
  - "`--no-bs` could drift into cross-language output instead of preserving source language."
  - "`--no-bs` could over-compress long content into summary-like output instead of cleaning noise only."
  - "Large translation inputs behaved differently in CLI vs agent paths (chunked vs monolithic calls)."
  - "Space-separated `--translate-to` parsing had edge-case contract drift vs equals form."
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [translate-to, no-bs, cli-agent-parity, fail-closed, language-preservation, chunking]
---

# Troubleshooting: Translate/No-BS Contract Hardening with CLI-Agent Parity

## Problem

The transform contracts around `--translate-to` and `--no-bs` were not strict enough. Translation could degrade into summary-like output for long documents, and no-bs could change language or compress content beyond "cleaning" semantics.

## Environment

- Module: CLI + Agent Integration
- Affected Component: CLI option parsing, LLM transform runtime, agent reader API parity
- Date: 2026-03-09
- Key commit: `a159066`

## Symptoms

- Running `bun run src/cli/index.tsx <url> --translate-to es` sometimes produced output that looked shorter/summary-like instead of a full translation.
- Running no-bs transformations could accept translated output in some Latin-script scenarios.
- Long content behaved differently between CLI and agent translation paths due to different request shaping.
- Parsing around `--translate-to` had edge cases where equivalent user intent forms could diverge.

## What Didn't Work

**Attempted behavior (pre-hardening): one-shot translate call for long content**
- **Why it failed:** oversized single requests increased truncation/summarization-like drift risk and reduced determinism.

**Attempted behavior (pre-hardening): weak language/content guardrails in no-bs and translate**
- **Why it failed:** outputs that violated language-preservation or full-content intent could pass.

**Attempted behavior (pre-hardening): parser heuristic that was too restrictive/fragile**
- **Why it failed:** space-separated target parsing had edge-case drift from equals-form behavior for some valid tags.

## Solution

Implemented deterministic, fail-closed contracts for translate and no-bs, and aligned CLI and agent execution paths.

**Code changes:**

```ts
// src/cli/reading-pipeline.ts
// Enforced ordering: no-bs -> summary -> translate -> tokenize
const summaryResult = input.summaryOption.enabled ? await summarize(...) : passthrough;
const translateResult = input.translateOption?.enabled ? await translate(...) : passthrough;
const tokenized = tokenizeFn(translateResult.readingContent);
```

```ts
// src/llm/translate.ts
// Fail closed on wrong target language or summarized/truncated outputs
if (violatesTargetLanguageExpectation(input.input, normalized, input.targetLanguage)) {
  throw new TranslateRuntimeError(
    "Translation failed [schema]: target language check failed; translated text does not match requested target.",
    "schema"
  );
}

if (violatesContentPreservation(input.input, normalized)) {
  throw new TranslateRuntimeError(
    "Translation failed [schema]: content preservation check failed; translation appears summarized or truncated.",
    "schema"
  );
}
```

```ts
// src/llm/translate-chunking.ts
// Shared chunk planner/executor reused by CLI and agent translate paths
export async function translateContentInChunks(input: {
  content: string;
  translateChunk: (chunk: string) => Promise<string>;
}): Promise<string> {
  // split into bounded chunks, run bounded workers, preserve order
}
```

Additional hardening:
- Added `src/cli/translate-option.ts`, `src/cli/translate-flow.ts`, `src/llm/language-normalizer.ts`, `src/llm/translate.ts`.
- Added content/language-preservation checks to `src/llm/no-bs.ts` to prevent translation/summarization drift.
- Added signal forwarding and error-envelope parity improvements in `src/agent/reader-api.ts`.
- Updated parser normalization in `src/cli/index.tsx` to keep target parsing deterministic and safe.

## Why This Works

The fix removes silent degradation paths and makes each stage's responsibility explicit:
1. **No-BS** only cleans noise and now fails if language/content contracts are violated.
2. **Summary** runs only when requested.
3. **Translate** runs after summary (if any), enforces target-language/content checks, and chunks large inputs.
4. **Agent parity** now shares chunking behavior and forwards cancellation/error contracts similarly to CLI.

This converts previously permissive behavior into deterministic, fail-closed behavior that matches user intent.

## Prevention

- Keep transform order contract locked in tests (`no-bs -> summary -> translate -> tokenize`).
- Keep fail-closed checks for language/content preservation in both no-bs and translate.
- Keep CLI/agent parity by reusing shared chunking/normalization helpers.
- Treat `--translate-to` option parsing and normalization as contract code; update contract tests with any parser changes.
- Require focused regression runs whenever touching these files:
  - `src/cli/index.tsx`
  - `src/cli/reading-pipeline.ts`
  - `src/cli/translate-flow.ts`
  - `src/llm/no-bs.ts`
  - `src/llm/translate.ts`
  - `src/llm/language-normalizer.ts`
  - `src/agent/reader-api.ts`

## Validation Evidence

- `bun test` passed after hardening changes.
- `bun x tsc --noEmit` passed.
- Added/updated targeted suites for CLI contract, flow ordering, LLM guardrails, and agent parity.

## Related Issues

- See also: `summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`
- Similar to: `url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- Similar to: `markdown-ingestion-deterministic-contracts-timeout-size-guardrails-cli-agent-parity.md`
