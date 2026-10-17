import { AUTH_PATHS } from "../../../lib/routes"
import { isSupabaseConfigured, supabase, supabaseConfig } from "../../../lib/supabase"

/**
 * Google sign-in through Supabase's hosted OAuth flow.
 *
 * The browser is sent to Google by Supabase and comes back to `/login` with
 * either a session in the URL (implicit flow, the client's default) or an
 * OAuth error. `supabase.auth` is created with `detectSessionInUrl: true`
 * (src/lib/supabase.ts), so the session in the URL is picked up before the
 * login screen renders and `useSupabaseAuth` takes over from there. This
 * module therefore only has to start the flow and translate the errors an
 * operator or visitor can actually act on.
 *
 * Provider credentials are deliberately NOT part of the browser bundle: the
 * Google client ID/secret live in the Supabase project (Authentication →
 * Providers → Google). See docs/GOOGLE_AUTH.md for the dashboard steps.
 */

export type GoogleSignInErrorCode =
  | "notConfigured"
  | "providerNotEnabled"
  | "redirectNotAllowed"
  | "cancelled"
  | "network"
  | "unexpected"

export type GoogleSignInResult = {
  error: GoogleSignInErrorCode | null
}

/** `/login` is where Supabase sends the browser back with the Google result. */
export function googleRedirectTo(): string {
  if (typeof window === "undefined") return AUTH_PATHS.login
  return `${window.location.origin}${AUTH_PATHS.login}`
}

/** True when a hosted Supabase project is available to run the OAuth flow. */
export function isGoogleSignInAvailable(): boolean {
  return isSupabaseConfigured
}

/**
 * Maps the English messages GoTrue returns (or puts on the callback URL) to a
 * small, translatable set. Raw provider text is never shown to a visitor.
 */
export function mapGoogleSignInError(message: string): GoogleSignInErrorCode {
  const m = message.toLowerCase()
  if (m.includes("provider is not enabled") || m.includes("unsupported provider")) return "providerNotEnabled"
  if (m.includes("redirect") && (m.includes("not allowed") || m.includes("invalid") || m.includes("not permitted"))) {
    return "redirectNotAllowed"
  }
  if (m.includes("access_denied") || m.includes("cancelled") || m.includes("canceled")) return "cancelled"
  if (m.includes("network") || m.includes("failed to fetch") || m.includes("load failed")) return "network"
  return "unexpected"
}

/**
 * Best-effort read of the project's public auth settings, so a disabled
 * provider is explained on our screen instead of sending the visitor to a raw
 * Supabase JSON error page. `null` means "could not tell" (offline, unexpected
 * response): the caller should still attempt the redirect.
 */
export async function isGoogleProviderEnabled(): Promise<boolean | null> {
  if (!isSupabaseConfigured) return false
  try {
    const response = await fetch(`${supabaseConfig.url}/auth/v1/settings`, {
      headers: { apikey: supabaseConfig.anonKey },
      cache: "no-store",
    })
    if (!response.ok) return null
    const settings: unknown = await response.json()
    const external = settings !== null && typeof settings === "object"
      ? (settings as { external?: unknown }).external
      : null
    if (external === null || typeof external !== "object") return null
    const google = (external as Record<string, unknown>).google
    return typeof google === "boolean" ? google : null
  } catch {
    return null
  }
}

/**
 * Starts the hosted Google OAuth flow. On success the browser navigates to
 * Google and then back to `/login`; the promise's success value only matters
 * in environments where navigation is stubbed (tests).
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (!isSupabaseConfigured) return { error: "notConfigured" }
  try {
    if (await isGoogleProviderEnabled() === false) return { error: "providerNotEnabled" }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: googleRedirectTo(),
        // Always show the account chooser: a shared computer must not silently
        // reuse the previous Google account.
        queryParams: { prompt: "select_account" },
      },
    })
    return { error: error ? mapGoogleSignInError(error.message) : null }
  } catch {
    return { error: "network" }
  }
}

/**
 * Reads an OAuth error left on the callback URL (`#error=access_denied…` for
 * the implicit flow, `?error=…` when PKCE is enabled). Returns null when the
 * URL is not an error callback.
 */
export function readGoogleSignInError(): GoogleSignInErrorCode | null {
  if (typeof window === "undefined") return null
  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))
  const code = search.get("error") ?? hash.get("error")
  const description = search.get("error_description") ?? hash.get("error_description") ?? ""
  if (!code && !description) return null
  return mapGoogleSignInError(`${code ?? ""} ${description}`)
}

/**
 * Drops the OAuth error from the address bar so a reload does not replay it.
 * Unrelated query/hash parameters are preserved.
 */
export function clearGoogleSignInError(): void {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""))
  for (const params of [url.searchParams, hash]) {
    for (const key of ["error", "error_code", "error_description", "error_uri"]) params.delete(key)
  }
  const hashString = hash.toString()
  const next = `${url.pathname}${url.search}${hashString ? `#${hashString}` : ""}`
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (next === current) return
  try {
    window.history.replaceState(window.history.state, "", next)
  } catch {
    // Sandboxed iframes can refuse history writes; leaving the error in the
    // URL is harmless — the screen has already shown the message.
  }
}
