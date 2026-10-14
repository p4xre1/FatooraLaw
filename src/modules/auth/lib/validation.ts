/**
 * Lightweight, dependency-free validation for the auth forms.
 *
 * These checks exist to give fast, friendly feedback in the UI — they are
 * NOT a substitute for server-side enforcement. Supabase Auth (GoTrue) and
 * Postgres RLS remain the source of truth; never trust client validation
 * alone for security decisions.
 */

// RFC 5321 practical max length for an email address.
const MAX_EMAIL_LENGTH = 254
// Simple, deliberately permissive email shape check (avoids catastrophic
// backtracking and false negatives on valid-but-unusual addresses).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Supabase's default minimum; keep in sync with your project's Auth password policy.
export const MIN_PASSWORD_LENGTH = 8
// bcrypt (used by GoTrue) only considers the first 72 bytes.
export const MAX_PASSWORD_LENGTH = 72

export const MAX_NAME_LENGTH = 120

/** Trims whitespace, strips control characters, and blocks injection signatures (defense in depth). */
export function sanitizeInput(value: string): string {
  const base = value.trim().replace(/[\u0000-\u001F\u007F]/g, "")
  // Block script/event/protocol injection patterns
  return base.replace(/(<\s*script|javascript:|on\w+\s*=|eval\s*\(|<\s*iframe|<\s*object|<\s*embed|<\s*form|select\s+.*\bfrom\b|insert\s+into|delete\s+from|drop\s+table)/gi, "")
}

export function isValidEmail(value: string): boolean {
  const email = value.trim()
  // Use strict allowlist: blocks injection signatures and restricts characters
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return false
  const safe = email.replace(/[\x00-\x1F\x7F]/g, "").replace(/(<\s*script|javascript:|on\w+\s*=|eval\s*\()/gi, "")
  if (safe !== email) return false
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(safe)
}

export type PasswordIssue = "required" | "tooShort" | "tooLong" | null

export function checkPassword(value: string): PasswordIssue {
  if (value.length === 0) return "required"
  if (value.length < MIN_PASSWORD_LENGTH) return "tooShort"
  if (new TextEncoder().encode(value).byteLength > MAX_PASSWORD_LENGTH) return "tooLong"
  return null
}

export function isNonEmpty(value: string): boolean {
  return value.trim().length > 0
}
