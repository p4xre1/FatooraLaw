/**
 * XSS / INJECTION SHIELD — output-side defense
 * Use before rendering any user-controlled value in JSX or DOM.
 */
import { sanitizeInput, escapeHtml } from "./inputGuard"

/** Render a safe text node from arbitrary input. */
export function safeText(value: unknown): string {
  return sanitizeInput(value)
}

/** Render a safe HTML snippet only when it comes from a trusted source; otherwise escape. */
export function safeHtml(value: unknown, trusted = false): string {
  if (trusted) return String(value ?? "")
  return escapeHtml(value)
}

/** Safe URL validation for links (prevents javascript: protocols and open redirects). */
export function safeUrl(input: unknown): string {
  const s = sanitizeInput(input)
  if (!s) return ""
  // Allow only http/https relative or absolute; block javascript:, data:, vbscript:, etc.
  if (/^(https?:\/\/|\/|\#)/i.test(s)) {
    return s
  }
  return ""
}

/** Safe attribute value for HTML tags (prevents attribute-breakout). */
export function safeAttr(value: unknown): string {
  return sanitizeInput(value).replace(/["'>\s]/g, "_")
}
