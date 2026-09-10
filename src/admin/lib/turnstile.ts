import { useCallback, useEffect, useRef, useState } from "react"

const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim()

/** True only when a site key is configured — mirrors `isSupabaseConfigured`'s
 *  "degrade gracefully instead of hard-failing" pattern in src/lib/supabase.ts. */
export const isTurnstileConfigured = Boolean(TURNSTILE_SITE_KEY)

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js"
let scriptPromise: Promise<void> | null = null

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
  }
}

function loadTurnstileScript(): Promise<void> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve()
      return
    }
    const script = document.createElement("script")
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load Cloudflare Turnstile."))
    document.head.appendChild(script)
  })
  return scriptPromise
}

/**
 * Optional Cloudflare Turnstile integration for the admin login form.
 *
 * No-ops entirely — renders nothing, never loads the third-party script,
 * always returns a null token — unless `VITE_TURNSTILE_SITE_KEY` is set.
 * Get a site key from the Cloudflare dashboard, then enable "CAPTCHA
 * protection" with the matching secret key under Supabase Dashboard ->
 * Authentication -> Attack Protection. When both sides are configured,
 * Supabase verifies the token server-side before issuing a session — a
 * script that never renders (or never solves) the widget simply never
 * gets past `signInWithPassword`, regardless of what it sends here.
 *
 * If you enable this, also uncomment the Turnstile CSP lines in
 * public/_headers (script-src / frame-src for challenges.cloudflare.com).
 */
export function useTurnstile() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetId = useRef<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    if (!isTurnstileConfigured || !containerRef.current) return
    let cancelled = false

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (t: string) => setToken(t),
          "expired-callback": () => setToken(null),
          "error-callback": () => setToken(null),
        })
      })
      .catch(() => setToken(null))

    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
    }
  }, [])

  const reset = useCallback(() => {
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current)
    setToken(null)
  }, [])

  return { containerRef, token, reset, enabled: isTurnstileConfigured }
}
