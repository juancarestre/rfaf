---
date: 2026-03-10
topic: rfaf-phase-5-subphase-25-yaml-full-config
---

# rfaf Phase 5 Subphase 25: YAML Full Config + Inline Provider Keys

## What We're Building

For Phase 5.25, rfaf will move to a **full YAML config model** (`~/.rfaf/config.yaml`) and stop runtime support for TOML.

This subphase includes both:
- migration from TOML pathing/contracts to YAML contracts
- broader full config scope (not only LLM): `display`, `reading`, and `defaults` sections in addition to LLM-related settings

User intent for this subphase is explicit:
- hard switch to YAML
- keep environment variables higher priority than YAML values on conflicts
- allow storing provider API keys directly in YAML
- warn on permissive file permissions (do not hard-block)

## Why This Approach

Three approaches were considered:

1. **Strict YAML cutover + guided migration** (recommended baseline)  
   Lower ambiguity, smaller scope, deterministic behavior.
2. **Transitional compatibility window**  
   Lower short-term disruption, but temporary complexity.
3. **Big-bang full config redesign** (**chosen**)  
   Delivers migration plus full config architecture in one subphase.

Approach (3) was chosen to avoid split-phase config churn and deliver the complete configuration model in one milestone, despite higher integration risk.

## Key Decisions

- **Canonical config file:** `~/.rfaf/config.yaml` for runtime configuration.
- **TOML runtime support:** removed in this subphase (hard switch).
- **If TOML exists without YAML:** fail with a clear migration command/instructions (guided failure).
- **Secrets policy:** inline provider keys in YAML are allowed.
- **Permissions behavior:** permissive file permissions produce warning, not blocking failure.
- **Precedence:** environment variables override YAML values when both are set.
- **Scope:** include full config sections (`display`, `reading`, `defaults`) in this subphase, not only LLM.

## Open Questions

(None remaining for brainstorm scope.)

## Resolved Questions

- **Migration behavior for existing TOML users?** Hard switch to YAML.
- **First-run handling when only TOML exists?** Fail with guided migrate command.
- **Store provider keys directly in config?** Yes.
- **File-permission policy for inline keys?** Warn-only, not strict-blocking.
- **Precedence when env and YAML both provide values?** Env wins.
- **Subphase scope level?** Full config now, not YAML+LLM-only.

## Next Steps

-> `/ce:plan` to define migration contract details, acceptance criteria, and rollout/test strategy.
