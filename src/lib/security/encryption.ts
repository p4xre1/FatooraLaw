/**
 * CLIENT-SIDE ENCRYPTION — AES-GCM via SubtleCrypto
 * Protects exported files / CMS backups / localStorage backups.
 * Key must be derived from a user password or session token (not hardcoded).
 */

const ALGO = "AES-GCM"
const KEY_LENGTH = 256

/** Derive a CryptoKey from a password + salt using PBKDF2. */
export async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"])
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    base,
    { name: ALGO, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  )
}

/** Encrypt string -> base64 {iv, ciphertext, salt}. */
export async function encryptString(plaintext: string, password: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(password, salt)
  const enc = new TextEncoder()
  const ct = await crypto.subtle.encrypt({ name: ALGO, iv }, key, enc.encode(plaintext))
  const payload = { iv: btoa(String.fromCharCode(...iv)), ct: btoa(String.fromCharCode(...new Uint8Array(ct))), salt: btoa(String.fromCharCode(...salt)) }
  return btoa(JSON.stringify(payload))
}

/** Decrypt base64 -> string. */
export async function decryptString(b64: string, password: string): Promise<string> {
  const payload = JSON.parse(atob(b64))
  const iv = new Uint8Array(atob(payload.iv).split("").map((c) => c.charCodeAt(0)))
  const salt = new Uint8Array(atob(payload.salt).split("").map((c) => c.charCodeAt(0)))
  const ct = new Uint8Array(atob(payload.ct).split("").map((c) => c.charCodeAt(0)))
  const key = await deriveKey(password, salt)
  const dec = await crypto.subtle.decrypt({ name: ALGO, iv }, key, ct)
  return new TextDecoder().decode(dec)
}

/** Quick check if Web Crypto is available (secure environment). */
export function cryptoAvailable(): boolean {
  return typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined"
}
