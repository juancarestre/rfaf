---
date: 2026-03-04
topic: rfaf-mvp-scope
---

# rfaf MVP Scope & Phase Structure

## What We're Building

A CLI/TUI speed-reading tool (rfaf — "Read Fast As F*ck") with an MVP focused on a **tight, excellent RSVP reading experience**. The MVP accepts plaintext files and stdin, presents content one word at a time with ORP (Optimal Recognition Point) highlighting, and provides precise speed/navigation controls. No LLM features, no config file, no additional reading modes in MVP.

The goal is a tool that's **shareable on GitHub** — other devs can clone, build, and use it immediately.

## Why This Approach

Three approaches were considered:

1. **Tight RSVP Core** (chosen) — Minimal surface area, forces the reading engine to be excellent, shippable in days.
2. **RSVP + Summarize** — Shows both reading engine and LLM story, but complicates setup.
3. **Feature-Complete Phase 1+2** — Broader scope, risks shipping mediocre versions of many features.

We chose (1) because the reading engine IS the product. If RSVP doesn't feel great, no amount of LLM features will save it. LLM is a core differentiator but belongs in Phase 2 after the engine is proven.

## Key Decisions

- **Plaintext + stdin only for MVP**: No PDF parsing. Removes pdf-parse dependency and complex extraction logic. PDFs move to Phase 3 (more sources).
- **Deep RSVP only**: One mode, done well. ORP calculation, smart punctuation pauses, speed ramping. Other modes (chunked, bionic, scroll) come later.
- **Keep yargs**: Battle-tested CLI parser. Worth the weight for help generation and future subcommands (config, history).
- **TUI framework: validate Ink**: Ink is the default choice but user is open to alternatives. The plan phase should include a spike to validate Ink 5 + fullscreen-ink handles flicker-free single-word updates. Alternatives if Ink falls short: terminal-kit, raw ANSI escapes.
- **Stdin in MVP**: Trivial to implement, expected by CLI users. `cat article.txt | rfaf` works from day one.
- **LLM is a core differentiator**: But deferred to Phase 2 (`--summarize` first). LLM features are what make rfaf different from existing speed readers.
- **Revised phase order**: Reordered to bring LLM (summarize) into Phase 2 and push additional modes to Phase 3.

## Revised Phase Plan

### Phase 1: Core MVP (RSVP Engine)
1. CLI entry point with Bun + yargs
2. Ingest: plaintext files + stdin
3. Tokenizer + pacer (word-level)
4. RSVP mode with Ink fullscreen (or validated alternative)
   - ORP (Optimal Recognition Point) highlighting
   - Punctuation-aware pausing (period, comma, paragraph breaks)
5. Controls: pause/resume, speed +/-, forward/back word, forward/back paragraph, quit
6. Progress bar + status bar (WPM, time remaining, %)
7. Basic speed ramping (start slower, accelerate)

### Phase 2: LLM + Summarize
8. Minimal `~/.rfaf/config.toml` ([llm] section only; migrated to YAML in Phase 6)
9. AI SDK provider abstraction (env vars for API keys)
10. `--summarize` with compression levels (shown before reading starts)

### Phase 3: More Modes
11. Chunked reading mode (3-5 word groups)
12. Bionic reading mode
13. Guided scroll mode
14. Runtime mode switching (1-4 keys)

### Phase 4: More Sources
15. URL ingestion (@mozilla/readability + linkedom)
16. PDF ingestion (pdf-parse)
17. EPUB support (epub2)
18. Markdown support (marked)
19. Clipboard support

### Phase 5: LLM Features + Polish
20. `--no-bs` (remove bullshit from the text, only keep the good stuff and the most relevant information, remove or replace not readable characters like emojis, etc.)
21. `--translate-to`
22. `--key-phrases` (intelligent emphasis)
23. `--quiz` (post-reading comprehension)
24. `--strategy` (LLM suggests best mode)
25. Full config file (display, reading, defaults sections)
26. Session history + stats
27. `bun build --compile` for distribution

### Phase 6: Behavior Corrections + Final Polish
28. Make `--summarize` output length proportional to source length (short text should stay short, long text should not collapse to a fixed ~1-minute read)
29. Ensure `--no-bs` only removes fluff/noise and keeps core content without implicitly summarizing
      🐍 > $ bun run src/cli/index.tsx tests/fixtures/AldousHuxley-Laspuertasdelapercepción.pdf --no-bs
   [error] no-bs failed
   No-BS failed [schema]: content preservation check failed; cleaned text appears summarized or truncated. (provider=google, model=gemini-3.1-flash-lite-preview)
30. Fix chunked-mode ORP highlighting so the painted character is never whitespace (fallback to nearest visible character)
31. Migrate config from TOML to YAML (`~/.rfaf/config.yaml`) and update all dependencies (config loader, defaults, tests, fixtures, docs, sample configs)

## Open Questions

(None remaining — all resolved below.)

## Resolved Questions

- **Ink validation**: Build a quick spike (~30 min) before committing. Render a single word updating at 500+ WPM in fullscreen Ink. If it flickers or feels wrong, pivot to terminal-kit or raw ANSI. Include this spike as the first task in the plan.
- **ORP algorithm**: Research existing implementations (Spritz, ReadFast.ai, etc.) rather than shipping a naive 1/3 rule. ORP likely uses word-length dependent lookup tables. Include a research task in the plan.
- **Speed ramping in MVP**: Use word-length aware pausing instead of linear ramp or fixed WPM. Base WPM is fixed at the user's setting, but longer words get proportionally more display time. This feels natural without needing a full ramping system. No `--ramp` flag in MVP.

## Next Steps

-> `/workflows:plan` for Phase 1 implementation details
