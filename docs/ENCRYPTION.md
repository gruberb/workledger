# WorkLedger Encryption — Technical Analysis

A deep-dive study companion for understanding WorkLedger's end-to-end encryption system. Read this alongside the source code in `src/features/sync/utils/`.

---

## 1. Executive Summary

WorkLedger implements client-side end-to-end encryption (E2EE) to ensure that no server or intermediary can read user content. All encryption and decryption happens in the browser using the Web Crypto API. The sync server stores only opaque ciphertext — it cannot decrypt, inspect, or modify entry content by design.

The encryption system serves a single purpose: protect the confidentiality and integrity of notebook entries during synchronization between devices. Local-only usage (the default mode) involves no encryption at all. Encryption activates only when the user opts into remote sync.

The cryptographic pipeline is built on three well-established primitives: **PBKDF2** for key derivation (stretching the user's sync ID into an encryption key), **AES-256-GCM** for authenticated encryption (confidentiality plus tamper detection), and **SHA-256** for hashing (authentication tokens and integrity verification). All three are implemented via the browser's `crypto.subtle` API — no third-party crypto libraries are used.

**Files involved:** 4 source files (~260 lines total), 4 test files (~450 lines total).

```
src/features/sync/utils/
├── crypto.ts          → Primitives: key generation, derivation, AES-GCM encrypt/decrypt (77 lines)
├── sync-crypto.ts     → Entry-level: serialize → hash → encrypt / decrypt → parse (85 lines)
├── integrity.ts       → SHA-256 plaintext hashing for integrity verification (16 lines)
└── __tests__/
    ├── crypto.test.ts           → Tests for primitives (121 lines)
    ├── sync-crypto.test.ts      → Tests for entry encryption round-trips (90 lines)
    ├── integrity.test.ts        → Tests for hash computation/verification (50 lines)
    └── sync-lifecycle.test.ts   → Integration: encrypt → push → pull → decrypt → merge (454 lines)
```

---

## 2. Threat Model

Before examining the implementation, it is worth understanding what the encryption is designed to protect against and what it explicitly does not address.

### What is Protected

1. **Server-side data access.** The sync server operator (whether the default `sync.workledger.org` or a self-hosted instance) cannot read entry content. Entries are encrypted before leaving the device and decrypted only after arriving on another device. The server sees only ciphertext blobs.

2. **Network eavesdropping.** All traffic uses HTTPS (the CSP's `connect-src` directive allows `https:` and localhost only). Even if TLS were compromised, the AES-256-GCM encryption provides an independent layer of confidentiality.

3. **Server-side data tampering.** AES-GCM is an authenticated encryption mode — decryption fails if the ciphertext has been modified. A compromised server cannot alter entry content without detection.

4. **Authentication token exposure.** The auth token sent to the server is `SHA-256("auth:" + syncId)`, not the sync ID itself. Knowing the auth token does not allow deriving the encryption key, because the encryption key uses a different domain prefix (`"crypto:"`).

### What is NOT Protected

1. **Metadata.** The `SyncEntry` wire format sends `id`, `updatedAt`, `isArchived`, and `isDeleted` in plaintext. The server knows how many entries exist, when they were last modified, and which are archived or deleted. It does not know the entry content, tags, or which day an entry belongs to.

2. **Client-side access.** IndexedDB stores entries in plaintext. Anyone with access to the browser (physically or via browser extensions/malware) can read all entries. The encryption is for transport and server-side storage only.

3. **Sync ID compromise.** The sync ID is the single secret. If an attacker obtains it, they can derive both the auth token (gaining API access) and the encryption key (decrypting all entries). There is no separate password, no multi-factor authentication, and no way to rotate the encryption key without re-encrypting all entries.

4. **Forward secrecy.** All entries past and future are encrypted with the same derived key. Compromising the key at any point compromises the entire history. There is no per-session or per-entry key rotation.

5. **Entry ID linkability.** Entry IDs are UUIDs sent in plaintext. If the same entry is updated multiple times, the server can observe the update pattern and link updates to the same entry. The server can also correlate entries across devices belonging to the same account.

---

## 3. The Cryptographic Pipeline

The encryption system processes entries through a layered pipeline. Each layer serves a distinct purpose and maps to a specific source file.

```
                    USER'S SYNC ID
                         │
                         │ (generated locally, never sent to server)
                         │
              ┌──────────┴──────────┐
              │                     │
        SHA-256("auth:"+id)   SHA-256("crypto:"+id)
              │                     │
              ▼                     ▼
         AUTH TOKEN            CRYPTO SEED
         (64 hex chars)        (64 hex chars)
              │                     │
              │                     │  + server-provided salt
              │                     │  + PBKDF2 (100,000 iterations)
              │                     │
              │                     ▼
              │               AES-256-GCM KEY
              │               (CryptoKey object)
              │                     │
              │        ┌────────────┴────────────┐
              │        │                         │
              │    ENCRYPT                   DECRYPT
              │    entry → JSON →             ciphertext →
              │    AES-GCM(random IV)         AES-GCM →
              │    → base64 ciphertext        JSON → entry
              │        │                         │
              ▼        ▼                         │
         ┌─────────────────┐               ┌─────────────────┐
         │   SYNC SERVER   │──── pull ────▶│   OTHER DEVICE  │
         │  (opaque blobs) │               │  (same sync ID) │
         └─────────────────┘               └─────────────────┘
```

### 3.1 Layer 1: Sync ID Generation

**File:** `crypto.ts:11-17`

```typescript
export function generateSyncIdLocal(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `wl-${hex}`;
}
```

The sync ID is a 20-character hex string prefixed with `wl-`, generated from 10 cryptographically random bytes. Examples: `wl-a1b2c3d4e5f6a7b8c9d0`, `wl-f3e2d1c0b9a8f7e6d5c4`.

**Entropy analysis:** 10 random bytes = 80 bits of entropy. This produces 2^80 ≈ 1.2 × 10^24 possible sync IDs. For context, brute-forcing 80 bits at 1 billion attempts per second would take approximately 38 million years. However, the effective security depends on PBKDF2 (see Section 3.3).

The sync ID is generated entirely on the client. It is never sent to the server in any form. The server receives only derived values (auth token and encrypted payloads).

The `wl-` prefix is a human-readable marker that serves two purposes: (1) users can visually identify a sync ID as belonging to WorkLedger, and (2) the UI validates input against the regex `^wl-[0-9a-f]{20}$` to catch typos before attempting a connection.

### 3.2 Layer 2: Domain Separation

**File:** `crypto.ts:19-25`

The sync ID is used for two different purposes — authentication and encryption — and these must be cryptographically separated. If the same hash were used for both, knowing the auth token (which the server stores) would allow deriving the encryption key.

Domain separation is achieved by prefixing the sync ID with different strings before hashing:

```typescript
export async function computeAuthToken(syncId: string): Promise<string> {
  return sha256Hex("auth:" + syncId);
}

export async function computeCryptoSeed(syncId: string): Promise<string> {
  return sha256Hex("crypto:" + syncId);
}
```

Both functions compute `SHA-256(prefix + syncId)` and return the result as a 64-character hex string (256 bits).

**Auth token** (`SHA-256("auth:" + syncId)`): Sent to the server as the `X-Auth-Token` header. The server stores this hash and uses it to authenticate API requests. Because SHA-256 is a one-way function, the server cannot reverse the hash to recover the sync ID.

**Crypto seed** (`SHA-256("crypto:" + syncId)`): Used as the input key material for PBKDF2 key derivation. Never sent to the server. Even if the server stores the auth token, it cannot compute the crypto seed because the two are derived from different domain-separated hashes.

The `sha256Hex` helper (`crypto.ts:3-9`) performs the actual hashing:

```typescript
async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

This uses the Web Crypto API's `crypto.subtle.digest()`, which is a native browser implementation of SHA-256 — constant-time, hardware-accelerated where available, and not susceptible to the timing attacks that plague JavaScript implementations.

### 3.3 Layer 3: Key Derivation (PBKDF2)

**File:** `crypto.ts:27-47`

The crypto seed (256 bits) could theoretically be used directly as an AES-256 key, but this would be vulnerable to offline brute-force attacks. If an attacker obtained the encrypted data from the server, they could try sync IDs at hardware speed. PBKDF2 adds computational cost to each attempt.

```typescript
const PBKDF2_ITERATIONS = 100_000;

export async function deriveKey(syncId: string, saltBase64: string): Promise<CryptoKey> {
  const cryptoSeed = await computeCryptoSeed(syncId);
  const encoder = new TextEncoder();
  const salt = Uint8Array.from(atob(saltBase64), (c) => c.charCodeAt(0));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(cryptoSeed),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,        // not extractable
    ["encrypt", "decrypt"],
  );
}
```

The derivation process:

1. **Compute crypto seed:** `SHA-256("crypto:" + syncId)` → 64 hex characters
2. **Decode salt:** The server provides a base64-encoded random salt during account creation. The client decodes it to raw bytes.
3. **Import key material:** The crypto seed (as UTF-8 bytes of the hex string) is imported as raw PBKDF2 key material.
4. **Derive AES key:** PBKDF2 with SHA-256, 100,000 iterations, and the server salt produces a 256-bit AES-GCM key.

**The salt's role:** The salt is generated server-side during `POST /api/v1/accounts` and returned to the client. It is stored in `SyncConfig.salt` (persisted in IndexedDB) and returned again during `GET /api/v1/accounts/validate` (used during `connect()`). The salt ensures that two users with the same sync ID (astronomically unlikely, but theoretically possible) derive different encryption keys. It also prevents precomputation attacks — an attacker cannot build a rainbow table of sync ID → key mappings without knowing the salt.

**Iteration count analysis:** 100,000 iterations of PBKDF2-SHA-256 takes approximately 50-200ms on modern hardware (browser-dependent). For a user, this is imperceptible — key derivation happens once during connect, not on every sync. For an attacker brute-forcing sync IDs, each attempt costs ~100ms, meaning ~10 attempts/second on a single core. Combined with 80 bits of sync ID entropy, this provides a comfortable security margin.

**Non-extractable key:** The `extractable: false` parameter prevents JavaScript code from reading the raw key bytes via `crypto.subtle.exportKey()`. The key can only be used for `encrypt` and `decrypt` operations through the Web Crypto API. This is a defense-in-depth measure — it prevents accidental key leakage through logging or serialization.

### 3.4 Layer 4: Entry Encryption (AES-256-GCM)

**File:** `crypto.ts:49-77`

AES-256-GCM is an authenticated encryption with associated data (AEAD) cipher. It provides both confidentiality (the data is unreadable without the key) and integrity (any modification to the ciphertext is detected during decryption). This is important — it means the sync server cannot tamper with entry content.

#### Encryption

```typescript
export async function encrypt(key: CryptoKey, plaintext: string): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext),
  );

  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  return btoa(String.fromCharCode(...combined));
}
```

The process:

1. **Generate IV:** 12 random bytes (96 bits), the standard IV size for AES-GCM. Each encryption uses a fresh random IV, ensuring that encrypting the same plaintext twice produces different ciphertext (the tests verify this: `crypto.test.ts:89-98`).
2. **Encrypt:** `crypto.subtle.encrypt()` with AES-GCM produces ciphertext that includes a 16-byte authentication tag (automatically appended by the Web Crypto API).
3. **Combine:** The IV is prepended to the ciphertext. The receiver needs the IV to decrypt, and prepending is the standard convention.
4. **Encode:** The combined bytes are base64-encoded for safe transport as a JSON string.

**Wire format of `encryptedPayload`:**

```
base64( IV (12 bytes) || ciphertext (variable) || auth tag (16 bytes) )
```

The authentication tag is embedded within the ciphertext by the Web Crypto API — it is not a separate field. The total overhead per entry is 12 bytes (IV) + 16 bytes (auth tag) + base64 expansion (~33%).

#### Decryption

```typescript
export async function decrypt(key: CryptoKey, ciphertextBase64: string): Promise<string> {
  const combined = Uint8Array.from(atob(ciphertextBase64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(plaintext);
}
```

The process is the reverse: base64-decode, split IV from ciphertext, decrypt. If the key is wrong or the ciphertext has been tampered with, `crypto.subtle.decrypt()` throws an `OperationError`. This is the primary tamper detection mechanism.

**IV reuse risk:** AES-GCM has a critical requirement: the same (key, IV) pair must never be used twice. Reusing an IV with the same key allows an attacker to recover plaintext through XOR analysis. WorkLedger mitigates this by generating a fresh random 12-byte IV for every encryption call. With 96 bits of randomness and the birthday bound, the probability of a collision reaches 50% after approximately 2^48 ≈ 281 trillion encryptions with the same key. For a personal notebook syncing a few hundred entries, this is not a practical concern.

### 3.5 Layer 5: Entry Serialization and Integrity

**File:** `sync-crypto.ts` (entry-level operations), `integrity.ts` (hash computation)

The layers above operate on raw strings. The entry-level layer handles the translation between `WorkLedgerEntry` objects and encrypted `SyncEntry` wire format.

#### Encryption Side

```typescript
export async function encryptEntry(key: CryptoKey, entry: {...}): Promise<SyncEntry> {
  const payload: EntryPayload = {
    dayKey: entry.dayKey,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    blocks: entry.blocks,
    isArchived: entry.isArchived,
    tags: entry.tags ?? [],
  };
  const plaintext = JSON.stringify(payload);
  const integrityHash = await computePlaintextHash(plaintext);
  const encryptedPayload = await encrypt(key, plaintext);
  return {
    id: entry.id,
    updatedAt: entry.updatedAt,
    isArchived: entry.isArchived,
    isDeleted: entry.isDeleted ?? false,
    encryptedPayload,
    integrityHash,
  };
}
```

The serialization process:

1. **Extract payload fields:** Only content fields (`dayKey`, `createdAt`, `updatedAt`, `blocks`, `isArchived`, `tags`) are included in the encrypted payload. The `id` is excluded because it must be visible to the server for deduplication.

2. **Serialize to JSON:** `JSON.stringify(payload)` produces the plaintext string. The order of keys in the JSON output depends on insertion order (the `EntryPayload` interface definition order), which is deterministic.

3. **Compute integrity hash:** `SHA-256(plaintext)` → 64-character hex string. This hash is sent to the server alongside the ciphertext and is verified during decryption.

4. **Encrypt:** The JSON string is encrypted with AES-256-GCM as described in Section 3.4.

5. **Build SyncEntry:** The result combines plaintext metadata (`id`, `updatedAt`, `isArchived`, `isDeleted`) with the encrypted payload and integrity hash.

**Why are `id`, `updatedAt`, `isArchived`, and `isDeleted` sent in plaintext?**

These fields serve operational purposes that require server-side visibility:

| Field | Why plaintext |
|-------|---------------|
| `id` | Server uses it for deduplication and conflict detection |
| `updatedAt` | Server may use it for conflict resolution in the `PushResponse.conflicts` array |
| `isArchived` | Metadata — could theoretically be encrypted, but currently exposed |
| `isDeleted` | Server must know to apply deletion logic (cannot decrypt empty payload) |

The `updatedAt` and `isArchived` values are also inside the encrypted payload (they are part of `EntryPayload`). This duplication means the server could in theory lie about these values in the plaintext metadata, but the client always uses the decrypted values from the payload for local storage.

#### Decryption Side

```typescript
export async function decryptEntry(key: CryptoKey, syncEntry: SyncEntry): Promise<DecryptedEntry> {
  if (syncEntry.isDeleted) {
    return {
      id: syncEntry.id, dayKey: "", createdAt: 0, updatedAt: syncEntry.updatedAt,
      blocks: [], isArchived: false, isDeleted: true, tags: [],
    };
  }
  const plaintext = await decrypt(key, syncEntry.encryptedPayload);
  const payload = JSON.parse(plaintext) as EntryPayload;
  const valid = await verifyPlaintextHash(plaintext, syncEntry.integrityHash);
  if (!valid) {
    console.warn(`Integrity hash mismatch for entry ${syncEntry.id} (will be corrected on next push)`);
  }
  return {
    id: syncEntry.id,
    dayKey: payload.dayKey,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    blocks: payload.blocks,
    isArchived: payload.isArchived,
    isDeleted: false,
    tags: payload.tags ?? [],
  };
}
```

The decryption process:

1. **Short-circuit for deletions:** Deletion markers have empty `encryptedPayload`. Attempting to decrypt an empty string would fail. The function returns a stub with `isDeleted: true` and empty content.

2. **Decrypt payload:** AES-GCM decryption. If the key is wrong, this throws immediately — the function does not catch this, allowing the caller to handle decryption failures per-entry.

3. **Parse JSON:** The decrypted string is parsed back into an `EntryPayload` object.

4. **Verify integrity hash:** The hash of the decrypted plaintext is compared to the `integrityHash` sent alongside the ciphertext.

5. **Return decrypted entry:** Content fields come from the decrypted payload. The `id` comes from the `SyncEntry` metadata (it was not encrypted).

#### The Integrity Hash: Redundant by Design

The integrity hash (`SHA-256` of the JSON plaintext, stored in `integrityHash`) is technically redundant. AES-GCM already provides authenticated encryption — if `crypto.subtle.decrypt()` succeeds, the ciphertext has not been tampered with. The authentication tag embedded in the GCM ciphertext serves exactly this purpose.

So why does the hash exist? Historical reasons. The original implementation likely intended the hash as an additional verification layer, perhaps anticipating a future switch to a non-authenticated cipher mode (like AES-CTR, which provides confidentiality but not integrity). In practice, the hash caught a real bug — an inconsistency between `sortedStringify()` and `JSON.stringify()` (see Section 5.1) — which revealed a logic error even though the data was not actually tampered with.

The current behavior on hash mismatch is a warning, not an error. The comment in the source explains why:

```typescript
// AES-256-GCM already authenticates the data — if decryption succeeded, the data is untampered.
// Hash mismatch is expected for entries created before the hash fix (sortedStringify vs plaintext).
// The hash will be corrected on next push.
```

This is correct. A hash mismatch after successful GCM decryption means the hash was computed differently (a bug), not that the data was tampered with. The entry is accepted, and when it is next pushed, the hash will be recomputed with the current `JSON.stringify` method.

---

## 4. The Wire Format: SyncEntry

This section documents exactly what bytes cross the network boundary.

### 4.1 SyncEntry Structure

```typescript
interface SyncEntry {
  id: string;                 // Plaintext UUID
  updatedAt: number;          // Plaintext Unix timestamp (ms)
  isArchived: boolean;        // Plaintext
  isDeleted: boolean;         // Plaintext
  encryptedPayload: string;   // base64(IV || AES-GCM ciphertext || auth tag)
  integrityHash: string;      // SHA-256 hex of JSON plaintext
  serverSeq?: number;         // Assigned by server, present only in pull responses
}
```

### 4.2 What the Server Sees

For a typical entry with two paragraphs of text and two tags, the server sees something like:

```json
{
  "id": "xk7m2p9q4r",
  "updatedAt": 1739836800000,
  "isArchived": false,
  "isDeleted": false,
  "encryptedPayload": "dGhpcyBpcyBhIGJhc2U2NC1lbmNvZGVkIGNpcGhlcnRleHQuLi4=",
  "integrityHash": "a3f2b8c4d5e6f7081920abcdef1234567890abcdef1234567890abcdef123456"
}
```

The server can determine:
- This entry was created or modified at timestamp 1739836800000 (Feb 17, 2026)
- It is not archived and not deleted
- The encrypted content is approximately N bytes (the base64 length reveals plaintext size within ~33%)
- The entry has been synced before (if it has a `serverSeq`)

The server **cannot** determine:
- What the entry says
- Which day the entry belongs to (`dayKey` is encrypted)
- What tags the entry has
- When the entry was originally created (`createdAt` is encrypted)

### 4.3 What a Deletion Marker Looks Like

```json
{
  "id": "xk7m2p9q4r",
  "updatedAt": 1739836800000,
  "isArchived": false,
  "isDeleted": true,
  "encryptedPayload": "",
  "integrityHash": ""
}
```

Deletion markers have empty `encryptedPayload` and `integrityHash`. The server knows an entry was deleted, but the entry's content was never transmitted in plaintext, so the server has no way to recover what was deleted.

### 4.4 Size Overhead

For a JSON payload of N bytes:

| Component | Size |
|-----------|------|
| JSON plaintext | N bytes |
| AES-GCM IV | 12 bytes |
| AES-GCM ciphertext | N bytes |
| AES-GCM auth tag | 16 bytes |
| Base64 expansion | × 4/3 |
| **Total `encryptedPayload`** | **≈ (N + 28) × 4/3 bytes** |

For a typical entry with a paragraph of text (~200 bytes JSON), the encrypted payload is approximately 300 bytes. The plaintext metadata adds another ~100 bytes. The integrity hash is always 64 characters.

---

## 5. Key Lifecycle

### 5.1 Account Creation (Generate)

When the user clicks "Generate" in the sync settings:

```
1. generateSyncIdLocal()
   └─ crypto.getRandomValues(10 bytes) → "wl-a1b2c3d4e5f6a7b8c9d0"

2. computeAuthToken("wl-a1b2c3d4e5f6a7b8c9d0")
   └─ SHA-256("auth:wl-a1b2c3d4e5f6a7b8c9d0") → "8f3a..."  (auth token)

3. POST /api/v1/accounts  { authToken: "8f3a..." }
   └─ Server generates random salt, stores (authToken, salt)
   └─ Returns { salt: "base64-encoded-salt" }

4. deriveKey("wl-a1b2c3d4e5f6a7b8c9d0", salt)
   └─ SHA-256("crypto:wl-a1b2c3d4e5f6a7b8c9d0") → crypto seed
   └─ PBKDF2(seed, salt, 100000 iterations) → AES-256-GCM CryptoKey

5. Store in SyncConfig:
   { mode: "remote", syncId: "wl-...", salt: "base64...", lastSyncSeq: 0, lastSyncAt: null }

6. CryptoKey and authToken stored in useRef (memory only, not persisted)
```

The sync ID is shown to the user exactly once during generation. The UI instructs them to save it in a password manager. If lost, the encryption key cannot be recovered.

### 5.2 Connecting from Another Device

When the user enters their sync ID on a second device and clicks "Connect":

```
1. computeAuthToken(syncId) → auth token

2. GET /api/v1/accounts/validate  (X-Auth-Token: auth token)
   └─ Server looks up account by auth token
   └─ Returns { valid: true, salt: "base64...", entryCount: N, createdAt: T }

3. deriveKey(syncId, salt)
   └─ Same derivation as original device → same CryptoKey

4. getAllEntries() from local IndexedDB → encrypt each → POST /api/v1/sync/full
   └─ Server returns all stored entries

5. For each server entry: decryptEntry(key, entry)
   └─ AES-GCM decrypt with the derived key
   └─ If decryption fails → the sync ID is wrong (different key)

6. mergeRemoteEntries(decrypted) → write to local IndexedDB
```

The critical insight: the same sync ID + salt always derives the same CryptoKey. This is what makes cross-device sync work — both devices independently derive the same key and can decrypt each other's entries.

If the user enters the wrong sync ID, step 2 will fail (the auth token won't match any account). If the user enters a sync ID that passes authentication but was somehow altered (impossible in practice, since auth validation would fail first), step 5 would fail when AES-GCM decryption detects the wrong key.

### 5.3 Key Derivation on App Startup

When a user returns to a device that is already connected:

```
1. loadSyncConfig() from IndexedDB → { syncId, salt, mode: "remote", ... }

2. useEffect triggers (configLoaded + mode === "remote"):
   a. deriveKey(syncId, salt) → CryptoKey  (re-derived from stored credentials)
   b. computeAuthToken(syncId) → auth token

3. Both stored in useRef for the session duration

4. Immediate pull + start 30-second pull interval
```

Key derivation happens on every page load because the CryptoKey object cannot be serialized to IndexedDB. The Web Crypto API's `CryptoKey` is an opaque handle — even with `extractable: true`, exporting and re-importing would be more complex than simply re-deriving. At 100,000 PBKDF2 iterations, re-derivation takes 50-200ms, which is imperceptible during app startup.

### 5.4 Disconnection and Deletion

**Disconnect** (keep server account, remove local credentials):

```
1. Clear CryptoKey and authToken refs (set to null)
2. Stop all intervals and timeouts
3. Clear dirty tracking sets
4. Delete SyncConfig from IndexedDB (clearSyncConfig)
5. Reset React state to DEFAULT_SYNC_CONFIG
```

After disconnecting, the encryption key exists nowhere — not in memory, not in IndexedDB. The only way to recover it is to re-enter the sync ID, which re-derives the key.

**Delete account** (remove server data):

```
1. DELETE /api/v1/accounts (X-Auth-Token: auth token)
   └─ Server deletes all stored encrypted entries
2. Proceed with disconnect (steps above)
```

After account deletion, the encrypted entries on the server are gone. Local entries in IndexedDB remain in plaintext. The sync ID is useless since the server account no longer exists.

---

## 6. What Gets Encrypted and What Does Not

A precise accounting of every field and its confidentiality status:

### Encrypted (inside `encryptedPayload`)

| Field | Type | Why encrypted |
|-------|------|---------------|
| `dayKey` | `string` (YYYY-MM-DD) | Reveals what day the user was working — temporal pattern |
| `createdAt` | `number` (timestamp ms) | Reveals exact creation time |
| `updatedAt` | `number` (timestamp ms) | Reveals exact edit time (also in plaintext — see below) |
| `blocks` | `PartialBlock[]` (BlockNote JSON) | The actual content — most sensitive field |
| `isArchived` | `boolean` | Archive status (also in plaintext) |
| `tags` | `string[]` | User-defined categories — reveals work topics |

### Plaintext (SyncEntry metadata)

| Field | Type | Why plaintext | Sensitivity |
|-------|------|---------------|-------------|
| `id` | `string` (UUID) | Server deduplication | Low — random, no semantic meaning |
| `updatedAt` | `number` | Server conflict detection | Medium — reveals edit frequency |
| `isArchived` | `boolean` | Server-side filtering (if any) | Low — binary flag |
| `isDeleted` | `boolean` | Server must know to process deletions | Low — binary flag |
| `integrityHash` | `string` (SHA-256 hex) | Integrity verification | Low — hash of encrypted content, not reversible |

### Duplicated fields

`updatedAt` and `isArchived` appear both in plaintext metadata and inside the encrypted payload. The client uses the encrypted versions when rebuilding local entries after a pull — the plaintext versions are for the server's operational use. A malicious server could alter the plaintext `updatedAt` to manipulate conflict resolution ordering, but this would only affect which version "wins" during merge, not the content of either version.

---

## 7. Security Properties and Analysis

### 7.1 Confidentiality

AES-256-GCM with random IVs provides semantic security: an attacker cannot distinguish between encryptions of different messages, even if they can choose the messages (IND-CPA security). The 256-bit key length provides a 128-bit security level against quantum attacks (Grover's algorithm).

### 7.2 Integrity and Authenticity

AES-GCM's authentication tag (128 bits by default in Web Crypto) ensures that any modification to the ciphertext — including bit flips, truncation, or reordering — is detected during decryption. The probability of a forged ciphertext passing authentication is 2^-128.

The separate `integrityHash` is an additional check on the plaintext after decryption. As discussed in Section 3.5, this is redundant with GCM authentication but serves as a bug-detection mechanism.

### 7.3 Key Derivation Strength

The PBKDF2 chain is: `syncId (80 bits) → SHA-256 → PBKDF2 (100k iterations, salt) → AES-256 key`.

An attacker who obtains encrypted entries from the server would need to:
1. Guess sync IDs (80-bit space, `wl-` prefix is known)
2. Obtain the salt (stored on the server, requires auth token to retrieve — but the auth token is also derived from the sync ID, creating a bootstrap problem)
3. Run PBKDF2 for each guess

In practice, an attacker who compromises the server database has access to both encrypted entries and salts (stored with each account). The auth token is also stored server-side. The remaining protection is the 80-bit sync ID entropy combined with 100,000 PBKDF2 iterations.

At an optimistic 10,000 PBKDF2 evaluations per second per GPU (SHA-256 based PBKDF2 is moderately GPU-friendly), brute-forcing 80 bits would require 2^80 / 10^4 ≈ 10^20 seconds ≈ 3 × 10^12 years. This is secure against any foreseeable attack.

### 7.4 Known Limitations

1. **No forward secrecy.** The same key encrypts all entries forever. Key compromise exposes the complete history.

2. **No key rotation.** Changing the encryption key would require re-encrypting all server-side entries, which would require downloading, decrypting, re-encrypting, and re-uploading everything. The system has no mechanism for this.

3. **Payload size leakage.** The base64-encoded ciphertext length is proportional to the plaintext length. An observer (including the server) can infer approximate entry sizes.

4. **Timing leakage.** The `updatedAt` timestamp is in plaintext. Combined with payload size changes over time, this reveals editing patterns.

5. **No per-entry keys.** All entries use the same key. Sharing a single entry with another user is impossible without sharing the entire account's encryption key.

6. **Salt is server-controlled.** A malicious server could provide a weak or predetermined salt. However, since the input key material (crypto seed) already has 256 bits of entropy from SHA-256, a weak salt does not meaningfully reduce security — the PBKDF2 iterations still add computational cost.

---

## 8. Content Security Policy Interaction

The CSP meta tag in `index.html` affects crypto operations:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' ...;
  connect-src 'self' https: http://localhost:* http://127.0.0.1:*;
  ...
">
```

**`connect-src 'self' https: http://localhost:* http://127.0.0.1:*`**: Encrypted payloads can only be sent to HTTPS endpoints (or localhost for development). This prevents accidental transmission over unencrypted HTTP in production.

**`script-src` includes `'unsafe-eval'` and `'wasm-unsafe-eval'`**: These are required by Excalidraw's WebAssembly dependencies, not by the crypto system. The crypto operations use only `crypto.subtle`, which works under any CSP.

The Web Crypto API (`crypto.subtle`) is available in all modern browsers and does not require any CSP relaxation. It works in secure contexts (HTTPS and localhost) by default.

---

## 9. Test Coverage

The encryption system has four test files that cover the pipeline at different levels of abstraction.

### 9.1 crypto.test.ts — Primitive Tests (121 lines)

Tests the low-level cryptographic functions:

- **Sync ID generation:** Format validation (`wl-` prefix, 20 hex chars), uniqueness (100 generated IDs are all distinct)
- **Auth token:** Returns 64-char hex, deterministic for same input, different for different inputs
- **Crypto seed:** Returns 64-char hex, differs from auth token for same input (domain separation)
- **Key derivation:** Produces a `CryptoKey` with algorithm `AES-GCM`, length 256, usages `["encrypt", "decrypt"]`
- **Encrypt/decrypt round-trips:** Simple strings, JSON payloads, empty strings, Unicode content (including emoji and CJK characters)
- **Random IV verification:** Same plaintext encrypted twice produces different ciphertext
- **Wrong key rejection:** Decryption with a different key throws an error

### 9.2 sync-crypto.test.ts — Entry-Level Tests (90 lines)

Tests the entry serialization and encryption:

- **Full round-trip:** Entry → encrypt → decrypt → verify all fields match
- **Metadata preservation:** Encrypted `SyncEntry` has correct plaintext `id`, `updatedAt`, `isArchived`
- **Integrity hash format:** 64-character hex string
- **Deleted entry handling:** No decryption attempted, returns stub with `isDeleted: true`
- **Hash mismatch tolerance:** Tampered hash still decrypts successfully (AES-GCM authentication is the real check)
- **Edge cases:** Empty blocks and tags, `isDeleted` flag on input

### 9.3 integrity.test.ts — Hash Tests (50 lines)

Tests the SHA-256 integrity hash:

- **Format:** 64-character hex output
- **Determinism:** Same plaintext → same hash
- **Collision resistance:** Different plaintexts → different hashes
- **Empty input:** Returns valid hash for empty string
- **Verification round-trip:** `compute` then `verify` returns true; wrong hash returns false

### 9.4 sync-lifecycle.test.ts — Integration Tests (454 lines)

Full end-to-end tests using real crypto (no mocks for encrypt/decrypt) with a simulated in-memory server:

- **Fresh sync:** Push local entries → verify encrypted on server (no plaintext content visible) → clear local → pull → verify decrypted content matches original
- **Conflict resolution:** Remote wins when `updatedAt >` local; local wins on timestamp tie
- **Deletion propagation:** Server deletion marker → local entry and search index removed
- **Corrupt entry recovery:** Entry encrypted with different key → decryption fails → skipped with warning → other entries still processed
- **Pagination:** 150 entries → pulled across 2 pages (limit 100) → all recovered
- **Resync recovery:** Pull from seq 0 → all entries recovered after simulated data loss
- **Archive round-trip:** `isArchived: true` survives encrypt → push → pull → decrypt

The lifecycle tests are the most valuable for confidence, because they exercise the real Web Crypto API with randomly generated keys and verify that the full pipeline is correct end to end.

---

## 10. Design Decisions

### Decision: Web Crypto API Only, No Libraries

**Context:** Many JavaScript encryption libraries exist (libsodium.js, tweetnacl.js, node-forge). Using one would provide a higher-level API and potentially better cross-browser compatibility.

**Decision:** Use only `crypto.subtle` from the Web Crypto API.

**Tradeoffs:** Zero additional dependencies for crypto, native browser performance (hardware-accelerated where available), constant-time implementations that resist side-channel attacks. However, the API is verbose and async-only (`crypto.subtle` returns Promises for all operations). Browser support is excellent (all modern browsers since ~2015), but the API is only available in secure contexts (HTTPS/localhost).

**Consequence:** No crypto code runs during build. No need to worry about tree-shaking crypto libraries or polyfilling for older environments. The test environment (Vitest with happy-dom or jsdom) must provide `crypto.subtle` — Node.js has included it since v15.

### Decision: Single Sync ID as Both Identity and Key

**Context:** The system could use separate credentials: a username/password for authentication and a separate encryption key (or passphrase) for encryption.

**Decision:** One sync ID serves both purposes via domain separation.

**Tradeoffs:** Simpler UX (one string to manage), but higher risk from a single point of compromise. If the sync ID is leaked, both authentication and encryption are broken simultaneously. A separate encryption passphrase would allow the server to authenticate without the ability to decrypt, but would add UX friction.

**Consequence:** The sync ID must be treated as a high-value secret. The UI shows prominent warnings to save it in a password manager. There is no "forgot ID" recovery flow.

### Decision: Integrity Hash Alongside GCM Authentication

**Context:** AES-GCM already provides data authentication. A separate SHA-256 hash is redundant for tamper detection.

**Decision:** Keep the hash anyway, but downgrade mismatches to warnings rather than errors.

**Tradeoffs:** Small computational overhead (one extra SHA-256 per encrypt and decrypt). The hash proved useful for detecting a serialization bug (Section 5.1 of TECHNICAL.md) but provides no additional security. Removing it would simplify the code, but it serves as a canary for implementation bugs.

### Decision: Non-Extractable CryptoKey

**Context:** `crypto.subtle.deriveKey()` accepts an `extractable` parameter. Setting it to `true` would allow exporting the raw key bytes.

**Decision:** `extractable: false`.

**Tradeoffs:** Prevents accidental key leakage through logging (`console.log(key)` shows `CryptoKey {}`, not raw bytes). Also prevents programmatic key export, which means the key cannot be backed up, transferred, or used with other crypto libraries. Since the key can always be re-derived from the sync ID and salt, extractability is unnecessary.

### Decision: PBKDF2 over Argon2

**Context:** Argon2 is the modern password-hashing standard, providing better resistance to GPU/ASIC attacks through memory-hardness. PBKDF2 is older and more GPU-friendly.

**Decision:** PBKDF2 (the only KDF available in Web Crypto API).

**Tradeoffs:** PBKDF2 is natively supported by `crypto.subtle` — no WebAssembly or library needed. Argon2 would require a WASM build or JavaScript implementation, adding ~100KB+ to the bundle and complexity. With 80 bits of sync ID entropy, the KDF's role is primarily rate-limiting (adding computational cost per attempt), not compensating for low-entropy passwords. PBKDF2 with 100,000 iterations provides adequate rate-limiting for this use case.

---

## 11. Appendix

### 11.1 Glossary

| Term | Definition |
|------|-----------|
| **AES-256-GCM** | Advanced Encryption Standard with 256-bit keys in Galois/Counter Mode. Provides authenticated encryption (confidentiality + integrity). |
| **PBKDF2** | Password-Based Key Derivation Function 2. Stretches a password/secret into a cryptographic key using repeated hashing. |
| **IV (Initialization Vector)** | A random value used once per encryption to ensure different ciphertexts for the same plaintext. 12 bytes for AES-GCM. |
| **Auth tag** | A 16-byte value computed during AES-GCM encryption that authenticates the ciphertext. Decryption fails if the tag doesn't match. |
| **Domain separation** | Using different prefixes (`"auth:"`, `"crypto:"`) before hashing to ensure the same input produces different outputs for different purposes. |
| **Key material** | The raw bytes imported into PBKDF2 as the starting point for key derivation. In this system, it is the UTF-8 encoding of the crypto seed hex string. |
| **Salt** | A random value (provided by the server) mixed into PBKDF2 to prevent precomputation attacks. Unique per account. |
| **Semantic security** | The property that an attacker cannot distinguish between encryptions of different messages, even if they choose the messages. |
| **Non-extractable** | A CryptoKey property that prevents reading the raw key bytes via `exportKey()`. The key can only be used for its designated operations (encrypt/decrypt). |

### 11.2 Cryptographic Parameter Summary

| Parameter | Value | Standard |
|-----------|-------|----------|
| Sync ID entropy | 80 bits (10 random bytes) | — |
| Hash function | SHA-256 | FIPS 180-4 |
| KDF | PBKDF2-SHA-256 | RFC 8018 |
| KDF iterations | 100,000 | OWASP minimum for SHA-256 |
| Encryption | AES-256-GCM | NIST SP 800-38D |
| Key length | 256 bits | — |
| IV length | 96 bits (12 bytes) | NIST recommended for GCM |
| Auth tag length | 128 bits (16 bytes) | Web Crypto API default |
| Integrity hash | SHA-256 (redundant with GCM) | — |

### 11.3 File Reference

| File | Lines | Crypto operations |
|------|-------|-------------------|
| `crypto.ts` | 77 | `generateSyncIdLocal`, `computeAuthToken`, `computeCryptoSeed`, `deriveKey`, `encrypt`, `decrypt` |
| `sync-crypto.ts` | 85 | `encryptEntry`, `decryptEntry` |
| `integrity.ts` | 16 | `computePlaintextHash`, `verifyPlaintextHash` |
| `sync-api.ts` | 100 | Auth token passed in `X-Auth-Token` header (no crypto operations, just transport) |
| `crypto.test.ts` | 121 | Tests for all primitives |
| `sync-crypto.test.ts` | 90 | Tests for entry-level encryption |
| `integrity.test.ts` | 50 | Tests for hash functions |
| `sync-lifecycle.test.ts` | 454 | End-to-end integration with real crypto |
