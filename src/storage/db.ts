import { openDB, type IDBPDatabase } from "idb";
import { emit } from "../utils/events.ts";

const DB_NAME = "workledger";
const DB_VERSION = 5;

type StoredEntry = WorkLedgerDB["entries"]["value"];

export interface WorkLedgerDB {
  entries: {
    key: string;
    value: {
      id: string;
      dayKey: string;
      createdAt: number;
      updatedAt: number;
      blocks: unknown[];
      isArchived: boolean;
      tags: string[];
      isPinned?: boolean;
      signifier?: string;
    };
    indexes: {
      "by-dayKey": string;
      "by-createdAt": number;
      "by-tags": string;
    };
  };
  searchIndex: {
    key: string;
    value: {
      entryId: string;
      dayKey: string;
      plainText: string;
      updatedAt: number;
      tags: string[];
    };
    indexes: {
      "by-dayKey": string;
    };
  };
  settings: {
    key: string;
    value: {
      key: string;
      value: string;
    };
  };
  aiConversations: {
    key: string;
    value: {
      id: string;
      entryId: string;
      frameworkId: string;
      currentStepId: string;
      messages: unknown[];
      createdAt: number;
      updatedAt: number;
    };
    indexes: {
      "by-entryId": string;
      "by-updatedAt": number;
    };
  };
}

// v3.0.1 dropped these signifiers without migrating stored entries.
const REMOVED_SIGNIFIERS = new Set(["note", "task"]);

/** Returns the upgraded entry, or null when it needs no change. */
export function upgradeLegacyEntry(entry: StoredEntry): StoredEntry | null {
  const needsPinned = entry.isPinned === undefined;
  const hasRemovedSignifier = entry.signifier !== undefined && REMOVED_SIGNIFIERS.has(entry.signifier);
  if (!needsPinned && !hasRemovedSignifier) return null;
  const upgraded: StoredEntry = { ...entry, isPinned: entry.isPinned ?? false };
  if (hasRemovedSignifier) delete upgraded.signifier;
  return upgraded;
}

let dbPromise: Promise<IDBPDatabase<WorkLedgerDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<WorkLedgerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<WorkLedgerDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          const entryStore = db.createObjectStore("entries", { keyPath: "id" });
          entryStore.createIndex("by-dayKey", "dayKey");
          entryStore.createIndex("by-createdAt", "createdAt");

          const searchStore = db.createObjectStore("searchIndex", {
            keyPath: "entryId",
          });
          searchStore.createIndex("by-dayKey", "dayKey");

          db.createObjectStore("settings", { keyPath: "key" });
        }

        if (oldVersion < 2) {
          const entryStore = transaction.objectStore("entries");
          entryStore.createIndex("by-tags", "tags", { multiEntry: true });
        }

        if (oldVersion < 3) {
          const aiStore = db.createObjectStore("aiConversations", { keyPath: "id" });
          aiStore.createIndex("by-entryId", "entryId");
          aiStore.createIndex("by-updatedAt", "updatedAt");
        }

        // v4 backfilled isPinned; v5 strips removed signifiers. One pass covers both
        // so two getAll snapshots cannot overwrite each other's puts.
        if (oldVersion < 5) {
          const entryStore = transaction.objectStore("entries");
          entryStore.getAll().then((entries) => {
            for (const entry of entries) {
              const upgraded = upgradeLegacyEntry(entry);
              if (upgraded) entryStore.put(upgraded);
            }
          });
        }
      },
      blocked() {
        emit("db-blocked", {});
      },
      blocking(_currentVersion, _blockedVersion, event) {
        // Close so the newer tab can upgrade; this tab must reload to keep writing.
        (event.target as IDBDatabase).close();
        dbPromise = null;
        emit("db-outdated", {});
      },
      terminated() {
        dbPromise = null;
      },
    }).catch((err) => {
      // Do not cache a failed open; the next call retries.
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

// Settings rows derived from entries (e.g. the backlinks index) must be wiped
// with them. Features register the key plus a hook to drop in-memory caches.
const derivedSettings = new Map<string, () => void>();

export function registerDerivedSetting(key: string, onCleared: () => void): void {
  derivedSettings.set(key, onCleared);
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["entries", "searchIndex", "aiConversations", "settings"], "readwrite");
  await Promise.all([
    tx.objectStore("entries").clear(),
    tx.objectStore("searchIndex").clear(),
    tx.objectStore("aiConversations").clear(),
    ...[...derivedSettings.keys()].map((key) => tx.objectStore("settings").delete(key)),
    tx.done,
  ]);
  for (const onCleared of derivedSettings.values()) onCleared();
}
