import { isSupabaseConfigured } from "./supabase"
import { useMizan } from "../store/useMizan"

/**
 * Development-only local session.
 *
 * Accounts live in Supabase, so with no usable configuration
 * (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`) there is nothing to sign in
 * with — and inventing credentials is not an option. For local development we
 * therefore allow an explicitly labelled, opt-in local session that is backed
 * by the browser-local business store only: no Supabase account, no network
 * call, no elevated privilege.
 *
 * This can never reach a deployed site. `import.meta.env.DEV` is replaced with
 * `false` at build time, so `localDevModeEnabled()` is a constant `false` in
 * every production build, including `pnpm build` and the Cloudflare deploy.
 */

export const LOCAL_DEV_USER = {
  id: "local-dev",
  name: "Mode local",
  email: "local-dev@localhost",
  /** Full local workspace, not a role demo. */
  role: "owner" as const,
}

/** Opt-in marker, stored per tab so it disappears when the tab closes. */
const FLAG = "mizan.dev-local-session"

export function localDevModeEnabled(): boolean {
  return import.meta.env.DEV && !isSupabaseConfigured
}

function storage(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage
  } catch {
    // Storage can be blocked by the browser (private mode, partitioning).
    return null
  }
}

export function rememberLocalDevSession(): void {
  try {
    storage()?.setItem(FLAG, "1")
  } catch {
    // Not fatal: the session simply will not survive a reload.
  }
}

export function forgetLocalDevSession(): void {
  try {
    storage()?.removeItem(FLAG)
  } catch {
    // Nothing to clear.
  }
}

/**
 * Starts the local session. Returns false (without touching any state) unless
 * this really is a dev build with no usable Supabase configuration, so even a
 * stray call in a production bundle stays inert.
 */
export function signInLocally(): boolean {
  if (!localDevModeEnabled()) return false
  rememberLocalDevSession()
  useMizan.getState().signIn(LOCAL_DEV_USER.name, LOCAL_DEV_USER.email, LOCAL_DEV_USER.role, LOCAL_DEV_USER.id)
  return true
}

/**
 * True only after the developer opted in *and* the build is a dev build with
 * no usable Supabase configuration — checking both here means a stale flag can
 * never sign anyone in on a production site.
 */
export function localDevSessionRequested(): boolean {
  if (!localDevModeEnabled()) return false
  try {
    return storage()?.getItem(FLAG) === "1"
  } catch {
    return false
  }
}
