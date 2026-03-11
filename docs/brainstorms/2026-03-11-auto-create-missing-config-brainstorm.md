---
date: 2026-03-11
topic: auto-create-missing-config
---

# Auto-Create Missing Config on First Run

## What We're Building
When a user runs a transform command (for example `--summary`) and `~/.rfaf/config.yaml` is missing, the CLI should offer to create the config automatically in interactive terminals.

If the user accepts, the CLI should copy from `config.yaml.example`, write `~/.rfaf/config.yaml` with secure `600` permissions, reload config, and continue the same command immediately.

In non-interactive mode, behavior remains fail-closed and deterministic: return the existing config error without auto-creation prompts.

## Why This Approach
We selected Approach A (interactive quick-create from template) because it removes first-run friction with minimal scope and aligns with existing repository conventions:

- Interactive prompts are already used for bounded runtime decisions.
- Non-interactive paths prioritize deterministic behavior.
- Existing `config.yaml.example` provides a clear source of truth for starter config.

This keeps the feature simple, predictable, and shippable without introducing wizard complexity or new command surface area.

## Key Decisions
- Offer auto-create only in interactive TTY sessions.
- Keep non-interactive sessions fail-closed with current config error contract.
- Use `config.yaml.example` as the template source.
- After creation, continue in the same command run (no required rerun).
- Enforce file permissions `600` for the created config.

## Resolved Questions
- **Scope:** this applies to missing-config startup path for transform commands.
- **Prompt behavior:** interactive only.
- **Template source:** copy from `config.yaml.example`.
- **Post-create flow:** continue immediately.
- **Permissions:** force secure mode `600`.

## Open Questions
- None at this stage.

## Next Steps
Proceed to planning (`/ce:plan`) to define acceptance criteria, test contracts, and implementation touchpoints for config loading and CLI startup error handling.
