# Agent Safety

Agents must not read or print secrets. Do not run `op read`, `op item get`, `printenv`, or broad environment dumps in automation.

Use `op run` or `op inject` only in approved local operator workflows, never in CI scripts committed to this repository.

deployment commands and credential rotation commands require manual approval from the repository owner before execution.
