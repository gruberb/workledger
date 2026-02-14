export type SyncMode = "local" | "remote";

export type SyncPhase = "idle" | "pushing" | "pulling" | "merging" | "error";

export interface SyncConfig {
  mode: SyncMode;
  syncId: string | null;
  salt: string | null;
  serverUrl: string | null;
  lastSyncSeq: number;
  lastSyncAt: number | null;
}

export interface SyncStatus {
  phase: SyncPhase;
  error: string | null;
  lastSyncAt: number | null;
  pendingChanges: number;
}

export const DEFAULT_SERVER_URL = "https://sync.workledger.org";

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  mode: "local",
  syncId: null,
  salt: null,
  serverUrl: null,
  lastSyncSeq: 0,
  lastSyncAt: null,
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
  entryCount: number;
  createdAt: number;
  salt: string;
}

export interface PushResponse {
  accepted: number;
  conflicts: ConflictEntry[];
  serverSeq: number;
}

export interface PullResponse {
  entries: SyncEntry[];
  serverSeq: number;
  hasMore: boolean;
}

export interface FullSyncResponse {
  entries: SyncEntry[];
  serverSeq: number;
  merged: number;
}

export interface ConflictEntry {
  id: string;
  serverUpdatedAt: number;
  serverSeq: number;
}
