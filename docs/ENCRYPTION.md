# WorkLedger Encryption: Technical Analysis

A study companion for WorkLedger's end-to-end encryption. Read this alongside `src/features/sync/utils/crypto.ts` and `src/features/sync/utils/sync-crypto.ts`. Sync behavior (queue, cursors, merge) is covered in [SYNC.md](SYNC.md).

---

## 1. Executive Summary

WorkLedger implements client-side end-to-end encryption (E2EE) so that no server or intermediary can read user content. All encryption and decryption happens in the browser using the Web Crypto API. The sync server stores only ciphertext.

Encryption protects the confidentiality and integrity of notebook entries during synchronization between devices. Local-only usage (the default mode) involves no encryption. Encryption activates only when the user opts into remote sync.

The pipeline uses three primitives, all through `crypto.subtle` with no third-party crypto libraries:

- **PBKDF2-SHA-256** to stretch the sync ID into an AES key
- **AES-256-GCM** with additional data (AAD) for authenticated encryption; the entry id is the AAD, so a ciphertext only decrypts under the id it was written for
- **SHA-256** for the auth token, domain separation, and the `integrityHash` field (a hash of the ciphertext, required by the server)

New writes use **payload format v2**: the entry id and the deletion flag are inside the ciphertext, and deletions are encrypted like any other entry. Decryption still accepts the legacy v1 format so data already on servers keeps working.

**Files involved:** 2 source files (206 lines), 2 test files (237 lines).

```
src/features/sync/utils/
├── crypto.ts          → Primitives: SHA-256, sync ID, auth token, PBKDF2, AES-GCM with optional AAD (87 lines)
├── sync-crypto.ts     → Entry level: v2 encrypt, encrypted tombstones, v2/v1 decrypt, decryptAll (119 lines)
└── __tests__/
    ├── crypto.test.ts        → Primitives, AAD round-trip and mismatch (120 lines)
    └── sync-crypto.test.ts   → v2 round-trip, id/isDeleted binding, legacy reads, tombstones (117 lines)
```

---

## 2. Threat Model

### What is Protected

1. **Server-side data access.** The sync server operator (the default `sync.workledger.org` or a self-hosted instance) cannot read entry content, tags, day keys or creation times.

2. **Network eavesdropping.** The default server and any self-hosted server URL must use https; plain http is only accepted for `localhost`, `127.0.0.1` and `[::1]` (`validateServerUrl`). The CSP's `connect-src` also limits connections to `https:` and localhost. AES-256-GCM is an independent layer on top of TLS.

3. **Content tampering.** AES-GCM authenticates the ciphertext; decryption fails if it was modified.

4. **Payload swapping and deletion forgery (v2 entries).** The AAD `workledger:entry:<id>` binds each ciphertext to its entry id, so the server cannot serve entry A's ciphertext as entry B. The encrypted `isDeleted` flag must match the plaintext one, so flipping the flag on a v2 entry or tombstone makes decryption fail. v2 tombstones are encrypted and authenticated too. (The server can still forge a deletion by sending an empty legacy tombstone, see below.)

5. **Authentication token exposure.** The auth token is `SHA-256("auth:" + syncId)`. Knowing it does not allow deriving the encryption key, which uses the `"crypto:"` prefix.

### What is NOT Protected

1. **Metadata.** `id`, `updatedAt`, `isArchived` and `isDeleted` are sent in plaintext. The server knows how many entries exist, when they were last modified, and which are archived or deleted. It also sees payload sizes.

2. **Legacy formats.** For compatibility, the client still accepts:
   - empty, unauthenticated tombstones (`isDeleted: true`, empty payload) from older clients, so a malicious server can delete any entry on a client;
   - v1 payloads without AAD, so the server can serve any v1 ciphertext it still holds under a different id, and can flip `isDeleted` on a v1 entry.

   These gaps stay open until legacy support is removed.

3. **Replay of older versions.** The server can serve an older v2 ciphertext of the same entry. LWW rejects it if the local copy is newer, but a device without a local copy accepts it.

4. **Client-side access.** IndexedDB stores entries in plaintext. Anyone with access to the browser profile (physically, or through extensions or malware) can read everything. Encryption covers transport and server storage only.

5. **Sync ID compromise.** The sync ID is the single secret. With it an attacker derives both the auth token and the key. There is no separate password, no MFA, and no key rotation.

6. **Forward secrecy.** One derived key encrypts all entries, past and future.

7. **Entry ID linkability.** Entry ids are plaintext, so the server can link updates to the same entry over time.

---

## 3. The Cryptographic Pipeline

```
                    USER'S SYNC ID
                         │
                         │ (generated locally, never sent to the server)
              ┌──────────┴──────────┐
              │                     │
        SHA-256("auth:"+id)   SHA-256("crypto:"+id)
              │                     │
              ▼                     ▼
         AUTH TOKEN            CRYPTO SEED
         (64 hex chars)        (64 hex chars)
              │                     │  + server-provided salt
              │                     │  + PBKDF2-SHA-256 (100,000 iterations)
              │                     ▼
              │               AES-256-GCM KEY (non-extractable CryptoKey)
              │                     │
              │        ┌────────────┴─────────────────┐
              │    ENCRYPT                         DECRYPT
              │    {v:2, id, isDeleted, ...}       try v2: AAD = id, check v + id
              │    → AES-GCM(random IV,            fallback v1: no AAD, no "v" key
              │       AAD "workledger:entry:<id>") → RemoteEntry
              │    → base64; integrityHash =
              │       SHA-256(ciphertext)
              ▼        ▼                               ▲
         ┌─────────────────┐                  ┌─────────────────┐
         │   SYNC SERVER   │───── pull ──────▶│  OTHER DEVICE   │
         │  (opaque blobs) │                  │  (same sync ID) │
         └─────────────────┘                  └─────────────────┘
```

### 3.1 Layer 1: Sync ID Generation

```typescript
export function generateSyncIdLocal(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `wl-${hex}`;
}
```

A 20-character hex string prefixed with `wl-`, from 10 cryptographically random bytes (80 bits). The `wl-` prefix makes the ID recognizable, and the UI validates input against `^wl-[0-9a-f]{20}$` before connecting.

The sync ID is generated on the client and never sent to the server in any form. The server only receives the auth token and ciphertext.

### 3.2 Layer 2: Domain Separation

The sync ID is used for authentication and encryption, and the two must be cryptographically separated:

```typescript
export async function computeAuthToken(syncId: string): Promise<string> {
  return sha256Hex("auth:" + syncId);
}

async function computeCryptoSeed(syncId: string): Promise<string> {
  return sha256Hex("crypto:" + syncId);
}
```

- **Auth token** (`SHA-256("auth:" + syncId)`): sent as `X-Auth-Token`. The server stores it and authenticates requests with it.
- **Crypto seed** (`SHA-256("crypto:" + syncId)`): PBKDF2 input. Module-private and never sent anywhere.

`sha256Hex` wraps `crypto.subtle.digest("SHA-256", ...)` and returns lowercase hex. It is exported because `sync-crypto.ts` also uses it for `integrityHash`.

### 3.3 Layer 3: Key Derivation (PBKDF2)

```typescript
const PBKDF2_ITERATIONS = 100_000;

export async function deriveKey(syncId: string, saltBase64: string): Promise<CryptoKey> {
  const cryptoSeed = await computeCryptoSeed(syncId);
  const encoder = new TextEncoder();
  const salt = Uint8Array.from(atob(saltBase64), (c) => c.charCodeAt(0));

  const keyMaterial = await crypto.subtle.importKey(
    "raw", encoder.encode(cryptoSeed), "PBKDF2", false, ["deriveKey"],
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

1. Compute the crypto seed (64 hex chars).
2. Decode the base64 salt the server returned.
3. Import the UTF-8 bytes of the seed hex string as PBKDF2 key material.
4. Derive a 256-bit AES-GCM key with PBKDF2-SHA-256, 100,000 iterations.

**Salt:** generated by the server during `POST /api/v1/accounts` and returned again by `GET /api/v1/accounts/validate` during `connect()`. Stored in `SyncConfig.salt`. It prevents precomputed sync ID → key tables.

**Iteration cost:** derivation runs once per engine activation (startup, connect, new account), not per sync, and the result is cached in memory. The cost matters only to an attacker guessing sync IDs.

**Non-extractable key:** `extractable: false` means the raw key bytes cannot be read through `exportKey()`, so they cannot leak through logging or serialization.

### 3.4 Layer 4: AES-256-GCM with Additional Data

AES-GCM is an AEAD cipher: it encrypts the plaintext and authenticates both the ciphertext and the optional additional data. The additional data is not encrypted and not transmitted; the decrypting side must supply the same value or decryption fails.

```typescript
function gcmParams(iv: Uint8Array<ArrayBuffer>, additionalData?: string): AesGcmParams {
  return additionalData === undefined
    ? { name: "AES-GCM", iv }
    : { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(additionalData) };
}

export async function encrypt(key: CryptoKey, plaintext: string, additionalData?: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    gcmParams(iv, additionalData), key, new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  let binary = "";
  for (let i = 0; i < combined.length; i++) binary += String.fromCharCode(combined[i]);
  return btoa(binary);
}
```

1. **IV:** 12 fresh random bytes per call, so encrypting the same plaintext twice gives different ciphertext.
2. **Encrypt:** Web Crypto appends a 16-byte authentication tag to the ciphertext.
3. **Combine:** IV prepended to ciphertext.
4. **Encode:** base64. The byte-to-string conversion is a loop rather than `String.fromCharCode(...combined)`, because spreading a large array into function arguments can exceed the engine's argument limit for large entries.

`decrypt(key, ciphertextBase64, additionalData?)` reverses this: base64-decode, split off the first 12 bytes as IV, decrypt with the same `gcmParams`. A wrong key, modified ciphertext, or different/missing additional data makes `crypto.subtle.decrypt()` throw.

**Wire format of `encryptedPayload`:**

```
base64( IV (12 bytes) || ciphertext (variable) || auth tag (16 bytes) )
```

**IV reuse:** a repeated (key, IV) pair breaks GCM. With random 96-bit IVs the collision probability reaches 50% after about 2^48 encryptions under one key, far beyond a personal notebook's volume.

### 3.5 Layer 5: Entry Payloads (v2) and Legacy Reads

#### Encrypting an entry

```typescript
const PAYLOAD_VERSION = 2;

function aad(id: string): string {
  return `workledger:entry:${id}`;
}

export async function encryptEntry(key: CryptoKey, entry: WorkLedgerEntry): Promise<SyncEntry> {
  const plaintext = JSON.stringify({
    v: PAYLOAD_VERSION,
    id: entry.id,
    isDeleted: false,
    dayKey: entry.dayKey,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    blocks: entry.blocks,
    isArchived: entry.isArchived,
    tags: entry.tags ?? [],
    isPinned: entry.isPinned ?? false,
    signifier: entry.signifier,
  });
  const encryptedPayload = await encrypt(key, plaintext, aad(entry.id));
  return {
    id: entry.id,
    updatedAt: entry.updatedAt,
    isArchived: entry.isArchived,
    isDeleted: false,
    encryptedPayload,
    integrityHash: await sha256Hex(encryptedPayload),
  };
}
```

`id` and `isDeleted` appear in the encrypted JSON and the id is also the AAD. Either one alone would detect a swap; the AAD makes the check happen inside AES-GCM, and the `id` field lets the decryptor confirm the payload is v2 for this exact entry.

#### Encrypting a deletion

```typescript
export async function encryptTombstone(key: CryptoKey, id: string, updatedAt: number): Promise<SyncEntry> {
  const plaintext = JSON.stringify({ v: PAYLOAD_VERSION, id, isDeleted: true, updatedAt });
  const encryptedPayload = await encrypt(key, plaintext, aad(id));
  return { id, updatedAt, isArchived: false, isDeleted: true, encryptedPayload,
           integrityHash: await sha256Hex(encryptedPayload) };
}
```

`pushEntries` passes the push time as `updatedAt`, so the deletion wins LWW on the server against the entry's last edit.

#### Decrypting

```typescript
async function decryptPayload(key, syncEntry) {
  try {
    const payload = JSON.parse(await decrypt(key, syncEntry.encryptedPayload, aad(syncEntry.id)));
    if (payload.v !== PAYLOAD_VERSION || payload.id !== syncEntry.id) throw new Error("payload does not match entry id");
    return payload;
  } catch (v2Error) {
    let legacy;
    try { legacy = JSON.parse(await decrypt(key, syncEntry.encryptedPayload)); }
    catch { throw v2Error; }
    // A versioned payload must never be accepted without its additional data.
    if ("v" in legacy) throw new Error("versioned payload without additional data");
    return legacy;
  }
}
```

`decryptEntry(key, syncEntry)` then:

1. **Legacy empty tombstone:** `isDeleted && !encryptedPayload` returns `{ id, isDeleted: true, updatedAt }` from the transport fields without decryption. Unauthenticated, accepted for compatibility with older clients.
2. **Decrypt** with `decryptPayload` (v2, then v1).
3. **Deletion flag:** for v2, `isDeleted` comes from the payload and must equal the transport `isDeleted`, otherwise it throws. For v1 it comes from the transport.
4. **Timestamp:** `payload.updatedAt` when it is a number, else the transport `updatedAt`. Both v2 and v1 entry payloads contain it, so the plaintext `updatedAt` is not used for LWW.
5. **Result:** a deletion `{ id, isDeleted: true, updatedAt }`, or `{ id, isDeleted: false, updatedAt, data: { ...payload, id: syncEntry.id } }`. `data` is untrusted; `applyRemoteEntries` validates it with Zod (`.strip()` drops `v` and `isDeleted`) and the transport id always wins.

`decryptAll(key, entries)` decrypts a page with `Promise.allSettled`, logs failures with the entry id, and returns the rest.

**Why the v1 fallback can't be used to downgrade a v2 payload:** a v2 payload decrypted without AAD fails GCM authentication, and if anything versioned ever decrypted without AAD, the `"v" in legacy` check rejects it. Only payloads that were written as v1 pass the fallback.

#### The integrity hash

The server requires a 64-hex `integrityHash` per entry. The previous implementation sent `SHA-256(plaintext JSON)`, which leaked content equality (two identical entries, or an entry reverted to an earlier state, had the same hash). AES-GCM already authenticates, so the field is now `SHA-256(encryptedPayload)`: it satisfies the server and reveals nothing the server doesn't already hold. The client never verifies it.

---

## 4. The Wire Format: SyncEntry

### 4.1 SyncEntry Structure

```typescript
interface SyncEntry {
  id: string;                 // plaintext; bound to the ciphertext via AAD (v2)
  updatedAt: number;          // plaintext; the decrypted value is used locally
  isArchived: boolean;        // plaintext; the decrypted value is used locally
  isDeleted: boolean;         // plaintext; must match the encrypted flag (v2)
  encryptedPayload: string;   // base64(IV || ciphertext || auth tag)
  integrityHash: string;      // SHA-256 hex of encryptedPayload
  serverSeq?: number;         // assigned by the server, present in pull responses
}
```

### 4.2 What the Server Sees

```json
{
  "id": "xk7m2p9q4r",
  "updatedAt": 1739836800000,
  "isArchived": false,
  "isDeleted": false,
  "encryptedPayload": "dGhpcyBpcyBhIGJhc2U2NC1lbmNvZGVkIGNpcGhlcnRleHQuLi4=",
  "integrityHash": "<64 hex chars, SHA-256 of encryptedPayload>"
}
```

The server can determine the modification time, archive and delete status, and approximate payload size. It cannot determine content, tags, `dayKey`, `createdAt`, pin status or signifier.

### 4.3 What a Deletion Looks Like

v2 tombstone (written by current clients):

```json
{
  "id": "xk7m2p9q4r",
  "updatedAt": 1739836900000,
  "isArchived": false,
  "isDeleted": true,
  "encryptedPayload": "<base64 of AES-GCM({v:2,id,isDeleted:true,updatedAt}, AAD id)>",
  "integrityHash": "<SHA-256 of encryptedPayload>"
}
```

Legacy tombstone (older clients, still accepted on read): `"encryptedPayload": ""` and `"integrityHash": ""`.

### 4.4 Size Overhead

| Component | Size |
|-----------|------|
| JSON plaintext | N bytes (includes `v`, `id`, `isDeleted`) |
| AES-GCM IV | 12 bytes |
| AES-GCM auth tag | 16 bytes |
| Base64 expansion | × 4/3 |
| **Total `encryptedPayload`** | **≈ (N + 28) × 4/3 bytes** |

The AAD adds no bytes to the payload. `integrityHash` is always 64 characters. Push batches are limited to 900,000 serialized characters (see [SYNC.md](SYNC.md) 4.3); an entry the server rejects as too large (413) is skipped.

---

## 5. Key Lifecycle

The `CryptoKey` and auth token live only in `SyncEngine.credentials` (memory). `SyncConfig` persists `syncId` and `salt`.

### 5.1 Account Creation (Generate)

```
1. generateSyncIdLocal() → "wl-a1b2c3d4e5f6a7b8c9d0"
2. computeAuthToken(syncId) → SHA-256("auth:" + syncId)
3. POST /api/v1/accounts { authToken } → { salt }
4. deriveKey(syncId, salt) → AES-256-GCM CryptoKey
5. credentials = { key, token } (memory only)
6. SyncConfig: { mode: "remote", syncId, salt, lastSyncSeq: 0, lastSyncAt: null, lastPullAt: null }
7. activate(): push every local entry (forceAll, encrypted v2), then pull
```

The sync ID appears in the input field after generation; the UI tells the user to save it in a password manager. If lost, the key cannot be recovered.

### 5.2 Connecting from Another Device

```
1. computeAuthToken(syncId)
2. GET /api/v1/accounts/validate (X-Auth-Token) → { valid, salt }
   invalid → "Invalid sync ID"
3. deriveKey(syncId, salt) → same CryptoKey as the first device
4. Full pull from seq 0: decrypt each entry (v2, else v1), skip failures, applyRemoteEntries
5. Push every local entry, encrypted v2, in batches
   failure in 4 or 5 → previous config restored, not connected
```

The same sync ID and salt always derive the same key, which is what lets devices read each other's entries. A wrong sync ID fails at step 2 because its auth token matches no account.

### 5.3 Key Derivation on App Startup

```
1. Load SyncConfig and tombstones from the settings store
2. If mode "remote" with syncId and salt:
   deriveKey(syncId, salt) and computeAuthToken(syncId) in parallel
   failure → status error "Could not derive sync key: ..."
3. Cache in credentials for the engine's lifetime
4. Push (with recovery scan), pull, start the 30-second interval
```

The `CryptoKey` is non-extractable and is not stored, so it is re-derived on every page load. Switching to Local mode and back reuses the cached credentials within the session.

### 5.4 Disconnection and Deletion

**Disconnect** (keep the server account):

```
1. resetRuntime(): bump generation, stop timers
2. resetAccountState(null): credentials = null, clear dirty ids and tombstones
3. Reset state to DEFAULT_SYNC_CONFIG
4. Delete the "sync-config" row; tombstones row removed (empty set)
```

Afterwards the key exists nowhere until the sync ID is entered again.

**Delete account:**

```
1. DELETE /api/v1/accounts (X-Auth-Token)
   error other than 404 → status error, return false, stay connected
   404 → account already gone, continue
2. Disconnect (steps above)
```

Local entries in IndexedDB remain in plaintext.

---

## 6. What Gets Encrypted and What Does Not

### Encrypted (inside `encryptedPayload`)

| Field | Type | Notes |
|-------|------|-------|
| `v` | `2` | Payload format version (v2 only) |
| `id` | `string` | Must match the transport id and the AAD (v2 only) |
| `isDeleted` | `boolean` | Must match the transport flag (v2 only) |
| `dayKey` | `string` (YYYY-MM-DD) | Which day the entry belongs to |
| `createdAt` | `number` | Creation time |
| `updatedAt` | `number` | Used for LWW instead of the plaintext copy |
| `blocks` | BlockNote JSON | Content |
| `isArchived` | `boolean` | Used locally instead of the plaintext copy |
| `tags` | `string[]` | Work topics |
| `isPinned` | `boolean` | Pin status |
| `signifier` | `string \| undefined` | Entry signifier |

A v2 tombstone contains only `v`, `id`, `isDeleted: true` and `updatedAt`.

### Plaintext (SyncEntry metadata)

| Field | Why plaintext | Sensitivity |
|-------|---------------|-------------|
| `id` | Server stores entries by id | Low: random, but links updates of one entry |
| `updatedAt` | Server-side LWW | Medium: reveals edit times |
| `isArchived` | Sent alongside, not used by the client on read | Low |
| `isDeleted` | Server applies deletions | Low |
| `integrityHash` | Server requires it | None: hash of the ciphertext |

### Duplicated fields

`updatedAt`, `isArchived` and (v2) `id` and `isDeleted` exist in both places. The client builds local entries from the decrypted values; the transport id is authenticated by the AAD and the transport `isDeleted` must match. A malicious server can still change the plaintext `updatedAt` to influence its own server-side LWW (which version it keeps), but not the client's merge decision for v2 payloads.

---

## 7. Security Properties and Analysis

### 7.1 Confidentiality

AES-256-GCM with random IVs is IND-CPA secure. The 256-bit key leaves a 128-bit margin against Grover's algorithm.

### 7.2 Integrity and Authenticity

GCM's 128-bit tag authenticates the ciphertext and the AAD. For v2 payloads this covers the content, the entry id binding and the deletion flag; a forgery passes with probability about 2^-128. Legacy v1 payloads and empty tombstones do not have the id and deletion binding (section 2).

`integrityHash` adds no integrity guarantee: it is a hash of the ciphertext, sent for the server, not verified by the client.

### 7.3 Key Derivation Strength

The chain is `syncId (80 bits) → SHA-256 → PBKDF2 (100k iterations, salt) → AES-256 key`.

An attacker with the server database has the ciphertexts, salts and auth tokens. Note that the auth token is a single unsalted SHA-256 of the sync ID, so it is a cheaper offline target than PBKDF2: checking a guessed sync ID against a stolen auth token costs one SHA-256. The protection in either case is the 80-bit sync ID space: at 10^12 SHA-256 guesses per second, searching all 2^80 sync IDs takes about 38,000 years. Guessing against the ciphertext instead adds the PBKDF2 cost to every guess.

### 7.4 Known Limitations

1. **No forward secrecy.** One key for all entries.
2. **No key rotation.** Changing the key would require downloading, re-encrypting and re-uploading everything; there is no mechanism for this.
3. **Payload size leakage.** Ciphertext length tracks plaintext length.
4. **Timing leakage.** Plaintext `updatedAt` plus size changes reveal editing patterns.
5. **No per-entry keys.** Sharing one entry means sharing the account key.
6. **Server-controlled salt.** A malicious server could provide a fixed salt. The 256-bit seed and the PBKDF2 cost still apply, but precomputation across accounts with the same salt becomes possible.
7. **Legacy acceptance.** Empty tombstones and v1 payloads are accepted without id binding (section 2).
8. **Old clients can't read v2.** Clients older than the v2 release fail to decrypt v2 entries and skip them.

---

## 8. Content Security Policy Interaction

The CSP meta tag in `index.html` includes:

```
connect-src 'self' https: http://localhost:* http://127.0.0.1:*;
```

Encrypted payloads can only go to https endpoints or localhost. `validateServerUrl` enforces the same rule in the app (and also allows `[::1]`), with a clear error instead of a CSP violation.

The `script-src` directive contains `'unsafe-eval'` and `'wasm-unsafe-eval'`; the crypto code does not need either. `crypto.subtle` requires a secure context (https or localhost) and no CSP relaxation.

---

## 9. Test Coverage

Run with `npm test` (Vitest, real Web Crypto, no crypto mocks).

### 9.1 crypto.test.ts: Primitives (120 lines)

- Sync ID format (`wl-` prefix) and uniqueness
- Auth token: 64 hex chars, deterministic, differs per input
- `deriveKey` produces an AES-GCM `CryptoKey`
- Encrypt/decrypt round-trips: simple string, JSON, empty string, Unicode
- Random IV: same plaintext gives different ciphertext
- Wrong key fails
- AAD: round-trips with matching additional data; fails when it differs or is missing

### 9.2 sync-crypto.test.ts: Entry Payloads (117 lines)

- v2 round-trip of an entry
- `integrityHash` is SHA-256 of the ciphertext, not the plaintext
- v2 payload moved to another entry id is rejected
- v2 entry with `isDeleted` flipped by the server is rejected
- Legacy v1 payloads (plain JSON, no AAD) still decrypt
- Legacy empty tombstones are accepted
- `encryptTombstone`: round-trip; rejected when moved to another id; rejected when presented as a live entry
- `decryptAll` skips undecryptable entries and keeps the rest

Related tests outside the crypto files: `sync-operations.test.ts` checks that pushed tombstones carry an encrypted payload, and `entries/storage/__tests__/remote-entries.test.ts` checks that the transport id wins over an id inside the payload.

---

## 10. Design Decisions

### Decision: Web Crypto API Only, No Libraries

**Decision:** Use only `crypto.subtle`.

**Tradeoffs:** No crypto dependencies, native implementations, async-only and verbose API, secure contexts only. Node (Vitest) provides `crypto.subtle`, so tests use the real implementation.

### Decision: Single Sync ID as Both Identity and Key

**Decision:** One sync ID with domain separation instead of separate credentials.

**Tradeoffs:** One string to manage, single point of compromise, no recovery flow. The UI tells users to keep it in a password manager.

### Decision: Bind Payloads to Entry Ids with AAD (Payload v2)

**Context:** v1 encrypted only the entry fields. The server could move a ciphertext to another id, and tombstones were plaintext flags.

**Decision:** AAD `workledger:entry:<id>`, plus `v`, `id` and `isDeleted` inside the ciphertext, and encrypted tombstones.

**Tradeoffs:** No extra bytes per payload. Clients older than this version cannot read v2 entries until they update.

### Decision: Keep Reading v1

**Context:** Existing server data and tombstones from not-yet-updated clients are v1.

**Decision:** Fall back to v1 on read, never write it, and reject any versioned payload that decrypts without AAD.

**Tradeoffs:** No migration step and no data loss, at the cost of keeping the v1 weaknesses (no id binding, unauthenticated empty tombstones) open for as long as the fallback exists. v1 entries become v2 when they are next pushed (edit, `syncNow`, connect).

### Decision: Hash the Ciphertext for `integrityHash`

**Context:** The server requires the field. The old plaintext hash was redundant with GCM and leaked content equality.

**Decision:** `SHA-256(encryptedPayload)`, never verified by the client.

**Tradeoffs:** Satisfies the server and leaks nothing new. It no longer detects serialization bugs, which GCM decryption plus Zod validation cover.

### Decision: Non-Extractable CryptoKey

**Decision:** `extractable: false`.

**Tradeoffs:** The key can't leak through logging or export, and can't be backed up; it is re-derived from the sync ID and salt instead.

### Decision: PBKDF2 over Argon2

**Decision:** PBKDF2, the only password KDF in Web Crypto.

**Tradeoffs:** No WASM or library. With 80 bits of sync ID entropy the KDF mainly adds cost per guess; memory hardness matters less than for human passwords.

---

## 11. Appendix

### 11.1 Glossary

| Term | Definition |
|------|-----------|
| **AES-256-GCM** | AES with 256-bit keys in Galois/Counter Mode. Authenticated encryption with additional data. |
| **AAD (additional authenticated data)** | Data authenticated by GCM but not encrypted or transmitted. Here `workledger:entry:<id>`. |
| **PBKDF2** | Password-Based Key Derivation Function 2. Stretches a secret into a key by repeated hashing. |
| **IV** | Random 12-byte value used once per encryption. |
| **Auth tag** | 16-byte GCM tag; decryption fails if it doesn't match the ciphertext and AAD. |
| **Domain separation** | Different prefixes (`"auth:"`, `"crypto:"`) so one input yields unrelated outputs per purpose. |
| **Payload v2** | Encrypted JSON with `v: 2`, `id`, `isDeleted` and entry fields, encrypted with the entry id as AAD. |
| **Legacy (v1) payload** | Encrypted entry fields without `v`, `id` or AAD, written by older clients. Still readable. |
| **Tombstone** | Deletion record. v2: encrypted `{ v, id, isDeleted: true, updatedAt }`. Legacy: empty payload. |
| **Salt** | Random per-account value from the server, mixed into PBKDF2. |
| **Non-extractable** | `CryptoKey` property that blocks `exportKey()`. |

### 11.2 Cryptographic Parameter Summary

| Parameter | Value | Standard |
|-----------|-------|----------|
| Sync ID entropy | 80 bits (10 random bytes) | |
| Hash function | SHA-256 | FIPS 180-4 |
| KDF | PBKDF2-SHA-256 | RFC 8018 |
| KDF iterations | 100,000 | |
| Encryption | AES-256-GCM | NIST SP 800-38D |
| Key length | 256 bits | |
| IV length | 96 bits (12 bytes) | NIST recommended for GCM |
| Auth tag length | 128 bits (16 bytes) | Web Crypto default |
| Additional data | `workledger:entry:<id>` (UTF-8) | |
| Payload version | 2 (reads 1) | |
| `integrityHash` | SHA-256 of `encryptedPayload` | |

### 11.3 File Reference

| File | Lines | Crypto operations |
|------|-------|-------------------|
| `crypto.ts` | 87 | `sha256Hex`, `generateSyncIdLocal`, `computeAuthToken`, `deriveKey`, `encrypt`, `decrypt` (`computeCryptoSeed` is private) |
| `sync-crypto.ts` | 119 | `encryptEntry`, `encryptTombstone`, `decryptEntry`, `decryptAll` |
| `sync-api.ts` | 99 | Sends the auth token as `X-Auth-Token`; no crypto |
| `server-url.ts` | 18 | `validateServerUrl`: https except loopback |
| `crypto.test.ts` | 120 | Primitives and AAD |
| `sync-crypto.test.ts` | 117 | v2, tombstones, legacy reads |
