---
title: "feat: Add URL ingestion with Readability extraction"
type: feat
status: completed
date: 2026-03-07
origin: docs/brainstorms/2026-03-07-url-ingestion-brainstorm.md
---

# feat: Add URL ingestion with Readability extraction

## Overview

Add URL ingestion to rfaf so users can speed-read web articles directly: `rfaf https://example.com/article`. The feature fetches HTML from a URL, extracts article content using `@mozilla/readability` + `linkedom`, and feeds the clean text into the existing reading pipeline. This is Phase 4, subphase 15 — the first "More Sources" feature.

The implementation follows TDD-first: tests are written before production code at every step.

## Problem Statement / Motivation

Currently rfaf only accepts plaintext files and stdin. Users who want to speed-read web articles must manually copy text or save the page. Adding URL ingestion removes this friction — `rfaf https://...` just works. This is the most impactful "More Sources" feature because web articles are the primary use case for speed reading.

## Proposed Solution

Add a direct ingestor module (`src/ingest/url.ts`) following the exact pattern of `plaintext.ts` and `stdin.ts` (see brainstorm: `docs/brainstorms/2026-03-07-url-ingestion-brainstorm.md` — "Direct Ingestor Module" chosen over Generic Source Resolver and separate subcommand).

Architecture:
- **New:** `src/ingest/url.ts` — `readUrl(url, options?)` returning `Promise<Document>`
- **Modified:** `src/ingest/detect.ts` — add `"url"` kind to `InputSource` union
- **Modified:** `src/cli/index.tsx` — add URL branch with loading spinner
- **New:** `tests/ingest/url.test.ts` — comprehensive test suite
- **Modified:** `tests/ingest/detect.test.ts` — URL detection test cases
- **Dependencies:** `@mozilla/readability`, `linkedom`

## Technical Considerations

### Key API Details (from research)

**`@mozilla/readability` (v0.6.0):**
- `Readability(document).parse()` returns `null` on failure (empty body, scripts-only) or an article object
- Article object fields: `title`, `textContent` (plain text, tags stripped), `content` (HTML), `excerpt`, `byline`, `siteName`, `lang`, `publishedTime` — all nullable
- `isProbablyReaderable(document)` provides a quick pre-check (returns boolean)
- **Critical:** `parse()` mutates the document DOM. No clone needed since we don't reuse it
- Ships own TypeScript types — no `@types/` package needed

**`linkedom` (v0.18.12):**
- `parseHTML(htmlString)` returns a window-like object; destructure `{ document }`
- The `document` is a full `HTMLDocument` with standard DOM APIs
- Much lighter than JSDOM — no virtual browser/layout engine
- Ships own TypeScript types

**Integration pattern (3 lines of core logic):**
```typescript
const { document } = parseHTML(html);
const article = new Readability(document).parse();
const text = article?.textContent ?? null;
```

### Security Considerations

- **SSRF is not a concern** — this is a local CLI tool, the user has the same access as `curl`
- **Terminal injection via URL** — the existing `createLoadingIndicator` calls `sanitizeTerminalText()` on the message, so URLs embedded in spinner messages are safe
- **Article title sanitization** — pass extracted titles through `sanitizeTerminalText()` before using as `sourceLabel` to prevent control character injection from malicious HTML
- **URL in error messages** — display full URL as-is; the user provided it and knows what's in it

### Performance

- `linkedom` uses a triple-linked list internally — linear performance, no crashes
- No global state — safe for concurrent use (though rfaf is single-article)
- Raw HTML response size pre-check via `Content-Length` header when available to avoid buffering excessively large pages

### Institutional Learnings Applied

From `docs/solutions/`:
- **Ingestion boundary hardening** — enforce byte limits early, sanitize untrusted text before terminal rendering, wrap lifecycle in outer `try/finally` (from `terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`)
- **Deterministic parse behavior** — keep URL detection logic simple and argv-only, sanitize error output (from `cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`)
- **Contract tests** — add parity tests alongside feature implementation (from `20260305-chunked-mode-behavior-parity-hardening-fixes.md`)

## System-Wide Impact

- **Interaction graph**: `resolveInputSource()` → detects URL → `readUrl()` called in `main()` → returns `Document` → `buildReadingPipeline()` → tokenize → pacer → display. All downstream is source-agnostic.
- **Error propagation**: `readUrl()` throws `Error` with descriptive messages. Caught in `main()`'s existing try/catch which renders to stderr with secret redaction. Same error path as file/stdin.
- **State lifecycle risks**: None — no persistent state. Fetch is stateless, extraction is in-memory, result is a `Document` value type.
- **API surface parity**: `readUrl()` returns the same `Document` interface as `readPlaintextFile()` and `readStdin()`. The reading pipeline, agent API, and all modes work unchanged.
- **Integration test scenarios**: URL + `--summary` produces two sequential spinners. URL + `--mode scroll` passes extracted text through scroll mode pipeline. URL fetch failure produces stderr error + exit 1.

## Implementation Phases (TDD-First)

### Phase 1: Dependencies & Detection Tests

**1.1 Install dependencies**
```bash
bun add @mozilla/readability linkedom
```

**1.2 Write detection tests** (`tests/ingest/detect.test.ts` — additions)

| Test | Input | Expected |
|------|-------|----------|
| Detects https:// URL | `fileArg: "https://example.com/article"` | `{ kind: "url", url: "https://example.com/article" }` |
| Detects http:// URL | `fileArg: "http://example.com/article"` | `{ kind: "url", url: "http://example.com/article" }` |
| Case-insensitive protocol | `fileArg: "HTTPS://EXAMPLE.COM"` | `{ kind: "url", url: "HTTPS://EXAMPLE.COM" }` |
| URL + piped stdin warns | `fileArg: "https://x.com", stdinIsPiped: true` | `{ kind: "url", url: "...", warning: "...ignoring stdin" }` |
| ftp:// is NOT a URL | `fileArg: "ftp://example.com"` | `{ kind: "file", path: "ftp://example.com" }` |
| Bare domain is NOT a URL | `fileArg: "example.com/article"` | `{ kind: "file", path: "example.com/article" }` |
| Protocol-only string | `fileArg: "https://"` | `{ kind: "url", url: "https://" }` (validation deferred to readUrl) |

**1.3 Implement detection** (`src/ingest/detect.ts`)
- Add `| { kind: "url"; url: string; warning?: string }` to `InputSource` union
- In `resolveInputSource`, check `fileArg` for `http://` or `https://` prefix (case-insensitive) **before** the file path branch
- If URL + stdin piped, set `warning: "URL argument provided; ignoring piped stdin"`
- Run tests → green

### Phase 2: URL Ingestor Tests & Implementation

**2.1 Write `readUrl` unit tests** (`tests/ingest/url.test.ts`)

All tests use injectable `fetchFn` — no network calls.

| Test | Scenario | Expected |
|------|----------|----------|
| Happy path | Valid HTML with `<article>` content | Returns `Document` with extracted text, title as source, correct word count |
| Title extraction | HTML has `<title>My Article</title>` | `document.source === "My Article"` |
| Title fallback | HTML has no `<title>` | `document.source === url` |
| Extraction failure | HTML with only `<script>` tags (Readability returns null) | Throws `"Could not extract article content from <url>"` |
| Empty extraction | Readability returns article but `textContent` is whitespace | Throws extraction failure error |
| Size limit exceeded | Extracted textContent > 5MB | Throws `"Input exceeds maximum supported size"` |
| Size limit boundary | Extracted textContent exactly at 5MB | Succeeds |
| Fetch timeout | `fetchFn` rejects with abort error | Throws `"Timed out fetching <url> (10s limit)"` |
| HTTP 404 | `fetchFn` returns `Response` with status 404 | Throws `"HTTP 404 fetching <url>"` |
| HTTP 500 | `fetchFn` returns `Response` with status 500 | Throws `"HTTP 500 fetching <url>"` |
| HTTP 403 | `fetchFn` returns `Response` with status 403 | Throws `"HTTP 403 fetching <url>"` |
| Non-HTML content type | `Content-Type: application/json` | Throws `"Unsupported content type: application/json from <url>"` |
| Plain text content type | `Content-Type: text/plain` | Returns `Document` with raw text (bypass Readability) |
| Verify User-Agent | Check that `fetchFn` was called with browser UA header | UA string matches expected |
| Verify timeout signal | Check that `fetchFn` was called with AbortSignal | Signal present in init |
| HTML entities in title | `<title>&amp; &mdash; test</title>` | Title properly decoded |
| Script/style stripped | HTML with `<script>` and `<style>` tags in article | Extracted text doesn't contain script/style content |
| Minimal article | Single `<p>` paragraph | Succeeds with correct word count |
| Content-Length pre-check | Response with `Content-Length: 20000000` (20MB) | Throws `"Response too large from <url>"` |
| Custom maxBytes | `options.maxBytes = 100` with 200-byte article | Throws size limit error |
| `isProbablyReaderable` check | Page that is not an article (nav links only) | Throws extraction failure |

**2.2 Implement `readUrl`** (`src/ingest/url.ts`)

```typescript
// src/ingest/url.ts — function signature
interface ReadUrlOptions {
  maxBytes?: number;              // extracted text limit (default: 5MB)
  maxResponseBytes?: number;      // raw HTML limit (default: 10MB)
  timeoutMs?: number;             // fetch timeout (default: 10_000)
  userAgent?: string;             // browser UA string
  signal?: AbortSignal;           // for Ctrl+C cancellation
  fetchFn?: typeof fetch;         // injectable for testing
}

export async function readUrl(
  url: string,
  options?: ReadUrlOptions
): Promise<Document>
```

Implementation steps:
1. Create `AbortController` with timeout (`AbortSignal.timeout(timeoutMs)`) — combine with external `signal` if provided
2. Call `fetchFn(url, { headers: { "User-Agent": userAgent }, signal, redirect: "follow" })`
3. Check `response.ok` — if not, throw `"HTTP ${response.status} fetching ${url}"`
4. Check `Content-Type` header — reject non-HTML/non-text types
5. Check `Content-Length` header — reject if > `maxResponseBytes`
6. Read response text: `response.text()`
7. If `Content-Type` is `text/plain`, return `Document` with raw text (bypass Readability)
8. Parse HTML: `parseHTML(html)`
9. Check `isProbablyReaderable(document)` — if false, throw extraction failure
10. Extract: `new Readability(document).parse()`
11. If `null` or empty `textContent`, throw `"Could not extract article content from ${url}"`
12. `assertInputWithinLimit(byteLength, maxBytes)` on extracted text
13. Sanitize title via `sanitizeTerminalText()`
14. Return `{ content: textContent, source: title ?? url, wordCount: countWords(textContent) }`

Run tests → green

### Phase 3: CLI Wiring Tests & Implementation

**3.1 Update detection tests** — verify they still pass after Phase 2

**3.2 Write CLI integration consideration**

The CLI wiring in `src/cli/index.tsx` needs:
- Import `readUrl` from `../ingest/url`
- Add `else if (source.kind === "url")` branch between file and stdin
- Loading spinner: `createLoadingIndicator({ message: \`fetching article from ${source.url}\` })`
- Follow the summarize-flow spinner lifecycle: `start()` → `readUrl()` → `stop()` → `succeed("article loaded: ${document.source} (${document.wordCount} words)")`
- On failure: `stop()` → `fail("failed to fetch article")` → throw

**3.3 Fix `createLoadingIndicator` non-TTY prefix** (`src/cli/loading-indicator.ts`)

The non-TTY branch hardcodes `"Summarizing:"` as a prefix. Change to use the message as-is or a generic prefix. This is a pre-existing bug exposed by URL ingestion (see SpecFlow gap 6.1).

### Phase 4: Edge Case & Contract Tests

**4.1 Add contract tests for CLI behavior with URL input**

| Test | Scenario | Expected |
|------|----------|----------|
| URL fetch error → exit 1 | Mock fetch failure | stderr error message, process exit 1 |
| URL extraction error → exit 1 | Mock Readability failure | stderr error message, process exit 1 |
| URL + `--summary` | Mock both fetch and LLM | Two spinners, reading starts with summarized content |

**4.2 Sanitization tests**

| Test | Scenario | Expected |
|------|----------|----------|
| Title with ANSI sequences | `<title>\x1b[2J Evil</title>` | ANSI stripped from sourceLabel |
| Title with control chars | `<title>\x00\x07 Test</title>` | Control chars stripped |

## Acceptance Criteria

### Functional Requirements

- [x] `rfaf https://example.com/article` fetches and speed-reads the article
- [x] `rfaf http://localhost:3000/page` works with HTTP URLs
- [x] URL detection is protocol-prefix only (`http://`, `https://`) — case insensitive
- [x] Loading spinner shows `"fetching article from <url>..."` during fetch
- [x] Spinner shows success with article title and word count on completion
- [x] Article title from Readability is used as source label in status bar (fallback: URL)
- [x] Extraction failure produces clear error: `"Could not extract article content from <url>"` + exit 1
- [x] HTTP errors produce distinct messages: `"HTTP <status> fetching <url>"` + exit 1
- [x] Fetch timeout (10s) produces: `"Timed out fetching <url> (10s limit)"` + exit 1
- [x] Non-HTML content types rejected with: `"Unsupported content type: <type> from <url>"` + exit 1
- [x] `text/plain` responses bypass Readability and use raw text directly
- [x] Browser User-Agent header sent with all requests
- [x] HTTP redirects followed (standard fetch behavior)
- [x] Size limit (5MB) applied to extracted text, not raw HTML
- [x] Raw response size pre-checked via Content-Length header (10MB limit)
- [x] URL + piped stdin: fetches URL, warns about ignoring stdin (mirrors file+stdin behavior)
- [x] Works with `--summary`, `--mode`, and all existing flags
- [x] Ctrl+C during fetch aborts cleanly (AbortSignal)

### Testing Requirements (TDD-First)

- [x] All tests written BEFORE their corresponding implementation code
- [x] `tests/ingest/detect.test.ts` — 7+ URL detection cases
- [x] `tests/ingest/url.test.ts` — 20+ cases covering happy path, errors, edge cases
- [x] All tests use injectable `fetchFn` — zero network calls in test suite
- [x] Error messages tested with exact string matching (existing convention)
- [x] `bun test` passes
- [x] `bun x tsc --noEmit` passes (strict TypeScript)

### Non-Functional Requirements

- [x] Article title sanitized through `sanitizeTerminalText()` before display
- [x] `createLoadingIndicator` non-TTY prefix bug fixed (no more hardcoded "Summarizing:")
- [x] `isProbablyReaderable()` pre-check before full Readability extraction

## Success Metrics

- `rfaf https://...` works end-to-end for common article sites (Medium, blog posts, news articles)
- Test suite covers all error paths documented in acceptance criteria
- No network calls in test suite
- TypeScript strict mode passes with no type errors

## Dependencies & Risks

**Dependencies:**
- `@mozilla/readability` (v0.6.0) — article extraction, ships own types, zero npm dependencies
- `linkedom` (v0.18.12) — DOM implementation, ships own types

**Risks:**
- **Bot blocking**: Some sites return CAPTCHAs or 403s even with browser User-Agent. Mitigation: clear error message, user can try a different URL or save the page locally.
- **JS-rendered content**: Pages that require JavaScript (SPAs, paywalled content behind JS) won't extract properly. Mitigation: Readability fails cleanly → clear error message.
- **linkedom type casting**: `cloneNode` returns `Node`, but Readability expects `Document`. No clone needed in our case (we don't reuse the document), so this TypeScript rough edge is avoided entirely.

## Sources & References

- **Origin brainstorm:** [docs/brainstorms/2026-03-07-url-ingestion-brainstorm.md](docs/brainstorms/2026-03-07-url-ingestion-brainstorm.md) — Key decisions carried forward: protocol-prefix-only detection, error-and-exit on extraction failure, direct ingestor module pattern, injectable fetchFn for testing
- **Parent brainstorm:** [docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md](docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md) — Phase 4 subphase 15 definition
- Similar implementation: `src/ingest/plaintext.ts` (ingestor pattern), `src/ingest/stdin.ts` (injectable deps pattern)
- Loading pattern: `src/cli/loading-indicator.ts`, `src/cli/summarize-flow.ts`
- Learnings: `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- Readability docs: https://github.com/mozilla/readability
- linkedom docs: https://github.com/WebReflection/linkedom
