import { useCallback, useEffect, useRef, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { isSupabaseConfigured, supabase } from "../../lib/supabase"

export type AdminAuthStatus = "checking" | "unauthenticated" | "forbidden" | "authenticated"
export type AdminAccess = {
  status: AdminAuthStatus
  user: User | null
  isContentAdmin: boolean
  isPlatformAdmin: boolean
}

/** UI gate only; Postgres RLS is the actual access-control boundary. */
export function useAdminAuth() {
  const [state, setState] = useState<AdminAccess>({
    status: "checking",
    user: null,
    isContentAdmin: false,
    isPlatformAdmin: false,
  })
  const mounted = useRef(false)
  const revision = useRef(0)

  const verify = useCallback(async () => {
    const request = ++revision.current
    const isCurrent = () => mounted.current && request === revision.current
    if (!isSupabaseConfigured) {
      if (isCurrent()) setState({ status: "unauthenticated", user: null, isContentAdmin: false, isPlatformAdmin: false })
      return
    }
    setState({ status: "checking", user: null, isContentAdmin: false, isPlatformAdmin: false })
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (!isCurrent()) return
      if (authError || !auth.user) {
        setState({ status: "unauthenticated", user: null, isContentAdmin: false, isPlatformAdmin: false })
        return
      }

      // CMS editors and platform operators are separate roles. Each query is
      // scoped to the signed-in user's own row by RLS; the database still
      // enforces every operation on the data tables independently.
      const [profileResult, platformResult] = await Promise.all([
        supabase.from("profiles").select("is_admin").eq("id", auth.user.id).maybeSingle(),
        supabase.from("platform_admins").select("user_id").eq("user_id", auth.user.id).maybeSingle(),
      ])
      if (!isCurrent()) return
      const isContentAdmin = !profileResult.error && profileResult.data?.is_admin === true
      const isPlatformAdmin = !platformResult.error && platformResult.data?.user_id === auth.user.id
      setState({
        status: isContentAdmin || isPlatformAdmin ? "authenticated" : "forbidden",
        user: auth.user,
        isContentAdmin,
        isPlatformAdmin,
      })
    } catch {
      if (isCurrent()) setState({ status: "unauthenticated", user: null, isContentAdmin: false, isPlatformAdmin: false })
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    const pending = new Set<ReturnType<typeof setTimeout>>()
    void verify()
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted.current) return
      const request = ++revision.current
      if (event === "SIGNED_OUT") {
        setState({ status: "unauthenticated", user: null, isContentAdmin: false, isPlatformAdmin: false })
        return
      }
      setState({ status: "checking", user: null, isContentAdmin: false, isPlatformAdmin: false })
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
