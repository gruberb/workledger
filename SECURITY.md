# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly by emailing **security@gruber.dev** (or open a [private security advisory](https://github.com/gruberb/workledger/security/advisories/new) on GitHub).

Please do **not** open a public issue for security vulnerabilities.

## Scope

WorkLedger is a client-side application. All data is stored locally in your browser's IndexedDB. There is no server, no authentication, and no data leaves your machine.

Relevant concerns include:
- XSS via editor content or imported data
- Malicious content in imported JSON files
- Dependencies with known vulnerabilities
