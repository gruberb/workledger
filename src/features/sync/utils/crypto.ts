const PBKDF2_ITERATIONS = 100_000;

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateSyncIdLocal(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `wl-${hex}`;
}

export async function computeAuthToken(syncId: string): Promise<string> {
  return sha256Hex("auth:" + syncId);
}

export async function computeCryptoSeed(syncId: string): Promise<string> {
  return sha256Hex("crypto:" + syncId);
}

export async function deriveKey(syncId: string, saltBase64: string): Promise<CryptoKey> {
  const cryptoSeed = await computeCryptoSeed(syncId);
  const encoder = new TextEncoder();
  const salt = Uint8Array.from(atob(saltBase64), (c) => c.charCodeAt(0));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(cryptoSeed),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encrypt(key: CryptoKey, plaintext: string): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext),
  );

  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(key: CryptoKey, ciphertextBase64: string): Promise<string> {
  const combined = Uint8Array.from(atob(ciphertextBase64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(plaintext);
}
