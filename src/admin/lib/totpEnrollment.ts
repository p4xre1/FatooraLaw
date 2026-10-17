/**
 * Handing the AAL2 (TOTP) factor to an authenticator app — Google Authenticator
 * and friends.
 *
 * GoTrue returns three views of the same setup: `qr_code` (raw SVG markup —
 * despite the name, it is not a URL), `secret` (unpadded base32) and `uri` (the
 * otpauth:// link). Two failure modes are handled here:
 *
 *  - the QR: the common `data:image/svg+xml;utf-8,…` wrapper is not a valid
 *    data URL (`;utf-8` is not a media-type parameter) and several browsers
 *    refuse it, leaving a broken image instead of a scannable code. A base64
 *    data URL decodes everywhere and survives `#`, quotes and newlines inside
 *    the SVG;
 *  - the setup key: Google Authenticator answers "the key value is too short"
 *    to any key under 16 characters — exactly what a wrapped `<code>` block
 *    hands back when a manual copy grabs only one line. Keys are normalized
 *    once, validated before they are shown, and copied whole in one click.
 */

/** Google Authenticator refuses setup keys shorter than this. */
export const MIN_SETUP_KEY_LENGTH = 16

/** UTF-8-safe base64: `btoa` alone chokes on non-Latin1 SVG content. */
function utf8Base64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/**
 * A browser-safe `src` for the enrollment QR. `qr_code` is raw SVG markup;
 * builds that already return a ready-made data URL are passed through.
 */
export function qrImageDataUrl(qrCode: string): string {
  const raw = qrCode.trim()
  if (raw.startsWith("data:")) return raw
  return `data:image/svg+xml;base64,${utf8Base64(raw)}`
}

/** The setup key the way authenticator apps store it: no spaces, no `=`, uppercase. */
export function normalizeSetupKey(secret: string): string {
  return secret.replace(/\s+/g, "").replace(/=+$/, "").toUpperCase()
}

/**
 * False for every value an authenticator app refuses: truncated copies ("key
 * value is too short"), empties and text outside the base32 alphabet.
 */
export function isUsableSetupKey(secret: string): boolean {
  const key = normalizeSetupKey(secret)
  return key.length >= MIN_SETUP_KEY_LENGTH && /^[A-Z2-7]+$/.test(key)
}

/** Groups of four for reading/typing; `normalizeSetupKey` is the copy form. */
export function formatSetupKey(secret: string): string {
  return normalizeSetupKey(secret).replace(/(.{4})/g, "$1 ").trim()
}

/** Fallback when the enroll response omits `secret`: read it off the otpauth URI. */
export function secretFromUri(uri: string): string {
  try {
    return new URL(uri).searchParams.get("secret") ?? ""
  } catch {
    return ""
  }
}
