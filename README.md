![Read Fast as F*ck](docs/readfastasfckyeah.png)

# rfaf

Read Fast As F*ck is a Bun + Ink CLI/TUI app for high-focus, high-speed reading directly in your terminal.

> Use your entire cerebral power to Read Fast As F*ck.

## Purpose and objective

Use your entire cerebral power to Read Fast As F*ck.

The goal is simple: help you read and retain more in less time, without leaving your flow.

`rfaf` is built to:

- make long text easier to process with speed-reading modes,
- reduce context switching by running in the terminal,
- improve comprehension with optional AI transforms (summary, cleanup, translation, key phrases, quiz),
- keep behavior deterministic for both humans (`src/cli`) and agents (`src/agent`).

## Pain point this app solves

Most reading tools are either too slow, too visual-heavy, or disconnected from dev workflows.

Common pain points:

- reading long docs/articles in a browser breaks terminal flow,
- skimming manually misses structure and important phrases,
- speed-reading tools often lack support for real-world inputs (files, URLs, stdin, clipboard),
- AI helpers are usually bolted on and inconsistent.

`rfaf` addresses this by combining deterministic ingestion + terminal-native reading + optional AI preprocessing in one command.

## Installation

### 1) Prerequisites

- [Bun](https://bun.sh) installed
- macOS/Linux/Windows terminal (TTY recommended for interactive mode)

### 2) Install dependencies

```bash
bun install
```

### 3) (Optional) Configure AI features

AI flags like `--summary`, `--no-bs`, `--translate-to`, `--key-phrases`, `--quiz`, and `--strategy` require config.

```bash
mkdir -p ~/.rfaf
cp config.yaml.example ~/.rfaf/config.yaml
```

Then set provider credentials in your shell (example for OpenAI):

```bash
export OPENAI_API_KEY="your-key"
```

You can also use Anthropic (`ANTHROPIC_API_KEY`) or Google (`GOOGLE_GENERATIVE_AI_API_KEY`).

### Recommended models (important)

If you want `rfaf` to feel snappy and low-cost, start with fast inference models.

Recommended defaults by priority:

1. `gemini-3.1-flash-lite-preview` (Google) - best fast/cheap default for most `rfaf` AI transforms.
2. `gemini-2.0-flash` (Google) - great fallback if `3.1-flash-lite-preview` is unavailable.
3. `gpt-4o-mini` (OpenAI) - strong quality/cost balance.
4. `claude-3-5-haiku-latest` (Anthropic) - reliable fast option.

Suggested config for fast + cheap operation:

```yaml
llm:
  provider: google
  model: gemini-3.1-flash-lite-preview
  api_key_env: GOOGLE_GENERATIVE_AI_API_KEY

defaults:
  summary_preset: medium
  timeout_ms: 40000
  max_retries: 1
```

If a model name is not enabled in your account/region, use the closest flash/mini equivalent from the same provider.

## How to use

### Quick start

```bash
bun run src/cli/index.tsx --help
bun run src/cli/index.tsx ./notes.md
bun run src/cli/index.tsx https://example.com/article
cat ./article.txt | bun run src/cli/index.tsx
bun run src/cli/index.tsx --clipboard
```

### Accepted input types

`rfaf` accepts these input sources:

- HTTP/HTTPS article pages (`https://...`)
- Plain text files (`.txt` and other plaintext files)
- Markdown files (`.md`, `.markdown`)
- PDF files (`.pdf`)
- EPUB files (`.epub`)
- Piped stdin text (`cat article.txt | rfaf`)
- System clipboard text (`--clipboard`)

Input selection behavior:

- URL passed as positional argument -> fetches and extracts article content.
- File path passed as positional argument -> ingests by file type.
- No positional input + piped stdin -> reads stdin.
- `--clipboard` -> reads copied text from clipboard.

### Usage examples per input type

```bash
# 1) HTTP/HTTPS page
bun run src/cli/index.tsx "https://example.com/article"

# 2) Plain text file
bun run src/cli/index.tsx ./docs/article.txt

# 3) Markdown file
bun run src/cli/index.tsx ./docs/notes.md

# 4) PDF file
bun run src/cli/index.tsx ./docs/paper.pdf

# 5) EPUB file
bun run src/cli/index.tsx ./books/book.epub

# 6) Piped stdin
cat ./docs/article.txt | bun run src/cli/index.tsx

# 7) Clipboard input
bun run src/cli/index.tsx --clipboard
```

### Common usage patterns

```bash
# speed + mode
bun run src/cli/index.tsx ./article.txt --wpm=420 --mode=chunked

# summarize then read
bun run src/cli/index.tsx ./article.txt --summary=medium --mode=scroll

# clean noisy text
bun run src/cli/index.tsx ./article.txt --no-bs

# translate before reading
bun run src/cli/index.tsx ./article.txt --translate-to=es

# extract key phrases only
bun run src/cli/index.tsx ./article.txt --key-phrases=list

# strategy recommendation (advisory)
bun run src/cli/index.tsx ./article.txt --strategy

# standalone retention quiz
bun run src/cli/index.tsx ./article.txt --quiz

# session history
bun run src/cli/index.tsx history
```

### Reading modes

- `rsvp` (default)
- `chunked`
- `bionic`
- `scroll`

### What is RSVP and why it helps

RSVP means **Rapid Serial Visual Presentation**. Instead of moving your eyes across lines, the app shows one word (or small chunk) at a fixed point in the terminal.

Why this can improve reading speed:

- Less eye movement (reduced saccades) means less time spent physically scanning lines.
- Fixed focal point reduces re-acquisition time between words.
- Consistent pacing (WPM) helps maintain focus and rhythm.
- For many readers, this reduces regressions (unnecessary backtracking).

Practical note: RSVP is best for fast first-pass reading. For dense technical material, combine lower WPM with `chunked` or `scroll` mode when you need deeper comprehension.

### Runtime controls

- `Space` play/pause
- `Left/Right` step
- `Up/Down` adjust WPM
- `p` / `b` paragraph jump
- `1-4` switch mode
- `?` toggle help
- `Esc` close help
- `r` restart
- `q` quit

## Build the app

Build compiled binaries:

```bash
# all supported targets
bun run build:compile

# only current host target
bun run build:compile:current
```

Generate checksums + release manifest:

```bash
bun run release:checksums --dir dist/bin
```

Run a compiled artifact example:

```bash
./dist/bin/rfaf-v0.1.0-bun-darwin-arm64 --help
```

See `docs/usage/compiled-binary-usage.md` for full compiled-binary guidance.

## Development and quality checks

```bash
# full tests
bun test

# run one file
bun test tests/engine/session.test.ts

# run one test by name
bun test tests/engine/session.test.ts -t "starts with zeroed stats"

# typecheck (required static check)
bun x tsc --noEmit
```

Recommended pre-PR check:

```bash
bun test && bun x tsc --noEmit
```

## Project structure

- `src/cli/` user-facing command parsing and lifecycle
- `src/ui/` Ink terminal screens/components
- `src/engine/` reader and session state transitions
- `src/processor/` deterministic text transforms
- `src/ingest/` file/stdin/url/clipboard ingestion
- `src/llm/` provider calls, retry/timeout policy, schema checks
- `src/history/` completed session persistence
- `src/agent/` agent-native API with CLI parity
- `tests/` contract, integration, and unit tests

## Notes

- Interactive features depend on TTY behavior; CI/tests often set `RFAF_NO_ALT_SCREEN=1`.
- The project emphasizes deterministic errors and exit codes (contract-tested).
- Agent and CLI capabilities are kept in sync to preserve parity.
