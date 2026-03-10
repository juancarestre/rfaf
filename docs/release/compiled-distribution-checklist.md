# Compiled Distribution Checklist

Use this checklist before publishing rfaf compiled binaries.

## Build

- [ ] Run `bun run build:compile` for full target matrix.
- [ ] Confirm `dist/bin/compile-manifest.json` is generated.
- [ ] Confirm all expected artifacts are present for supported targets.

## Integrity

- [ ] Run `bun run release:checksums --dir dist/bin`.
- [ ] Confirm `dist/bin/SHA256SUMS` exists and includes every artifact.
- [ ] Confirm `dist/bin/release-manifest.json` artifact count matches actual files.
- [ ] Verify artifact authenticity via signing/provenance before publish (for example, Sigstore/Cosign or GitHub attestations).
- [ ] Confirm checksum verification instructions include both integrity and authenticity steps.

## Runtime Validation

- [ ] Run compiled help contract: `tests/cli/compiled-help-contract.test.ts`.
- [ ] Run compiled non-TTY contract: `tests/cli/compiled-non-tty-contract.test.ts`.
- [ ] Run compiled error contract: `tests/cli/compiled-error-exit-contract.test.ts`.
- [ ] Run compiled PTY lifecycle contracts:
  - `tests/cli/compiled-runtime-lifecycle-pty.test.ts`
  - `tests/cli/compiled-signal-cleanup-pty.test.ts`

## Quality Gate

- [ ] Run `bun test`.
- [ ] Run `bun x tsc --noEmit`.

## Release Notes

- [ ] Document supported targets in release notes.
- [ ] Include checksum verification instructions.
- [ ] Link to `docs/usage/compiled-binary-usage.md`.
