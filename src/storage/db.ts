import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "workledger";
const DB_VERSION = 2;

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
      },
    });
  }
  return dbPromise;
}
