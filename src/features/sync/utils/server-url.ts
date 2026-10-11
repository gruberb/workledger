const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Returns an error message, or null when the URL is acceptable.
 * Plain http would expose the auth token and entry metadata on the wire,
 * so it is only allowed for a server on this machine.
 */
export function validateServerUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Invalid URL";
  }
  if (parsed.protocol === "https:") return null;
  if (parsed.protocol === "http:" && LOOPBACK_HOSTS.has(parsed.hostname)) return null;
  return "Server URL must use https (http is only allowed for localhost)";
}
