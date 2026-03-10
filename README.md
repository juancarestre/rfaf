# rfaf

Read Fast As F*ck - a Bun + Ink CLI/TUI speed-reading tool.

## Development

Run from source:

```bash
bun run src/cli/index.tsx --help
```

Run tests:

```bash
bun test
bun x tsc --noEmit
```

## Distribution (Compiled Binaries)

Build full target matrix:

```bash
bun run build:compile
```

Build only current host target:

```bash
bun run build:compile:current
```

Generate checksums and release manifest:

```bash
bun run release:checksums --dir dist/bin
```

See `docs/usage/compiled-binary-usage.md` for detailed usage and verification.
