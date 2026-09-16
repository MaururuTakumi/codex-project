# Security Policy

`codex-project` handles local project memory and may store encrypted sensitive data. Security reports are welcome.

## Supported version

Until tagged releases are published, only the current `main` branch is supported.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting flow from the repository's **Security** tab when it is available.

If private reporting is unavailable, open a minimal public Issue asking for a private contact channel. Do not include exploit details, credentials, tokens, private repository contents, decrypted notes, or personal data in the Issue.

## Relevant areas

Reports are especially useful when they involve:

- secret or encrypted-memory disclosure;
- accidental Git tracking of `.local/`;
- unsafe file permissions;
- hook output exposing private values;
- path traversal or writes outside the selected project;
- command injection;
- a fail-open condition where the documented behavior should stop safely.

## Security boundaries

Encryption is intended to reduce accidental disclosure if `.local/` is copied or committed separately. It is not designed to protect data after full compromise of the same operating-system user account.

Project-local hooks and configuration are intentionally scoped to the repository. The tool should not modify global Codex configuration during project initialization.
