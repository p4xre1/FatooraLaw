import { useEffect, useRef, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { isSupabaseConfigured, supabase } from "../lib/supabase"
import { useMizan } from "../store/useMizan"
import type { Role } from "../store/types"

const ROLES: readonly Role[] = ["owner", "accountant", "supervisor", "assistant"]
const trustedRole = (value: unknown): Role => ROLES.includes(value as Role) ? value as Role : "assistant"

/** Supabase owns the session; the local dashboard only caches business records. */
export function useSupabaseAuth() {
  const signIn = useMizan((s) => s.signIn)
  const signOut = useMizan((s) => s.signOut)
  const [ready, setReady] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const revision = useRef(0)

  useEffect(() => {
    let mounted = true
    const pending = new Set<ReturnType<typeof setTimeout>>()
    const isCurrent = (request: number) => mounted && request === revision.current

    function clearSession(request: number) {
      if (!isCurrent(request)) return
      signOut()
      setReady(true)
    }

    async function hydrate(session: Session | null, request: number) {
      if (!isCurrent(request)) return
      if (!session?.user?.email) { clearSession(request); return }
      try {
        // user_metadata is editable by the user. It may supply display text,
        // but NEVER permissions. profiles.role is protected server-side.
        const { data: profile, error } = await supabase.from("profiles")
          .select("name, role").eq("id", session.user.id).maybeSingle()
        if (!isCurrent(request)) return
        if (error || !profile) { clearSession(request); return }
        const name = typeof profile.name === "string" && profile.name.trim() ? profile.name : session.user.email
        signIn(name, session.user.email, trustedRole(profile.role), session.user.id)
        setReady(true)
      } catch {
        clearSession(request)
      }
    }

    const initialRequest = ++revision.current
    if (!isSupabaseConfigured) {
      clearSession(initialRequest)
      return () => { mounted = false; revision.current++ }
    }

    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) clearSession(initialRequest)
        else return hydrate(data.session, initialRequest)
      })
      .catch(() => clearSession(initialRequest))

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      const request = ++revision.current
      if (event === "SIGNED_OUT") {
        setRecovery(false)
        clearSession(request)
        return
      }
      if (session?.user.id !== useMizan.getState().auth?.id) {
        // Hide the previous account's records immediately, not after the
        // next account's profile request has finished.
        signOut()
        setReady(false)
      }
      if (event === "PASSWORD_RECOVERY") setRecovery(true)
      // Defer Supabase calls until its auth callback has released the auth
      // client's lock. A newer event/logout invalidates this pending work.
      const timer = setTimeout(() => {
        pending.delete(timer)
        void hydrate(session, request)
      }, 0)
      pending.add(timer)
    })

    return () => {
      mounted = false
      revision.current++
      pending.forEach(clearTimeout)
      sub.subscription.unsubscribe()
    }
  }, [signIn, signOut])

  return {
    ready,
    recovery,
    clearRecovery: () => setRecovery(false),
    logout: async () => {
      revision.current++
      signOut() // Lock the local UI immediately, even offline / without config.
      setReady(true)
      setRecovery(false)
      try {
        if (isSupabaseConfigured) {
          const { error } = await supabase.auth.signOut({ scope: "local" })
          if (error) console.warn("Supabase sign-out could not be confirmed; the local dashboard was locked.")
        }
      } catch {
        console.warn("Supabase sign-out could not be confirmed; the local dashboard was locked.")
      } finally {
        revision.current++
        signOut()
      }
    },
  }
}
