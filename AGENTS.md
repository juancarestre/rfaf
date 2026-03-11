# AGENTS.md

Guidance for coding agents working in this repository.
This project is `rfaf`, a Bun + Ink CLI/TUI speed-reading app with both user CLI and agent-facing APIs.

## Environment and stack

- Runtime: Bun (TypeScript, ESM, `type: module`).
- UI: Ink + React for terminal rendering.
- Testing: `bun:test`.
- Type safety: strict TypeScript (`tsconfig.json` has `strict: true`).
- Distribution: compiled Bun binaries via scripts in `scripts/build` and `scripts/release`.

## Source map

- `src/cli/*`: CLI entrypoint, arg parsing, user-facing flows, exit codes.
- `src/ui/*`: Ink screens/components and input handling.
- `src/engine/*`: reader/session state transitions.
- `src/processor/*`: pure text/token/reading-mode transforms.
- `src/ingest/*`: file/stdin/url/clipboard ingestion.
- `src/llm/*`: provider calls, retries, timeout policy, schema checks.
- `src/history/*`: completed session persistence.
- `src/agent/*`: agent-native API parity with CLI capabilities.
- `tests/*`: contract/unit/integration tests.

## Build, lint, and test commands

### Install

- `bun install`

### Run locally

- `bun run start`
- `bun run src/cli/index.tsx --help`
- `bun run src/cli/index.tsx <input-or-url>`

### Tests

- Full suite: `bun test`
- Watch mode: `bun run test:watch`
- Run one file: `bun test tests/engine/session.test.ts`
- Run one folder: `bun test tests/cli`
- Run one test name: `bun test tests/engine/session.test.ts -t "starts with zeroed stats"`
- Run by name regex across files: `bun test -t "CLI contract"`

### Lint/typecheck

- There is no ESLint/Prettier config in repo today.
- Use typecheck as the required static check: `bun x tsc --noEmit`
- Standard pre-PR validation: `bun test && bun x tsc --noEmit`

### Build and release artifacts

- Compile all targets: `bun run build:compile`
- Compile current host target only: `bun run build:compile:current`
- Generate checksums/manifest: `bun run release:checksums --dir dist/bin`

## Coding style and conventions

### Imports and modules

- Use ESM imports only.
- Use `node:` specifiers for Node built-ins (example: `node:fs`, `node:path`).
- Prefer explicit type-only imports with `import type { ... }`.
- Keep imports grouped logically: external deps, then internal modules.
- Use relative imports (`./`, `../`) consistent with existing files.

### Formatting

- Follow existing TS formatting style:
  - 2-space indentation.
  - double quotes.
  - semicolons.
  - trailing commas in multiline objects/arrays/params.
- Use numeric separators for readability (`60_000`, `10_000`).
- Keep functions focused and small when possible.
- Avoid adding comments unless the logic is non-obvious.

### Types and APIs

- Maintain strict typing; avoid `any`.
- Prefer narrow unions and literal types for mode/state/error variants.
- Validate untrusted values at boundaries (CLI args, env, config, external I/O).
- Use interfaces/types for command/result shapes (see `src/agent/*`).
- For exhaustive switches, use `never` unreachable checks.

### Naming

- File names: kebab-case (`reading-pipeline.ts`, `mode-option.ts`).
- Types/interfaces/classes: PascalCase.
- Variables/functions: camelCase.
- Constants: UPPER_SNAKE_CASE for shared/static constants.
- Boolean helpers should read clearly (`is*`, `has*`, `should*`, `was*`).
- Runtime option resolvers use `resolve*` naming; preserve this pattern.

### State and data flow

- Prefer immutable state updates (`{ ...state, field }`) over in-place mutation.
- Keep processor/engine functions deterministic and side-effect light.
- Keep CLI and agent behavior in sync when adding capabilities.
- Reuse shared transforms rather than duplicating behavior in UI/CLI/agent layers.

## Error handling guidelines

- Throw `UsageError` for invalid user input/config and deterministic contract failures.
- Use domain runtime errors with stage tags (`provider`, `schema`, `network`, `timeout`, `runtime`).
- In `catch`, use `unknown` then narrow (`error instanceof Error`).
- Normalize and sanitize user-visible error messages.
- Never leak API keys/secrets; redact before writing to stderr/stdout.
- Preserve deterministic error text and exit codes because tests assert on them.

## CLI/TTY behavior rules

- Respect TTY vs non-TTY contexts (`process.stdout.isTTY`, stdin checks).
- Ensure alternate-screen entry/exit and cursor visibility are restored reliably.
- Keep runtime controls/help text in sync with `src/runtime-controls.ts`.
- For interactive-only features (quiz, live controls), fail fast with clear UsageError messages.

## Testing conventions

- Use `bun:test` with `describe/it/expect` imports from `bun:test`.
- Name tests by behavior contract, not implementation details.
- CLI contract tests often use `Bun.spawnSync` and assert exit code + stdout/stderr.
- Disable alternate screen in CLI tests with `RFAF_NO_ALT_SCREEN=1` when relevant.
- For external systems (URL/clipboard/LLM), prefer mocks/stubs/injected functions.
- Add or update tests in the same domain folder as the changed behavior.

## Security and config expectations

- Treat config/env as untrusted input; validate shape and allowed keys.
- Keep safe defaults and explicit bounds for timeout/retry/input sizes.
- Do not add telemetry or secret logging.
- If touching release artifacts, preserve checksum/manifest safety checks.

## Agent workflow expectations

- Keep changes minimal and scoped; do not perform unrelated refactors.
- If editing CLI behavior, check agent API parity (`src/agent/reader-api.ts`).
- Prefer deterministic logic over clever abstractions.
- Preserve current command names and public option semantics unless explicitly changing them.

## Cursor/Copilot rules status

- No Cursor rules found at `.cursor/rules/`.
- No `.cursorrules` file found.
- No Copilot instructions found at `.github/copilot-instructions.md`.
- This `AGENTS.md` is currently the primary agent-instruction source in-repo.

## Useful validation checklist before finishing

- Run targeted tests for touched area (`bun test <path>`).
- Run full tests if change is cross-cutting (`bun test`).
- Run typecheck (`bun x tsc --noEmit`).
- If build/release code changed, run compile/checksum commands as needed.
