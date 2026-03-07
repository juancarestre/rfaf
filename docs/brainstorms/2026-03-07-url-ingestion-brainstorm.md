---
date: 2026-03-07
topic: url-ingestion
parent: 2026-03-04-rfaf-mvp-scope-brainstorm.md
phase: 4
subphase: 15
---

# URL Ingestion

## What We're Building

Adding URL ingestion to rfaf so users can speed-read web articles directly: `rfaf https://example.com/article`. The feature fetches HTML from a URL, extracts article content using `@mozilla/readability` + `linkedom`, and feeds the clean text into the existing reading pipeline. This is the first "More Sources" feature in Phase 4.

The UX is simple — a URL in the positional argument is auto-detected and treated like any other input source. The user sees a loading spinner while the article is fetched and extracted, then enters the reader with the article title shown in the status bar.

## Why This Approach

Three approaches were considered:

1. **Direct Ingestor Module** (chosen) — Add `src/ingest/url.ts` following the exact pattern of `plaintext.ts` and `stdin.ts`. Extend the `InputSource` union with a `"url"` kind. Wire into `main()` with one new branch.
2. **Generic Source Resolver** — Abstract `SourceReader` interface for all source types. Over-engineered for 3-4 source types; YAGNI.
3. **Separate subcommand** — `rfaf fetch <url>` breaks the simple `rfaf <input>` UX that users expect.

We chose (1) because the existing ingestion architecture is clean and well-suited for extension. The if/else branching on `source.kind` is perfectly clear at this scale.

## Key Decisions

- **URL detection: protocol prefix only** (`http://` or `https://`). No bare domain detection — avoids ambiguity with filenames.
- **Extraction failure = error and exit**: If Readability can't extract article content, show "Could not extract article content from <url>" and exit non-zero. No fallback to raw HTML text.
- **Loading feedback**: Show a spinner/message while fetching, similar to the existing summarization loading pattern. "Fetching article from <url>..."
- **Fetch timeout: 10 seconds**: Generous enough for most articles, fails fast on dead URLs.
- **Article title in status bar**: Use Readability's extracted title as the source label instead of the raw URL. Falls back to URL if no title extracted.
- **Follow redirects + browser User-Agent**: Follow HTTP redirects (standard fetch behavior) and set a browser-like User-Agent header to avoid bot blocking.
- **Size limit on extracted text**: Apply the existing 5MB `assertInputWithinLimit()` check to the clean extracted text, not the raw HTML. Raw HTML is often much larger than article content.
- **Dependencies**: `@mozilla/readability` for article extraction, `linkedom` for DOM implementation (no browser needed). Both are well-maintained and lightweight.
- **Testability**: Accept an injectable `fetchFn` parameter (like stdin's injectable `readText`) for testing without network calls.

## Open Questions

(None — all decisions resolved above.)

## Next Steps

-> `/ce:plan` for implementation details
