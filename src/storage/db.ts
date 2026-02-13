import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "workledger";
const DB_VERSION = 3;

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
      },
    });
  }
  return dbPromise;
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await db.clear("entries");
  await db.clear("searchIndex");
  await db.clear("aiConversations");
}
