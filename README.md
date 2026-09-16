# codex-project

[日本語](README.ja.md)

Project-local shared memory, encrypted notes, and hooks for Codex App.

`codex-project` helps a maintainer keep continuity across multiple Codex tasks that work in the same repository. It stores project state, decisions, task-local logs, and selected long-lived memories inside the workspace while keeping private data out of Git.

This project is independent and is not affiliated with or endorsed by OpenAI.

## Why

A repository may have several Codex tasks running in parallel, but their conversation context is not automatically shared. That can make maintainers repeat architectural decisions, reload project history, or lose track of what another task already verified.

`codex-project` adds a small, local-first coordination layer:

- shared project state and durable decisions;
- task-local action and conversation logs;
- project-local `AGENTS.md` guidance and hooks;
- searchable structured memory with provenance and lifecycle states;
- encrypted notes and secret storage for data that must not enter plain Markdown;
- learning candidates for reusable instructions, corrections, and preferences.

It does not replace Git, Issues, pull requests, or release notes. It gives Codex the missing local context needed to use those maintainer tools consistently.

## Maintainer workflows

The tool is designed for real maintenance work across long-running repositories:

- preserve decisions while triaging Issues in separate tasks;
- hand off verified findings between review, implementation, and testing tasks;
- keep release and migration context close to the repository;
- record what was executed separately from what was verified;
- recall only relevant project memories before a new task;
- keep credentials and private operational notes out of commits.

The primary maintainer uses it in day-to-day Codex App work across multiple company and open-source projects.

## Install

Requirements: Node.js 20 or later.

```sh
npm install --global https://github.com/MaururuTakumi/codex-project.git \
  && codex-project install-skill
```

For development:

```sh
git clone https://github.com/MaururuTakumi/codex-project.git
cd codex-project
npm link
codex-project install-skill
```

## Quick start

Run once from the root of a project:

```sh
codex-project init
```

You may include initial context:

```sh
codex-project init "A Next.js SaaS. Authentication uses Clerk."
```

In Codex App, you can also choose **Codex Project** from the skill picker.

Initialization preserves existing source code and documentation. It adds only the files needed for shared project memory. If `.local/` is already tracked by Git, initialization stops instead of risking a private-data commit.

## What it adds

- `.local/project.md`: project purpose and initial context
- `.local/project.json`: stable project UUID
- `.local/state.md`: current working state
- `.local/decisions.md`: durable decisions
- `.local/index.md`: task index
- `.local/chats/<task-id>/`: task-local logs
- `.local/learn/`: reusable instruction and correction candidates
- `.local/memory/records/`: structured, searchable project memory
- `.local/vault/secrets.json.enc`: encrypted notes and secret values
- `.codex/`: project-local hooks and configuration
- a managed `AGENTS.md` block describing the memory contract

`.local/` is added to `.gitignore`.

## Commands used by Codex

These commands are primarily intended for Codex to call according to the installed project rules:

```sh
codex-project context
codex-project context --hook
codex-project learn add <instruction|mistake|preference|rule> <text>
codex-project learn capture
codex-project memory status
codex-project memory search <query>
codex-project memory get <name>
codex-project secret get <name>
codex-project hooks status
```

`context` lists available plain context files, encrypted note names, secret names, and learning candidates without displaying encrypted values.

Structured memory is stored in a permission-restricted JSON source of truth and indexed with SQLite FTS5 when available. If SQLite is unavailable, search falls back to a linear scan. Records support provenance and lifecycle states such as active, superseded, and forgotten.

## Security model

- Private project memory stays under `.local/` and is not committed.
- Sensitive notes and secret values are encrypted at rest.
- Structured learning rejects likely secrets and direct contact data.
- Hooks are installed only inside the project; global Codex configuration is not modified.
- Existing tracked `.local/` data causes initialization to fail closed.
- Encrypted values are not shown by `context` or hook output.

Encryption protects against accidental commits and disclosure of the `.local/` directory alone. It does not protect against full compromise of the same operating-system user account.

Please report security issues according to [SECURITY.md](SECURITY.md).

## Development

```sh
npm run check
npm test
```

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
