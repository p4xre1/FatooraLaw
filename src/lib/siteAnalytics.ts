import { useEffect } from "react"
import type { LocaleId } from "./locales"
import { readCookieConsent, COOKIE_CONSENT_EVENT, COOKIE_CONSENT_KEY } from "./cookieConsent"
import { supabase } from "./supabase"

/**
 * First-party, consent-gated page-view tracking. Only a canonical path, locale,
 * referring hostname and server timestamp are recorded—never an IP, account ID,
 * user agent, cookie, or persistent/session visitor identifier.
 */
export function recordSiteEvent(eventType: "download_click" | "purchase_click", path: string, target: string, locale: LocaleId): void {
  if (typeof window === "undefined" || readCookieConsent() !== "accepted") return
  const cleanPath = path.split(/[?#]/, 1)[0]
  if (!cleanPath.startsWith("/") || cleanPath.startsWith("/admin/") || cleanPath === "/admin") return
  let referrerHost = ""
  try { referrerHost = document.referrer ? new URL(document.referrer).hostname.slice(0, 255) : "" } catch { referrerHost = "" }
  void supabase.rpc("record_site_event", {
    p_event_type: eventType,
    p_path: cleanPath.slice(0, 240),
    p_target: target.slice(0, 240),
    p_locale: locale,
    p_referrer_host: referrerHost,
  }).then(({ error }) => { if (error) console.warn("Site interaction was not recorded.") }, () => {})
}

export function useSiteVisitTracking(path: string, locale: LocaleId): void {
  useEffect(() => {
    let cancelled = false
    let sent = false

    async function trackIfConsented() {
      if (sent || readCookieConsent() !== "accepted") return
      const cleanPath = path.split(/[?#]/, 1)[0]
      if (!cleanPath.startsWith("/") || cleanPath.startsWith("/admin/") || cleanPath === "/admin") return
      sent = true
      try {
        if (cancelled) return
        let referrerHost = ""
        try { referrerHost = document.referrer ? new URL(document.referrer).hostname.slice(0, 255) : "" } catch { referrerHost = "" }
        const { error } = await supabase.rpc("record_site_page_view", {
          p_path: cleanPath.slice(0, 240),
          p_locale: locale,
          p_referrer_host: referrerHost,
        })
        if (error) console.warn("Page-view event was not recorded.")
      } catch {
        // Tracking is optional. A network or schema failure must never block navigation.
      }
    }

    function onConsent(event: Event) {
      if ((event as CustomEvent).detail === "accepted") void trackIfConsented()
    }
    function onStorage(event: StorageEvent) {
      if (event.key === COOKIE_CONSENT_KEY || event.key === null) void trackIfConsented()
    }

    void trackIfConsented()
    window.addEventListener(COOKIE_CONSENT_EVENT, onConsent)
    window.addEventListener("storage", onStorage)
    return () => {
      cancelled = true
      window.removeEventListener(COOKIE_CONSENT_EVENT, onConsent)
      window.removeEventListener("storage", onStorage)
    }
  }, [path, locale])
}
