/** Returns a user-facing error for an unusable server URL, or null if valid. */
export function validateServerUrl(url: string): string | null {
  if (!url.trim()) return "Server URL is required";
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return "Enter a full URL, e.g. http://localhost:11434";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Only http and https URLs are allowed";
  }
  return null;
}

/** Strips trailing slashes so path joins never produce "//api/...". */
export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function isNonLocalHttp(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:") return false;
    const host = parsed.hostname;
    return host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]";
  } catch {
    return false;
  }
}
