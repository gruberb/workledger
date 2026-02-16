# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly by emailing **security@gruber.dev** (or open a [private security advisory](https://github.com/gruberb/workledger/security/advisories/new) on GitHub).

Please do **not** open a public issue for security vulnerabilities.

## Scope

WorkLedger is a local-first application. How your data is handled depends on which features you enable:

### Local mode (default)
- All data (entries, settings) stored in your browser's IndexedDB — **unencrypted**
- No data leaves the browser
- No authentication, no server communication

### Sync mode (opt-in)
- Entries are end-to-end encrypted using **AES-256-GCM** with a key derived from your sync ID
- Key derivation: sync ID → `SHA-256("crypto:" + syncId)` → **PBKDF2** (100,000 iterations, SHA-256, server-provided salt) → AES-256-GCM key
- Authentication: sync ID → `SHA-256("auth:" + syncId)` → auth token sent as `X-Auth-Token` header. Domain separation ensures the auth token reveals nothing about the encryption key
- **Encrypted** (inside `encryptedPayload`): entry content (blocks), day key, creation time, tags
- **Not encrypted** (visible to server): entry IDs, `updatedAt` timestamps, `isArchived` flag, `isDeleted` flag, integrity hash
- Each encryption uses a random 12-byte IV — identical content produces different ciphertext
- The integrity hash is `SHA-256` of the plaintext JSON, a secondary check on top of AES-GCM's built-in authentication tag
- Your sync ID is stored unencrypted in IndexedDB — treat it like a password
- The search index (a separate IndexedDB store) is **not encrypted** and remains local-only; it is never sent to the server

### AI features (opt-in)
- Note content is sent to the configured LLM provider (Ollama, Hugging Face, or a custom server)
- API keys are stored unencrypted in IndexedDB
- Ollama runs locally by default; other providers send data over the network

### Relevant concerns
- XSS via editor content or imported data
- Malicious content in imported JSON files
- Dependencies with known vulnerabilities
- Unencrypted local storage of API keys and sync IDs
