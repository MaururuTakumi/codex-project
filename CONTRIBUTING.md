# Contributing to codex-project

Thank you for helping improve project-local continuity for Codex maintainers.

## Scope

Good contributions include:

- bug fixes for initialization, hooks, memory, or secret handling;
- regression tests for privacy and fail-closed behavior;
- portability improvements;
- clearer documentation and examples;
- focused proposals for maintainer workflows.

Please keep the project local-first. Features should not upload repository contents, memories, or secrets to a new service by default.

## Before opening an Issue

Search existing Issues first. Include:

- the command you ran;
- the operating system and Node.js version;
- expected and actual behavior;
- a minimal reproduction when possible.

Never include credentials, tokens, private repository contents, or decrypted `.local/` data.

## Development setup

```sh
git clone https://github.com/MaururuTakumi/codex-project.git
cd codex-project
npm link
npm run check
npm test
```

## Pull requests

Keep pull requests small and explain the user-visible behavior they change. Add or update tests when behavior changes. Before requesting review, run:

```sh
npm run check
npm test
```

A pull request should not weaken these invariants:

- `.local/` remains excluded from Git;
- secret values do not appear in context or hook output;
- tracked private data causes initialization to fail closed;
- project-local setup does not modify global Codex configuration.

For vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of opening a public Issue.
