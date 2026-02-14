function sortedStringify(obj: unknown): string {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(sortedStringify).join(",") + "]";
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map(
    (k) => JSON.stringify(k) + ":" + sortedStringify((obj as Record<string, unknown>)[k]),
  );
  return "{" + pairs.join(",") + "}";
}

export async function computeIntegrityHash(payload: unknown): Promise<string> {
  const canonical = sortedStringify(payload);
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(canonical));
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyIntegrityHash(payload: unknown, expectedHash: string): Promise<boolean> {
  const actual = await computeIntegrityHash(payload);
  return actual === expectedHash;
}
