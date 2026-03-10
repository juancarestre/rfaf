# Using rfaf Compiled Binaries

rfaf can be distributed as compiled binaries built with `bun build --compile`.

## Supported Targets

- `bun-darwin-arm64`
- `bun-darwin-x64`
- `bun-linux-arm64`
- `bun-linux-x64-baseline`
- `bun-windows-x64-baseline`

## Build Artifacts Locally

```bash
bun run build:compile
```

For current host only:

```bash
bun run build:compile:current
```

Artifacts are written to `dist/bin/` by default.

## Verify Integrity

Generate checksums and release manifest:

```bash
bun run release:checksums --dir dist/bin
```

This writes:

- `dist/bin/SHA256SUMS`
- `dist/bin/release-manifest.json`

For published releases, verify artifact authenticity (signatures/attestations) in addition to checksum integrity.

## Run Binary

Examples:

```bash
./dist/bin/rfaf-v0.1.0-bun-darwin-arm64 --help
./dist/bin/rfaf-v0.1.0-bun-linux-x64-baseline history
```

Windows artifacts include `.exe`.

## Troubleshooting

- If interactive terminal behavior is odd, run in a real TTY (not redirected shell).
- If a binary fails on older x64 CPUs, use `*-baseline` targets.
- Validate behavior parity with source-run commands before release.
