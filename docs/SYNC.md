# WorkLedger Sync System — Technical Analysis

A deep-dive study companion for understanding WorkLedger's end-to-end encrypted synchronization layer. Read this alongside the source code in `src/features/sync/`.

---

## 1. Executive Summary

WorkLedger is a local-first engineering notebook that stores all data in the browser's IndexedDB. It is a React + TypeScript single-page application with no backend requirement for core functionality. Users create daily entries in a rich text editor (BlockNote), organize them with tags, and optionally synchronize across devices through an encrypted sync protocol.

The sync feature is an optional layer that, when enabled, encrypts every entry client-side using AES-256-GCM (key derived from a user-generated sync ID via PBKDF2), pushes encrypted payloads to a remote server, and pulls encrypted payloads from other devices. The server never sees plaintext. Conflict resolution uses last-writer-wins based on `updatedAt` timestamps, with deletion markers always taking priority.

The sync system is roughly 900 lines of TypeScript across 10 source files, plus 6 test files. It is entirely contained in `src/features/sync/` and communicates with the rest of the app through two narrow interfaces: the entries feature's public API and a typed event bus.

**Tech stack:** React 19, TypeScript (strict), Vite, IndexedDB (via `idb`), Web Crypto API, BlockNote editor, Tailwind CSS.

---

## 2. Architecture Overview

### Where Sync Lives in the App

The provider hierarchy determines component access to shared state. Sync sits between entries (its data source) and the sidebar (which displays sync status):

```
ThemeContext
  └─ EntriesProvider          ← core data layer
       └─ SyncProvider        ← sync orchestration
            └─ SidebarProvider
                 └─ FocusModeProvider
                      └─ AIProvider
```

This ordering means `SyncProvider` can call `useEntriesActions()` to trigger a UI refresh after pulling new entries, but the entries layer has no knowledge of sync. The coupling is one-directional: sync depends on entries, entries do not depend on sync.

### Sync Feature File Map

```
src/features/sync/
├── index.ts                        → Public API (SyncProvider, useSyncContext, components, types)
├── types/sync.ts                   → All type definitions (SyncConfig, SyncStatus, SyncEntry, API responses)
├── context/SyncContext.tsx          → React Context wrapper around useSync hook
├── hooks/useSync.ts                → Orchestrator: intervals, events, push/pull, account management (~405 lines)
├── storage/sync-settings.ts        → Persists SyncConfig to IndexedDB settings store
├── utils/
│   ├── sync-operations.ts          → pushEntries() and pullEntries() — the core sync algorithms
│   ├── merge.ts                    → mergeRemoteEntries() — conflict resolution and IDB writes
│   ├── sync-crypto.ts              → encryptEntry() / decryptEntry() — entry-level encryption
│   ├── crypto.ts                   → Key derivation (PBKDF2), AES-GCM encrypt/decrypt, sync ID generation
│   ├── integrity.ts                → SHA-256 plaintext hashing for integrity verification
│   ├── sync-api.ts                 → HTTP client for all server endpoints
│   └── sync-events.ts              → Thin wrappers around the typed event bus
└── components/
    ├── StorageSubmenu.tsx           → Settings UI: mode toggle, connect/disconnect, sync now (~347 lines)
    └── SyncStatusIndicator.tsx      → Green/blue/red dot status display
```

### System Boundary Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Device A)                                             │
│                                                                 │
│  ┌──────────────┐    entry-changed     ┌──────────────────┐    │
│  │  useEntries   │──── event bus ──────▶│  useSync          │    │
│  │  (entries     │    entry-deleted     │  (orchestrator)   │    │
│  │   feature)    │◀── refresh() ───────│                   │    │
│  └──────┬───────┘                      └────────┬─────────┘    │
│         │                                        │              │
│    ┌────▼────┐                            ┌──────▼──────┐      │
│    │ IndexedDB │                            │ sync-operations│    │
│    │ entries  │◀──── merge.ts ◀────────────│ push / pull  │    │
│    │ store    │                            └──────┬──────┘      │
│    └─────────┘                                   │              │
│                                            ┌──────▼──────┐      │
│                                            │ sync-crypto  │      │
│                                            │ AES-256-GCM  │      │
│                                            └──────┬──────┘      │
└───────────────────────────────────────────────────┼─────────────┘
                                                    │ HTTPS
                                              ┌─────▼──────┐
                                              │ Sync Server │
                                              │ (opaque     │
                                              │  blob store)│
                                              └─────┬──────┘
                                                    │ HTTPS
┌───────────────────────────────────────────────────┼─────────────┐
│  Browser (Device B)                               │              │
│                                            ┌──────▼──────┐      │
│                                            │  useSync     │      │
│                                            │  pulls →     │      │
│                                            │  decrypts →  │      │
│                                            │  merges      │      │
│                                            └─────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

The sync server is a separate codebase (`workledger-sync`). From the client's perspective it is an opaque blob store that accepts encrypted payloads, assigns monotonically increasing sequence numbers (`serverSeq`), and returns them in order during pulls. The server cannot decrypt, inspect, or modify entry content.

---

## 3. Key Concepts and Abstractions

These are the seven mental models required to reason about the sync system. Each subsequent section of this document assumes familiarity with all of them.

### 3.1 SyncConfig vs SyncStatus

The sync system maintains two distinct state objects that serve fundamentally different purposes.

**SyncConfig** (`types/sync.ts:5-12`) is the persisted configuration. It lives in IndexedDB under the key `"sync-config"` in the `settings` store. It survives page refreshes, browser restarts, and tab crashes. It contains the user's credentials (`syncId`, `salt`), the server URL, the operating mode (`"local"` or `"remote"`), and — critically — the two sync cursors (`lastSyncSeq` and `lastSyncAt`).

```typescript
interface SyncConfig {
  mode: "local" | "remote";
  syncId: string | null;
  salt: string | null;
  serverUrl: string | null;
  lastSyncSeq: number;       // pull cursor
  lastSyncAt: number | null;  // push cursor
}
```

**SyncStatus** (`types/sync.ts:14-19`) is ephemeral UI state. It exists only in React state (`useState`) and is never persisted. It tells the UI what the sync system is currently doing: idle, pushing, pulling, merging, or in an error state. It also tracks `pendingChanges` (how many dirty entries are queued for push) and `lastSyncAt` (mirrored from config for convenient UI access).

```typescript
interface SyncStatus {
  phase: "idle" | "pushing" | "pulling" | "merging" | "error";
  error: string | null;
  lastSyncAt: number | null;
  pendingChanges: number;
}
```

The separation matters because SyncConfig changes must be persisted atomically (a crash between updating the cursor and saving to IndexedDB could lose entries), while SyncStatus changes are frequent, transient, and drive re-renders. Mixing them would cause unnecessary persistence writes on every phase transition and unnecessary re-renders on every config save.

### 3.2 The Two Cursors

The sync system uses two independent cursors to track progress, and they must never be conflated.

**`lastSyncSeq`** (the pull cursor) is a server-assigned monotonically increasing integer. Each entry stored on the server gets a `serverSeq` value. When the client pulls, it asks "give me everything with `serverSeq > lastSyncSeq`". After a successful pull, the client advances `lastSyncSeq` to the highest sequence number it received. **Only pull updates this cursor.**

**`lastSyncAt`** (the push cursor) is a client-side Unix timestamp in milliseconds. When the client pushes dirty entries, it records `Date.now()` as the new `lastSyncAt`. On the next push, if there are no explicitly dirty entries (because the in-memory tracking was lost due to a page refresh), the fallback logic sends all entries where `entry.updatedAt > lastSyncAt`. **Only push updates this cursor.**

The separation exists because of a real bug (fixed in v2.2.1): an earlier version advanced `lastSyncSeq` during push, which caused the pull cursor to jump ahead, skipping entries that other devices had pushed in the meantime. The invariant is:

- Push reads `lastSyncAt`, writes `lastSyncAt`
- Pull reads `lastSyncSeq`, writes `lastSyncSeq`
- `configRef.current` is re-read after each operation to pick up changes from the other

This is implemented in `useSync.ts`. In `push()` (line 184): `const updated = { ...configRef.current, lastSyncAt: result.syncedAt }` — note it spreads `configRef.current`, not the captured `cfg`, so it picks up any `lastSyncSeq` change from a concurrent pull. In `pull()` (line 226): `const updated = { ...cfg, lastSyncSeq: result.serverSeq, lastSyncAt: result.syncedAt }` — pull does write both, but this is safe because it always moves forward.

### 3.3 The Mutex and Its Asymmetry

A single boolean ref (`mutexRef` in `useSync.ts:38`) prevents push and pull from executing concurrently. This is necessary because both operations read from and write to IndexedDB and the sync config, and interleaving could produce inconsistent state.

The asymmetry is deliberate:

- **Push, when blocked:** Calls `schedulePush()`, which sets a new 2-second timeout. The dirty entries remain in the `dirtyEntriesRef` set, so nothing is lost. The push will execute after the current operation finishes and the debounce elapses. This guarantees that dirty entries are eventually pushed.

- **Pull, when blocked:** Returns immediately with no rescheduling (`useSync.ts:212`). The next pull will happen on the regular 30-second interval, or when the user switches tabs back. This is acceptable because pull is speculative — it checks for new server entries — and dropping a single pull only delays receiving remote changes by one interval.

Changing pull to reschedule (like push does) would risk a feedback loop: pull triggers merge, merge triggers `refresh()`, refresh triggers re-render, re-render could trigger another pull if not carefully guarded.

### 3.4 Dirty Tracking

The sync system tracks which entries need pushing using two in-memory `Set<string>` refs:

- `dirtyEntriesRef` — entry IDs that have been created or modified since the last push
- `deletedEntriesRef` — entry IDs that have been deleted since the last push

These are `useRef` values (`useSync.ts:41-42`), not `useState`, because they are written frequently (on every keystroke that triggers auto-save) and should never cause re-renders. They are read only when a push executes.

**The in-memory tracking is lost on page refresh.** This is a deliberate tradeoff for simplicity. The fallback is the `lastSyncAt` cursor: when `dirtyIds.size === 0` (no tracked dirty entries), `pushEntries()` falls back to sending all entries where `entry.updatedAt > config.lastSyncAt` (`sync-operations.ts:29`). This catches any entries modified between the last push and the page refresh.

The fallback does not handle deletions after a refresh, since deleted entries no longer exist in IndexedDB. Deletions that occur between a push and a page refresh will not sync until the user triggers `syncNow()`, which does a full push of everything.

### 3.5 The Event Bus

Cross-feature communication uses a typed in-memory pub/sub system defined in `src/utils/events.ts`. It is not DOM-based — it uses a plain `Map<string, Set<handler>>` and synchronous dispatch.

Three events exist:

| Event | Payload | Emitted by | Consumed by |
|-------|---------|------------|-------------|
| `entry-changed` | `{ entryId }` | `useEntries` on create, update, tag change, archive, unarchive | `useSync` → marks dirty, schedules push |
| `entry-deleted` | `{ entryId }` | `useEntries` on delete | `useSync` → marks dirty + deleted, schedules push |
| `navigate-entry` | `{ entryId }` | Wiki-link click handler | `useEntryNavigation` → scrolls to entry |

The sync feature subscribes to `entry-changed` and `entry-deleted` in a `useEffect` that is gated on `config.mode === "remote"` (`useSync.ts:114-129`). When mode switches to `"local"`, the effect cleanup unsubscribes. When mode switches to `"remote"`, it re-subscribes. This means local-mode edits never touch the sync machinery at all.

Each event listener does two things: adds the entry ID to `dirtyEntriesRef` (and `deletedEntriesRef` for deletes), then calls `schedulePush()`. Because `schedulePush()` resets the 2-second debounce timer on every call, rapid edits (like typing) batch into a single push.

### 3.6 The Encryption Envelope

Every entry is encrypted before leaving the device. The encryption pipeline has four layers:

**1. Sync ID generation** (`crypto.ts:11-17`): A 20-character hex string prefixed with `wl-`, generated from 10 random bytes. This is the user's "password" — the only secret. Format: `wl-a1b2c3d4e5f6a7b8c9d0`.

**2. Auth token derivation** (`crypto.ts:19-21`): `SHA-256("auth:" + syncId)`. Sent as `X-Auth-Token` header. The server stores this hash, never the sync ID. This means the server can authenticate requests without knowing the encryption key.

**3. Encryption key derivation** (`crypto.ts:27-47`): `SHA-256("crypto:" + syncId)` produces a crypto seed, which is then run through PBKDF2 with 100,000 iterations and a server-provided salt to produce an AES-256-GCM key. The salt is generated server-side during account creation and returned to the client. The separation of `"auth:"` and `"crypto:"` prefixes ensures the auth token cannot be used to derive the encryption key.

**4. Entry encryption** (`sync-crypto.ts:25-48`): The entry's content fields (`dayKey`, `createdAt`, `updatedAt`, `blocks`, `isArchived`, `tags`) are serialized to JSON, hashed with SHA-256 for integrity verification, then encrypted with AES-GCM using a random 12-byte IV. The result is a `SyncEntry`:

```typescript
interface SyncEntry {
  id: string;                 // plaintext — needed for server-side dedup
  updatedAt: number;          // plaintext — needed for server-side conflict detection
  isArchived: boolean;        // plaintext — metadata
  isDeleted: boolean;         // plaintext — deletion marker
  encryptedPayload: string;   // base64(IV + ciphertext)
  integrityHash: string;      // SHA-256 of the JSON plaintext
  serverSeq?: number;         // assigned by server, returned during pull
}
```

Note that `id` and `updatedAt` are sent in plaintext alongside the encrypted payload. The server needs these for deduplication and conflict response. The `encryptedPayload` is a base64 string containing the 12-byte IV concatenated with the AES-GCM ciphertext.

### 3.7 Merge Semantics

When entries arrive from the server during a pull, `mergeRemoteEntries()` (`merge.ts`) decides what to do with each one:

1. **If `remote.isDeleted === true`:** Delete the local entry from IndexedDB and its search index. Deletions always win, regardless of timestamps. This is a deliberate "delete wins" policy.

2. **If the entry is not deleted:** Validate it through the Zod schema (`validateEntry`). If validation fails, skip the entry with a warning — do not crash the merge. If validation passes:

3. **If no local copy exists** (`!local`): Write the remote entry to IndexedDB. This handles new entries from other devices.

4. **If a local copy exists and `remote.updatedAt > local.updatedAt`:** Overwrite the local entry. This is strict greater-than, meaning equal timestamps keep the local version. This is the "last-writer-wins" policy.

5. **If `remote.updatedAt <= local.updatedAt`:** Keep the local version. The remote entry is silently discarded.

After each write, if the entry has content (`blocks.length > 0`), the search index is updated to keep full-text search consistent.

The merge function returns a count of entries that were actually written, but the caller (`pullEntries`) also tracks `hadEntries` — whether any entries were received at all, even if none were merged. This distinction matters for UI refresh: even if all received entries were older than local copies (merge count = 0), the pull happened successfully and the UI should reflect the updated `lastSyncAt`.

---

## 4. Component Deep-Dives

### 4.1 useSync — The Orchestrator

**Location:** `src/features/sync/hooks/useSync.ts` (~405 lines)

**Responsibility:** This is the central nervous system of the sync feature. It manages the sync lifecycle: loading config from IndexedDB on mount, deriving crypto keys, starting and stopping intervals, listening for entry mutation events, coordinating push and pull operations, and exposing account management functions (generate, connect, disconnect, delete) to the UI.

**State and Refs:**

The hook maintains three categories of state:

| Category | Variable | Type | Purpose |
|----------|----------|------|---------|
| React state | `config` | `SyncConfig` | Persisted config, drives `useEffect` dependencies |
| React state | `status` | `SyncStatus` | UI display state |
| React state | `configLoaded` | `boolean` | Guards against premature operations |
| Ref | `cryptoKeyRef` | `CryptoKey` | Derived encryption key, set after key derivation |
| Ref | `authTokenRef` | `string` | SHA-256 auth token for server requests |
| Ref | `mutexRef` | `boolean` | Push/pull mutual exclusion |
| Ref | `pullIntervalRef` | interval ID | 30-second pull interval handle |
| Ref | `pushTimeoutRef` | timeout ID | 2-second push debounce handle |
| Ref | `dirtyEntriesRef` | `Set<string>` | Entry IDs modified since last push |
| Ref | `deletedEntriesRef` | `Set<string>` | Entry IDs deleted since last push |
| Ref | `pushRetryCountRef` | `number` | Current retry attempt (0-3) |
| Ref | `pushRetryTimeoutRef` | timeout ID | Retry timeout handle |
| Ref | `configRef` | `SyncConfig` | Always-current config snapshot (avoids stale closures) |

The `configRef` pattern (`useSync.ts:45-46`) deserves attention. Because `push()` and `pull()` are not wrapped in `useCallback` (they are plain `async function` declarations inside the hook), they close over the initial `config` value. The `configRef` is updated on every render (`configRef.current = config`), and the operations read from `configRef.current` instead of `config` directly. This ensures they always see the latest config, even when called from stale closures like `setInterval` callbacks.

**Initialization Sequence (useEffect chain):**

The hook uses four `useEffect` blocks that execute in a specific order:

1. **Config loading** (line 77-83, deps: `[]`): Runs once on mount. Loads `SyncConfig` from IndexedDB, sets state, sets `configLoaded = true`.

2. **Key derivation and interval start** (line 87-110, deps: `[configLoaded, config.mode, config.syncId, config.salt]`): Runs when config is loaded and whenever credentials change. If mode is `"remote"` with valid credentials, derives the crypto key and auth token in parallel, then immediately pulls and starts the 30-second pull interval. If mode is not remote, clears crypto refs and stops intervals.

3. **Event listeners** (line 114-129, deps: `[config.mode]`): Registers `entry-changed` and `entry-deleted` listeners when mode is `"remote"`. Unsubscribes on cleanup (mode switch or unmount).

4. **Visibility change** (line 133-143, deps: `[config.mode]`): Registers a `visibilitychange` listener that triggers a pull when the tab becomes visible. This handles the case where a user switches back to a tab that has been in the background — the 30-second interval only fires if the document is visible, so a backgrounded tab doesn't pull until re-focused.

5. **Cleanup** (line 147-153, deps: `[]`): Runs on unmount. Clears all intervals and timeouts.

**Push Operation** (line 157-205):

```
push(forceAll?) → guard(key, token, mode) → guard(mutex)
  → setStatus("pushing")
  → pushEntries({key, token, config, dirtyIds, deletedIds, forceAll})
  → update lastSyncAt in config (re-read configRef for latest lastSyncSeq)
  → save config to IndexedDB
  → clear dirty sets
  → reset retry count
  → setStatus("idle")
```

On failure: if the error is retryable (not a 4xx), schedules a retry with exponential backoff (5s, 15s, 30s, 60s). The `isRetryableError` function (`useSync.ts:18-24`) treats network errors and 5xx errors as retryable, but 4xx client errors as permanent failures.

**Pull Operation** (line 207-237):

```
pull() → guard(key, token, mode) → guard(mutex) — NOTE: no reschedule on mutex block
  → setStatus("pulling")
  → pullEntries({key, token, config, onPhaseChange})
  → if hadEntries: await refresh()
  → update both lastSyncSeq AND lastSyncAt in config
  → save config to IndexedDB
  → setStatus("idle")
```

Pull does update `lastSyncAt` in addition to `lastSyncSeq`. This is safe because pull always runs to completion before push can acquire the mutex, and the next push will read the updated `lastSyncAt` from `configRef.current`.

The `refresh()` call (line 223) is critical — it reloads the entries context from IndexedDB, which triggers React re-renders in all components that consume `useEntriesData()`. This is how synced entries become visible in the UI.

### 4.2 sync-operations.ts — Push and Pull Logic

**Location:** `src/features/sync/utils/sync-operations.ts` (~125 lines)

**Responsibility:** The pure(ish) operational logic for pushing entries to and pulling entries from the server. These functions are called by `useSync` but are separated to keep the hook focused on orchestration and these functions focused on data transformation.

#### pushEntries()

The push function determines which entries to send, encrypts them, appends deletion markers, and calls the API.

**Entry selection** (lines 24-29) uses a three-tier priority:

1. If `forceAll === true`: send every entry from IndexedDB. Used by `syncNow()`.
2. If `dirtyIds` is non-empty: send only explicitly dirty entries. The normal case after event-driven tracking.
3. Fallback: send all entries where `updatedAt > lastSyncAt`. The recovery path when dirty tracking was lost (page refresh).

```typescript
const toPush = forceAll
  ? allEntries
  : dirtyIds.size > 0
    ? allEntries.filter((e) => dirtyIds.has(e.id))
    : allEntries.filter((e) => config.lastSyncAt === null || e.updatedAt > config.lastSyncAt);
```

**Deletion markers** (lines 32-43) are synthetic `SyncEntry` objects with `isDeleted: true` and empty `encryptedPayload`. They are created from the `deletedIds` set. Because deleted entries no longer exist in IndexedDB, the only information available is the entry ID. The `updatedAt` is set to `Date.now()` to ensure the deletion wins during merge on other devices.

The function returns `null` if there is nothing to push (no dirty entries and no deletions), which the caller interprets as a no-op.

#### pullEntries()

The pull function implements paginated retrieval with careful cursor management. This is where most of the sync bugs lived.

**Pagination loop** (lines 80-116):

```typescript
let since = config.lastSyncSeq;    // start from last known position
let hasMore = true;

while (hasMore) {
  const res = await apiPullEntries(token, since, 100, config.serverUrl);
  hasMore = res.hasMore;
  // ... decrypt, merge ...

  // Advance cursor to LAST ENTRY's serverSeq, NOT res.serverSeq
  const lastEntry = res.entries[res.entries.length - 1];
  if (lastEntry.serverSeq !== undefined && lastEntry.serverSeq > since) {
    since = lastEntry.serverSeq;
  }

  // Safety: break if cursor didn't advance
  if (since === previousSince && hasMore) {
    console.warn("[sync] Pull cursor stuck, stopping pagination");
    break;
  }
}
```

The cursor advancement logic is the most bug-prone part of the sync system (see Section 7). Three invariants protect against entry loss:

1. **Use per-entry cursor, not global:** The `since` variable advances to `lastEntry.serverSeq`, not `res.serverSeq`. The global `res.serverSeq` is the server's maximum sequence number across all entries, which could jump past entries in later pages during a paginated pull.

2. **Stuck cursor detection:** If `since` didn't advance after processing a page (entries lack `serverSeq` or all have `seq <= since`), break the loop to prevent infinite requests.

3. **Global catch-up:** After all pages are processed, if the server's global `serverSeq` is higher than the page-by-page cursor, advance to the global value (lines 120-122). This accounts for entries pushed by other devices during the pull.

### 4.3 merge.ts — Conflict Resolution

**Location:** `src/features/sync/utils/merge.ts` (~61 lines)

**Responsibility:** Takes an array of decrypted remote entries and writes them to IndexedDB according to the merge policy. This is the only place where remote data enters the local database.

The function operates directly on IndexedDB (via the `idb` library's `db.put()` and `db.delete()`) rather than going through the entries feature's storage layer. This is deliberate: the entries storage functions emit events and do other bookkeeping that would create feedback loops during merge. The merge function is a low-level bypass that writes directly and lets the caller handle UI updates.

**Validation gate** (lines 36-42): Every non-deleted remote entry passes through the Zod schema (`validateEntry`) before being written. This catches malformed entries, applies defaults (`tags: []`, `isArchived: false`), and strips unknown fields (`.strip()`). Entries that fail validation are skipped with a console warning — they do not abort the entire merge.

The Zod validation was the source of a bug in v2.2.3: the original schema used `.strict()` instead of `.strip()`, which rejected entries with extra fields. Archived entries from older client versions had an extra `archivedAt` field that the strict schema rejected, preventing them from syncing.

### 4.4 sync-crypto.ts and crypto.ts — The Encryption Pipeline

**Location:** `src/features/sync/utils/crypto.ts` (~77 lines), `sync-crypto.ts` (~85 lines)

**crypto.ts** provides four primitives:

- `generateSyncIdLocal()`: 10 random bytes → hex → `wl-` prefix. This is purely local; the sync ID is never sent to the server.
- `computeAuthToken(syncId)`: `SHA-256("auth:" + syncId)` → hex string. Sent as `X-Auth-Token`.
- `deriveKey(syncId, salt)`: `SHA-256("crypto:" + syncId)` → PBKDF2 (100k iterations, server salt) → AES-256-GCM `CryptoKey`.
- `encrypt(key, plaintext)` / `decrypt(key, ciphertext)`: AES-GCM with random 12-byte IV. The IV is prepended to the ciphertext and the whole thing is base64-encoded.

**sync-crypto.ts** wraps these primitives for entry-level operations:

`encryptEntry()` serializes the entry payload (everything except `id`) to JSON, computes a SHA-256 integrity hash of the plaintext, encrypts the JSON string, and returns a `SyncEntry` with both `encryptedPayload` and `integrityHash`.

`decryptEntry()` handles two cases: deleted entries (returns a stub with `isDeleted: true`, no decryption needed since `encryptedPayload` is empty) and normal entries (decrypts, parses JSON, verifies integrity hash). If the hash doesn't match, it logs a warning but still returns the entry — AES-GCM already provides authentication, so a successful decryption guarantees the data was encrypted with the same key. Hash mismatches are expected for entries created before a bug fix that changed the hashing method (see Section 7.6).

### 4.5 sync-api.ts — The HTTP Layer

**Location:** `src/features/sync/utils/sync-api.ts` (~100 lines)

A thin HTTP client with five endpoints:

| Function | Method | Path | Purpose |
|----------|--------|------|---------|
| `apiCreateAccount` | POST | `/api/v1/accounts` | Creates server account, returns `{ salt }` |
| `apiValidateAccount` | GET | `/api/v1/accounts/validate` | Validates sync ID, returns `{ valid, salt, entryCount, createdAt }` |
| `apiDeleteAccount` | DELETE | `/api/v1/accounts` | Permanently deletes server account |
| `apiPushEntries` | POST | `/api/v1/sync/push` | Sends encrypted entries, returns `{ accepted, conflicts, serverSeq }` |
| `apiPullEntries` | GET | `/api/v1/sync/pull?since=N&limit=M` | Returns `{ entries, serverSeq, hasMore }` |
| `apiFullSync` | POST | `/api/v1/sync/full` | Initial bidirectional sync, returns `{ entries, serverSeq, merged }` |

Authentication is via `X-Auth-Token` header containing the SHA-256 hash of the sync ID. The server URL defaults to `https://sync.workledger.org` but can be overridden per-user (for self-hosted servers) or globally via `VITE_SYNC_SERVER_URL` environment variable.

Error handling is uniform: non-2xx responses throw `Error("Sync server error {status}: {body}")`. The `isRetryableError` function in `useSync.ts` parses these messages to distinguish 4xx (don't retry) from 5xx (retry).

Note that the `PushResponse` includes a `conflicts` array (`ConflictEntry[]`), but the current client code does not process conflicts — it treats the push as successful if the API returns 200. Conflict handling appears to be deferred to the server's merge logic.

### 4.6 SyncContext.tsx — React Integration

**Location:** `src/features/sync/context/SyncContext.tsx` (~33 lines)

A straightforward context wrapper. The key detail is the `useMemo` on the context value (line 21-24):

```typescript
const value = useMemo<SyncContextValue>(
  () => ({ config, status, generateSyncId, connect, ... }),
  [config, status, generateSyncId, connect, ...],
);
```

This memoization was added in v2.2.3 to prevent a render cascade. Without it, every re-render of `SyncProvider` (triggered by `setConfig` or `setStatus` in `useSync`) created a new context value object, which re-rendered every consumer — even if they only used stable functions like `syncNow` that hadn't changed. With `useMemo`, the context value only changes when one of its dependencies actually changes.

The context value includes both data (`config`, `status`) and actions (`generateSyncId`, `connect`, `disconnect`, etc.). Unlike the entries feature which splits data and actions into separate contexts for performance, the sync feature keeps them together because there are far fewer consumers (only `StorageSubmenu` and `SyncStatusIndicator`).

### 4.7 StorageSubmenu.tsx — The Settings UI

**Location:** `src/features/sync/components/StorageSubmenu.tsx` (~347 lines)

This component manages the user-facing sync configuration flow. It renders inside the sidebar settings panel and consumes `useSyncContext()`.

**Three UI states:**

1. **Local mode** (`!isRemote`): Shows a simple "Data stored in your browser only" message and a toggle to switch to remote mode.

2. **Remote mode, not connected** (`isRemote && !isConnected`): Shows the sync ID input field, Generate and Connect buttons, an optional server URL field (collapsed by default), and validation feedback. The sync ID is validated against the regex `^wl-[0-9a-f]{20}$`.

3. **Remote mode, connected** (`isConnected`): Shows the current sync ID (copyable), the sync status indicator, a "Sync now" button, the last sync time, and disconnect/delete account buttons. Delete requires confirmation.

**The connect flow from the UI perspective:**

1. User enters or generates a sync ID
2. Clicks "Connect"
3. `handleConnect()` calls `saveServerUrl()` then `connect(syncId)`
4. `connect()` in `useSync.ts` validates the ID with the server, derives the key, performs a full bidirectional sync, saves config, and starts the pull interval
5. The component re-renders with `isConnected = true`, showing the connected state

---

## 5. Data Flow and Lifecycle

### 5.1 User Edit → Push to Server

This traces what happens when a user types in an entry editor and the change reaches the sync server.

```
User types in BlockNote editor
  │
  ▼ (immediate)
BlockNoteView.onChange fires
  │
  ▼ (immediate)
EntryEditor.onChange → handleChange(editor)
  │
  ▼ (500ms debounce — useAutoSave)
useAutoSave timer fires:
  1. Reads editor.document (current blocks)
  2. Creates updated entry with new updatedAt = Date.now()
  3. Calls onSave(updated) → useEntries.updateEntry()
     │
     ▼ (immediate)
     useEntries.updateEntry():
       1. await dbUpdateEntry(entry)       — writes to IndexedDB
       2. emit("entry-changed", {entryId}) — fires event synchronously
       3. setEntriesByDay(prev => ...)      — optimistic React state update
  4. Calls updateSearchIndex()             — updates search store
  │
  ▼ (synchronous, via event bus)
useSync event listener (onEntryChanged):
  1. dirtyEntriesRef.current.add(entryId)
  2. setStatus({pendingChanges: dirtyEntriesRef.size})
  3. schedulePush() — resets 2s debounce timer
  │
  ▼ (2000ms debounce — PUSH_DEBOUNCE_MS)
push() executes:
  1. Acquires mutex
  2. setStatus("pushing")
  3. pushEntries():
     a. getAllEntries() from IndexedDB
     b. Filter to dirty entries (dirtyIds set)
     c. Build deletion markers for deletedIds
     d. Encrypt each entry → SyncEntry[]
     e. apiPushEntries(token, encrypted, serverUrl)
  4. Update config.lastSyncAt = Date.now()
  5. Save config to IndexedDB
  6. Clear dirtyEntriesRef and deletedEntriesRef
  7. setStatus("idle", pendingChanges: 0)
  8. Release mutex
```

**Total latency from keystroke to server:** ~2.5 seconds minimum (500ms auto-save debounce + 2000ms push debounce + network time). Rapid typing resets both debounces, so a burst of typing results in a single save and a single push.

### 5.2 Pull Interval → UI Update

This traces a 30-second interval pull that finds new entries on the server.

```
setInterval fires (every 30s, only if document.visibilityState === "visible")
  │
  ▼
pull():
  1. Guard: key, token, mode must be valid
  2. Guard: mutexRef must be false (if true, return immediately — no reschedule)
  3. Acquire mutex
  4. setStatus("pulling")
  │
  ▼
  pullEntries():
    Page 1: GET /api/v1/sync/pull?since={lastSyncSeq}&limit=100
      │
      ▼
    If entries received:
      1. setStatus("merging") via onPhaseChange callback
      2. For each encrypted entry:
         - decryptEntry(key, syncEntry) → DecryptedEntry
         - (log warning if integrity hash mismatches)
      3. mergeRemoteEntries(decrypted):
         For each entry:
           - If isDeleted: delete from IDB + search index
           - If not deleted: validate via Zod
           - If !local || remote.updatedAt > local.updatedAt: db.put()
           - Update search index if entry has blocks
      4. Advance cursor: since = lastEntry.serverSeq
      │
      ▼
    If hasMore: repeat with new cursor
    If !hasMore or cursor stuck: exit loop
  │
  ▼
  After pagination: if globalServerSeq > since, advance to globalServerSeq
  Return { serverSeq, syncedAt, totalMerged, hadEntries }
  │
  ▼
Back in pull():
  5. If hadEntries: await refresh()
     │
     ▼
     refresh() in useEntries:
       a. getRecentEntries(30) from IndexedDB → new Map
       b. getAllDayKeys() → new string[]
       c. setEntriesByDay(newMap)  — triggers re-render
       d. setDayKeys(newKeys)     — triggers re-render
       │
       ▼
     EntriesDataContext value changes (new entriesByDay reference)
       │
       ▼
     All consumers of useEntriesData() re-render:
       - EntryStream re-renders with new data
       - EntryCard memo check: prev.entry.updatedAt !== next.entry.updatedAt?
         - If entry was overwritten by merge: YES → re-render → new props to EntryEditor
         - If entry unchanged: NO → skip
       │
       ▼
     EntryEditor receives new `entry` prop:
       - useEffect([entry.updatedAt]) fires
       - Checks: entry.updatedAt !== lastSavedAtRef.current?
         - YES (this is a sync update, not a local save)
         - editor.replaceBlocks(editor.document, entry.blocks)
         - Editor content updates in-place without remounting

  6. Update config: lastSyncSeq = result.serverSeq, lastSyncAt = result.syncedAt
  7. Save config to IndexedDB
  8. setConfig(updated) — triggers SyncProvider re-render
  9. setStatus("idle") — triggers SyncStatusIndicator re-render
  10. Release mutex
```

The `hadEntries` flag (introduced in the fix at commit `c54be58`) is important. An earlier version only called `refresh()` when `mergeCount > 0` (entries were actually overwritten). But if all server entries were older than local copies, merge count would be 0 and the UI wouldn't refresh — even though the pull succeeded and `lastSyncAt` should update. Using `hadEntries` (any entries received, regardless of merge outcome) ensures the UI always reflects a successful pull.

### 5.3 connect() — Initial Full Sync

When a user enters a sync ID and clicks "Connect", the system performs a full bidirectional sync to reconcile local and remote state.

```
connect(syncId):
  1. Compute auth token: SHA-256("auth:" + syncId)
  2. Validate with server: GET /accounts/validate
     - Returns { valid, salt, entryCount, createdAt }
     - If !valid: set error, return false
  3. Derive encryption key: PBKDF2(SHA-256("crypto:" + syncId), salt, 100k)
  4. Get ALL local entries from IndexedDB
  5. Encrypt each entry → SyncEntry[]
  6. POST /sync/full with all encrypted entries
     - Server merges client entries with existing entries
     - Returns ALL server entries (including ones just pushed)
  7. Decrypt each server entry (skip failures with warning)
  8. mergeRemoteEntries(decrypted) — overwrite locals where server is newer
  9. refresh() — reload UI from IndexedDB
  10. Save config: mode="remote", syncId, salt, lastSyncSeq=fullRes.serverSeq, lastSyncAt=now
  11. Start pull interval
  12. Return true
```

This is an expensive operation: it encrypts and sends every local entry, receives every server entry, and decrypts and merges them all. For a notebook with hundreds of entries, this could take several seconds. The status indicator shows "Syncing..." throughout.

The `connect()` flow is fundamentally different from regular push/pull. Regular push sends only dirty entries; regular pull fetches only entries newer than the cursor. Connect sends everything because the client has no prior sync state — it doesn't know what the server already has, and the server doesn't know what the client has.

### 5.4 syncNow() — Manual Recovery

The "Sync now" button triggers a recovery flow that resets the pull cursor and forces a full re-pull.

```
syncNow():
  1. If lastSyncSeq > 0:
     - Reset config.lastSyncSeq = 0
     - Save to IndexedDB immediately
  2. await pull()     — pulls from seq 0, fetching ALL server entries
  3. await push(true) — pushes ALL local entries (forceAll = true)
```

This was added after the cursor advancement bug (v2.2.1) to provide a way for users to recover entries that were skipped by the broken cursor logic. By resetting `lastSyncSeq` to 0, the pull re-fetches every entry from the server. The `mergeRemoteEntries` function handles deduplication — it only overwrites entries where the remote is strictly newer.

The sequential `pull → push` order matters: pulling first ensures the client has the latest server state, then pushing sends everything local. If push ran first, it would advance `lastSyncAt`, and any entries modified between the old `lastSyncAt` and the push might not be included.

### 5.5 Synced Content Reaching the Editor

This traces the re-render chain from a merged entry to visible content in the BlockNote editor. This was the source of multiple bugs (stale UI, editor not updating).

```
mergeRemoteEntries() writes entry to IDB with new updatedAt
  │
  ▼
pull() calls refresh()
  │
  ▼
refresh() reads from IndexedDB:
  - getRecentEntries(30) → new Map<string, WorkLedgerEntry[]>
  - setEntriesByDay(newMap) — NEW reference, always triggers context update
  │
  ▼
EntriesProvider re-renders:
  - data = useMemo({entriesByDay, dayKeys, loading, archivedEntries}, [...])
  - New entriesByDay reference → new data object → EntriesDataContext value changes
  │
  ▼
EntryStream re-renders (consumes useEntriesData)
  - Iterates over entriesByDay, renders day groups
  - For each entry, renders <EntryCard entry={entry} .../>
  │
  ▼
EntryCard memo comparison (lines 221-226):
  - Compares prev.entry.updatedAt === next.entry.updatedAt
  - For synced entry: updatedAt CHANGED → memo returns false → re-render
  │
  ▼
EntryCard re-renders → passes new `entry` prop to <EntryEditor entry={entry} .../>
  │
  ▼
EntryEditor receives new props:
  - initialContent memo depends on [entry.id] — same ID, no change
  - editor instance NOT recreated (useCreateBlockNote deps: [entry.id])
  - useEffect([entry.updatedAt]) fires:
    1. Check: entry.updatedAt !== lastSavedAtRef.current
       - lastSavedAtRef was set by the last LOCAL auto-save
       - Synced updatedAt is from a different device → values differ
    2. editor.replaceBlocks(editor.document, entry.blocks)
       - Updates editor content IN-PLACE without remounting
       - This preserves cursor position if user wasn't editing this entry
```

The `lastSavedAtRef` check (line 52 of `EntryEditor.tsx`) is the key mechanism that prevents a feedback loop. Without it, a local auto-save would update `entry.updatedAt`, trigger a re-render, and `replaceBlocks` would overwrite the editor content with the just-saved version — potentially losing keystrokes that occurred during the 500ms debounce. By recording the `updatedAt` value at save time and skipping `replaceBlocks` when they match, only externally-originated updates (from sync) trigger content replacement.

---

## 6. Cross-Cutting Concerns

### 6.1 Re-render Cascade Analysis

Understanding which state changes trigger which re-renders is critical for diagnosing stale UI bugs.

**SyncConfig changes** (from `setConfig()` in useSync):
```
setConfig() → useSync re-renders → SyncProvider re-renders
  → useMemo recalculates context value (config changed)
  → Consumers of useSyncContext() re-render:
    - StorageSubmenu (shows sync ID, status, last sync time)
    - SyncStatusIndicator (shows phase dot)
```

**SyncStatus changes** (from `setStatus()` in useSync):
```
setStatus() → useSync re-renders → SyncProvider re-renders
  → useMemo recalculates context value (status changed)
  → Same consumers re-render
```

These are high-frequency during active sync (phase transitions: idle → pushing → idle, or idle → pulling → merging → idle). The `useMemo` on the context value ensures that only actual state changes propagate.

**Entries refresh after pull:**
```
refresh() → setEntriesByDay() + setDayKeys()
  → EntriesProvider re-renders
  → data useMemo recalculates (entriesByDay changed)
  → EntriesDataContext value changes
  → ALL consumers of useEntriesData() re-render:
    - EntryStream (renders the entry list)
    - Sidebar (shows day keys, tag counts)
    - StorageSubmenu (shows entry count)
    - SearchPanel (if open)
```

This is a broad re-render. The EntryCard memo (comparing `updatedAt`) prevents unchanged entries from re-rendering their editors. But the EntryStream component itself must iterate the new Map to determine what changed, and all sidebar components that show derived data (tag counts, day lists) re-render.

**Important: `actions` context does not change.** The `EntriesActionsContext` value is memoized with stable `useCallback` references as dependencies. Since `createEntry`, `updateEntry`, etc. only change when their `useCallback` dependencies change (which is rare), the actions context almost never triggers consumer re-renders. Components that only need actions (like the "New Entry" button) avoid the entries data re-render cascade entirely.

### 6.2 Error Handling and Retry

**Push errors** use exponential backoff: delays of 5s, 15s, 30s, 60s (`PUSH_RETRY_DELAYS`). After 4 failed attempts, the push stops retrying and the error persists in `status.error` until the next successful operation. The `isRetryableError` function exempts 4xx errors from retry — these indicate client-side problems (invalid token, malformed request) that won't resolve by waiting.

**Pull errors** are caught and set `status.phase = "error"` with the error message, but there is no retry mechanism. The next pull will happen on the regular 30-second interval. This is acceptable because pull failures are usually transient (network issues) and the interval provides natural retry.

**Decryption errors during pull** are caught per-entry (`sync-operations.ts:90-94`). A failed decryption skips that entry with a console warning but continues processing the batch. This prevents a single corrupted entry from blocking all syncs.

**Merge validation errors** are also per-entry (`merge.ts:38-42`). Failed validation skips the entry with a warning. This was important for the Zod bug — without per-entry error handling, a single archived entry with extra fields would have blocked all merges.

### 6.3 Visibility-Aware Sync

The sync system is aware of tab visibility in two places:

1. **Pull interval guard** (`useSync.ts:55`): The 30-second interval fires regardless, but the callback checks `document.visibilityState === "visible"` before calling `pull()`. A backgrounded tab does not make network requests.

2. **Visibility change listener** (`useSync.ts:133-143`): When the tab becomes visible, an immediate pull is triggered. This means a user who switches back to WorkLedger after being away gets fresh data immediately, rather than waiting up to 30 seconds.

Together these create a sync pattern where: active tabs pull every 30 seconds, backgrounded tabs don't pull at all, and returning to a tab triggers an immediate pull. Push is not affected by visibility — if the user edits in a backgrounded tab (unlikely but possible), the push still fires after the debounce.

---

## 7. Bug Archaeology: v2.2.1 through v2.2.3

The sync feature went through a rapid series of bug fixes across three releases. Understanding what went wrong and why reveals the system's fragile points.

### 7.1 The Cursor Advancement Bug (v2.2.1, commit 01145d4)

**Symptom:** Entries synced from Device A silently failed to appear on Device B.

**Root cause:** The original `pullEntries()` used `res.serverSeq` (the global maximum sequence number from the API response) to advance the pagination cursor, instead of using the last entry's `serverSeq`. During a paginated pull with `limit=100`, the first page would advance the cursor to the global max, causing the second page request to return nothing (all entries had `serverSeq < globalMax`). Entries in pages 2+ were silently skipped.

**Fix:** Advance the cursor to `lastEntry.serverSeq` per page, and only use the global `serverSeq` after all pages are processed.

### 7.2 The Push-Advances-Pull-Cursor Bug (v2.2.1, commit 01145d4)

**Symptom:** Same as above — entries lost during cross-device sync.

**Root cause:** An earlier version of `push()` updated both `lastSyncAt` AND `lastSyncSeq` in the config. Since push returns a `serverSeq` from the server, it seemed logical to save it. But this caused the pull cursor to jump forward past entries that other devices had pushed between the last pull and this push.

**Fix:** Push only updates `lastSyncAt`. Pull only updates `lastSyncSeq`. The cursor separation invariant (Section 3.2).

### 7.3 The Race Condition (v2.2.2, commits fe5e7a4 and 436c3e2)

**Symptom:** Overlapping push and pull operations corrupted the sync config, causing subsequent syncs to skip entries or re-sync everything.

**Root cause:** The mutex was being released before the config was saved to IndexedDB. A pull could start between mutex release and config save, reading stale cursor values. Additionally, `configRef.current` was not being re-read after the async operations, so push could overwrite cursor values that pull had just updated.

**Fix:** Two changes: (1) In `push()`, re-read `configRef.current` when building the updated config (line 184: `{ ...configRef.current, lastSyncAt: result.syncedAt }`), so it picks up any `lastSyncSeq` change from a concurrent pull. (2) Ensure the mutex is held through the entire save-config operation, not just the network call.

### 7.4 The Infinite Loop (v2.2.2, commit 436c3e2)

**Symptom:** Pull requests looped indefinitely, hammering the server.

**Root cause:** If entries in a pull response lacked `serverSeq` fields (possible with older server versions or edge cases), the cursor advancement condition `lastEntry.serverSeq > since` was never true, so `since` never changed, and `hasMore` remained true.

**Fix:** Added stuck cursor detection (lines 111-114 of `sync-operations.ts`): if `since === previousSince` after processing a page and `hasMore` is true, break the loop with a warning.

### 7.5 The Stale UI Chain (v2.2.3, commits c54be58, 712d370, 2e0a882, ad0b142)

This was actually four related bugs that manifested as "synced entries don't show up in the editor."

**Bug A: refresh() only called on merge** (c54be58). The original code called `refresh()` only when `mergeCount > 0`. But if all received entries were older than local copies, the UI never refreshed, and `lastSyncAt` never updated in the status display. Fix: track `hadEntries` separately from merge count.

**Bug B: Context value not memoized** (712d370, ad0b142). Every `setStatus()` call in `useSync` re-rendered `SyncProvider`, which created a new context value object, which re-rendered every consumer including `EntryStream`. But the entries data hadn't changed, so the re-render was wasted and could cause flickering. Fix: `useMemo` on the context value in `SyncContext.tsx`.

**Bug C: Editor not updating on sync** (712d370, ad0b142). Even when `EntryCard` re-rendered with new props, the `EntryEditor` wasn't updating its BlockNote content. The editor was created with `useCreateBlockNote([entry.id])` — it only remounted when the entry ID changed, not when content changed. The `initialContent` memo also depended only on `entry.id`. Fix: added a `useEffect([entry.updatedAt])` that calls `editor.replaceBlocks()` to apply synced content in-place, with the `lastSavedAtRef` guard to skip local saves.

**Bug D: Zod rejects archived entries** (2e0a882). The Zod schema for entry validation used strict parsing, which rejected entries with unknown fields. Older entries had an `archivedAt` timestamp field that was later removed. When these entries arrived via sync, validation failed and they were silently skipped. Fix: changed to `.strip()` which removes unknown fields instead of rejecting them.

### 7.6 The Integrity Hash Bug (v2.2.1, commit 01145d4)

**Symptom:** Console warnings about integrity hash mismatches during pull, though entries synced correctly.

**Root cause:** The original implementation computed the integrity hash using a `sortedStringify()` function (deterministic key ordering) on the encryption side, but used plain `JSON.stringify()` on the verification side. Since JavaScript's `JSON.stringify()` preserves insertion order, the hash inputs differed.

Additionally, `sortedStringify()` handled `undefined` values differently from `JSON.stringify()` — JSON.stringify omits undefined values entirely, while sortedStringify included them as `null`.

**Fix:** Switched both sides to plain `JSON.stringify()` for the integrity hash. Downgraded hash mismatch from an error (which would reject the entry) to a warning, since AES-256-GCM already provides authenticated encryption — if decryption succeeds, the data is untampered. Old-format entries get their hash corrected on the next push.

---

## 8. Design Decisions and Tradeoffs

### Decision: In-Memory Dirty Tracking with Fallback

**Context:** The sync system needs to know which entries to push. It could track dirty state in IndexedDB (persistent), in React state (re-render on every keystroke), or in refs (ephemeral).

**Decision:** `useRef<Set<string>>` for dirty tracking, with a `updatedAt > lastSyncAt` fallback for recovery after page refresh.

**Tradeoffs:** Refs are zero-cost during typing (no re-renders, no IDB writes), but lost on refresh. The fallback covers the common case (modified entries have newer timestamps) but misses one edge case: deleted entries after a refresh. A deleted entry no longer exists in IndexedDB, so neither the ref nor the fallback can detect it. The user must manually `syncNow()` to propagate deletions that occurred just before a refresh.

**Consequence:** The `syncNow()` function exists partly because of this limitation. It forces a full push of everything, catching any missed deletions.

### Decision: Single Boolean Mutex

**Context:** Push and pull need synchronization. Options: a proper async mutex library, a queue, or a boolean flag.

**Decision:** A `useRef(false)` boolean.

**Tradeoffs:** Extremely simple and works because there are only two consumers (push and pull) and both check the flag at the top of their function. However, it provides no fairness guarantee — pull can be starved if push keeps rescheduling. In practice this doesn't happen because push has a 2-second debounce (plenty of time for pull to acquire the mutex between pushes), but the asymmetry (push reschedules, pull drops) means pull is always the one that yields.

### Decision: Encryption Key Derived from Sync ID

**Context:** The sync ID serves as both the account identifier and the encryption secret. Alternatives: separate password for encryption, server-managed keys, device keys with key exchange.

**Decision:** Single sync ID → SHA-256 domain separation (`"auth:"` prefix for auth token, `"crypto:"` prefix for key derivation seed) → PBKDF2 with server salt for encryption key.

**Tradeoffs:** Simpler UX (one string to remember), but the sync ID must be treated as a password. If compromised, both authentication and encryption are broken. The 100,000 PBKDF2 iterations provide some brute-force resistance, and the server-provided salt prevents rainbow table attacks, but the sync ID is only 80 bits of entropy (10 random bytes).

**Consequence:** The UI prominently warns users to save the sync ID in a password manager. There is no "forgot sync ID" recovery — if lost, the server data is irrecoverable.

### Decision: Last-Writer-Wins with Delete Priority

**Context:** Concurrent edits on different devices create conflicts. Options: CRDTs, operational transforms, server-side merge, LWW timestamps.

**Decision:** Simple timestamp comparison (`remote.updatedAt > local.updatedAt`), with deletions always winning regardless of timestamps.

**Tradeoffs:** Can lose edits if two devices modify the same entry simultaneously — the older edit is silently discarded. But for a personal engineering notebook with typically one active device, conflicts are rare. Delete priority means accidental deletes propagate immediately and irreversibly, but the alternative (keeping deleted entries alive on other devices) is more confusing.

### Decision: Separate Pull and Push Cursors

**Context:** A single "last sync" cursor would be simpler. Two cursors is more complex but prevents entry loss.

**Decision:** `lastSyncSeq` (server-assigned integers, advanced by pull only) and `lastSyncAt` (client timestamp, advanced by push only).

**Tradeoffs:** More state to manage and more opportunities for bugs (see Section 7.2). But a single cursor conflates "where am I in the server's history" with "what have I sent" — advancing one affects the other. The bug that prompted this separation caused silent entry loss, which is the worst possible failure mode for a sync system.

### Technical Debt and Risks

1. **Push conflicts are not handled client-side.** The `PushResponse` includes a `conflicts` array, but the client ignores it. If the server detects a conflict (entry pushed simultaneously from two devices), the client doesn't know about it. The server appears to handle this by accepting the latest entry, but the client has no retry-with-merge logic.

2. **No offline queue.** If a push fails, the retry mechanism is in-memory (timeout refs). If the user closes the tab during retry backoff, the pending push is lost. The fallback (`updatedAt > lastSyncAt`) will eventually catch it, but not until the next session.

3. **`refreshArchive()` is not called after pull.** When a pull merges entries that are archived, the archive view is stale until the user manually opens it (which triggers `refreshArchive`). Only `refresh()` is called, which loads recent active entries.

4. **`unarchiveEntry` emits `entry-changed`** but the CLAUDE.md incorrectly states it does NOT. The code at `useEntries.ts:129` shows `emit("entry-changed", { entryId: id })` after unarchive. This means unarchive does trigger a sync push, contrary to what the documentation says.

---

## 9. Appendix

### 9.1 Glossary

| Term | Definition |
|------|-----------|
| **Sync ID** | A `wl-` prefixed 20-character hex string that serves as both account identifier and encryption secret. Format: `wl-a1b2c3d4e5f6a7b8c9d0`. |
| **Auth token** | `SHA-256("auth:" + syncId)`. Sent in `X-Auth-Token` header. The server stores this, never the raw sync ID. |
| **Server seq / serverSeq** | A monotonically increasing integer assigned by the sync server to each stored entry. Used as the pagination cursor for pull operations. |
| **SyncEntry** | The encrypted wire format: `{ id, updatedAt, isArchived, isDeleted, encryptedPayload, integrityHash, serverSeq? }`. |
| **Deletion marker** | A `SyncEntry` with `isDeleted: true` and empty `encryptedPayload`. Created by push to propagate local deletes to other devices. |
| **Dirty entry** | An entry whose ID is in `dirtyEntriesRef` — it has been modified since the last push and needs to be synced. |
| **Merge** | The process of integrating remote entries into the local IndexedDB. Uses last-writer-wins with delete priority. |
| **Full sync** | The bidirectional exchange during `connect()`: sends all local entries, receives all server entries, merges both directions. |
| **Cursor reset** | Setting `lastSyncSeq = 0` to force a full re-pull from the beginning of the server's history. Triggered by `syncNow()`. |

### 9.2 File Index

| File | Lines | Purpose |
|------|-------|---------|
| `sync/index.ts` | 6 | Public API: exports SyncProvider, useSyncContext, components, types |
| `sync/types/sync.ts` | 76 | All type definitions: SyncConfig, SyncStatus, SyncEntry, API responses |
| `sync/context/SyncContext.tsx` | 33 | React context wrapper, memoized value |
| `sync/hooks/useSync.ts` | 405 | Orchestrator: intervals, events, push/pull, account lifecycle |
| `sync/storage/sync-settings.ts` | 25 | SyncConfig persistence to IndexedDB settings store |
| `sync/utils/sync-operations.ts` | 125 | pushEntries() and pullEntries() — core sync algorithms |
| `sync/utils/merge.ts` | 61 | mergeRemoteEntries() — conflict resolution, IDB writes |
| `sync/utils/sync-crypto.ts` | 85 | Entry-level encrypt/decrypt with integrity hash |
| `sync/utils/crypto.ts` | 77 | Primitives: key derivation, AES-GCM, sync ID generation |
| `sync/utils/integrity.ts` | 16 | SHA-256 plaintext hashing |
| `sync/utils/sync-api.ts` | 100 | HTTP client for 6 server endpoints |
| `sync/utils/sync-events.ts` | 9 | Thin wrappers around typed event bus |
| `sync/components/StorageSubmenu.tsx` | 347 | Settings UI: mode toggle, connect/disconnect, sync now |
| `sync/components/SyncStatusIndicator.tsx` | 36 | Green/blue/red status dot |

### 9.3 Timing Constants

| Constant | Value | Location | Purpose |
|----------|-------|----------|---------|
| `PULL_INTERVAL_MS` | 30,000ms | useSync.ts:14 | Interval between automatic pulls |
| `PUSH_DEBOUNCE_MS` | 2,000ms | useSync.ts:15 | Debounce delay before push after entry change |
| `PUSH_RETRY_DELAYS` | [5s, 15s, 30s, 60s] | useSync.ts:16 | Exponential backoff for failed pushes |
| Auto-save debounce | 500ms | useAutoSave.ts:42 | Delay before saving editor content to IndexedDB |
| Pull page size | 100 | sync-operations.ts:81 | Entries per pull API request |
| PBKDF2 iterations | 100,000 | crypto.ts:1 | Key derivation cost factor |
