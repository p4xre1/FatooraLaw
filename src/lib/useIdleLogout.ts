import { useEffect, useRef } from "react"

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "wheel"] as const

/**
 * Signs the user out after `timeoutMs` of no interaction. Financial and
 * client data here lives entirely client-side with no re-auth step once
 * signed in, so an unattended, unlocked tab is a real exposure — this is
 * the mitigation for that, not a replacement for real session expiry on
 * a backend (this app doesn't have one).
 *
 * Only runs while `active` is true (i.e. while someone is actually signed
 * in) so it's a no-op on the public landing/login screens.
 */
export function useIdleLogout(active: boolean, timeoutMs: number, onIdle: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

  useEffect(() => {
    if (!active) return

    function reset() {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => onIdleRef.current(), timeoutMs)
    }

    reset()
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, reset, { passive: true }))
    document.addEventListener("visibilitychange", reset)

    return () => {
      if (timer.current) clearTimeout(timer.current)
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, reset))
      document.removeEventListener("visibilitychange", reset)
    }
  }, [active, timeoutMs])
}
