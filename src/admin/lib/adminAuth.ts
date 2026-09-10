import { useCallback, useEffect, useRef, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { isSupabaseConfigured, supabase } from "../../lib/supabase"

export type AdminAuthStatus = "checking" | "unauthenticated" | "forbidden" | "authenticated"

type AdminAuthState = {
  status: AdminAuthStatus
  user: User | null
}

/**
 * Verifies — and keeps re-verifying — that the current browser holds a
 * real, admin-flagged Supabase session. Backs `ProtectedRoute`; see that
 * file for why this hook is defense-in-depth and not the actual security
 * boundary (that's Postgres RLS via `public.is_admin()`).
 *
 * Two things make this more rigorous than a typical "is someone logged
 * in?" client check:
 *
 * 1. It calls `supabase.auth.getUser()`, not `getSession()`. The session
 *    object cached in localStorage is only ever *decoded* locally on the
 *    client; `getUser()` round-trips to Supabase's Auth server and
 *    verifies the JWT's signature there. A tampered or stale local
 *    session (or one replayed from another machine after being revoked)
 *    fails this check even though `getSession()` would happily return it.
 * 2. Admin status is re-checked, not cached indefinitely: on every auth
 *    state change AND whenever the tab regains focus. If an admin's
 *    `profiles.is_admin` flag is revoked mid-session, a tab left open in
 *    the background loses access the next time it's looked at, instead
 *    of keeping CMS UI rendered for the rest of the day.
 */
export function useAdminAuth() {
  const [state, setState] = useState<AdminAuthState>({ status: "checking", user: null })
  const mounted = useRef(true)

  const verify = useCallback(async () => {
    if (!isSupabaseConfigured) {
      if (mounted.current) setState({ status: "unauthenticated", user: null })
      return
    }

    const { data, error } = await supabase.auth.getUser()
    if (!mounted.current) return
    if (error || !data.user) {
      setState({ status: "unauthenticated", user: null })
      return
    }

    // profiles_select_own (supabase/schema.sql) already lets a user read
    // their own row — no policy change needed for this query to work.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", data.user.id)
      .single()

    if (!mounted.current) return
    if (profileError || !profile?.is_admin) {
      setState({ status: "forbidden", user: data.user })
      return
    }

    setState({ status: "authenticated", user: data.user })
  }, [])

  useEffect(() => {
    mounted.current = true
    void verify()

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void verify()
    })

    function onVisibilityChange() {
      if (document.visibilityState === "visible") void verify()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      mounted.current = false
      sub.subscription.unsubscribe()
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [verify])

  return {
    ...state,
    signOut: () => supabase.auth.signOut(),
  }
}
