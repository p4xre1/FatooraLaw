import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "../lib/supabase"
import { useMizan } from "../store/useMizan"
import type { Role } from "../store/types"

/**
 * Bridges Supabase Auth (real accounts, sessions, password recovery) with the
 * app's local Zustand store, which only tracks a lightweight profile
 * (name / email / role) for the demo dashboard and permissions.
 */
export function useSupabaseAuth() {
  const signIn = useMizan((s) => s.signIn)
  const signOut = useMizan((s) => s.signOut)
  const [ready, setReady] = useState(false)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      if (data.session) hydrate(data.session, { silent: true })
      setReady(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true)
        return
      }
      if (event === "SIGNED_IN" && session) {
        hydrate(session)
        return
      }
      if (event === "SIGNED_OUT") {
        signOut()
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function hydrate(session: Session, opts: { silent?: boolean } = {}) {
    const user = session.user
    if (!user?.email) return
    if (opts.silent && useMizan.getState().auth?.email === user.email) return
    const name = (user.user_metadata?.name as string) || user.email
    const role = (user.user_metadata?.role as Role) || "owner"
    signIn(name, user.email, role)
  }

  return {
    ready,
    recovery,
    clearRecovery: () => setRecovery(false),
  }
}
