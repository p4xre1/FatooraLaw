import { useEffect, useRef } from "react"

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "wheel"] as const

/** Browser-side inactivity lock; not a replacement for server-side session expiry. */
export function useIdleLogout(active: boolean, timeoutMs: number, onIdle: () => void) {
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

  useEffect(() => {
    if (!active) return
    let deadline = Date.now() + timeoutMs
    let expired = false
    let timer: ReturnType<typeof setTimeout>

    function checkDeadline() {
      if (expired) return
      const remaining = deadline - Date.now()
      if (remaining <= 0) {
        expired = true
        clearTimeout(timer)
        onIdleRef.current()
      } else {
        clearTimeout(timer)
        timer = setTimeout(checkDeadline, remaining)
      }
    }

    function onActivity() {
      // A background tab's timers may be throttled. Never let the first
      // interaction after an already-expired deadline resurrect the session.
      if (expired) return
      if (Date.now() >= deadline) { checkDeadline(); return }
      deadline = Date.now() + timeoutMs
      checkDeadline()
    }

    checkDeadline()
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity, { passive: true }))
    // Hiding/showing a tab is not activity. Check elapsed wall-clock time.
    document.addEventListener("visibilitychange", checkDeadline)

    return () => {
      clearTimeout(timer)
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity))
      document.removeEventListener("visibilitychange", checkDeadline)
    }
  }, [active, timeoutMs])
}
