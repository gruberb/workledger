# WorkLedger Sync System: Technical Analysis

A study companion for WorkLedger's end-to-end encrypted synchronization layer. Read this alongside the source code in `src/features/sync/` and `src/features/entries/storage/remote-entries.ts`.

---

## 1. Executive Summary

WorkLedger is a local-first engineering notebook that stores all data in the browser's IndexedDB. It is a React + TypeScript single-page application with no backend requirement for core functionality. Users create daily entries in a rich text editor (BlockNote), organize them with tags, and optionally synchronize across devices through an encrypted sync protocol.

The sync feature is an optional layer that, when enabled, encrypts every entry client-side using AES-256-GCM (key derived from a user-generated sync ID via PBKDF2), pushes encrypted payloads to a remote server, and pulls encrypted payloads from other devices. The server never sees plaintext. Each payload is bound to its entry id through AES-GCM additional data, and deletions are encrypted too (payload format v2, see [ENCRYPTION.md](ENCRYPTION.md)). Conflict resolution is last-writer-wins on `updatedAt`, with deletions always winning.

The sync logic lives in `SyncEngine` (`engine/sync-engine.ts`), a plain TypeScript class with no React dependency. `useSync` only creates the engine, wires it to the event bus and `visibilitychange`, and exposes its state via `useSyncExternalStore`. The engine runs one network operation at a time on a coalescing queue, tracks local changes with change counters, persists pending deletes, and uses a generation counter to drop results from operations that outlived a disconnect, account change or mode switch.

The feature is about 1,700 lines of TypeScript across 17 source files in `src/features/sync/`, plus `applyRemoteEntries` (73 lines) in the entries feature, with 5 test files in sync and one for `remote-entries.ts`. It communicates with the rest of the app through two narrow interfaces: the entries feature's public API and a typed event bus.

**Tech stack:** React 19, TypeScript (strict), Vite, IndexedDB (via `idb`), Web Crypto API, Zod, BlockNote editor, Tailwind CSS, Vitest.

---

## 2. Architecture Overview

### Where Sync Lives in the App

Sync sits between entries (its data source) and the sidebar:

```
ThemeContext
  └─ EntriesProvider          ← core data layer
       └─ SyncProvider        ← sync orchestration (owns one SyncEngine)
            └─ SidebarProvider
                 └─ FocusModeProvider
                      └─ AIProvider
```

`SyncProvider` calls `useEntriesActions().refresh()` after a pull wrote entries, and calls `getAllEntries`, `getEntry` and `applyRemoteEntries` from the entries public API. The entries layer has no knowledge of sync: it only emits `entry-changed` / `entry-deleted` on the event bus.

### Sync Feature File Map

```
src/features/sync/
├── index.ts                       → Public API (SyncProvider, useSyncContext, StorageSubmenu)
├── types/sync.ts                  → SyncConfig, SyncStatus, SyncEntry, API response types, defaults
├── engine/sync-engine.ts          → SyncEngine: queue, push/pull, change tracking, account lifecycle
├── hooks/useSync.ts               → Creates the engine, binds events + visibility, useSyncExternalStore
├── context/SyncContext.tsx        → React context around useSync, memoized value
├── storage/sync-settings.ts       → SyncConfig and tombstone persistence (settings store), legacy migration
├── utils/
│   ├── sync-operations.ts         → pushEntries() (batched) and pullEntries() (paginated)
│   ├── sync-crypto.ts             → encryptEntry / encryptTombstone / decryptEntry / decryptAll (payload v2 + v1 fallback)
│   ├── crypto.ts                  → sha256Hex, sync ID generation, auth token, PBKDF2, AES-GCM with optional AAD
│   ├── sync-api.ts                → HTTP client, request timeouts, SyncHttpError, isRetryableError
│   ├── server-url.ts              → validateServerUrl(): https required except for loopback hosts
│   └── sync-events.ts             → Thin wrappers around the typed event bus
└── components/
    ├── StorageSubmenu.tsx         → Settings submenu: Local/Remote toggle, entry count, composes the panels below
    ├── RemoteConnectForm.tsx      → Server URL, sync ID input, Generate / Connect
    ├── RemoteConnectedPanel.tsx   → Sync ID (copy), status, last sync time, "Sync now"
    ├── AccountDangerZone.tsx      → Disconnect, delete account (with confirmation)
    └── SyncStatusIndicator.tsx    → Green/blue/red status dot

src/features/entries/storage/
└── remote-entries.ts              → applyRemoteEntries(): LWW merge, one transaction per page, search + backlinks
```

### System Boundary Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser (Device A)                                              │
│                                                                  │
│  ┌──────────────┐   entry-changed    ┌────────────────────────┐  │
│  │  useEntries   │── event bus ──────▶│ SyncEngine             │  │
│  │  (entries     │   entry-deleted    │  dirty map, tombstones │  │
│  │   feature)    │◀── refresh() ──────│  queue, generation     │  │
│  └──────┬───────┘   (remoteRevision)  └───────────┬────────────┘  │
│         │                                         │               │
│  ┌──────▼──────────┐   applyRemoteEntries  ┌──────▼──────────┐    │
│  │ IndexedDB        │◀──────────────────────│ sync-operations │    │
│  │ entries          │                       │ batched push    │    │
│  │ searchIndex      │                       │ paginated pull  │    │
│  │ settings         │                       └──────┬──────────┘    │
│  │  (sync-config,   │                              │               │
│  │   sync-tombstones│                       ┌──────▼──────────┐    │
│  │   backlinksIndex)│                       │ sync-crypto     │    │
│  └─────────────────┘                        │ AES-256-GCM,    │    │
│                                             │ AAD = entry id  │    │
│                                             └──────┬──────────┘    │
└────────────────────────────────────────────────────┼──────────────┘
                                                     │ HTTPS (30s timeout)
                                               ┌─────▼──────┐
                                               │ Sync Server │
                                               │ (opaque     │
                                               │  blob store)│
                                               └─────┬──────┘
                                                     │ HTTPS
┌────────────────────────────────────────────────────┼──────────────┐
│  Browser (Device B)                         ┌──────▼──────┐        │
│                                             │ SyncEngine   │        │
│                                             │ pull →       │        │
│                                             │ decrypt →    │        │
│                                             │ apply        │        │
│                                             └─────────────┘        │
└──────────────────────────────────────────────────────────────────┘
```

The sync server is a separate codebase (`workledger-sync`). From the client's perspective it is an opaque blob store that accepts encrypted payloads, assigns monotonically increasing sequence numbers (`serverSeq`), and returns them in order during pulls. It requires a 64-hex `integrityHash` per entry and rejects request bodies over 1 MB. It cannot decrypt entry content, and with payload v2 it cannot move a ciphertext to another entry id or flip `isDeleted` without decryption failing. Legacy formats are still accepted on read, which leaves some gaps open (section 8, Technical Debt).

---

## 3. Key Concepts and Abstractions

### 3.1 SyncConfig, SyncStatus and SyncState

**SyncConfig** (`types/sync.ts`) is persisted as JSON in the `settings` store under `"sync-config"`. It holds the credentials, the server URL, the mode and the cursors:

```typescript
interface SyncConfig {
  mode: "local" | "remote";
  syncId: string | null;
  salt: string | null;
  serverUrl: string | null;
  lastSyncSeq: number;        // pull cursor, only pull advances it
  lastSyncAt: number | null;  // push cursor, only push advances it
  lastPullAt: number | null;  // last successful pull, display only
}
```

**SyncStatus** is in-memory UI state:

```typescript
interface SyncStatus {
  phase: "idle" | "connecting" | "pushing" | "pulling" | "merging" | "error";
  error: string | null;
  lastSyncAt: number | null;  // most recent successful push or pull, for display
}
```

On start, `status.lastSyncAt` is the larger of `config.lastSyncAt` and `config.lastPullAt`.

**SyncState** is what the engine exposes to React: `{ config, status, remoteRevision }`. `remoteRevision` increments whenever a pull wrote at least one local entry; `useSync` reacts by calling `refresh()` (which also reloads the archive if it is loaded).

`loadSyncConfig()` parses the row with a Zod schema where every field falls back on its own (`.catch(...)`), so one bad or missing field does not reset the account. Unparsable JSON returns the defaults.

### 3.2 The Two Cursors

- **`lastSyncSeq`** (pull cursor): the server-assigned sequence number. Pull asks for `serverSeq > lastSyncSeq` and advances it. **Only pull writes it.**
- **`lastSyncAt`** (push cursor): local clock time taken *before* the last successful push read its entries. Every local change older than this is on the server. **Only push writes it.**
- **`lastPullAt`**: written by pull for display. It exists so that pull no longer has to touch `lastSyncAt`.

Push uses `lastSyncAt` for the recovery scan (`updatedAt > lastSyncAt`, section 3.4). If pull advanced `lastSyncAt`, as the previous implementation did, an edit made before a reload but after the last push would fall below the new `lastSyncAt` and never be pushed. Splitting out `lastPullAt` fixed this.

**Legacy config migration** (`sync-settings.ts`): a stored config without a `lastPullAt` key was written by a pre-v2 client. Loading it sets:

- `lastSyncAt = null`: that client let pulls advance `lastSyncAt`, which may hide unpushed edits, so the next push rescans every entry once.
- `lastSyncSeq = 0`: that client skipped (but moved its cursor past) v2 payloads it could not decrypt, so the next pull starts from the beginning to recover them.

The next config save writes `lastPullAt`, so the migration runs once.

### 3.3 The Queue, Coalescing and the Generation Counter

All network operations run one at a time on a promise chain (`enqueue`). Requests coalesce instead of being dropped:

- `requestPull()`: if a pull is already queued (not yet running), returns the same promise.
- `requestPush(forceAll)`: if a push is already queued, returns its promise and ORs `forceAll` into it, so a "push everything" request is never downgraded by joining a normal push.

A queued slot is released when the task *starts* running, so a request made while an operation is in flight queues a fresh run after it. Nothing is lost while another operation runs.

Every operation captures `generation` at its start. `resetRuntime()` bumps it and clears all timers; it runs on `stop()`, `generateSyncId()`, `connect()`, `disconnect()` and `setMode()`. `assertCurrent(gen)` throws a private `StaleOperationError` before each pull page is applied, between push batches, and before writing results, so a pull that finishes after a disconnect or a switch to Local mode cannot write entries or config.

Config writes are serialized on their own chain (`configWrites`), so an older save never lands after a newer one. `updateConfig()` patches the in-memory config first and then persists the whole current config.

### 3.4 Change Tracking

The engine tracks local changes in three structures:

| Structure | Type | Persisted | Purpose |
|-----------|------|-----------|---------|
| `dirty` | `Map<id, counter>` | no | Entries created or modified since they were last pushed |
| `tombstones` | `Set<id>` | yes, settings row `sync-tombstones` | Entries deleted locally and not yet pushed |
| `scanPending` | `boolean` | no | Next push also sends every entry with `updatedAt > lastSyncAt` |

**Change counters.** `notifyChanged(id)` stores `++changeCounter` for the id. A push snapshots the map before reading entries and, after each accepted batch, removes an id only if its counter is still the one in the snapshot. An edit made while the request was in flight has a newer counter and stays dirty.

**`syncedAt` before reading.** Push takes `syncedAt = Date.now()` before collecting entries and writes it to `lastSyncAt` on success. Anything edited after that point has a newer `updatedAt` and is caught by the dirty map or the next scan.

**Recovery scan.** The dirty map is lost on reload. `activate()` (startup, switching back to Remote, connect, new account) sets `scanPending = true`, so the first push also sends every entry with `updatedAt > lastSyncAt` (or every entry when `lastSyncAt` is null). The scan is cleared only after a successful push.

**Persisted tombstones.** A deleted entry's row is gone, so nothing could reconstruct the delete after a reload. `notifyDeleted(id)` removes the id from `dirty`, adds it to `tombstones` and persists the set. `notifyChanged(id)` removes a pending tombstone for that id. Tombstones are removed from the set only after the batch containing them was accepted.

**Tombstone write coalescing.** "Delete all" emits one `entry-deleted` per entry. `persistTombstones()` queues at most one pending write: the queued write snapshots the set when it starts, so all calls made before then share it instead of queueing N full-set writes. Writing an empty set deletes the row.

**When changes are recorded.** `tracksChanges()` is true before the config has loaded (changes are recorded and discarded on load if there is no account) and whenever an account exists (`syncId` set). Local mode with an account still records changes and tombstones; `schedulePush()` does nothing until the engine is connected again, and switching back to Remote pushes them. Without an account nothing is recorded.

**Pending deletes win against older server copies.** During pull, remote entries whose id is in `tombstones` are filtered out before `applyRemoteEntries`, so a pending local delete is not undone by a server copy the push has not overwritten yet.

### 3.5 The Event Bus

Cross-feature communication uses the typed in-memory pub/sub in `src/utils/events.ts` (a `Map<string, Set<handler>>` with synchronous dispatch). Sync consumes two events:

| Event | Emitted by | Engine handler |
|-------|------------|----------------|
| `entry-changed` | `useEntries`: create, content save, tags, pin, signifier, archive, unarchive; `importEntries()` per imported entry | `notifyChanged`: mark dirty with a new counter, drop pending tombstone, schedule push |
| `entry-deleted` | `useEntries`: delete; delete-all emits one per entry | `notifyDeleted`: drop from dirty, add tombstone, persist, schedule push |

`useSync` subscribes once in a mount effect, independent of mode. Gating happens inside the engine (`tracksChanges()`, `isConnected()`). A new mutation path that skips these events never syncs.

`applyRemoteEntries` writes directly to IndexedDB and emits no events, so pulled entries are not echoed back as local changes.

### 3.6 The Encryption Envelope

Summary only; [ENCRYPTION.md](ENCRYPTION.md) has the details.

1. **Sync ID**: `wl-` plus 20 hex chars from 10 random bytes. The only secret.
2. **Auth token**: `SHA-256("auth:" + syncId)`, sent as `X-Auth-Token`.
3. **Key**: `SHA-256("crypto:" + syncId)` as PBKDF2 input, 100,000 iterations, server salt, AES-256-GCM, non-extractable.
4. **Payload v2**: JSON with `v: 2`, `id`, `isDeleted` and the entry fields, encrypted with AES-GCM using `workledger:entry:<id>` as additional data. Tombstones are encrypted the same way (`{ v, id, isDeleted: true, updatedAt }`).
5. **Wire entry**:

```typescript
interface SyncEntry {
  id: string;                 // plaintext, bound to the ciphertext via AAD
  updatedAt: number;          // plaintext; the client uses the encrypted copy for v2
  isArchived: boolean;        // plaintext; the client uses the encrypted copy
  isDeleted: boolean;         // plaintext; must match the encrypted flag for v2
  encryptedPayload: string;   // base64(IV || ciphertext || tag)
  integrityHash: string;      // SHA-256 hex of encryptedPayload (server requires 64 hex)
  serverSeq?: number;         // assigned by the server, present in pull responses
}
```

Decryption tries v2 first and falls back to the legacy v1 format (no AAD, no `v` key), so data already on servers still reads. Empty unauthenticated tombstones from older clients are still accepted.

### 3.7 Merge Semantics

`applyRemoteEntries(remote)` (`entries/storage/remote-entries.ts`) applies one decrypted page:

1. **Validate first.** Each non-deleted entry goes through `validateEntry({ ...data, id: r.id })` (Zod, `.strip()`). The transport id always wins over any id inside the payload; unknown keys such as `v` and `isDeleted` are stripped. Invalid entries are logged and skipped.
2. **One transaction** over `entries` and `searchIndex` for the whole page. Thousands of per-entry transactions made initial sync slow, and a partially applied page can no longer be left behind.
3. **Deletion:** if a local copy exists, delete it and its search row. Deletions win regardless of timestamps.
4. **Upsert:** skip if a local copy exists and `remote.updatedAt <= local.updatedAt` (strict `>` to overwrite, equal timestamps keep local). Otherwise write the entry; archived entries have their search row deleted, active entries get `toSearchRow(entry)`.
5. **Backlinks after the transaction:** `updateBacklinksBatch()` for all upserts (one parse and write of the single `backlinksIndex` settings row), then `removeFromBacklinks()` per deleted id.

It returns the number of local entries that changed. The engine sums it per pull and bumps `remoteRevision` if it is above zero, even when the pull fails on a later page, so already written entries reach the UI.

---

## 4. Component Deep-Dives

### 4.1 SyncEngine: The State Machine

**Location:** `src/features/sync/engine/sync-engine.ts` (582 lines)

**Dependencies (injected):** `api: SyncApi`, `storage: SyncStorage`, `entries: { getAllEntries, getEntry, applyRemoteEntries }`, `isVisible()`. Tests pass fakes for all four.

**Options (`SyncOptions`, defaults in `DEFAULT_SYNC_OPTIONS`):** pull interval, push debounce, retry delays, request timeout, pull page size, batch limits, bulk read threshold (section 9.3).

**Private state:**

| Field | Purpose |
|-------|---------|
| `state` | `{ config, status, remoteRevision }`, published to subscribers on every change |
| `loaded` | Config and tombstones have been loaded |
| `credentials` | `{ key: CryptoKey, token }`, memory only |
| `generation` | Bumped by `resetRuntime()`; stale operations compare against it |
| `queue`, `queuedPull`, `queuedPush` | Serial operation queue and coalescing slots |
| `dirty`, `changeCounter` | Change tracking (section 3.4) |
| `tombstones` | Pending deletes, mirrored to settings row `sync-tombstones` |
| `scanPending`, `forceAllPending`, `fullPullPending` | Flags that survive a failed operation so the retry does the same work |
| `pullTimer`, `pushTimer`, `retryTimer`, `retryCount` | Timers |
| `configWrites`, `tombstoneWrites`, `tombstoneWriteQueued` | Serialized persistence chains |

**Lifecycle:**

```
start():
  gen = ++generation
  load config + tombstones in parallel
  if gen changed meanwhile: return
  loaded = true; merge tombstones; publish config
  if no syncId: clear dirty + tombstones, persist (empty → row deleted)
  activate()

activate():
  if not connected (mode remote + syncId + salt): return
  derive key + auth token (once; cached in credentials)
    on failure: status error "Could not derive sync key: ..."
  scanPending = true
  requestPush(); requestPull()       ← queued in this order
  start pull interval

stop(): resetRuntime()                ← called on unmount
```

**Push (`runPush`):**

```
forceAll = requested || forceAllPending
scan     = forceAll || scanPending
syncedAt = Date.now()
snapshot dirty map and tombstones
status "pushing"
collect entries:
  forceAll                          → all entries
  scan or dirty.size > 200          → getAllEntries() filtered to dirty ids (+ updatedAt > lastSyncAt if scan)
  otherwise                         → getEntry(id) per dirty id
  minus ids in the tombstone snapshot
if anything to send: pushEntries() in batches; after each batch mark sent ids pushed
mark remaining snapshot ids pushed (dirty ids whose entry no longer exists)
scanPending = false; forceAllPending = false (if forceAll); retryCount = 0
lastSyncAt = syncedAt (persisted)
status idle; error "N entries are too large to sync" if any were rejected
```

On failure: persist tombstones (partial batch progress), keep `forceAllPending` if this was a `forceAll` push, set status error, and if `isRetryableError(err)` and retries remain, schedule `requestPush()` after the next delay (5s, 15s, 30s, 60s). A new local change (`schedulePush`) cancels the retry timer and resets the retry count.

**Pull (`runPull`):**

```
since = fullPullPending ? 0 : lastSyncSeq   (fullPullPending cleared)
status "pulling"
pullEntries(): per page → status "merging", decrypt, assertCurrent,
               drop ids with pending tombstones, applyRemoteEntries
assertCurrent
lastSyncSeq = cursor, lastPullAt = now (persisted)
status idle, lastSyncAt = now
finally: if any entry changed, remoteRevision++
```

On failure: restore `fullPullPending` if this was a full pull, set status error. There is no pull retry timer; the next interval or visibility pull retries. Pages already applied stay applied; because the cursor was not saved, the next pull re-fetches them and LWW makes re-applying them a no-op.

### 4.2 useSync and SyncContext: React Binding

**Location:** `hooks/useSync.ts` (55 lines), `context/SyncContext.tsx` (35 lines)

`useSync` creates one engine per mount (`useState(createEngine)`) with `httpSyncApi`, `idbSyncStorage`, the entries storage functions and `document.visibilityState === "visible"`. A mount effect calls `engine.start()`, subscribes `onEntryChanged` / `onEntryDeleted`, and adds a `visibilitychange` listener that calls `engine.onVisible()`. Cleanup calls `engine.stop()` and unsubscribes. A second effect calls `refresh()` whenever `remoteRevision` changes (skipping 0).

State is read with `useSyncExternalStore(engine.subscribe, engine.getState)`. The engine's public methods are arrow-function properties, so their identity is stable and the context's `useMemo` only changes when `config` or `status` change.

`SyncContextValue` exposes `config`, `status`, `generateSyncId`, `connect`, `disconnect`, `deleteAccount` (resolves `false` when the server delete failed), `setMode`, `setServerUrl` (resolves to an error message when the URL is rejected) and `syncNow`.

### 4.3 sync-operations.ts: Batched Push, Paginated Pull

**Location:** `src/features/sync/utils/sync-operations.ts` (132 lines)

#### pushEntries()

Encrypts and sends entries in batches. Encrypting per batch keeps memory flat for large notebooks.

- **Order:** tombstones first, then entries.
- **Tombstone time:** every tombstone in the call gets `updatedAt = Date.now()` at push time. An older timestamp could lose LWW on the server against the entry's own last edit and leave it alive there.
- **Batch limits:** a batch is flushed before adding an entry if it already holds `maxEntries` (100) or adding the entry would exceed `maxBytes` (900,000, measured as `JSON.stringify(entry).length + 1` per entry). The reference server rejects bodies over 1 MB.
- **Progress:** `onBatchPushed(ids)` runs after each accepted batch, so a failure in a later batch keeps the earlier progress. `assertCurrent()` runs before each batch.
- **Oversized entries:** entries whose encrypted payload exceeds `maxPayloadChars` (default 700,000, the server's per-entry cap) are marked rejected and pushed without being sent. If the server still answers a batch with 413 (one oversized entry fails the whole batch, or its limits are lower), the batch is split in half recursively until the culprit is alone; a single-entry 413 marks that entry rejected and pushed. It would never be accepted, so it must not block later pushes. Any other error is rethrown.
- The push response body (`{ serverSeq }`) is not used.

#### pullEntries()

```typescript
let since = params.since;
for (;;) {
  const res = await api.pullEntries(ctx, token, since, pageSize);
  if (res.entries.length > 0) {
    onMerging?.();
    merged += await apply(await decryptAll(key, res.entries));
    const lastSeq = res.entries[res.entries.length - 1].serverSeq;
    if (res.hasMore && (lastSeq === undefined || lastSeq <= since)) {
      return { cursor: since, merged };        // stuck: keep the per-page cursor
    }
    if (lastSeq !== undefined && lastSeq > since) since = lastSeq;
  }
  if (!res.hasMore) return { cursor: Math.max(since, res.serverSeq), merged };
}
```

Invariants:

1. **Per-page cursor.** Advance to the last entry's `serverSeq`, not `res.serverSeq` (the global maximum), which would skip intermediate pages.
2. **Stuck cursor guard.** If `hasMore` is true but the cursor did not advance, stop and return the per-page cursor. Returning the global seq here would permanently skip the remaining pages.
3. **Catch-up on the last page.** When `hasMore` is false, the cursor becomes `max(since, res.serverSeq)`. The server returns the last page and its seq atomically.
4. **Decrypt before apply.** `decryptAll` decrypts a page in parallel and logs and skips entries that fail. If the request or decryption step throws, nothing from that page is applied.

### 4.4 remote-entries.ts: Applying Remote Entries

**Location:** `src/features/entries/storage/remote-entries.ts` (73 lines)

Section 3.7 covers the algorithm. It lives in the entries feature because it must keep every derived index (search, backlinks) in step with the entries store, and those are entries internals. `RemoteEntry.data` is typed `unknown` and treated as untrusted until `validateEntry` passes.

The search row and entry write share one transaction. The backlinks update runs after `tx.done`, as a separate write to the `backlinksIndex` settings row.

### 4.5 sync-crypto.ts and crypto.ts

**Location:** `utils/crypto.ts` (87 lines), `utils/sync-crypto.ts` (119 lines)

- `crypto.ts`: `sha256Hex`, `generateSyncIdLocal`, `computeAuthToken`, `deriveKey`, and `encrypt` / `decrypt` with an optional `additionalData` string passed to AES-GCM.
- `sync-crypto.ts`: `encryptEntry`, `encryptTombstone`, `decryptEntry`, `decryptAll`. New writes are always v2; `decryptPayload` tries v2 (with AAD, `v === 2`, payload `id` must match), then the legacy format (no AAD; rejected if it contains a `v` key). `integrityHash` is `sha256Hex(encryptedPayload)`.

See [ENCRYPTION.md](ENCRYPTION.md) sections 3.5 and 4.

### 4.6 sync-api.ts and server-url.ts: The HTTP Layer

**Location:** `utils/sync-api.ts` (99 lines), `utils/server-url.ts` (18 lines)

| Function | Method | Path | Response |
|----------|--------|------|----------|
| `apiCreateAccount` | POST | `/api/v1/accounts` | `{ salt }` |
| `apiValidateAccount` | GET | `/api/v1/accounts/validate` | `{ valid, salt }` |
| `apiDeleteAccount` | DELETE | `/api/v1/accounts` | (ignored) |
| `apiPushEntries` | POST | `/api/v1/sync/push` | `{ serverSeq }` (unused) |
| `apiPullEntries` | GET | `/api/v1/sync/pull?since=N&limit=M` | `{ entries, serverSeq, hasMore }` |

The client no longer calls `/sync/full`.

Every call takes an `ApiContext { serverUrl, timeoutMs }`. The base URL is `serverUrl`, else `VITE_SYNC_SERVER_URL`, else `https://sync.workledger.org`; trailing slashes are stripped. Requests send `Content-Type: application/json`, `X-Auth-Token` when authenticated, and `signal: AbortSignal.timeout(timeoutMs)` (default 30s). Without a timeout a stalled connection never settled and blocked the queue forever.

Non-2xx responses throw `SyncHttpError(status, "Sync server error <status>: <body>")`. `isRetryableError(err)`:

| Error | Retryable |
|-------|-----------|
| `SyncHttpError` 408, 429, 5xx | yes |
| `SyncHttpError` other 4xx | no |
| Anything else (network failure, timeout `AbortSignal` error) | yes |

`validateServerUrl(url)` accepts `https:` URLs and `http:` only for `localhost`, `127.0.0.1` and `[::1]`. Plain http would expose the auth token and entry metadata on the wire. `engine.setServerUrl()` and `RemoteConnectForm` both validate; an invalid URL keeps the form from generating or connecting.

### 4.7 The Settings UI

`StorageSubmenu` renders the Local/Remote toggle (disabled while `phase === "connecting"`), the entry count (read with `getAllEntryIds()` and re-read when `status.lastSyncAt` changes), and one of:

- **Local mode:** "Data stored in your browser only", plus a note that the sync ID stays saved and switching back sends the changes made meanwhile, if an account exists.
- **Remote, not connected** (`RemoteConnectForm`): collapsible server endpoint field (validated on blur and before Generate/Connect), sync ID input validated against `^wl-[0-9a-f]{20}$`, Generate and Connect buttons, error display.
- **Remote, connected** (`RemoteConnectedPanel` + `AccountDangerZone`): copyable sync ID, `SyncStatusIndicator`, last sync time, "Sync now" (disabled while syncing), server URL, Disconnect, and Delete account behind a confirmation. If the server delete fails, the confirmation stays open and shows the error.

`SyncStatusIndicator` shows red "Error" for `phase === "error"`, blue pulsing "Syncing..." for any other non-idle phase, and green "Synced" when idle.

---

## 5. Data Flow and Lifecycle

### 5.1 User Edit → Push to Server

```
User types in BlockNote editor
  │
  ▼
EntryEditor onChange (ignored while applying an external update)
  → useAutoSave.handleChange(editor)
  │
  ▼ (500ms debounce; also flushed on unmount, pagehide and tab hide)
useAutoSave save():
  records the blocks array as an own save, notes the save start time
  onSave(entryId, blocks) → useEntries.saveEntryContent()
     patchEntry() → IndexedDB (new updatedAt)
     update in-memory state, search index (if not archived), backlinks
     emit("entry-changed", { entryId })
  │
  ▼ (synchronous, event bus)
SyncEngine.notifyChanged(entryId):
  drop pending tombstone for this id (if any)
  dirty.set(entryId, ++changeCounter)
  schedulePush(): reset 2s timer, cancel retry timer
  │
  ▼ (2000ms debounce)
requestPush() → queued → runPush()
  syncedAt = now; snapshot dirty + tombstones
  getEntry(id) per dirty id (or full read, see 4.1)
  pushEntries(): encrypt v2 → POST /sync/push in batches of ≤100 / ≤900 KB
  clear only ids whose counter is unchanged
  lastSyncAt = syncedAt → settings row "sync-config"
  status idle
```

**Latency:** about 2.5 seconds plus network time (500ms auto-save debounce + 2000ms push debounce). Rapid typing resets both debounces.

**Reload in between:** the auto-save flush on `pagehide` writes the entry. On the next start the dirty map is empty, but `activate()` sets `scanPending`, and the scan finds the entry because its `updatedAt` is newer than `lastSyncAt`.

### 5.2 Pull Interval → UI Update

```
setInterval (30s) fires; requestPull() only if the document is visible
  (visibilitychange → visible also calls requestPull())
  │
  ▼
runPull():
  status "pulling"
  pullEntries():
    GET /sync/pull?since={lastSyncSeq}&limit=100
    if entries:
      status "merging"
      decryptAll (parallel, skip failures)
      assertCurrent(gen)
      filter ids with pending tombstones
      applyRemoteEntries(page)  → one IDB transaction + backlinks
      advance cursor to last entry's serverSeq
    repeat while hasMore
  lastSyncSeq = cursor, lastPullAt = now → "sync-config"
  status idle, lastSyncAt = now
  if anything changed: remoteRevision++
  │
  ▼
useSync effect([remoteRevision]) → refresh()
  loadActiveSnapshot(recent 30 days + extra days, archive if loaded)
  → new entriesByDay / dayKeys / archivedEntries state
  │
  ▼
EntryStream re-renders; EntryCard (React.memo) re-renders for changed entry objects
  → EntryEditor receives a new entry.blocks reference (section 5.5)
```

Unlike the previous `hadEntries` logic, the UI is refreshed only when entries actually changed; the status timestamp updates through `setStatus` independently.

### 5.3 connect(): Initial Reconciliation

```
connect(syncId):
  resetRuntime(); gen = generation; previous = config
  status "connecting"
  token = SHA-256("auth:" + syncId)
  GET /accounts/validate → { valid, salt }
    if !valid: status error "Invalid sync ID", return false
  key = deriveKey(syncId, salt)
  assertCurrent(gen)
  resetAccountState({ key, token })   ← clear dirty, tombstones, flags; scanPending = true
  config = { mode: "remote", syncId, salt, lastSyncSeq: 0, lastSyncAt: null, lastPullAt: null }
  ok = await requestPull() && await requestPush(true)
       full pull from seq 0, then batched push of every local entry
  assertCurrent(gen)
  if !ok:
    keep the error message
    resetRuntime(); resetAccountState(null); restore previous config
    status error; return false
  start pull interval; return true
```

The previous implementation sent every local entry in one `/sync/full` request, which overflowed the server's 1 MB body limit for large notebooks. Pull-then-push uses the regular paginated pull and batched push.

The account is not considered connected until the first reconciliation succeeds: on failure the previous config is restored.

### 5.4 generateSyncId(): New Account

```
generateSyncId():
  resetRuntime(); status "connecting"
  syncId = generateSyncIdLocal(); token = computeAuthToken(syncId)
  POST /accounts → { salt }
  key = deriveKey(syncId, salt)
  resetAccountState({ key, token }); forceAllPending = true
  config = { mode: "remote", syncId, salt, lastSyncSeq: 0, lastSyncAt: null, lastPullAt: null }
  status idle
  activate() → push(forceAll) uploads every existing local entry, then pull
  return syncId
```

The new account is empty, so every local entry must be uploaded. The previous implementation triggered no push here.

### 5.5 Synced Content Reaching the Editor

`EntryEditor` creates the BlockNote editor once per `entry.id` and applies later content changes in place. External update detection is keyed on the **blocks array reference**, not on `updatedAt`:

```
useEffect([entry.blocks]):
  incoming = entry.blocks
  if incoming === appliedBlocksRef.current: return     ← same content the editor already reflects
  if isOwnOrOlder(incoming, entry.updatedAt): return   ← this editor's own save, or older than its last save
  if isPending(): return                               ← unsaved typing or a save in flight wins
  appliedBlocksRef.current = incoming
  if JSON equal to editor.document: return
  applyingExternalRef = true
  editor.replaceBlocks(editor.document, incoming)
  applyingExternalRef = false
```

Why each guard exists:

- **Blocks reference.** Metadata changes (tags, pin, signifier) go through `patchMetadata`, which keeps the in-memory blocks reference, so they never replace content. A refresh that delivers newer stored blocks gets a new array from IndexedDB and is applied even if `updatedAt` looks unchanged.
- **`isOwnOrOlder`** (`useAutoSave`): every saved array is kept in a `WeakSet`, because saves can resolve out of order and remembering only the last one would let an older save look external and revert newer typing. Content stamped before the last save started is older than what this editor already wrote.
- **`isPending`**: true while the debounce timer is set or a save is in flight. The pending save will write a newer version.
- **`applyingExternalRef`**: `replaceBlocks` fires `onChange` synchronously. Saving it would echo pulled content back to sync with a fresh timestamp, so `onChange` is ignored while it runs.

---

## 6. Cross-Cutting Concerns

### 6.1 Re-render Behavior

- **Engine state changes** (`setState` / `setStatus`) notify `useSyncExternalStore`, re-rendering `SyncProvider`. The memoized context value changes only when `config` or `status` change, so consumers (`StorageSubmenu` and its panels, `SyncStatusIndicator`) re-render on phase transitions. Nothing outside the sync UI consumes `useSyncContext()`.
- **Entries refresh after pull** happens only when `remoteRevision` changes, that is when at least one local entry was written. It replaces the entries data context value, so `useEntriesData()` consumers re-render; `EntryCard` is wrapped in `React.memo` and skips entries whose object did not change.
- **Actions context** (`useEntriesActions`) is stable, so `useSync`'s effect on `refresh` does not re-run.

### 6.2 Error Handling and Retry

| Failure | Handling |
|---------|----------|
| Push: network error, timeout, 408, 429, 5xx | Status error; retry after 5s, 15s, 30s, 60s. A new local change cancels the retry and schedules a normal debounced push. After 4 retries, the next change or activation pushes again |
| Push: other 4xx | Status error, no retry |
| Push: entry over `maxPayloadChars`, or 413 for a batch | Over-limit entries are skipped before sending; a 413 batch is split until the oversized entry is alone, which is then skipped and marked pushed; status idle with "N entries are too large to sync" |
| Push: failure after some batches | Earlier batches stay marked pushed; `forceAll` is kept pending for the retry |
| Pull: any error | Status error; the next interval or visibility pull retries. A failed full pull stays pending |
| Decryption failure (per entry) | Logged and skipped (`decryptAll`) |
| Validation failure (per entry) | Logged and skipped (`applyRemoteEntries`) |
| Key derivation failure | Status error "Could not derive sync key: ..." |
| Loading settings fails | Status error "Failed to load sync settings" |
| Saving config or tombstones fails | `console.warn`; in-memory state stays current |
| `deleteAccount`: server error | Status error, returns `false`, account stays connected. 404 counts as success |
| `connect`: reconciliation fails | Previous config restored, error kept |
| Stale operation (generation changed) | Result dropped silently |

### 6.3 Visibility-Aware Sync

1. **Pull interval guard:** the 30-second interval always runs, but only calls `requestPull()` when `isVisible()` returns true.
2. **Visibility listener:** when the tab becomes visible, `onVisible()` requests a pull if credentials exist and the engine is connected.

Push is not affected by visibility. `useAutoSave` also flushes pending saves when the tab is hidden, which emits `entry-changed` and schedules a push.

---

## 7. Bug Archaeology

The sync feature went through a rapid series of fixes in v2.2.1 through v2.2.3, and a rewrite in the release after v3.2.5 (section 7.7). Sections 7.1 to 7.6 describe the old implementation; notes mark where the mechanism has since been replaced.

### 7.1 The Cursor Advancement Bug (v2.2.1, commit 01145d4)

**Symptom:** Entries synced from Device A silently failed to appear on Device B.

**Root cause:** The original `pullEntries()` used `res.serverSeq` (the global maximum sequence number from the API response) to advance the pagination cursor, instead of using the last entry's `serverSeq`. During a paginated pull with `limit=100`, the first page would advance the cursor to the global max, causing the second page request to return nothing. Entries in pages 2+ were silently skipped.

**Fix:** Advance the cursor to `lastEntry.serverSeq` per page, and only use the global `serverSeq` after all pages are processed. Still the rule today (section 4.3).

### 7.2 The Push-Advances-Pull-Cursor Bug (v2.2.1, commit 01145d4)

**Symptom:** Same as above: entries lost during cross-device sync.

**Root cause:** An earlier version of `push()` updated both `lastSyncAt` and `lastSyncSeq` in the config. This caused the pull cursor to jump forward past entries that other devices had pushed between the last pull and this push.

**Fix:** Push only updates `lastSyncAt`. Pull only updates `lastSyncSeq`. The other half of this rule (pull must not write `lastSyncAt`) was only enforced in the rewrite (section 7.7).

### 7.3 The Race Condition (v2.2.2, commits fe5e7a4 and 436c3e2)

**Symptom:** Overlapping push and pull operations corrupted the sync config, causing subsequent syncs to skip entries or re-sync everything.

**Root cause:** The boolean mutex was released before the config was saved to IndexedDB, so a pull could start between mutex release and config save and read stale cursor values. Also, `configRef.current` was not re-read after the async operations, so push could overwrite cursor values that pull had just updated.

**Fix (then):** re-read `configRef.current` when building the updated config, and hold the mutex through the config save.

**Superseded:** the mutex and `configRef` are gone. The engine's serial queue, in-memory config patched by `updateConfig()`, and the serialized `configWrites` chain replace them (section 3.3).

### 7.4 The Infinite Loop (v2.2.2, commit 436c3e2)

**Symptom:** Pull requests looped indefinitely, hammering the server.

**Root cause:** If entries in a pull response lacked `serverSeq` fields, the cursor never advanced and `hasMore` stayed true.

**Fix:** Stuck cursor detection: stop the loop with a warning. The rewrite also returns the per-page cursor in that case instead of the global seq (section 4.3).

### 7.5 The Stale UI Chain (v2.2.3, commits c54be58, 712d370, 2e0a882, ad0b142)

Four related bugs that manifested as "synced entries don't show up in the editor."

**Bug A: refresh() only called on merge** (c54be58). `refresh()` ran only when `mergeCount > 0`, so the status display did not update when all received entries were older. Fix then: track `hadEntries`. *Superseded:* status updates are independent of entry reloads, and `refresh()` runs only when `remoteRevision` changes (section 5.2).

**Bug B: Context value not memoized** (712d370, ad0b142). Every status change created a new context value and re-rendered every consumer. Fix: `useMemo` on the context value in `SyncContext.tsx`. Still in place.

**Bug C: Editor not updating on sync** (712d370, ad0b142). The editor is created with `useCreateBlockNote(..., [entry.id])`, so new content never reached it. Fix then: `useEffect([entry.updatedAt])` calling `replaceBlocks()` with a `lastSavedAtRef` guard. *Superseded:* detection is now keyed on the blocks reference with `isOwnOrOlder` and `isPending` guards (section 5.5). This release also fixed "changing tags, pin or signifier while typing reverted the unsaved text", which the reference check covers: metadata patches keep the blocks reference.

**Bug D: Zod rejects archived entries** (2e0a882). Strict parsing rejected entries with an obsolete `archivedAt` field. Fix: `.strip()`. Still in place; the v2 payload relies on it to drop `v` and `isDeleted`.

### 7.6 The Integrity Hash Bug (v2.2.1, commit 01145d4)

**Symptom:** Console warnings about integrity hash mismatches during pull, though entries synced correctly.

**Root cause:** The hash was computed with `sortedStringify()` on the encryption side and `JSON.stringify()` on the verification side, so the hash inputs differed.

**Fix (then):** plain `JSON.stringify()` on both sides, mismatch downgraded to a warning because AES-GCM already authenticates.

**Superseded:** the plaintext hash and `integrity.ts` are gone. A plaintext hash leaked content equality to the server. `integrityHash` is now SHA-256 of the ciphertext, sent only because the server requires it, and never verified by the client.

### 7.7 The Sync Rewrite (Unreleased)

The `SyncEngine` rewrite fixed these bugs (CHANGELOG `[Unreleased]`, Sync lines):

| Bug | Root cause | Fix |
|-----|------------|-----|
| Edits made during an in-flight push, or just before a reload, were never pushed | Push cleared the whole dirty set after the request; pull wrote `lastSyncAt`, hiding pre-reload edits from the scan; the scan only ran when the dirty set was empty | Change counters, `syncedAt` taken before reading, `lastPullAt` for pull, scan on every activation (3.4) |
| Deletes made before a reload or in Local mode came back from the server | Deleted ids lived in an in-memory set; Local mode removed event listeners and cleared the sets | Tombstones persisted in `sync-tombstones`, recorded in Local mode, and pulled copies of tombstoned ids are not applied |
| A new account never uploaded existing entries | `generateSyncId()` saved config but triggered no push | `forceAllPending` on account creation |
| Disconnect or account deletion during a pull was undone when the pull finished | Pull wrote `{ ...capturedConfig, ... }` after its awaits | Generation counter, `assertCurrent` before apply and before writes |
| A hung request blocked sync until reload; 408/429 were not retried | No fetch timeout; retry policy parsed error messages | `AbortSignal.timeout`, `SyncHttpError` with status, `isRetryableError` |
| "Sync now" lost its full push when another sync was running | A blocked push rescheduled itself without `forceAll`; a blocked pull was dropped | Coalescing queue keeps `forceAll`; `fullPullPending` survives |
| Large notebooks failed to push | One request for all dirty entries, and `/sync/full` in connect, exceeded the 1 MB body limit | Batched push (100 entries / 900 KB); connect is pull plus batched push |
| Merged entries did not update backlinks; archived entries appeared in search on other devices | Merge only wrote entries and search rows, indexing archived entries too | `applyRemoteEntries` keeps search and backlinks in step and keeps archived entries out of search |
| Deleting the server account failed silently and disconnected anyway | Errors were swallowed | `deleteAccount` returns `false` and stays connected; 404 counts as success |

Related changes in the same release: payload v2 (AAD-bound ids, encrypted tombstones), ciphertext `integrityHash`, https requirement for self-hosted URLs, the legacy config migration (3.2), and the editor's external update detection (5.5).

---

## 8. Design Decisions and Tradeoffs

### Decision: A Plain Engine Class Instead of Hook Logic

**Context:** The old `useSync` kept state in refs and closures, which produced stale-closure bugs (`configRef`) and was hard to test without rendering.

**Decision:** `SyncEngine` owns all state and timers, takes its dependencies as constructor arguments, and exposes `subscribe` / `getState` for `useSyncExternalStore`.

**Tradeoffs:** Tests drive the engine directly with fake API, storage and entries (`engine/__tests__/sync-engine.test.ts`). The engine duplicates a small store mechanism instead of using React state.

### Decision: Serial Coalescing Queue Instead of a Mutex

**Context:** The boolean mutex dropped blocked pulls and rescheduled blocked pushes without their `forceAll` flag.

**Decision:** One promise-chain queue; at most one queued pull and one queued push, with `forceAll` merged.

**Tradeoffs:** Push and pull never overlap, so a long pull delays a push (and the other way around). Requests are never dropped, and the number of queued operations is at most two.

### Decision: Change Counters Plus a Recovery Scan, Persisted Tombstones Only

**Context:** Dirty state could be persisted per keystroke, kept in memory, or reconstructed.

**Decision:** Dirty ids stay in memory (`Map<id, counter>`), reconstructed after reload by the `updatedAt > lastSyncAt` scan. Tombstones are persisted because a deleted row leaves nothing to scan.

**Tradeoffs:** No IndexedDB write per edit. The scan does a full `getAllEntries()` once per activation. It depends on the local clock moving forward: an entry saved while the clock was behind `lastSyncAt` is not found by the scan (it is still pushed in the same session through the dirty map).

### Decision: Encryption Key Derived from Sync ID

**Context:** The sync ID is both account identifier and encryption secret. Alternatives: separate password, server-managed keys, device keys with key exchange.

**Decision:** Single sync ID → SHA-256 domain separation (`"auth:"`, `"crypto:"`) → PBKDF2 with server salt.

**Tradeoffs:** One string to keep, but it must be treated as a password; compromise breaks both authentication and encryption. 80 bits of entropy plus 100,000 PBKDF2 iterations. There is no recovery if it is lost.

### Decision: Last-Writer-Wins with Delete Priority

**Context:** Concurrent edits on different devices conflict. Options: CRDTs, operational transforms, server-side merge, LWW.

**Decision:** `remote.updatedAt > local.updatedAt` overwrites; deletions always win.

**Tradeoffs:** Concurrent edits to the same entry lose the older one silently. A delete on one device removes the entry everywhere, even if another device edited it later. For a personal notebook with typically one active device, conflicts are rare.

### Decision: Separate Pull and Push Cursors, Plus `lastPullAt`

**Decision:** `lastSyncSeq` (pull only), `lastSyncAt` (push only), `lastPullAt` (pull, display only).

**Tradeoffs:** Three fields instead of one, but each has one writer. Mixing them caused silent entry loss twice (7.2 and 7.7).

### Decision: Pull Then Batched Push for Connect

**Context:** `/sync/full` sent everything in one request.

**Decision:** Connect is a full pull from seq 0 followed by a `forceAll` push, reusing the regular paths.

**Tradeoffs:** More requests, but no body limit, progress survives partial failure, and there is one code path for transfers.

### Decision: Payload v2 with v1 Read Fallback

**Context:** v1 payloads did not bind ciphertext to the entry id and sent tombstones unencrypted, so the server could swap payloads between ids or forge `isDeleted`.

**Decision:** Write v2 only; read v1 for existing data.

**Tradeoffs:** Existing server data keeps working without a migration. Clients older than this version cannot decrypt v2 entries and skip them (moving their cursor past them); the legacy config migration re-pulls from seq 0 once such a client updates.

### Technical Debt and Risks

1. **Old clients can't read v2.** A device still on an older version logs decrypt failures and skips every entry written by an updated device, until it updates.
2. **Legacy formats are still accepted.** Empty, unauthenticated tombstones (`isDeleted: true`, empty payload) are accepted for compatibility with older clients, so a malicious server can still delete any entry on a client. v1 payloads decrypt without AAD, so the server can also serve any v1 ciphertext it still holds under a different id. Both stay open until legacy support is dropped.
3. **Backlinks index is a single settings row.** `backlinksIndex` is one JSON blob, parsed and rewritten per batch. It is updated after the entries/search transaction, not inside it, so a crash in between leaves backlinks stale until the entry is saved again. Remote deletes update it one id at a time.
4. **Push response is ignored.** The client does not inspect the server's push response; conflict handling is entirely the server's LWW plus the client's LWW on pull.
5. **No cross-tab coordination.** Each tab runs its own engine with its own dirty map and queue. Tombstone and config writes from two tabs overwrite each other's rows.
6. **Retry state is in memory.** Retries and the dirty map are lost when the tab closes; the next session's recovery scan and persisted tombstones cover them.
7. **Clock dependence.** LWW and the recovery scan compare local `Date.now()` values across devices and sessions. Clock skew can make an older edit win or hide an edit from the scan.
8. **Rejected entries are not retried.** An entry the server refuses with 413 is marked pushed. It is sent again only after its next edit or a `forceAll` push.

---

## 9. Appendix

### 9.1 Glossary

| Term | Definition |
|------|-----------|
| **Sync ID** | `wl-` plus 20 hex characters (10 random bytes). Account identifier and encryption secret. |
| **Auth token** | `SHA-256("auth:" + syncId)`, sent in `X-Auth-Token`. The server stores this, never the sync ID. |
| **serverSeq** | Monotonically increasing integer the server assigns to each stored entry. Pull pagination cursor. |
| **SyncEntry** | Wire format: `{ id, updatedAt, isArchived, isDeleted, encryptedPayload, integrityHash, serverSeq? }`. |
| **RemoteEntry** | Decrypted entry handed to `applyRemoteEntries`: a deletion `{ id, isDeleted: true, updatedAt }` or `{ id, isDeleted: false, updatedAt, data }` with untrusted `data`. |
| **Payload v2** | Encrypted JSON with `v: 2`, `id`, `isDeleted`, AES-GCM AAD `workledger:entry:<id>`. |
| **Tombstone** | A pending local delete (persisted in `sync-tombstones`), pushed as an encrypted v2 entry with `isDeleted: true`. |
| **Dirty entry** | An id in the engine's `dirty` map, with the change counter of its latest change. |
| **Recovery scan** | Push also sends entries with `updatedAt > lastSyncAt`; enabled on every activation. |
| **Generation** | Counter bumped on disconnect, account changes and mode switches; operations from an older generation are discarded. |
| **forceAll push** | Push of every local entry. Used by `generateSyncId()`, `connect()` and `syncNow()`. |
| **Full pull** | Pull from seq 0. Used by `connect()`, `syncNow()` and after the legacy config migration. |
| **Merge** | `applyRemoteEntries`: LWW with delete priority, one transaction per page, updates search and backlinks. |

### 9.2 File Index

| File | Lines | Purpose |
|------|-------|---------|
| `sync/index.ts` | 3 | Public API: SyncProvider, useSyncContext, StorageSubmenu |
| `sync/types/sync.ts` | 67 | SyncConfig, SyncStatus, SyncEntry, API responses, defaults |
| `sync/engine/sync-engine.ts` | 582 | SyncEngine: queue, push/pull, change tracking, account lifecycle |
| `sync/hooks/useSync.ts` | 55 | Engine creation, event and visibility binding |
| `sync/context/SyncContext.tsx` | 35 | React context, memoized value |
| `sync/storage/sync-settings.ts` | 90 | Config and tombstone persistence, legacy migration |
| `sync/utils/sync-operations.ts` | 132 | Batched pushEntries(), paginated pullEntries() |
| `sync/utils/sync-crypto.ts` | 119 | Payload v2 encrypt/decrypt, v1 fallback, ciphertext hash |
| `sync/utils/crypto.ts` | 87 | SHA-256, sync ID, auth token, PBKDF2, AES-GCM with AAD |
| `sync/utils/sync-api.ts` | 99 | HTTP client, timeouts, SyncHttpError, retry classification |
| `sync/utils/server-url.ts` | 18 | https requirement for server URLs |
| `sync/utils/sync-events.ts` | 9 | Event bus wrappers |
| `sync/components/StorageSubmenu.tsx` | 91 | Storage submenu shell, mode toggle, entry count |
| `sync/components/RemoteConnectForm.tsx` | 124 | Server URL, sync ID, Generate / Connect |
| `sync/components/RemoteConnectedPanel.tsx` | 103 | Connected state, "Sync now" |
| `sync/components/AccountDangerZone.tsx` | 69 | Disconnect, delete account |
| `sync/components/SyncStatusIndicator.tsx` | 36 | Status dot |
| `entries/storage/remote-entries.ts` | 73 | applyRemoteEntries() |
| `sync/engine/__tests__/sync-engine.test.ts` | 385 | Push, pull, tombstones, account lifecycle |
| `sync/utils/__tests__/sync-operations.test.ts` | 136 | Batching, 413 handling, pull cursor |
| `sync/utils/__tests__/sync-crypto.test.ts` | 117 | v2 round-trip, AAD binding, legacy reads |
| `sync/utils/__tests__/crypto.test.ts` | 120 | Primitives, AAD |
| `sync/storage/__tests__/sync-settings.test.ts` | 50 | Per-field fallback, legacy migration, tombstone row |
| `entries/storage/__tests__/remote-entries.test.ts` | 103 | LWW, deletes, search/backlinks, validation |

Run tests with `npm test` (Vitest).

### 9.3 Timing and Size Constants

| Constant | Value | Location | Purpose |
|----------|-------|----------|---------|
| `pullIntervalMs` | 30,000ms | `DEFAULT_SYNC_OPTIONS` (sync-engine.ts) | Interval between automatic pulls (visible tabs only) |
| `pushDebounceMs` | 2,000ms | `DEFAULT_SYNC_OPTIONS` | Debounce before push after a change |
| `retryDelaysMs` | [5s, 15s, 30s, 60s] | `DEFAULT_SYNC_OPTIONS` | Backoff for retryable push failures |
| `requestTimeoutMs` | 30,000ms | `DEFAULT_SYNC_OPTIONS` | Per-request timeout (`AbortSignal.timeout`) |
| `pullPageSize` | 100 | `DEFAULT_SYNC_OPTIONS` | Entries per pull request |
| `batch.maxEntries` | 100 | `DEFAULT_SYNC_OPTIONS` | Entries per push request |
| `batch.maxBytes` | 900,000 | `DEFAULT_SYNC_OPTIONS` | Serialized size per push request (server limit 1 MB) |
| `bulkReadThreshold` | 200 | `DEFAULT_SYNC_OPTIONS` | Above this many dirty ids, read all entries once |
| Auto-save debounce | 500ms | `useAutoSave` (`delayMs` default) | Delay before saving editor content |
| PBKDF2 iterations | 100,000 | crypto.ts | Key derivation cost |
