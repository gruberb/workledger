# Sync & Encryption Flow

Exhaustive documentation of how WorkLedger's sync and encryption system works, including every trigger, edge case, and race condition. Written to prevent future sync bugs.

**Source files:** All sync code lives in `src/features/sync/`. Cross-feature communication uses `src/utils/events.ts`.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Provider Hierarchy & Initialization](#provider-hierarchy--initialization)
3. [Encryption Flow](#encryption-flow)
4. [Event System & Sync Triggers](#event-system--sync-triggers)
5. [Push Flow](#push-flow)
6. [Pull Flow](#pull-flow)
7. [Merge Logic](#merge-logic)
8. [Mutex & Concurrency](#mutex--concurrency)
9. [Dirty Tracking](#dirty-tracking)
10. [Timing & Debounce](#timing--debounce)
11. [Account Lifecycle](#account-lifecycle)
12. [syncNow() — Recovery Tool](#syncnow--recovery-tool)
13. [Mode Switching](#mode-switching)
14. [Config & Cursor Semantics](#config--cursor-semantics)
15. [Error Handling & Recovery](#error-handling--recovery)
16. [Edge Cases & Race Conditions](#edge-cases--race-conditions)
17. [API Contract](#api-contract)
18. [Complete Trigger Reference](#complete-trigger-reference)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│  App.tsx                                         │
│  ┌────────────────────────────────────────────┐  │
│  │  EntriesProvider                           │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │  SyncProvider                        │  │  │
│  │  │  ┌────────────────────────────────┐  │  │  │
│  │  │  │  SidebarProvider + rest ...    │  │  │  │
│  │  │  └────────────────────────────────┘  │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

SyncProvider sits **inside** EntriesProvider (has access to `refresh()`) but **outside** SidebarProvider. This means sync can reload entries into the UI but cannot directly manipulate sidebar state.

### File Map

| File | Role |
|------|------|
| `hooks/useSync.ts` | Orchestrator — push, pull, connect, disconnect, intervals, mutex |
| `utils/sync-operations.ts` | Push and pull business logic (encryption, pagination, merge delegation) |
| `utils/merge.ts` | Merge remote entries into local IndexedDB |
| `utils/sync-api.ts` | HTTP API calls to sync server |
| `utils/sync-events.ts` | Event listener wrappers for `entry-changed` and `entry-deleted` |
| `utils/crypto.ts` | Low-level crypto: PBKDF2 key derivation, AES-GCM encrypt/decrypt |
| `utils/sync-crypto.ts` | Entry-level encrypt/decrypt (builds payload, calls crypto.ts) |
| `utils/integrity.ts` | SHA-256 plaintext hash for integrity verification |
| `storage/sync-settings.ts` | Persist/load `SyncConfig` to/from IndexedDB settings store |
| `types/sync.ts` | All type definitions: SyncConfig, SyncStatus, SyncEntry, API responses |
| `context/SyncContext.tsx` | React context that exposes `useSync()` to the component tree |

---

## Provider Hierarchy & Initialization

### Startup sequence (4 phases)

**Phase 1 — Config load** (`useSync.ts:64-70`)
```
useEffect → loadSyncConfig() from IndexedDB → setConfig() → setConfigLoaded(true)
```

**Phase 2 — Key derivation & first pull** (`useSync.ts:74-97`)
```
Watches: configLoaded, config.mode, config.syncId, config.salt
If mode === "remote" && syncId && salt:
  → deriveKey(syncId, salt)     → cryptoKeyRef
  → computeAuthToken(syncId)    → authTokenRef
  → pull()                      → immediate first pull
  → startPullInterval()         → 30s recurring pull
```

**Phase 3 — Event listeners** (`useSync.ts:101-116`)
```
Watches: config.mode
If mode === "remote":
  → onEntryChanged(handler)     → adds to dirtyEntriesRef, schedulePush()
  → onEntryDeleted(handler)     → adds to dirtyEntriesRef + deletedEntriesRef, schedulePush()
```

**Phase 4 — Visibility listener** (`useSync.ts:120-130`)
```
Watches: config.mode
If mode === "remote":
  → document.addEventListener("visibilitychange", ...)
  → On tab focus: immediate pull()
```

### Teardown

All effects return cleanup functions. Switching mode to "local" or unmounting stops intervals, cancels timeouts, and unsubscribes event listeners.

---

## Encryption Flow

### Key Derivation Chain

```
syncId (e.g. "wl-a1b2c3d4e5f6a7b8c9d0")
  │
  ├─ SHA-256("auth:" + syncId)  →  authToken (64-char hex)
  │     Used as X-Auth-Token header. Server never sees raw syncId.
  │
  └─ SHA-256("crypto:" + syncId)  →  cryptoSeed (64-char hex)
        │
        └─ PBKDF2(cryptoSeed, server-salt, 100000 iterations, SHA-256)
              │
              └─ AES-GCM 256-bit CryptoKey (non-extractable, encrypt+decrypt only)
```

The `"auth:"` and `"crypto:"` prefixes create **domain separation** — knowing the auth token reveals nothing about the encryption key.

### What Gets Encrypted

| Field | Encrypted? | Visible to Server |
|-------|-----------|-------------------|
| `id` | No | Yes |
| `updatedAt` | No | Yes |
| `isArchived` | No | Yes |
| `isDeleted` | No | Yes |
| `dayKey` | **Yes** | No |
| `createdAt` | **Yes** | No |
| `blocks` (content) | **Yes** | No |
| `tags` | **Yes** | No |
| `integrityHash` | No | Yes (hash of plaintext) |

### Encrypt Entry (`sync-crypto.ts:25-48`)

```
1. Build payload: { dayKey, createdAt, updatedAt, blocks, isArchived, tags }
2. plaintext = JSON.stringify(payload)
3. integrityHash = SHA-256(plaintext)
4. encryptedPayload = AES-GCM-256(plaintext, key, random 12-byte IV)
5. Return SyncEntry: { id, updatedAt, isArchived, isDeleted, encryptedPayload, integrityHash }
```

### Decrypt Entry (`sync-crypto.ts:50-85`)

```
1. If isDeleted → return skeleton entry (no decryption needed)
2. plaintext = AES-GCM-256-decrypt(encryptedPayload, key)
3. payload = JSON.parse(plaintext)
4. Verify integrity hash — warn on mismatch but DO NOT reject
   (AES-GCM already authenticates; mismatches expected for pre-hash-fix entries)
5. Return DecryptedEntry with all fields
```

### AES-GCM Wire Format

```
Base64( IV[12 bytes] || Ciphertext[variable] || AuthTag[16 bytes, appended by AES-GCM] )
```

Random IV per encryption ensures identical plaintext produces different ciphertext.

---

## Event System & Sync Triggers

### Event Bus (`src/utils/events.ts`)

In-memory typed event bus using `Map<string, Set<handler>>`. Three event types:

```typescript
"entry-changed": { entryId: string }   // Entry created, updated, tags changed, or archived
"entry-deleted": { entryId: string }   // Entry permanently deleted from IndexedDB
"navigate-entry": { entryId: string }  // Cross-entry navigation (not sync-related)
```

### Which Operations Emit Events

| Operation | Event Emitted | Triggers Sync Push |
|-----------|--------------|-------------------|
| `createEntry` | `entry-changed` | Yes |
| `updateEntry` | `entry-changed` | Yes |
| `updateEntryTags` | `entry-changed` | Yes |
| `archiveEntry` | `entry-changed` | Yes |
| `unarchiveEntry` | `entry-changed` | Yes |
| `deleteEntry` | `entry-deleted` | Yes |

### Edit-to-Sync Chain (Complete Trace)

```
1. User types in editor
2. BlockNote onChange fires (immediate)
3. useAutoSave debounces (500ms)
4. dbUpdateEntry() writes to IndexedDB
5. emit("entry-changed", { entryId })
6. Sync event listener fires (sync-events.ts)
7. entryId added to dirtyEntriesRef
8. setStatus({ pendingChanges: dirtyEntriesRef.size })
9. schedulePush() — clears previous timeout, sets new 2s timeout
10. ... 2 seconds of no new edits ...
11. push() fires
12. Reads dirty entries from IndexedDB, encrypts, sends to server
13. Clears dirtyEntriesRef, sets phase = "idle"
```

**Total latency from keystroke to server:** ~2.5s minimum (500ms auto-save + 2000ms push debounce).

---

## Push Flow

### Entry Point (`useSync.ts:143-183`)

```
push(forceAll = false)
  │
  ├─ Guard: key && token && mode === "remote"  → return if missing
  ├─ Mutex check: if locked → schedulePush() and return (RESCHEDULES)
  ├─ Acquire mutex
  ├─ Set phase = "pushing"
  │
  ├─ pushEntries(key, token, config, dirtyIds, deletedIds, forceAll)
  │     │
  │     ├─ getAllEntries() from IndexedDB
  │     ├─ Filter entries to push:
  │     │     forceAll? → all entries
  │     │     dirtyIds.size > 0? → only dirty entries
  │     │     else → entries where updatedAt > config.lastSyncAt (catch-up fallback)
  │     ├─ Build deletion markers for deletedIds (isDeleted: true, empty payload)
  │     ├─ Encrypt non-deleted entries via encryptEntry()
  │     ├─ apiPushEntries(token, [...encrypted, ...deletionMarkers])
  │     └─ Return { serverSeq, syncedAt }
  │
  ├─ Update config: lastSyncAt = result.syncedAt (NOT lastSyncSeq)
  ├─ Clear dirtyEntriesRef and deletedEntriesRef
  ├─ Set status: phase = "idle", pendingChanges = 0
  │
  ├─ On error: Set phase = "error" (dirty entries NOT cleared)
  │     └─ If retryable (network/5xx) and retries < 4 → schedule retry with backoff
  └─ Finally: Release mutex
```

### Key Invariant

Push **only updates `lastSyncAt`**, never `lastSyncSeq`. Only pull advances the sequence cursor. This separation is critical — mixing them up causes entries to be skipped during pull.

---

## Pull Flow

### Entry Point (`useSync.ts:185-215`)

```
pull()
  │
  ├─ Guard: key && token && mode === "remote"  → return if missing
  ├─ Mutex check: if locked → return immediately (DROPS SILENTLY, no reschedule)
  ├─ Acquire mutex
  ├─ Set phase = "pulling"
  │
  ├─ pullEntries(key, token, config, onPhaseChange)
  │     │
  │     ├─ since = config.lastSyncSeq
  │     ├─ PAGINATION LOOP (while hasMore):
  │     │     ├─ apiPullEntries(token, since, 100)
  │     │     ├─ Decrypt each entry individually (catch per-entry errors)
  │     │     ├─ mergeRemoteEntries(decrypted)
  │     │     ├─ Advance cursor to LAST ENTRY's serverSeq (not global!)
  │     │     └─ Safety: if cursor didn't advance → break (prevent infinite loop)
  │     │
  │     ├─ After loop: if global lastServerSeq > cursor → advance to global
  │     └─ Return { serverSeq, syncedAt, totalMerged, hadEntries }
  │
  ├─ If hadEntries → refresh() to reload UI
  ├─ Update config: lastSyncSeq = result.serverSeq AND lastSyncAt = result.syncedAt
  ├─ Set status: phase = "idle"
  │
  ├─ On error: Set phase = "error" (cursor NOT updated — will retry from same position)
  └─ Finally: Release mutex
```

### Pagination Cursor Advancement

This was the source of a critical bug (fixed in v2.2.1). The cursor must advance to the **last entry's `serverSeq`** in each batch, not the global `serverSeq`:

```
Page 1: entries with serverSeq [1, 2, 3, 4, 5], global serverSeq = 100
  → Cursor advances to 5 (last entry), not 100
Page 2: entries with serverSeq [6, 7, 8, 9, 10], global serverSeq = 100
  → Cursor advances to 10
...until hasMore = false...
Final: cursor set to max(lastBatchCursor, globalServerSeq)
```

Using the global serverSeq would skip entries 6-99 on the first page.

### Stuck Cursor Protection

If entries are returned but the cursor doesn't advance (entries lack `serverSeq` or all have `seq <= since`), the loop breaks with a warning to prevent infinite looping.

---

## Merge Logic

### Algorithm (`merge.ts:16-52`)

For each remote entry:

```
1. Fetch local entry by ID
2. If remote.isDeleted:
     If local exists → delete from IDB + delete search index
     If no local → skip (nothing to delete)
3. Validate via Zod schema (validateEntry)
     If invalid → warn and skip (don't crash)
4. shouldOverwrite = !local || remote.updatedAt > local.updatedAt
     (Strict >  — ties keep local version)
5. If should overwrite → db.put("entries", validatedEntry)
```

### Conflict Resolution Strategy

**Last-writer-wins** based on `updatedAt` timestamps.

| Scenario | Result |
|----------|--------|
| Entry doesn't exist locally | Always write remote |
| `remote.updatedAt > local.updatedAt` | Remote wins |
| `remote.updatedAt === local.updatedAt` | **Local wins** (no overwrite) |
| `remote.updatedAt < local.updatedAt` | Local wins |
| Remote says deleted | **Always delete** (no timestamp guard) |

### What Merge Does NOT Do

- **No field-level merge.** The entire entry is replaced atomically.
- **No event emission.** Merged entries don't fire `entry-changed`, so they can't trigger cascading syncs.

### What Merge DOES Do (beyond writing)

- **Updates search index.** After writing a merged entry, `updateSearchIndex()` is called so remotely-merged entries are immediately searchable.

---

## Mutex & Concurrency

### Implementation (`useSync.ts:29`)

Simple boolean ref: `const mutexRef = useRef(false)`. Not a true mutex — no queue, no priority.

### Behavior Table

| Operation Requested | Mutex Free | Mutex Held by Push | Mutex Held by Pull |
|--------------------|-----------|-------------------|-------------------|
| **Push** | Acquires, runs | Reschedules via `schedulePush()` | Reschedules via `schedulePush()` |
| **Pull** | Acquires, runs | **Drops silently** | **Drops silently** |

**Why the asymmetry?** Push reschedules because dirty entries must not be lost. Pull drops because the next interval tick (30s) or visibility change will retry — no data loss risk.

**Implication:** During a long push (many entries to encrypt), multiple pull attempts may be silently dropped. If the push takes >30s, one full pull interval is missed.

---

## Dirty Tracking

### State (`useSync.ts:32-33`)

```typescript
dirtyEntriesRef = useRef<Set<string>>(new Set())   // All changed entry IDs
deletedEntriesRef = useRef<Set<string>>(new Set())  // Subset: permanently deleted IDs
```

### Lifecycle

| Event | dirtyEntriesRef | deletedEntriesRef |
|-------|----------------|-------------------|
| `entry-changed` fires | Add entryId | — |
| `entry-deleted` fires | Add entryId | Add entryId |
| Push succeeds | **Clear** | **Clear** |
| Push fails | **Kept** (retry on next push) | **Kept** |
| Disconnect / mode→local | **Clear** (unsent changes lost!) | **Clear** |
| Page refresh | **Lost** (in-memory only) | **Lost** |

### Recovery After Page Refresh

Dirty tracking is entirely in-memory. On page refresh, the sets are empty. Recovery:
- `push()` fallback path: if no dirty IDs, pushes entries where `updatedAt > config.lastSyncAt` (catches anything modified since last sync).
- `syncNow()` forces `push(true)` which sends ALL entries regardless.

---

## Timing & Debounce

### All Timers

| Timer | Duration | Resets On | Purpose |
|-------|----------|-----------|---------|
| Auto-save debounce | 500ms | Every keystroke | Debounce editor saves to IndexedDB |
| Push debounce | 2,000ms | Every `entry-changed`/`entry-deleted` | Batch rapid edits into one push |
| Push retry backoff | 5s / 15s / 30s / 60s | New `schedulePush()` call | Retry transient push failures |
| Pull interval | 30,000ms | — (fixed interval) | Periodic check for remote changes |
| Visibility pull | Immediate | Tab becomes visible | Catch up after tab was backgrounded |

### Timing Chain: Keystroke to Server

```
t=0ms     User types
t=0ms     BlockNote onChange fires
t=500ms   Auto-save writes to IndexedDB, emits entry-changed
t=500ms   schedulePush() clears previous timeout, sets new 2s timeout
          (If user types again at t=800ms, auto-save fires at t=1300ms,
           schedulePush resets, push fires at t=3300ms)
t=2500ms  push() fires (if no more edits)
t=2500ms+ Network round-trip to server
```

---

## Account Lifecycle

### Generate Sync ID (`useSync.ts:219-248`)

Creates a **new** account:
```
1. generateSyncIdLocal() → random "wl-" + 20 hex chars
2. computeAuthToken(syncId) → SHA-256 hash
3. apiCreateAccount(authToken) → server creates account, returns { salt }
4. deriveKey(syncId, salt) → AES-256 CryptoKey
5. Save config with mode="remote", syncId, salt, lastSyncSeq=0
6. No sync happens here — just account setup
```

### Connect to Existing Account (`useSync.ts:250-306`)

Connects to an **existing** account (e.g., second device):
```
1. computeAuthToken(syncId)
2. apiValidateAccount(authToken) → verify account exists, get salt
3. deriveKey(syncId, salt)
4. FULL BIDIRECTIONAL SYNC:
   a. getAllEntries() → read all local entries
   b. encryptEntry() each → encrypt all
   c. apiFullSync(authToken, encrypted) → send all local, receive all server
   d. decryptEntry() each server entry (skip failures)
   e. mergeRemoteEntries(decrypted) → merge into local IDB
   f. refresh() → reload UI
5. Save config with lastSyncSeq = fullRes.serverSeq
6. startPullInterval()
```

**`connect()` is NOT just a "connect"** — it does a full sync. This is the initial reconciliation.

### Disconnect (`useSync.ts:308-321`)

```
1. Stop intervals, push timeout, and retry timeout
2. Reset retry counter
3. Clear cryptoKeyRef and authTokenRef
4. Clear dirtyEntriesRef and deletedEntriesRef (unsent changes are lost!)
5. clearSyncConfig() from IndexedDB
6. Reset to DEFAULT_SYNC_CONFIG (mode="local")
```

### Delete Account (`useSync.ts:321-331`)

```
1. Try: apiDeleteAccount(authToken) → delete server-side
2. Catch: if server delete fails, continue anyway
3. disconnect() → clean up locally
```

Server-side delete failure = orphaned server account.

---

## syncNow() — Recovery Tool

`syncNow()` (`useSync.ts:351-364`) is fundamentally different from regular sync:

```
1. Reset lastSyncSeq to 0 (force full re-pull from beginning)
2. Save reset config to IndexedDB
3. pull() → downloads ALL entries from server (paginated from seq 0)
4. push(true) → uploads ALL local entries (forceAll = true)
```

This recovers from cursor-advancement bugs where entries were skipped. It's a **recovery tool**, not a regular sync operation. The "Sync now" button in the UI triggers this.

---

## Mode Switching

### Switch to Local (`useSync.ts:333-342`)

```
1. stopIntervals() — kill pull interval
2. clearTimeout(pushTimeout) — cancel pending push
3. clearTimeout(pushRetryTimeout) — cancel pending retry
4. dirtyEntriesRef.clear() — unsent changes lost!
5. deletedEntriesRef.clear()
6. Save config with mode = "local"
```

Does NOT clear `cryptoKeyRef` or `authTokenRef`.

### Switch to Remote

```
1. Save config with mode = "remote"
```

That's it. Key derivation and intervals are started by the `useEffect` watching `config.mode` + `config.syncId` + `config.salt`. If `syncId`/`salt` aren't set yet (user hasn't connected), nothing happens until they generate or connect a sync ID.

### Event Listener Lifecycle

Event listeners are only active when `config.mode === "remote"` (`useSync.ts:101-116`). The `useEffect` cleanup tears them down on mode change, and the effect re-creates them if mode changes back to "remote".

---

## Config & Cursor Semantics

### SyncConfig Fields

```typescript
interface SyncConfig {
  mode: "local" | "remote";
  syncId: string | null;      // Raw sync ID (wl-...) — the root secret
  salt: string | null;         // Server-provided PBKDF2 salt (base64)
  serverUrl: string | null;    // Custom server URL (null = default)
  lastSyncSeq: number;         // Pull cursor: server sequence number
  lastSyncAt: number | null;   // Wall-clock time of last successful sync
}
```

### lastSyncSeq vs lastSyncAt

| Field | Updated By | Purpose |
|-------|-----------|---------|
| `lastSyncSeq` | Pull only | Cursor for incremental pull. "Give me entries after this server sequence." |
| `lastSyncAt` | Push and Pull | Wall-clock timestamp. Used as fallback filter in push when no dirty IDs. |

**Critical rule:** Only pull advances `lastSyncSeq`. Push only updates `lastSyncAt`. Mixing these up causes:
- If push updated `lastSyncSeq` → pull would skip server entries that arrived between pushes.
- If pull didn't update `lastSyncSeq` → pull would re-download already-merged entries forever.

---

## Error Handling & Recovery

### Push Errors

```
try { ... push logic ... }
catch → phase = "error", error message set
finally → mutex released
```

- Dirty entries **NOT cleared** — next push retries them.
- No automatic reschedule — next `entry-changed` event or manual `syncNow()` retries.

### Pull Errors

```
try { ... pull logic ... }
catch → phase = "error", error message set
finally → mutex released
```

- `lastSyncSeq` **NOT updated** — next pull retries from same cursor.
- Pull interval continues — automatic retry every 30s.

### Per-Entry Decryption Failures

Individual entries that fail decryption are **warned and skipped** (`sync-operations.ts:89-94`). The rest of the batch continues. This prevents one corrupted entry from blocking the entire sync.

### Validation Failures

Entries failing Zod validation are **warned and skipped** (`merge.ts:36-41`). The Zod schema uses `.strip()` to silently remove unknown fields before validation.

### Integrity Hash Mismatches

Hash mismatches are **warned but not rejected** (`sync-crypto.ts:69-73`). AES-GCM already provides authentication — if decryption succeeded, the data is untampered. Mismatches are expected for entries created before the hash computation was fixed (sortedStringify → raw plaintext). The hash is corrected on next push.

### Push Retry with Backoff

Failed pushes automatically retry with exponential backoff for transient errors (network failures, 5xx server errors). Client errors (4xx) are not retried.

```
Retry delays: 5s → 15s → 30s → 60s (max 4 retries)
```

- Retry counter resets on successful push or when a new `entry-changed` event fires `schedulePush()`.
- Retry counter and timeout are cleared on disconnect, mode switch, and component unmount.
- Pull has no retry mechanism beyond its 30-second interval and visibility-change trigger.

---

## Edge Cases & Race Conditions

### 1. Rapid Edits During Push

**Scenario:** User edits entry A. Push starts. User edits entry B before push completes.

**Behavior:** Entry B's `entry-changed` fires `schedulePush()`. Since mutex is held, `schedulePush()` is called (not directly from the mutex check, but from the event listener path). After the current push completes and releases the mutex, the scheduled push fires and sends entry B.

**No data loss** — the debounce reschedule ensures entry B is pushed.

### 2. Pull During Push

**Scenario:** Pull interval fires while a push is in progress.

**Behavior:** Pull sees `mutexRef.current === true` and returns immediately. No reschedule. The next interval tick (30s later) or visibility change retries.

**Acceptable** — pull is periodic and will naturally retry.

### 3. Push During Pull

**Scenario:** Entry changes while a pull is in progress.

**Behavior:** The `entry-changed` handler calls `schedulePush()`. Push fires after the debounce, sees the mutex held by pull, and calls `schedulePush()` again. Once pull releases the mutex, the rescheduled push fires.

**No data loss** — push reschedules until mutex is free.

### 4. Page Refresh With Unsent Changes

**Scenario:** User edits an entry, refreshes the page within 2 seconds (before push debounce fires).

**Behavior:** `dirtyEntriesRef` is lost (in-memory only). On next page load, `pull()` runs on initialization. No automatic push runs unless the user edits again.

**Recovery:** The entry IS saved in IndexedDB (auto-save at 500ms). On next push (triggered by any edit), the fallback filter `e.updatedAt > config.lastSyncAt` catches it. Or `syncNow()` sends everything.

### 5. Concurrent Edits on Two Devices

**Scenario:** Device A and Device B both edit the same entry.

**Behavior:** Last-writer-wins. Whichever device's `updatedAt` is higher keeps its version. The other device's changes are **silently overwritten** on pull+merge.

**Risk:** Clock skew between devices. If device A's clock is behind, its edits could be consistently overwritten even if they're more recent in wall-clock time.

### 6. Delete on Device A, Edit on Device B

**Scenario:** Device A deletes an entry. Device B (offline) edits the same entry, then comes online.

**Behavior:**
- Device B pushes its edited entry to the server.
- Device A's deletion marker is also on the server.
- When Device B pulls, the deletion marker has `isDeleted: true`. Merge always deletes regardless of timestamps.
- **The entry is deleted on Device B.** The edit is lost.

### 7. Unarchive Syncing (Fixed)

**Scenario:** User unarchives an entry on Device A.

**Behavior:** `unarchiveEntry` sets `isArchived = false` and `updatedAt = Date.now()` in IndexedDB, then emits `entry-changed`. The sync system is notified and pushes the change.

**Previously:** This was a bug — `unarchiveEntry` did not emit `entry-changed`. Fixed to match `archiveEntry`'s behavior.

### 8. Server Entries During Pull Pagination

**Scenario:** New entries are pushed to the server by another device while a paginated pull is in progress.

**Behavior:** The new entries have `serverSeq` values higher than the current pagination range. After the pagination loop completes, the final catch-up (`if lastServerSeq > since`) advances the cursor to include them. They'll be fetched on the next pull.

### 9. Disconnect With Pending Push

**Scenario:** User disconnects sync while entries are dirty (pending push).

**Behavior:** `disconnect()` clears `dirtyEntriesRef`. The pending changes are **never pushed**. They remain in local IndexedDB but won't sync to the server.

**Recovery:** If the user reconnects later with `connect()`, the full sync sends all local entries.

### 10. Config Race in Push

**Scenario:** Pull updates `lastSyncSeq` while push is running.

**Behavior:** Push re-reads `configRef.current` when saving (`useSync.ts:170`), not the config captured at push start. This preserves the `lastSyncSeq` value that pull may have updated during the push.

---

## API Contract

### Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/v1/accounts` | Body: `{ authToken }` | Create new account |
| `GET` | `/api/v1/accounts/validate` | `X-Auth-Token` | Validate account, get salt |
| `DELETE` | `/api/v1/accounts` | `X-Auth-Token` | Delete account |
| `POST` | `/api/v1/sync/push` | `X-Auth-Token` | Push entries to server |
| `GET` | `/api/v1/sync/pull?since=N&limit=N` | `X-Auth-Token` | Pull entries from server |
| `POST` | `/api/v1/sync/full` | `X-Auth-Token` | Full bidirectional sync |

### Wire Format (SyncEntry)

```typescript
{
  id: string;              // Entry UUID (cleartext)
  updatedAt: number;       // Millisecond timestamp (cleartext)
  isArchived: boolean;     // Archive flag (cleartext)
  isDeleted: boolean;      // Deletion tombstone flag (cleartext)
  encryptedPayload: string; // Base64(IV + AES-GCM ciphertext)
  integrityHash: string;    // SHA-256 hex of plaintext JSON
  serverSeq?: number;       // Server-assigned sequence (only in pull responses)
}
```

### API Response Types

```typescript
CreateAccountResponse: { salt: string }
ValidateResponse: { valid: boolean; entryCount: number; createdAt: number; salt: string }
PushResponse: { accepted: number; conflicts: ConflictEntry[]; serverSeq: number }
PullResponse: { entries: SyncEntry[]; serverSeq: number; hasMore: boolean }
FullSyncResponse: { entries: SyncEntry[]; serverSeq: number; merged: number }
```

---

## Complete Trigger Reference

### What Triggers a Push

| Trigger | Path | forceAll |
|---------|------|----------|
| Entry created | `entry-changed` → `schedulePush()` → `push()` | false |
| Entry updated | `entry-changed` → `schedulePush()` → `push()` | false |
| Entry tags changed | `entry-changed` → `schedulePush()` → `push()` | false |
| Entry archived | `entry-changed` → `schedulePush()` → `push()` | false |
| Entry deleted | `entry-deleted` → `schedulePush()` → `push()` | false |
| Entry unarchived | `entry-changed` → `schedulePush()` → `push()` | false |
| "Sync now" clicked | `syncNow()` → `push(true)` | **true** |
| Push failure (retryable) | Backoff timer → `push()` | same as failed push |

### What Triggers a Pull

| Trigger | Path |
|---------|------|
| App startup (mode = remote) | Key derivation effect → `pull()` |
| 30-second interval | `setInterval` → `pull()` (only if tab visible) |
| Tab becomes visible | `visibilitychange` → `pull()` |
| "Sync now" clicked | `syncNow()` → `pull()` |
| Connect to account | `connect()` → `apiFullSync()` (not regular pull) |
