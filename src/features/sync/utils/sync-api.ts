import type {
  CreateAccountResponse,
  ValidateResponse,
  PushResponse,
  PullResponse,
  FullSyncResponse,
  SyncEntry,
} from "../types/sync.ts";
import { DEFAULT_SERVER_URL } from "../types/sync.ts";

// Override with VITE_SYNC_SERVER_URL=http://localhost:3000 in .env.local for local dev
function getDefaultBaseUrl(): string {
  if (import.meta.env.VITE_SYNC_SERVER_URL) return import.meta.env.VITE_SYNC_SERVER_URL;
  return DEFAULT_SERVER_URL;
}

function apiUrl(baseUrl: string | null, path: string): string {
  const base = baseUrl || getDefaultBaseUrl();
  return `${base.replace(/\/+$/, "")}/api/v1${path}`;
}

function headers(authToken: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Auth-Token": authToken,
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Sync server error ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function apiCreateAccount(syncIdHash: string, serverUrl?: string | null): Promise<CreateAccountResponse> {
  const res = await fetch(apiUrl(serverUrl ?? null, "/accounts"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authToken: syncIdHash }),
  });
  return handleResponse<CreateAccountResponse>(res);
}

export async function apiValidateAccount(authToken: string, serverUrl?: string | null): Promise<ValidateResponse> {
  const res = await fetch(apiUrl(serverUrl ?? null, "/accounts/validate"), {
    headers: headers(authToken),
  });
  return handleResponse<ValidateResponse>(res);
}

export async function apiDeleteAccount(authToken: string, serverUrl?: string | null): Promise<void> {
  const res = await fetch(apiUrl(serverUrl ?? null, "/accounts"), {
    method: "DELETE",
    headers: headers(authToken),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Sync server error ${res.status}: ${text || res.statusText}`);
  }
}

export async function apiPushEntries(
  authToken: string,
  entries: SyncEntry[],
  serverUrl?: string | null,
): Promise<PushResponse> {
  const res = await fetch(apiUrl(serverUrl ?? null, "/sync/push"), {
    method: "POST",
    headers: headers(authToken),
    body: JSON.stringify({ entries }),
  });
  return handleResponse<PushResponse>(res);
}

export async function apiPullEntries(
  authToken: string,
  since: number = 0,
  limit: number = 100,
  serverUrl?: string | null,
): Promise<PullResponse> {
  const res = await fetch(apiUrl(serverUrl ?? null, `/sync/pull?since=${since}&limit=${limit}`), {
    headers: headers(authToken),
  });
  return handleResponse<PullResponse>(res);
}

export async function apiFullSync(
  authToken: string,
  entries: SyncEntry[],
  serverUrl?: string | null,
): Promise<FullSyncResponse> {
  const res = await fetch(apiUrl(serverUrl ?? null, "/sync/full"), {
    method: "POST",
    headers: headers(authToken),
    body: JSON.stringify({ entries }),
  });
  return handleResponse<FullSyncResponse>(res);
}
