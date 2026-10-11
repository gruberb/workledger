export type SyncMode = "local" | "remote";

export type SyncPhase = "idle" | "connecting" | "pushing" | "pulling" | "merging" | "error";

export interface SyncConfig {
  mode: SyncMode;
  syncId: string | null;
  salt: string | null;
  serverUrl: string | null;
  /** Pull cursor. Only pull advances it. */
  lastSyncSeq: number;
  /**
   * Local clock time before the last successful push read its entries.
   * Every local change older than this is on the server. Only push advances it,
   * because the `updatedAt > lastSyncAt` recovery scan depends on that.
   */
  lastSyncAt: number | null;
  /** Last successful pull, for display only. */
  lastPullAt: number | null;
}

export interface SyncStatus {
  phase: SyncPhase;
  error: string | null;
  lastSyncAt: number | null;
}

export const DEFAULT_SERVER_URL = "https://sync.workledger.org";

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  mode: "local",
  syncId: null,
  salt: null,
  serverUrl: null,
  lastSyncSeq: 0,
  lastSyncAt: null,
  lastPullAt: null,
};

export interface SyncEntry {
  id: string;
  updatedAt: number;
  isArchived: boolean;
  isDeleted: boolean;
  encryptedPayload: string;
  integrityHash: string;
  serverSeq?: number;
}

export interface CreateAccountResponse {
  salt: string;
}

export interface ValidateResponse {
  valid: boolean;
  salt: string;
}

export interface PushResponse {
  serverSeq: number;
}

export interface PullResponse {
  entries: SyncEntry[];
  serverSeq: number;
  hasMore: boolean;
}
