import { useCallback, useEffect, useRef, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { isSupabaseConfigured, supabase } from "../../lib/supabase"

export type AdminAuthStatus = "checking" | "unauthenticated" | "forbidden" | "authenticated"
type AdminAuthState = { status: AdminAuthStatus; user: User | null }

/** UI gate only; protected profiles and posts RLS enforce actual CMS privileges. */
export function useAdminAuth() {
  const [state, setState] = useState<AdminAuthState>({ status: "checking", user: null })
  const mounted = useRef(false)
  const revision = useRef(0)

  const verify = useCallback(async () => {
    const request = ++revision.current
    const isCurrent = () => mounted.current && request === revision.current
    if (!isSupabaseConfigured) {
      if (isCurrent()) setState({ status: "unauthenticated", user: null })
      return
    }
    // Don't leave a previously verified user's CMS visible while checking
    // a new session or a potentially revoked admin flag.
    setState({ status: "checking", user: null })
    try {
      const { data, error } = await supabase.auth.getUser()
      if (!isCurrent()) return
      if (error || !data.user) {
        setState({ status: "unauthenticated", user: null })
        return
      }
      const { data: profile, error: profileError } = await supabase.from("profiles")
        .select("is_admin").eq("id", data.user.id).single()
      if (!isCurrent()) return
      setState({ status: !profileError && profile?.is_admin === true ? "authenticated" : "forbidden", user: data.user })
    } catch {
      if (isCurrent()) setState({ status: "unauthenticated", user: null })
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    const pending = new Set<ReturnType<typeof setTimeout>>()
    void verify()
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted.current) return
      const request = ++revision.current // Invalidate work before deferred verification.
      if (event === "SIGNED_OUT") {
        setState({ status: "unauthenticated", user: null })
        return
      }
      setState({ status: "checking", user: null })
      const timer = setTimeout(() => {
        pending.delete(timer)
        if (mounted.current && request === revision.current) void verify()
      }, 0)
      pending.add(timer)
    })
    function onVisibilityChange() {
      if (document.visibilityState === "visible") void verify()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      mounted.current = false
      revision.current++
      pending.forEach(clearTimeout)
      sub.subscription.unsubscribe()
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [verify])

  return { ...state, signOut: () => supabase.auth.signOut({ scope: "local" }) }
}
