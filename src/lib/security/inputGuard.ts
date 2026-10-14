/**
 * MILITARY-GRADE INPUT HARDENING — injection defense
 * Every user-controlled value passes through one of these helpers
 * before rendering, storage, or network transmission.
 */

/** Strict allowlist for safe text: alphanumeric + common punctuation only. */
const SAFE_TEXT = /^[A-Za-z0-9\s.,;:!?'"()-_@\/\+\-%]+$/
/** Block common injection patterns: script tags, event handlers, JS protocols. */
const INJECTION_SIGNS = /(<\s*script|javascript:|on\w+\s*=|eval\s*\(|expression\s*\(|<\s*iframe|<\s*object|<\s*embed|<\s*form|<\s*input)|\bselect\s+.*\bfrom\b|\binsert\s+into\b|\bdelete\s+from\b|\bdrop\s+table\b/i

/** Sanitize a string for safe HTML/text rendering. */
export function sanitizeInput(raw: unknown): string {
  if (raw === null || raw === undefined) return ""
  let s = String(raw)
  // Block injection signatures by replacing with empty
  s = s.replace(INJECTION_SIGNS, "")
  // Strip non-printable control chars except newline / tab
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
  // Collapsing multiple whitespace to prevent formatting abuse
  s = s.replace(/\s{4,}/g, " ")
  return s.trim()
}

/** Escape HTML entities to prevent XSS when inserting into DOM/text. */
export function escapeHtml(raw: unknown): string {
  const s = sanitizeInput(raw)
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Validate email with strict allowlist (prevents header-injection / XSS via email fields). */
export function isSafeEmail(input: unknown): boolean {
  const s = sanitizeInput(input)
  // RFC 5321 simplified: local@domain.tld; no control chars, spaces, or dangerous symbols
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s) && !/[\x00-\x1F\x7F]/.test(s) && !INJECTION_SIGNS.test(s)
}

/** Validate that a string passes the safe-text allowlist (good for names, cities, IDs). */
export function isSafeText(input: unknown): boolean {
  const s = sanitizeInput(input)
  return SAFE_TEXT.test(s) && s.length > 0 && s.length <= 256
}

/** Numeric-only guard for amounts / IDs (prevents command/code injection via numeric fields). */
export function toSafeNumber(input: unknown): number | null {
  const s = sanitizeInput(input)
  if (s.length === 0 || s.length > 18) return null
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  // Prevent scientific-notation / hex injection via parse
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return n
}

/** Deep-sanitize an object/array recursively before persisting to localStorage/DB. */
export function sanitizeDeepValue(value: unknown): unknown {
  if (typeof value === "string") return sanitizeInput(value)
  if (Array.isArray(value)) return value.map(sanitizeDeepValue)
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      // Key sanitation: only allow safe key chars
      const safeKey = sanitizeInput(k).replace(/[^A-Za-z0-9_-]/g, "_")
      out[safeKey] = sanitizeDeepValue(v)
    }
    return out
  }
  return value
}
