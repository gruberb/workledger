import type {
  CreateAccountResponse,
  ValidateResponse,
  PushResponse,
  PullResponse,
  SyncEntry,
} from "../types/sync.ts";
import { DEFAULT_SERVER_URL } from "../types/sync.ts";

export interface ApiContext {
  serverUrl: string | null;
  timeoutMs: number;
}

/** HTTP-level failure. Carries the status so retry policy doesn't parse messages. */
export class SyncHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "SyncHttpError";
    this.status = status;
  }
}

// Network failures and timeouts are transient; 408, 429 and 5xx are the
// server asking us to come back later. Other 4xx will fail the same way again.
export function isRetryableError(err: unknown): boolean {
  if (err instanceof SyncHttpError) {
    return err.status === 408 || err.status === 429 || err.status >= 500;
  }
  return true;
}

// Override with VITE_SYNC_SERVER_URL=http://localhost:3000 in .env.local for local dev
function getDefaultBaseUrl(): string {
  if (import.meta.env?.VITE_SYNC_SERVER_URL) return import.meta.env.VITE_SYNC_SERVER_URL;
  return DEFAULT_SERVER_URL;
}

function apiUrl(baseUrl: string | null, path: string): string {
  const base = baseUrl || getDefaultBaseUrl();
  return `${base.replace(/\/+$/, "")}/api/v1${path}`;
}

async function request(ctx: ApiContext, path: string, init: RequestInit, authToken?: string): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["X-Auth-Token"] = authToken;
  // Without a timeout a stalled connection never settles and blocks the sync queue forever.
  const res = await fetch(apiUrl(ctx.serverUrl, path), {
    ...init,
    headers,
    signal: AbortSignal.timeout(ctx.timeoutMs),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new SyncHttpError(res.status, `Sync server error ${res.status}: ${text || res.statusText}`);
  }
  return res;
}

export async function apiCreateAccount(ctx: ApiContext, authToken: string): Promise<CreateAccountResponse> {
  const res = await request(ctx, "/accounts", { method: "POST", body: JSON.stringify({ authToken }) });
  return res.json();
}

export async function apiValidateAccount(ctx: ApiContext, authToken: string): Promise<ValidateResponse> {
  const res = await request(ctx, "/accounts/validate", { method: "GET" }, authToken);
  return res.json();
}

export async function apiDeleteAccount(ctx: ApiContext, authToken: string): Promise<void> {
  await request(ctx, "/accounts", { method: "DELETE" }, authToken);
}

export async function apiPushEntries(ctx: ApiContext, authToken: string, entries: SyncEntry[]): Promise<PushResponse> {
  const res = await request(ctx, "/sync/push", { method: "POST", body: JSON.stringify({ entries }) }, authToken);
  return res.json();
}

export async function apiPullEntries(ctx: ApiContext, authToken: string, since: number, limit: number): Promise<PullResponse> {
  const res = await request(ctx, `/sync/pull?since=${since}&limit=${limit}`, { method: "GET" }, authToken);
  return res.json();
}

export type SyncApi = {
  createAccount: typeof apiCreateAccount;
  validateAccount: typeof apiValidateAccount;
  deleteAccount: typeof apiDeleteAccount;
  pushEntries: typeof apiPushEntries;
  pullEntries: typeof apiPullEntries;
};

export const httpSyncApi: SyncApi = {
  createAccount: apiCreateAccount,
  validateAccount: apiValidateAccount,
  deleteAccount: apiDeleteAccount,
  pushEntries: apiPushEntries,
  pullEntries: apiPullEntries,
};
