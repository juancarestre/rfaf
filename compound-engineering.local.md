---
review_agents: [kieran-typescript-reviewer, code-simplicity-reviewer, security-sentinel, performance-oracle]
plan_review_agents: [kieran-typescript-reviewer, code-simplicity-reviewer]
---

# Review Context

- This is a Bun + Ink terminal app; prioritize interactive TTY behavior, raw-mode safety, and alternate-screen restoration.
- Preserve deterministic CLI behavior for file-vs-stdin resolution and exit codes.
- Keep MVP scope tight; avoid speculative abstractions.
