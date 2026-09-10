import type { Translation } from "../language/translations"

/**
 * Supabase (GoTrue) returns English error strings regardless of app
 * language. This maps the common ones to a translated, user-friendly
 * message and otherwise falls back to a generic "unexpected" message —
 * we deliberately avoid surfacing raw provider errors to end users.
 */
export function mapAuthError(message: string, t: Translation): string {
  const m = message.toLowerCase()

  if (m.includes("invalid login credentials")) return t.errors.invalidCredentials
  if (m.includes("already registered") || m.includes("already exists") || m.includes("user already registered")) {
    return t.errors.emailInUse
  }
  if (m.includes("password should be at least") || m.includes("password is too short") || m.includes("should contain at least")) {
    return t.errors.weakPassword
  }
  if (m.includes("email not confirmed")) return t.errors.emailNotConfirmed
  if (m.includes("rate limit") || m.includes("too many requests")) return t.errors.rateLimited
  if (m.includes("network") || m.includes("failed to fetch") || m.includes("load failed")) return t.errors.network
  if (m.includes("invalid email") || m.includes("unable to validate email")) return t.errors.invalidEmail

  return t.errors.unexpected
}
